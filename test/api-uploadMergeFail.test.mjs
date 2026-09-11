import assert from 'assert'
import fs from 'fs'
import path from 'path'
import w from 'wsemi'
import WConverhpServer from '../src/WConverhpServer.mjs'


/**
 * 伺服器端合併切片失敗時, 須記錄失敗態並於 merge-slices-get 回 state:'error' 附原因,
 * 而非永遠回 'merging'(前端依設計會持續等待, 但這裡等的是一件不會再發生的事)
 *
 * 直接打協定而不經 client: 失敗注入採「宣稱 3 片只送 1 片」, 合併時 fsMergeFiles 以 reject 回報缺片,
 * 此為可確定重現之路徑; client 端收到 state:'error' 即終止輪詢並 reject 已由 api-uploadMergeError 覆蓋
 */
describe('api-uploadMergeFail', function() {

    let port = 8194 //同時test故得要不同port
    let base = `http://127.0.0.1:${port}/api`
    let pathUploadTemp = path.resolve('./test/_tmp/uploadTemp-api-uploadMergeFail')
    let sizeSlice = 64 * 1024
    let wsv = null

    //nUpload, 記錄 upload 事件被觸發次數
    let nUpload = 0

    //bufs, 本測試之檔案內容(三片)
    let bufs = [Buffer.alloc(sizeSlice, 1), Buffer.alloc(sizeSlice, 2), Buffer.alloc(100, 3)]

    //hash, 本測試之檔案雜湊(伺服器以此為切片與合併檔之檔名), 須為內容之真實雜湊: 伺服器於合併完成時核對雜湊, 不符即判合併失敗(第十輪 F1)
    let hash = ''

    //hash2, 第三條之檔案雜湊, 同理須為其內容之真實雜湊, 使失敗點落在「輸出路徑不可寫」而非雜湊不符
    let buf2 = Buffer.alloc(100, 9)
    let hash2 = ''

    //parse, 解析本套件之 octet-stream 回應
    let parse = async(r) => {
        let bb = Buffer.from(await r.arrayBuffer())
        return w.u8arr2obj(new Uint8Array(bb))
    }

    //slc, 上傳一片(h 可指定另一個檔案雜湊, 預設為本測試之 hash)
    let slc = async(i, total, buf, h = hash) => {
        let r = await fetch(`${base}/slc`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer t', 'Content-Type': 'application/octet-stream', 'chunk-index': String(i), 'chunk-total': String(total), 'package-id': h },
            body: buf,
        })
        return await parse(r)
    }

    //ulctr
    let ulctr = async(payload, h = hash) => {
        let r = await fetch(`${base}/ulctr`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer t', 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileHash: h, ...payload }),
        })
        return await parse(r)
    }

    //pollUntilSettled, 每 500ms 問一次 merge-slices-get, 直到 state 不是 merging 或逾時
    let pollUntilSettled = async(queueId, limit, h = hash) => {
        let t0 = Date.now()
        let last = null
        while (Date.now() - t0 < limit) {
            let r = await ulctr({ mode: 'merge-slices-get', filename: 'x.bin', queueId }, h)
            last = w.iseobj(r.success) ? r.success : r
            if (last.state !== 'merging') {
                return last
            }
            await w.delay(500)
        }
        return { state: 'TIMEOUT', last }
    }

    before(async function() {

        fs.rmSync(pathUploadTemp, { recursive: true, force: true })
        fs.mkdirSync(pathUploadTemp, { recursive: true })

        hash = await w.getFileXxHash(new Blob([Buffer.concat(bufs)]))
        hash2 = await w.getFileXxHash(new Blob([buf2]))

        wsv = new WConverhpServer({
            port,
            apiName: 'api',
            pathStaticFiles: '.',
            pathUploadTemp,
            sizeSlice,
            verifyConn: async() => true,
        })
        wsv.on('upload', (input, pm) => {
            nUpload += 1
            pm.resolve({ filename: input.filename })
        })
        wsv.on('error', () => {})

        await w.delay(1000) //待伺服器啟動

    })

    after(function() {
        wsv.stop()
        fs.rmSync(pathUploadTemp, { recursive: true, force: true })
    })

    it('合併失敗(切片缺失)時, merge-slices-get 須回 state:error 並附原因, 且失敗態須持續存在', async function() {
        this.timeout(30000)

        //宣稱 3 片, 只送第 0 片
        await slc(0, 3, bufs[0])
        let rp = await ulctr({ mode: 'merge-slices-push', chunkTotal: 3 })
        let queueId = w.iseobj(rp.success) ? rp.success.queueId : ''
        assert.strict.deepEqual(w.isestr(queueId), true, JSON.stringify(rp))

        //輪詢須在合理時間內離開 merging(修正前: 永遠 merging → TIMEOUT)
        let r = await pollUntilSettled(queueId, 10000)
        assert.strict.deepEqual(r.state, 'error', JSON.stringify(r))

        //對外訊息為固定字串, 不含伺服器路徑與底層細節(細節以伺服器 error 事件通知, 由 api-pathTraversal 驗)
        assert.strict.deepEqual(r.msg, 'merge slices failed')
        assert.strict.deepEqual(Object.keys(r).indexOf('reason') < 0 && Object.keys(r).indexOf('path') < 0, true, JSON.stringify(r))

        //伺服器: 失敗態存在、成功態不存在, upload 事件不得被觸發
        assert.strict.deepEqual(fs.existsSync(path.resolve(pathUploadTemp, `${hash}.error`)), true)
        assert.strict.deepEqual(fs.existsSync(path.resolve(pathUploadTemp, `${hash}.done`)), false)
        assert.strict.deepEqual(nUpload, 0)

        //失敗態須持續: 前端可能漏接某次回應, 再問一次仍須為 error
        let r2 = await ulctr({ mode: 'merge-slices-get', filename: 'x.bin', queueId })
        assert.strict.deepEqual(w.iseobj(r2.success) && r2.success.state, 'error', JSON.stringify(r2))
    })

    it('合併失敗後依協定重傳(check-total-hash 決定缺哪些片 → 補傳 → push), 須成功且舊失敗態須被清除', async function() {
        this.timeout(30000)

        //與 client 相同: 先問伺服器現況。失敗的合併可能已消耗部分切片並留下不完整合併檔, 伺服器須據實回報
        let rc = await ulctr({ mode: 'check-total-hash', filename: 'x.bin', fileSize: sizeSlice * 2 + 100 })
        let ck = w.iseobj(rc.success) ? rc.success : {}
        assert.strict.deepEqual(ck.bAllHash, false, JSON.stringify(rc)) //不完整合併檔不得被當成完整檔
        let have = Array.isArray(ck.slks) ? ck.slks : []

        //補傳伺服器沒有的切片(與 client 依 slks 跳過已有切片之判斷相同)
        for (let i = 0; i < 3; i++) {
            if (have.indexOf(i) < 0) {
                await slc(i, 3, bufs[i])
            }
        }
        let rp = await ulctr({ mode: 'merge-slices-push', chunkTotal: 3 })
        let queueId = w.iseobj(rp.success) ? rp.success.queueId : ''

        let r = await pollUntilSettled(queueId, 10000)
        assert.strict.deepEqual(r.state, 'success', JSON.stringify(r))
        assert.strict.deepEqual(nUpload, 1)

        //舊的 .error 須於新一次合併啟動時被清除, 成功態須存在, 合併檔大小須為三片總和
        assert.strict.deepEqual(fs.existsSync(path.resolve(pathUploadTemp, `${hash}.error`)), false)
        assert.strict.deepEqual(fs.existsSync(path.resolve(pathUploadTemp, `${hash}.done`)), true)
        assert.strict.deepEqual(fs.statSync(path.resolve(pathUploadTemp, hash)).size, sizeSlice * 2 + 100)
    })

    it('合併輸出路徑不可寫(被同名目錄佔住)時, 亦須回 state:error 而非永遠 merging', async function() {
        this.timeout(30000)

        //此案例依賴 wsemi fsMergeFilesCore 之修正(見 ./建議wsemi修正.md):
        //修正前 write stream 開檔失敗之 error 無人監聽, worker 崩潰、promise 永不 settle, 伺服器無從記錄失敗態
        fs.mkdirSync(path.resolve(pathUploadTemp, hash2))

        await slc(0, 1, buf2, hash2)
        let rp = await ulctr({ mode: 'merge-slices-push', chunkTotal: 1 }, hash2)
        let queueId = w.iseobj(rp.success) ? rp.success.queueId : ''
        assert.strict.deepEqual(w.isestr(queueId), true, JSON.stringify(rp))

        let nUpload0 = nUpload
        let r = await pollUntilSettled(queueId, 10000, hash2)
        assert.strict.deepEqual(r.state, 'error', JSON.stringify(r))
        //對外訊息為固定字串, 不含伺服器路徑與底層細節(細節以伺服器 error 事件通知, 由 api-pathTraversal 驗)
        assert.strict.deepEqual(r.msg, 'merge slices failed')
        assert.strict.deepEqual(Object.keys(r).indexOf('reason') < 0 && Object.keys(r).indexOf('path') < 0, true, JSON.stringify(r))

        assert.strict.deepEqual(fs.existsSync(path.resolve(pathUploadTemp, `${hash2}.error`)), true)
        assert.strict.deepEqual(fs.existsSync(path.resolve(pathUploadTemp, `${hash2}.done`)), false)
        assert.strict.deepEqual(nUpload - nUpload0, 0)
    })

})
