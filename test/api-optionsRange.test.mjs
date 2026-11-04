import assert from 'assert'
import fs from 'fs'
import net from 'net'
import w from 'wsemi'
import u8arr2obj from 'wsemi/src/u8arr2obj.mjs'
import WConverhpServer from '../src/WConverhpServer.mjs'
import WConverhpClient from '../src/WConverhpClient.mjs'
import wPorts from './tools/ports.mjs'

let { portOf, reserved } = wPorts

//listenOrigOfFile, net.Server.prototype.listen 之原值: 「port 超出 TCP 值域取預設 8080」一案暫時攔截它(見該案);
//另於 after 還原, 涵蓋該案因 ready 永不 resolve 而逾時、finally 未執行之路徑, 不讓攔截殘留到同一 worker 之後續檔
let listenOrigOfFile = net.Server.prototype.listen


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

    let port = portOf('api-optionsRange')
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

        await wsv.ready //待伺服器就緒(ready)

    })

    after(function() {
        net.Server.prototype.listen = listenOrigOfFile //還原 70000 案之暫時攔截(正常路徑已於該案 finally 還原, 此處為逾時路徑之保險)
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
            port: portOf('api-optionsRange', 1),
            apiName: 'api',
            useInert: false,
            pathUploadTemp: './test/_tmp/uploadTemp-api-optionsRange2',
            sizeSlice: Number.MAX_SAFE_INTEGER + 1,
            sizeMsg: Number.MAX_SAFE_INTEGER + 1,
            verifyConn: async() => true,
        })
        wsv2.on('error', (e) => errs2.push(String(e)))
        wsv2.on('handler', () => {})
        wsv2.on('upload', (input, pm) => pm.resolve(input)) //第十二輪: check-total-hash 受理前須有 upload 接聽者, 本案以其回應之 sizeSlice 驗選項取值
        await wsv2.ready //待伺服器就緒(ready), 其 resolve 時建構期事件必已派發完畢
        assert.strict.deepEqual(errs2, [])
        let r = await fetch(`http://127.0.0.1:${portOf('api-optionsRange', 1)}/api/ulctr`, {
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

    it('伺服器 port 超出 TCP 值域時須取預設 8080(以 listen 實際被要求之埠為判準; 實際監聽改到作業系統配發之埠, 不佔 8080)', async function() {
        this.timeout(20000)
        //port 給 70000: 修正前述詞放行而 hapi 於 server.start 時失敗; 修正後取預設 8080。
        //
        //why 不在 8080 上實綁再 fetch(ch309, 規格 E8): 8080 是套件預設值,不是本檔可配發之埠 —— 他套件(w-web-sso、w-pubsub、w-serv-broadcast)的服務常在其上;
        //Windows 允許占用者以 127.0.0.1 與我們並存綁定而不報錯,實綁後 fetch 127.0.0.1:8080 會連到對方(被測碼打到別人的服務),
        //舊版只能以「有無 EADDRINUSE」分流,而該分流擋不住這種並存綁定。
        //改為攔截 net.Server.prototype.listen: 記下 hapi 被要求監聽的埠(判準=「取到了預設值」),並把實際監聽改到作業系統配發之埠(0)。
        //攔截只在本案的建構與 ready 期間有效,finally 還原; mocha 同一行程內案例循序執行,不會波及他案
        let listenAsked = [] //hapi 要求 listen 的埠
        let listenActual = [] //實際監聽的埠(作業系統配發)
        let listenOrig = listenOrigOfFile
        net.Server.prototype.listen = function(...a) {
            if (typeof a[0] === 'number') {
                listenAsked.push(a[0])
                a[0] = 0
                this.once('listening', () => {
                    listenActual.push(this.address().port)
                })
            }
            return listenOrig.apply(this, a)
        }
        let errs3 = []
        let wsv3 = null
        try {
            assert.doesNotThrow(() => {
                wsv3 = new WConverhpServer({
                    port: reserved.invalid,
                    apiName: 'api',
                    useInert: false,
                    pathUploadTemp: './test/_tmp/uploadTemp-api-optionsRange3',
                    verifyConn: async() => true,
                })
                wsv3.on('error', (e) => errs3.push(String(e)))
                wsv3.on('handler', () => {})
                wsv3.on('upload', (input, pm) => pm.resolve(input)) //第十二輪: check-total-hash 受理前須有 upload 接聽者, 本案以其回應之 sizeSlice 驗是否為本測試之伺服器
            })
            await wsv3.ready //待伺服器就緒(ready): start 完成,建構期事件必已派發完畢
        }
        finally {
            net.Server.prototype.listen = listenOrig
        }

        try {
            //取到了預設值: hapi 被要求監聽的恰為 8080(而非值域外的 70000, 也不是別的值); 實際監聽在作業系統配發之埠, 不會埠占用
            assert.strict.deepEqual(errs3, [], `不得有 error 事件: ${errs3.join('|')}`)
            assert.strict.deepEqual(listenAsked, [reserved.packageDefault], 'port 非法時須取預設 8080')

            //改道有效: 實際監聽之埠不是 8080(本案從未碰 8080), 且確為本測試所起之伺服器
            assert.strict.deepEqual(listenActual.length, 1)
            assert.strict.deepEqual(listenActual[0] !== reserved.packageDefault, true, '實際監聽不得在 8080')
            let rDef = await fetch(`http://127.0.0.1:${listenActual[0]}/api/ulctr`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer t', 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: 'check-total-hash', fileHash: 'ffffffffffffffff', filename: 'a.bin', fileSize: 1 }),
                signal: AbortSignal.timeout(3000),
            })
            assert.strict.deepEqual(rDef.status, 200, '伺服器須可服務')
            let oDef = u8arr2obj(new Uint8Array(await rDef.arrayBuffer()))
            assert.strict.deepEqual(oDef.success.sizeSlice, 1024 * 1024, '須為本測試所起之伺服器')
        }
        finally {
            wsv3.stop() //任一斷言失敗也要停掉, 不洩漏監聽
            try {
                fs.rmSync('./test/_tmp/uploadTemp-api-optionsRange3', { recursive: true, force: true })
            }
            catch (err) {}
        }
    })

})
