import assert from 'assert'
import fs from 'fs'
import path from 'path'
import w from 'wsemi'
import WConverhpServer from '../src/WConverhpServer.mjs'
import WConverhpClient from '../src/WConverhpClient.mjs'


/**
 * 可證明不需重試之錯誤須中止重試; 其餘一律照常重試
 *   - 可證明: 結果僅由 client 自行建構之請求內容(mode/fileHash/chunkTotal/chunkIndex/packageId/fileId)或伺服器建構參數(sizeMsg/sizeSlice)決定, 重送同一請求必同一結果
 *     伺服器於 error 封包標示 retryable:false 並於標頭標示 Return-Retryable:false; HTTP 413 由 client 以狀態碼判定
 *   - 不可證明(須重試): permission denied、應用端 reject、應用端回傳形狀不合、磁碟、網路; 伺服器不得標示
 *   重試與否以 client 之 retry 日誌(retry n=)為觀察點; 呼叫端仍須收到原始錯誤值
 */
describe('api-noRetry', function() {

    let port = 8206 //同時test故得要不同port
    let base = `http://127.0.0.1:${port}/api`
    let pathUploadTemp = path.resolve('./test/_tmp/uploadTemp-api-noRetry')
    let wsv = null

    //allow, verifyConn 開關
    let allow = true

    //parse, 解析本套件之 octet-stream 回應
    let parse = async(r) => {
        let bb = Buffer.from(await r.arrayBuffer())
        return w.u8arr2obj(new Uint8Array(bb))
    }

    //post, 直接打協定, 回傳 { data, retryableHeader }
    let post = async(urlPath, body, headers = {}) => {
        let r = await fetch(`${base}${urlPath}`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer t', ...headers },
            body,
        })
        return { data: await parse(r), retryableHeader: r.headers.get('return-retryable') }
    }
    let postJson = (urlPath, obj, headers = {}) => post(urlPath, JSON.stringify(obj), { 'Content-Type': 'application/json', ...headers })
    let postU8a = (urlPath, obj, headers = {}) => post(urlPath, Buffer.from(w.obj2u8arr(obj)), { 'Content-Type': 'application/octet-stream', ...headers })

    //mkClient
    let mkClient = (o = {}) => {
        let wo = new WConverhpClient({ url: `http://127.0.0.1:${port}`, apiName: 'api', getToken: () => 't', timeout: 8000, ...o })
        wo.on('error', () => {})
        return wo
    }

    //runCapture, 執行並攔截 console.log 計算 client 重試次數(retry n=), 回傳 { state, msg, nRetry }
    let runCapture = async(fn) => {
        let nRetry = 0
        let _log = console.log
        console.log = (...a) => {
            if (typeof a[0] === 'string' && a[0].indexOf('retry n=') === 0) {
                nRetry += 1
            }
        }
        try {
            let r = await fn()
            return { state: 'resolve', msg: r, nRetry }
        }
        catch (err) {
            return { state: 'reject', msg: err, nRetry }
        }
        finally {
            console.log = _log
        }
    }

    before(async function() {

        fs.rmSync(pathUploadTemp, { recursive: true, force: true })
        fs.mkdirSync(pathUploadTemp, { recursive: true })

        wsv = new WConverhpServer({ port, apiName: 'api', pathStaticFiles: '.', pathUploadTemp, sizeMsg: 1024 * 1024, sizeSlice: 64 * 1024, verifyConn: async() => allow })
        wsv.on('execute', (func, input, pm) => {
            if (func === 'ok') {
                pm.resolve({ ok: 1 })
                return
            }
            pm.reject('invalid func')
        })
        wsv.on('upload', (input, pm) => {
            pm.resolve('ok')
        })
        wsv.on('download', (input, pm) => {
            pm.reject('no such file')
        })
        wsv.on('error', () => {})

        await w.delay(1000) //待伺服器啟動

    })

    after(function() {
        wsv.stop()
        fs.rmSync(pathUploadTemp, { recursive: true, force: true })
    })

    it('伺服器對可證明不需重試之參數錯誤, 須於封包標示 retryable:false 且於標頭標示 Return-Retryable:false', async function() {
        let h = 'a1b2c3d4e5f60718'
        let slcHd = (o) => ({ 'chunk-index': '0', 'chunk-total': '1', 'package-id': h, ...o })
        let cases = [
            ['/ulctr mode', () => postJson('/ulctr', { mode: 'nope', fileHash: h }), 'invalid mode[nope] in payload'],
            ['/ulctr fileHash', () => postJson('/ulctr', { mode: 'check-total-hash', fileHash: '../x' }), 'invalid fileHash in payload'],
            ['/ulctr chunkTotal', () => postJson('/ulctr', { mode: 'merge-slices-push', fileHash: h, chunkTotal: 'x' }), 'invalid chunkTotal in payload'],
            ['/slc chunkIndex', () => post('/slc', Buffer.alloc(10), slcHd({ 'Content-Type': 'application/octet-stream', 'chunk-index': 'x' })), 'invalid chunkIndex in headers'],
            ['/slc chunkTotal', () => post('/slc', Buffer.alloc(10), slcHd({ 'Content-Type': 'application/octet-stream', 'chunk-total': 'x' })), 'invalid chunkTotal in headers'],
            ['/slc packageId', () => post('/slc', Buffer.alloc(10), slcHd({ 'Content-Type': 'application/octet-stream', 'package-id': '../x' })), 'invalid packageId in headers'],
            ['/dwgfn fileId', () => postJson('/dwgfn', { fileId: '' }), 'invalid fileId in payload'],
            ['/dw fileId', () => postJson('/dw', { fileId: '' }), 'invalid fileId in payload'],
        ]
        for (let [name, fn, expect] of cases) {
            let r = await fn()
            assert.strict.deepEqual(r.data.error, expect, name)
            assert.strict.deepEqual(r.data.retryable, false, `${name}: body`)
            assert.strict.deepEqual(r.retryableHeader, 'false', `${name}: header`)
        }
        //GET /dwgf
        let rg = await fetch(`${base}/dwgf?fileId=&token=t`)
        let dg = await parse(rg)
        assert.strict.deepEqual(dg.error, 'invalid fileId in query')
        assert.strict.deepEqual(dg.retryable, false)
        assert.strict.deepEqual(rg.headers.get('return-retryable'), 'false')
    })

    it('伺服器對 permission denied 與應用端 reject 不得標示 retryable(對照組, 此類須重試)', async function() {
        allow = false
        try {
            let r1 = await postJson('/ulctr', { mode: 'check-total-hash', fileHash: 'a1b2c3d4e5f60718' })
            assert.strict.deepEqual(r1.data.error, 'permission denied')
            assert.strict.deepEqual(Object.keys(r1.data).indexOf('retryable') < 0, true, JSON.stringify(r1.data))
            assert.strict.deepEqual(r1.retryableHeader, null)
        }
        finally {
            allow = true
        }
        let r2 = await postU8a('/main', { func: 'nofunc', input: {} })
        assert.strict.deepEqual(r2.data.error, 'invalid func')
        assert.strict.deepEqual(Object.keys(r2.data).indexOf('retryable') < 0, true, JSON.stringify(r2.data))
        assert.strict.deepEqual(r2.retryableHeader, null)
        let r3 = await postJson('/dw', { fileId: 'x' })
        assert.strict.deepEqual(r3.data.error, 'can not get file from fileId')
        assert.strict.deepEqual(Object.keys(r3.data).indexOf('retryable') < 0, true, JSON.stringify(r3.data))
        assert.strict.deepEqual(r3.retryableHeader, null)
    })

    it('execute 本體超過 sizeMsg(HTTP 413)時須不重試, 且呼叫端收到 Payload Too Large', async function() {
        this.timeout(20000)
        let r = await runCapture(() => mkClient({ retryMain: 3 }).execute('ok', { u8a: new Uint8Array(2 * 1024 * 1024) }, () => {}))
        assert.strict.deepEqual(r.state, 'reject')
        assert.strict.deepEqual(r.msg, 'Payload Too Large')
        assert.strict.deepEqual(r.nRetry, 0)
    })

    it('nodejs download 之 fileId 為空(invalid fileId in payload)時須不重試, 且呼叫端收到原始錯誤字串', async function() {
        this.timeout(20000)
        let r = await runCapture(() => mkClient({ retryDownload: 2 }).download('', () => {}, { fdDownload: pathUploadTemp }))
        assert.strict.deepEqual(r.state, 'reject')
        assert.strict.deepEqual(r.msg, 'invalid fileId in payload')
        assert.strict.deepEqual(r.nRetry, 0)
    })

    it('應用端 reject(invalid func)須照常重試 retryMain 次(對照組)', async function() {
        this.timeout(20000)
        let r = await runCapture(() => mkClient({ retryMain: 2 }).execute('nofunc', {}, () => {}))
        assert.strict.deepEqual(r.state, 'reject')
        assert.strict.deepEqual(r.msg, 'invalid func')
        assert.strict.deepEqual(r.nRetry, 2)
    })

    it('permission denied 須照常重試 retryMain 次(對照組)', async function() {
        this.timeout(20000)
        allow = false
        try {
            let r = await runCapture(() => mkClient({ retryMain: 1 }).execute('ok', {}, () => {}))
            assert.strict.deepEqual(r.state, 'reject')
            assert.strict.deepEqual(r.msg, 'permission denied')
            assert.strict.deepEqual(r.nRetry, 1)
        }
        finally {
            allow = true
        }
    })

})
