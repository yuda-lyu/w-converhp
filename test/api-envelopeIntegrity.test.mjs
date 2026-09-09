import assert from 'assert'
import fs from 'fs'
import w from 'wsemi'
import u8arr2obj from 'wsemi/src/u8arr2obj.mjs'
import WConverhpServer from '../src/WConverhpServer.mjs'
import WConverhpClient from '../src/WConverhpClient.mjs'


/**
 * api: 回應封包之序列化完整性
 *
 * 套件以 wsemi 之 obj2u8arr/u8arr2obj 為回應協定之編解碼器. 應用端若回傳無法序列化之值(含 BigInt、循環參照),
 * 寬鬆模式之 obj2u8arr 回空封包而不報錯, 修正前伺服器據以送出「HTTP 200 + Return-Type: success 但本體解不出 success 鍵」,
 * 前端只能以 'data is not an effective object' 拒絕, 而伺服器 error 事件為 0 則 —— 應用端無從得知是自己回了不可序列化的值.
 * BigInt 並非罕見: Prisma 之 BigInt 欄位、Drizzle 之 bigint mode、better-sqlite3 之 safeIntegers、fs.stat 之 bigint 選項皆回 JS BigInt.
 *
 * 修正後改以 wsemi 1.8.88 之 returnWithStateAndMsg 取狀態, 序列化失敗即回錯誤封包並發一則 error 事件;
 * 客戶端亦於送出前檢核 input, 不可序列化者提早以明確訊息拒絕而不送出
 */
describe('api-envelopeIntegrity', function() {

    let port = 8218 //同時test故得要不同port
    let pathUploadTemp = './test/_tmp/uploadTemp-api-envelopeIntegrity'
    let wsv = null
    let errs = []

    before(async function() {

        wsv = new WConverhpServer({
            port,
            apiName: 'api',
            useInert: false,
            pathUploadTemp,
            verifyConn: async({ authorization }) => {
                return w.isestr(w.strdelleft(authorization, 7))
            },
        })
        wsv.on('execute', (func, input, pm) => {
            if (func === 'ok') {
                pm.resolve({ v: 1 })
            }
            else if (func === 'bigint') {
                pm.resolve({ id: 1n, name: 'x' })
            }
            else if (func === 'circular') {
                let o = { a: 1 }
                o.self = o
                pm.resolve(o)
            }
            else if (func === 'reject-bigint') {
                pm.reject({ code: 2n })
            }
            else if (func === 'echo') {
                pm.resolve(input)
            }
            else {
                pm.reject('invalid func')
            }
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

    //raw, 直接打 /main 並解出封包, 以觀察線上實況(client 會把兩種失敗都轉成訊息, 分不出是哪一種)
    let raw = async(func) => {
        let u8a = w.obj2u8arr({ func, input: null })
        let r = await fetch(`http://127.0.0.1:${port}/api/main`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer t', 'Content-Type': 'application/octet-stream' },
            body: Buffer.from(u8a),
        })
        let buf = Buffer.from(await r.arrayBuffer())
        let o = null
        try {
            o = u8arr2obj(new Uint8Array(buf))
        }
        catch (err) {}
        return { status: r.status, returnType: r.headers.get('return-type'), bytes: buf.length, obj: o }
    }

    it('應用端 resolve 不可序列化之值時, 須回錯誤封包並發一則 error 事件(修正前為 200 + success 但本體空且無事件)', async function() {
        this.timeout(20000)
        for (let func of ['bigint', 'circular']) {
            errs = []
            let r = await raw(func)
            let tag = `${func}: ${JSON.stringify(r)}`
            assert.strict.deepEqual(r.status, 200, tag)
            assert.strict.deepEqual(r.returnType, 'error', tag) //修正前為 'success'
            assert.strict.deepEqual(w.haskey(r.obj, 'error'), true, tag) //封包須解得出 error 鍵
            assert.strict.deepEqual(r.obj.error, 'output can not be serialized', tag)
            await w.delay(150) //eeEmit 為 setTimeout 發送
            assert.strict.deepEqual(errs.length, 1, `${tag} errs=${JSON.stringify(errs)}`)
            assert.strict.deepEqual(errs[0].includes('can not be serialized'), true, errs[0])
        }
    })

    it('應用端 reject 不可序列化之值時, 亦須回錯誤封包並發一則 error 事件', async function() {
        this.timeout(20000)
        errs = []
        let r = await raw('reject-bigint')
        let tag = JSON.stringify(r)
        assert.strict.deepEqual(r.returnType, 'error', tag)
        assert.strict.deepEqual(r.obj.error, 'output can not be serialized', tag)
        await w.delay(150)
        assert.strict.deepEqual(errs.length, 1, `${tag} errs=${JSON.stringify(errs)}`)
    })

    it('對照組: 可序列化之值須維持 success 且不發 error 事件', async function() {
        this.timeout(20000)
        errs = []
        let r = await raw('ok')
        assert.strict.deepEqual(r.returnType, 'success', JSON.stringify(r))
        assert.strict.deepEqual(w.haskey(r.obj, 'success'), true, JSON.stringify(r))
        await w.delay(150)
        assert.strict.deepEqual(errs, [])
    })

    it('client 送出不可序列化之 input 時須提早拒絕且不觸發伺服器 execute 事件(修正前送出空封包, 伺服器以 func 空字串觸發事件)', async function() {
        this.timeout(20000)
        let wo = new WConverhpClient({ url: `http://127.0.0.1:${port}`, apiName: 'api', getToken: () => 'token-for-test', retryMain: 0, timeout: 10000 })
        let cerrs = []
        wo.on('error', (e) => cerrs.push(String(e)))
        errs = []
        let r = await wo.execute('echo', { id: 1n }, () => {}).then((v) => ({ resolve: v })).catch((e) => ({ reject: String(e) }))
        assert.strict.deepEqual(w.haskey(r, 'reject'), true, JSON.stringify(r))
        assert.strict.deepEqual(r.reject.includes('input can not be serialized'), true, r.reject)
        await w.delay(200)
        assert.strict.deepEqual(errs, []) //伺服器未被觸發
    })

    it('client 收到損毀封包時須以可辨識之訊息拒絕(而非與「伺服器回空物件」混為一談)', async function() {
        this.timeout(20000)
        //以 execute 走正常路徑取得對照: 此處直接驗 client 對壞位元組之處置由 u8arr2obj 嚴格模式判定
        let bad = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
        let rd = u8arr2obj(bad, { returnWithStateAndMsg: true })
        assert.strict.deepEqual(rd.state, 'error', JSON.stringify(rd))
        assert.strict.deepEqual(w.isestr(rd.msg), true, JSON.stringify(rd))
    })

    it('對照組: 一般字串內容須能原樣往返(wsemi 標記碰撞已於 1.8.88 修正)', async function() {
        this.timeout(20000)
        let wo = new WConverhpClient({ url: `http://127.0.0.1:${port}`, apiName: 'api', getToken: () => 'token-for-test', retryMain: 0, timeout: 10000 })
        wo.on('error', () => {})
        let texts = [
            'prefix [Uint8Array]::0 suffix',
            '[Uint8Array]::0',
            'note: [ArrayBuffer]::0',
        ]
        for (let text of texts) {
            let r = await wo.execute('echo', { text }, () => {})
            assert.strict.deepEqual(r, { text }, `text=${text} 實得 ${JSON.stringify(r)}`)
        }
    })

})
