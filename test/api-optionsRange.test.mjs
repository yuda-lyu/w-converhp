import assert from 'assert'
import fs from 'fs'
import w from 'wsemi'
import u8arr2obj from 'wsemi/src/u8arr2obj.mjs'
import WConverhpServer from '../src/WConverhpServer.mjs'
import WConverhpClient from '../src/WConverhpClient.mjs'


/**
 * api: 兩端之整數選項對非有限值(Infinity)須視為無效取預設
 *
 * 修正前以 wsemi 之 ispint/isp0int 檢核, 兩者對 Infinity 皆回 true:
 *   - client timeout: Infinity → axios 於請求送出前即拋 error trying to parse config.timeout to int, 伺服器 0 次呼叫(每個請求都失敗)
 *   - client retryMain/retryUpload/retryDownload: Infinity → 重試迴圈之終止條件 n > retry 永不成立
 *   - client sizeSlice: Infinity → 切片數算成 0
 *   - server sizeSlice/sizeMsg: Infinity → hapi 拒絕 payload.maxBytes 為 Infinity, 伺服器啟動失敗; server port: Infinity → 建構即拋錯; server delayForSlice: Infinity → cint 後 setTimeout 溢位成 1ms
 * retryUpload 之 Infinity 與其餘二者走同一述詞與同一重試迴圈, 因其預設 10 次之退避逾 6 分鐘, 不於此以 api 驗證, 由 test/unit-intSafe 之述詞測試涵蓋; server port 為避免綁定預設 8080 亦僅由述詞測試涵蓋
 *
 * 第二輪修正另補「有限但超出安全整數範圍」與「超出各 sink 值域上限」兩類:
 *   - Number.MAX_SAFE_INTEGER+1 交給 hapi 之 payload.maxBytes 會以「must be a safe number」於伺服器建構時同步拋錯
 *   - 2^31 交給計時器會溢位: server delayForSlice 變成 1ms 而失去節流作用, client timeout 則於 20ms 即以「timeout of 2147483648ms exceeded」拒絕(預期為 24.9 日)
 */
describe('api-optionsRange', function() {

    let port = 8216 //同時test故得要不同port
    let pathUploadTemp = './test/_tmp/uploadTemp-api-optionsRange'
    let wsv = null

    //errs, 伺服器 error 事件
    let errs = []

    //nExec, nDownload
    let nExec = {}
    let nDownload = 0

    before(async function() {

        //伺服器三個整數選項皆給 Infinity, 須取預設而非啟動失敗
        wsv = new WConverhpServer({
            port,
            apiName: 'api',
            useInert: false,
            pathUploadTemp,
            sizeSlice: Infinity,
            sizeMsg: Infinity,
            delayForSlice: Infinity,
            verifyConn: async({ authorization }) => {
                return w.isestr(w.strdelleft(authorization, 7))
            },
        })
        wsv.on('execute', (func, input, pm) => {
            nExec[func] = (nExec[func] || 0) + 1
            if (func === 'add') {
                pm.resolve(input.a + input.b)
                return
            }
            pm.reject('app rejected')
        })
        wsv.on('upload', (input, pm) => {
            pm.resolve({ n: fs.statSync(input.path).size })
        })
        wsv.on('download', (input, pm) => {
            nDownload += 1
            pm.reject('invalid fileId')
        })
        wsv.on('error', (e) => errs.push(String(e)))
        wsv.on('handler', () => {})

        await w.delay(1000) //待伺服器啟動

    })

    after(function() {
        wsv.stop()
        try {
            fs.rmSync(pathUploadTemp, { recursive: true, force: true })
        }
        catch (err) {}
    })

    //mkClient
    let mkClient = (o = {}) => {
        let wo = new WConverhpClient({ url: `http://127.0.0.1:${port}`, apiName: 'api', getToken: () => 'token-for-test', retryMain: 0, retryUpload: 0, retryDownload: 0, ...o })
        wo.on('error', () => {})
        return wo
    }

    it('伺服器 sizeSlice/sizeMsg/delayForSlice 為 Infinity 時須取預設而正常啟動(修正前 hapi 拒絕 maxBytes 為 Infinity, 伺服器起不來), check-total-hash 回傳之 sizeSlice 須為預設 1MB', async function() {
        this.timeout(20000)
        assert.strict.deepEqual(errs, [])
        let r = await fetch(`http://127.0.0.1:${port}/api/ulctr`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer t', 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: 'check-total-hash', fileHash: 'ffffffffffffffff', filename: 'a.bin', fileSize: 1 }),
            signal: AbortSignal.timeout(3000),
        })
        assert.strict.deepEqual(r.status, 200)
        let o = u8arr2obj(new Uint8Array(await r.arrayBuffer()))
        assert.strict.deepEqual(o.success.sizeSlice, 1024 * 1024)
    })

    it('client timeout 為 Infinity 時須取預設, 請求須能完成(修正前 axios 於送出前即拋錯, 伺服器 0 次呼叫)', async function() {
        this.timeout(20000)
        nExec.add = 0
        let r = await mkClient({ timeout: Infinity }).execute('add', { a: 1, b: 2 }, () => {})
        assert.strict.deepEqual(r, 3)
        assert.strict.deepEqual(nExec.add, 1)
    })

    it('client retryMain 為 Infinity 時須取預設 3: 應用端一律拒絕時共呼叫 4 次後 reject(修正前次數終止條件永不成立)', async function() {
        this.timeout(40000)
        nExec.fail = 0
        let t0 = Date.now()
        let r = await Promise.race([
            mkClient({ retryMain: Infinity }).execute('fail', {}, () => {}).then((msg) => ({ state: 'resolve', msg })).catch((msg) => ({ state: 'reject', msg })),
            w.delay(30000).then(() => ({ state: 'pending' })),
        ])
        assert.strict.deepEqual(r, { state: 'reject', msg: 'app rejected' }, `${Date.now() - t0}ms`)
        assert.strict.deepEqual(nExec.fail, 4) //1 + 預設 3 次重試
    })

    it('client retryDownload 為 Infinity 時須取預設 2: 共呼叫 3 次後 reject', async function() {
        this.timeout(40000)
        nDownload = 0
        let r = await Promise.race([
            mkClient({ retryDownload: Infinity }).download('any', () => {}, { fdDownload: './test/_tmp/download-api-optionsRange' }).then((msg) => ({ state: 'resolve', msg })).catch((msg) => ({ state: 'reject', msg })),
            w.delay(30000).then(() => ({ state: 'pending' })),
        ])
        assert.strict.deepEqual(r, { state: 'reject', msg: 'can not get file from fileId' })
        assert.strict.deepEqual(nDownload, 3) //1 + 預設 2 次重試
    })

    it('client sizeSlice 為 Infinity 時須取預設 1MB: 上傳須成功且應用端收到完整檔案(修正前切片數算成 0 而失敗)', async function() {
        this.timeout(30000)
        let n = 200 * 1024
        let r = await mkClient({ sizeSlice: Infinity }).upload('a.bin', new Uint8Array(n).fill(5), () => {})
        assert.strict.deepEqual(r, { n })
    })

    it('client timeout 為超出計時器上限之 2^31 時須取預設, 請求須能完成(修正前計時器溢位, 20ms 即以 timeout of 2147483648ms exceeded 拒絕)', async function() {
        this.timeout(20000)
        //分辨點為「請求成功且伺服器確實被呼叫」: 修正前計時器溢位使 axios 立即以 timeout of 2147483648ms exceeded 拒絕,
        //retryMain 為 0 故直接 reject 且伺服器 0 次呼叫. 不以耗時為判準(localhost 正常成功亦僅數毫秒, 快慢分不出成敗)
        nExec.add = 0
        let r = await mkClient({ timeout: 2 ** 31 }).execute('add', { a: 4, b: 5 }, () => {})
            .then((msg) => ({ state: 'resolve', msg }))
            .catch((msg) => ({ state: 'reject', msg: String(msg) }))
        assert.strict.deepEqual(r, { state: 'resolve', msg: 9 })
        assert.strict.deepEqual(nExec.add, 1)
    })

    it('client timeout 為超出安全整數範圍之值時須取預設, 請求須能完成', async function() {
        this.timeout(20000)
        nExec.add = 0
        let r = await mkClient({ timeout: Number.MAX_SAFE_INTEGER + 1 }).execute('add', { a: 6, b: 7 }, () => {})
        assert.strict.deepEqual(r, 13)
        assert.strict.deepEqual(nExec.add, 1)
    })

    it('伺服器 sizeSlice/sizeMsg 為超出安全整數範圍之值時須取預設而正常啟動(修正前 hapi 以 must be a safe number 於建構時同步拋錯)', async function() {
        this.timeout(20000)
        let errs2 = []
        let wsv2 = new WConverhpServer({
            port: 8220,
            apiName: 'api',
            useInert: false,
            pathUploadTemp: './test/_tmp/uploadTemp-api-optionsRange2',
            sizeSlice: Number.MAX_SAFE_INTEGER + 1,
            sizeMsg: Number.MAX_SAFE_INTEGER + 1,
            verifyConn: async() => true,
        })
        wsv2.on('error', (e) => errs2.push(String(e)))
        wsv2.on('handler', () => {})
        await w.delay(1200)
        assert.strict.deepEqual(errs2, [])
        let r = await fetch(`http://127.0.0.1:8220/api/ulctr`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer t', 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: 'check-total-hash', fileHash: 'ffffffffffffffff', filename: 'a.bin', fileSize: 1 }),
            signal: AbortSignal.timeout(3000),
        })
        assert.strict.deepEqual(r.status, 200)
        let o = u8arr2obj(new Uint8Array(await r.arrayBuffer()))
        assert.strict.deepEqual(o.success.sizeSlice, 1024 * 1024)
        wsv2.stop()
        try {
            fs.rmSync('./test/_tmp/uploadTemp-api-optionsRange2', { recursive: true, force: true })
        }
        catch (err) {}
    })

    it('伺服器 port 超出 TCP 值域時須取預設 8080(以建構不拋錯且不發 error 事件為判準)', async function() {
        this.timeout(20000)
        //port 給 70000: 修正前述詞放行而 hapi 於 server.start 時失敗; 修正後取預設 8080,
        //但 8080 可能已被其他行程占用, 故僅斷言「建構不拋錯」與「若有 error 事件則為埠占用而非值域錯誤」
        let errs3 = []
        let wsv3 = null
        assert.doesNotThrow(() => {
            wsv3 = new WConverhpServer({
                port: 70000,
                apiName: 'api',
                useInert: false,
                pathUploadTemp: './test/_tmp/uploadTemp-api-optionsRange3',
                verifyConn: async() => true,
            })
            wsv3.on('error', (e) => errs3.push(String(e)))
            wsv3.on('handler', () => {})
        })
        await w.delay(1200)
        for (let e of errs3) {
            assert.strict.deepEqual(e.includes('EADDRINUSE') || e.includes('address already in use'), true, `error 事件須僅可能為埠占用, 實得: ${e}`)
        }
        wsv3.stop()
        try {
            fs.rmSync('./test/_tmp/uploadTemp-api-optionsRange3', { recursive: true, force: true })
        }
        catch (err) {}
    })

})
