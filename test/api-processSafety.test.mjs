import assert from 'assert'
import fs from 'fs'
import path from 'path'
import w from 'wsemi'
import WConverhpServer from '../src/WConverhpServer.mjs'
import WConverhpClient from '../src/WConverhpClient.mjs'


/**
 * 伺服器行程存活性: 三種原本會使整個行程崩潰之情境, 皆須改為可觀察之錯誤且伺服器持續服務
 *   - merge-slices-push 之 chunkTotal: 非正整數 → 'invalid chunkTotal in payload'; 巨大值 → 合併以缺片失敗收場(.error), 不得依其值配置記憶體
 *   - 埠被占用: 建構不拋出, 以 error 事件通知(含 EADDRINUSE), 既有伺服器不受影響
 *   - 應用端監聽器同步拋錯或 async reject: 伺服器發 error 事件(含原始訊息), 該請求以錯誤回應(execute/download 由 client 收到, upload 由 merge-slices-get 回錯誤封包), 後續請求正常
 *   - client 端 error 監聽器拋錯: 不得使 client 行程崩潰, 原呼叫仍須以伺服器訊息拒絕
 * 未修正前, 前三者於 mocha 內會以 FATAL OOM / unhandledRejection / uncaughtException 使本檔整批失敗
 */
describe('api-processSafety', function() {

    let port = 8201 //同時test故得要不同port
    let base = `http://127.0.0.1:${port}/api`
    let pathUploadTemp = path.resolve('./test/_tmp/uploadTemp-api-processSafety')
    let sizeSlice = 64 * 1024
    let wsv = null

    //errs, 伺服器 error 事件訊息
    let errs = []

    //uploadThrow, 切換 upload 監聽器是否拋錯
    let uploadThrow = false

    //parse, 解析本套件之 octet-stream 回應
    let parse = async(r) => {
        let bb = Buffer.from(await r.arrayBuffer())
        return w.u8arr2obj(new Uint8Array(bb))
    }

    //ulctr, 直接打協定(JSON 本體)
    let ulctr = async(payload, h) => {
        let r = await fetch(`${base}/ulctr`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer t', 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileHash: h, ...payload }),
        })
        return await parse(r)
    }

    //pollUntilSettled, 每 300ms 問一次 merge-slices-get, 直到 state 不是 merging 或逾時
    let pollUntilSettled = async(queueId, limit, h) => {
        let t0 = Date.now()
        let last = null
        while (Date.now() - t0 < limit) {
            let r = await ulctr({ mode: 'merge-slices-get', filename: 'x.bin', queueId }, h)
            last = w.iseobj(r.success) ? r.success : r
            if (last.state !== 'merging') {
                return last
            }
            await w.delay(300)
        }
        return { state: 'TIMEOUT', last }
    }

    //putSlices, 直接於暫存夾放置切片檔, 回傳全檔雜湊
    let putSlices = async(parts) => {
        let h = await w.getFileXxHash(new Blob([Buffer.concat(parts)]))
        for (let i = 0; i < parts.length; i++) {
            fs.writeFileSync(path.resolve(pathUploadTemp, `${h}_${i}`), parts[i])
        }
        return h
    }

    //mkClient
    let mkClient = (o = {}) => {
        let wo = new WConverhpClient({ url: `http://127.0.0.1:${port}`, apiName: 'api', getToken: () => 't', retryMain: 0, retryUpload: 0, retryDownload: 0, timeout: 8000, ...o })
        return wo
    }

    //catchOf
    let catchOf = async(fn) => {
        try {
            let r = await fn()
            return { state: 'resolve', msg: r }
        }
        catch (err) {
            return { state: 'reject', msg: err }
        }
    }

    //hasErr, error 事件中是否有以指定字串開頭之訊息
    let hasErr = (prefix) => {
        return errs.some((v) => typeof v === 'string' && v.indexOf(prefix) === 0)
    }

    before(async function() {

        fs.rmSync(pathUploadTemp, { recursive: true, force: true })
        fs.mkdirSync(pathUploadTemp, { recursive: true })

        wsv = new WConverhpServer({ port, apiName: 'api', pathStaticFiles: '.', pathUploadTemp, sizeSlice, verifyConn: async() => true })
        wsv.on('execute', (func, input, pm) => { //非 async 函數, 供測試同步拋錯
            if (func === 'throwSync') {
                throw new Error('boom sync')
            }
            if (func === 'throwAsync') {
                return (async() => { //回傳被 reject 之 promise, 等同 async 監聽器內拋錯
                    throw new Error('boom async')
                })()
            }
            if (func === 'ok') {
                pm.resolve({ ok: 1 })
                return
            }
            pm.reject('invalid func')
        })
        wsv.on('upload', (input, pm) => {
            if (uploadThrow) {
                throw new Error('boom upload')
            }
            pm.resolve('ok')
        })
        wsv.on('download', (input, pm) => {
            if (input.fileId === 'throw') {
                throw new Error('boom download')
            }
            pm.reject('no such file')
        })
        wsv.on('error', (err) => {
            errs.push(err)
        })

        await w.delay(1000) //待伺服器啟動

    })

    after(function() {
        wsv.stop()
        fs.rmSync(pathUploadTemp, { recursive: true, force: true })
    })

    it('merge-slices-push 之 chunkTotal 非正整數時須回 invalid chunkTotal in payload', async function() {
        for (let v of ['abc', 0, -1, 1.5, '', null, [], {}]) {
            let r = await ulctr({ mode: 'merge-slices-push', chunkTotal: v }, 'a1b2c3d4e5f60718')
            assert.strict.deepEqual(r.error, 'invalid chunkTotal in payload', JSON.stringify(v))
        }
    })

    it('merge-slices-push 之 chunkTotal 為巨大值(1e8)且無切片時, 合併須立即以缺片失敗收場, 伺服器須存活', async function() {
        this.timeout(15000)
        let h = 'b1b2c3d4e5f60718'
        let rp = await ulctr({ mode: 'merge-slices-push', chunkTotal: 100000000 }, h)
        let queueId = w.iseobj(rp.success) ? rp.success.queueId : ''
        assert.strict.deepEqual(w.isestr(queueId), true, JSON.stringify(rp))
        let r = await pollUntilSettled(queueId, 8000, h)
        assert.strict.deepEqual(r.state, 'error', JSON.stringify(r))
        assert.strict.deepEqual(r.msg, 'merge slices failed')
        assert.strict.deepEqual(fs.existsSync(path.resolve(pathUploadTemp, `${h}.error`)), true)
        let re = await mkClient().execute('ok', {}, () => {})
        assert.strict.deepEqual(re, { ok: 1 })
    })

    it('chunkTotal 與實際切片數相符時合併須成功(對照組, 確認缺片即停未破壞正常路徑)', async function() {
        this.timeout(15000)
        let h = await putSlices([Buffer.alloc(sizeSlice, 1), Buffer.alloc(100, 2)])
        let rp = await ulctr({ mode: 'merge-slices-push', chunkTotal: 2 }, h)
        let queueId = w.iseobj(rp.success) ? rp.success.queueId : ''
        let r = await pollUntilSettled(queueId, 8000, h)
        assert.strict.deepEqual(r.state, 'success', JSON.stringify(r))
        assert.strict.deepEqual(r.msg, 'ok')
        assert.strict.deepEqual(fs.statSync(path.resolve(pathUploadTemp, h)).size, sizeSlice + 100)
    })

    it('埠被占用時, 建構須以 error 事件通知(含 EADDRINUSE)而不拋出, 既有伺服器須不受影響', async function() {
        let errs2 = []
        let wsv2 = new WConverhpServer({ port, apiName: 'api', pathStaticFiles: '.', pathUploadTemp, verifyConn: async() => true }) //同一埠
        wsv2.on('error', (err) => {
            errs2.push(err)
        })
        await w.delay(1500)
        assert.strict.deepEqual(errs2.length, 1, JSON.stringify(errs2))
        assert.strict.deepEqual(errs2[0].indexOf('start server error') === 0 && errs2[0].indexOf('EADDRINUSE') > 0, true, errs2[0])
        let re = await mkClient().execute('ok', {}, () => {})
        assert.strict.deepEqual(re, { ok: 1 })
        try {
            wsv2.stop()
        }
        catch (err) {}
    })

    it('execute 監聽器同步拋錯時, 呼叫端須收到錯誤而非懸置, 伺服器須發 error 事件並持續服務', async function() {
        errs = []
        let r = await catchOf(() => mkClient().execute('throwSync', {}, () => {}))
        assert.strict.deepEqual(r, { state: 'reject', msg: 'listener of event[execute] error' })
        await w.delay(200)
        assert.strict.deepEqual(hasErr('listener of event[execute] error: boom sync'), true, JSON.stringify(errs))
        let re = await mkClient().execute('ok', {}, () => {})
        assert.strict.deepEqual(re, { ok: 1 })
    })

    it('execute 監聽器 async reject 時, 亦須同上處置', async function() {
        errs = []
        let r = await catchOf(() => mkClient().execute('throwAsync', {}, () => {}))
        assert.strict.deepEqual(r, { state: 'reject', msg: 'listener of event[execute] error' })
        await w.delay(200)
        assert.strict.deepEqual(hasErr('listener of event[execute] error: boom async'), true, JSON.stringify(errs))
        let re = await mkClient().execute('ok', {}, () => {})
        assert.strict.deepEqual(re, { ok: 1 })
    })

    it('download 監聽器拋錯時, 呼叫端須收到 can not get file from fileId, 伺服器須發 error 事件', async function() {
        errs = []
        let r = await catchOf(() => mkClient().download('throw', () => {}, { fdDownload: pathUploadTemp }))
        assert.strict.deepEqual(r, { state: 'reject', msg: 'can not get file from fileId' })
        await w.delay(200)
        assert.strict.deepEqual(hasErr('listener of event[download] error: boom download'), true, JSON.stringify(errs))
    })

    it('upload 監聽器拋錯時, merge-slices-get 須回錯誤封包, 伺服器須發 error 事件並持續服務', async function() {
        this.timeout(15000)
        errs = []
        uploadThrow = true
        try {
            let h = await putSlices([Buffer.alloc(sizeSlice, 3), Buffer.alloc(50, 4)])
            let rp = await ulctr({ mode: 'merge-slices-push', chunkTotal: 2 }, h)
            let queueId = w.iseobj(rp.success) ? rp.success.queueId : ''
            let r = await pollUntilSettled(queueId, 8000, h)
            assert.strict.deepEqual(r.error, 'listener of event[upload] error', JSON.stringify(r))
            await w.delay(200)
            assert.strict.deepEqual(hasErr('listener of event[upload] error: boom upload'), true, JSON.stringify(errs))
        }
        finally {
            uploadThrow = false
        }
        let re = await mkClient().execute('ok', {}, () => {})
        assert.strict.deepEqual(re, { ok: 1 })
    })

    it('client 之 error 監聽器拋錯時, 不得使行程崩潰, 原呼叫仍須以伺服器訊息拒絕', async function() {
        let wo = mkClient()
        wo.on('error', () => {
            throw new Error('client listener boom')
        })
        let r = await catchOf(() => wo.execute('nofunc', {}, () => {}))
        assert.strict.deepEqual(r, { state: 'reject', msg: 'invalid func' })
        await w.delay(200) //eeEmit 為 setTimeout 發送, 待其送出並經包裝攔截
    })

})
