import assert from 'assert'
import fs from 'fs'
import path from 'path'
import w from 'wsemi'
import WConverhpServer from '../src/WConverhpServer.mjs'


/**
 * merge-slices-push 之重入保護: 同一 fileHash 之重複 push(回應遺失後之重試, 或同檔並發上傳)須為 no-op
 *   - 未保護時第二次合併以寫入模式開檔, 當下截斷第一次之結果, 又因切片已被第一次合併逐片刪除而於第零片失敗寫 .error, 使已完成或進行中之合併被回報為失敗
 *   - 合併完成後重複 push: 合併檔不得被截斷, 不得產生 .error, get 仍回 success
 *   - 合併進行中重複 push: 最終只有一次合併之結果, 不得產生 .error, 切片須全部被刪除
 *   合併失敗後補傳再 push 須重新合併之正規路徑由 api-uploadMergeFail 覆蓋
 */
describe('api-uploadMergeReentry', function() {

    let port = 8207 //同時test故得要不同port
    let base = `http://127.0.0.1:${port}/api`
    let pathUploadTemp = path.resolve('./test/_tmp/uploadTemp-api-uploadMergeReentry')
    let sizeSlice = 64 * 1024
    let wsv = null

    //nUpload, upload 事件觸發次數
    let nUpload = 0

    //parse, 解析本套件之 octet-stream 回應
    let parse = async(r) => {
        let bb = Buffer.from(await r.arrayBuffer())
        return w.u8arr2obj(new Uint8Array(bb))
    }

    //ulctr
    let ulctr = async(payload, h) => {
        let r = await fetch(`${base}/ulctr`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer t', 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileHash: h, ...payload }),
        })
        return await parse(r)
    }

    //push, 回傳 queueId
    let push = async(h, chunkTotal) => {
        let rp = await ulctr({ mode: 'merge-slices-push', chunkTotal }, h)
        let queueId = w.iseobj(rp.success) ? rp.success.queueId : ''
        assert.strict.deepEqual(w.isestr(queueId), true, JSON.stringify(rp))
        return queueId
    }

    //pollUntilSettled, 每 200ms 問一次 merge-slices-get, 直到 state 不是 merging 或逾時
    let pollUntilSettled = async(queueId, limit, h) => {
        let t0 = Date.now()
        let last = null
        while (Date.now() - t0 < limit) {
            let r = await ulctr({ mode: 'merge-slices-get', filename: 'x.bin', queueId }, h)
            last = w.iseobj(r.success) ? r.success : r
            if (last.state !== 'merging') {
                return last
            }
            await w.delay(200)
        }
        return { state: 'TIMEOUT', last }
    }

    //putSlices, 於暫存夾放置切片檔, 回傳全檔雜湊(同時作為 fileHash 與內容比對基準)
    let putSlices = async(parts) => {
        let h = await w.getFileXxHash(new Blob([Buffer.concat(parts)]))
        for (let i = 0; i < parts.length; i++) {
            fs.writeFileSync(path.resolve(pathUploadTemp, `${h}_${i}`), parts[i])
        }
        return h
    }

    //hashOfFile
    let hashOfFile = async(fp) => {
        return await w.getFileXxHash(new Blob([fs.readFileSync(fp)]))
    }

    //remainSlices
    let remainSlices = (h) => {
        return fs.readdirSync(pathUploadTemp).filter((v) => v.indexOf(`${h}_`) === 0)
    }

    before(async function() {

        fs.rmSync(pathUploadTemp, { recursive: true, force: true })
        fs.mkdirSync(pathUploadTemp, { recursive: true })

        wsv = new WConverhpServer({ port, apiName: 'api', pathStaticFiles: '.', pathUploadTemp, sizeSlice, verifyConn: async() => true })
        wsv.on('upload', (input, pm) => {
            nUpload += 1
            pm.resolve('ok')
        })
        wsv.on('error', () => {})

        await w.delay(1000) //待伺服器啟動

    })

    after(function() {
        wsv.stop()
        fs.rmSync(pathUploadTemp, { recursive: true, force: true })
    })

    it('合併完成後重複 push 須為 no-op: 合併檔不得被截斷, 不得產生 .error, get 仍回 success', async function() {
        this.timeout(20000)
        nUpload = 0
        let h = await putSlices([Buffer.alloc(sizeSlice, 1), Buffer.alloc(sizeSlice, 2), Buffer.alloc(100, 3)])
        let fp = path.resolve(pathUploadTemp, h)
        let q1 = await push(h, 3)
        let r1 = await pollUntilSettled(q1, 8000, h)
        assert.strict.deepEqual(r1.state, 'success', JSON.stringify(r1))
        assert.strict.deepEqual(fs.statSync(fp).size, sizeSlice * 2 + 100)
        assert.strict.deepEqual(await hashOfFile(fp), h)
        assert.strict.deepEqual(nUpload, 1)

        //重複 push(模擬回應遺失後之重試)
        let q2 = await push(h, 3)
        await w.delay(800)
        assert.strict.deepEqual(fs.existsSync(`${fp}.error`), false, '不得產生 .error')
        assert.strict.deepEqual(fs.existsSync(`${fp}.done`), true)
        assert.strict.deepEqual(fs.statSync(fp).size, sizeSlice * 2 + 100, '合併檔不得被截斷')
        assert.strict.deepEqual(await hashOfFile(fp), h)
        let r2 = await pollUntilSettled(q2, 8000, h)
        assert.strict.deepEqual(r2.state, 'success', JSON.stringify(r2))
        assert.strict.deepEqual(r2.msg, 'ok')
    })

    it('合併進行中重複 push 須為 no-op: 最終只有一次合併之結果, 不得產生 .error, 切片須全部被刪除', async function() {
        this.timeout(30000)
        nUpload = 0
        let parts = []
        for (let i = 0; i < 200; i++) { //200 片使合併耗時足以讓第二次 push 落在進行中
            parts.push(Buffer.alloc(sizeSlice, i % 251))
        }
        let h = await putSlices(parts)
        let fp = path.resolve(pathUploadTemp, h)
        let q1 = await push(h, 200)
        await w.delay(30)
        let q2 = await push(h, 200) //合併進行中之重複 push
        let r1 = await pollUntilSettled(q1, 15000, h)
        assert.strict.deepEqual(r1.state, 'success', JSON.stringify(r1))
        assert.strict.deepEqual(fs.existsSync(`${fp}.error`), false, '不得產生 .error')
        assert.strict.deepEqual(fs.statSync(fp).size, sizeSlice * 200)
        assert.strict.deepEqual(await hashOfFile(fp), h, '合併檔內容須正確')
        assert.strict.deepEqual(remainSlices(h), [], '切片須全部被刪除')
        let r2 = await pollUntilSettled(q2, 8000, h)
        assert.strict.deepEqual(r2.state, 'success', JSON.stringify(r2))
    })

})
