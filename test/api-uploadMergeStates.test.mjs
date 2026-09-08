import assert from 'assert'
import fs from 'fs'
import path from 'path'
import w from 'wsemi'
import WConverhpServer from '../src/WConverhpServer.mjs'
import WConverhpClient from '../src/WConverhpClient.mjs'


/**
 * 合併佇列狀態表之逐格驗證(狀態定義見 src/managerMergeSlices.mjs 檔頭)
 *
 * 修正前 qGet 只有 success / error / merging 三答, 沒有「已完成且被消費」之終結態: 應用端於 upload 事件移走合併檔後, 同一查詢之重送(回應遺失、逾時)會刪 .done 並永遠回 merging,
 * 前端 upload() 永不 settle; 合併中行程中止之殘檔亦永遠 merging。本檔對每一狀態 × 入口(get / push)各釘一格, 另釘同隊列併發共用一次呼叫、不同隊列各自呼叫(去重語意不變)、
 * 應用端拒絕不儲存、結果檔不干擾 check-total-hash、pm.resolve() 不帶值正規化為 null。
 * 各狀態直接於暫存夾建構(切片、合併檔、.done、.error), 不依賴前端流程, 使每格獨立可判
 */
describe('api-uploadMergeStates', function() {

    let port = 8213 //同時test故得要不同port
    let base = `http://127.0.0.1:${port}/api`
    let pathUploadTemp = path.resolve('./test/_tmp/uploadTemp-api-uploadMergeStates')
    let fdMoved = path.resolve('./test/_tmp/moved-api-uploadMergeStates')
    let sizeSlice = 64 * 1024
    let wsv = null

    //behavior, 應用端 upload 事件之行為, 由各案例設定: resolve / reject / slow / move / undefined
    let behavior = { mode: 'resolve', value: 'ok' }

    //nUpload, calls: upload 事件觸發次數與收到之輸入
    let nUpload = 0
    let calls = []

    //errs, 伺服器 error 事件
    let errs = []

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

    //getq, merge-slices-get, 回傳 success 內容或整個回應(error 封包)
    let getq = async(queueId, h) => {
        let r = await ulctr({ mode: 'merge-slices-get', filename: 'x.bin', queueId }, h)
        return w.iseobj(r.success) ? r.success : r
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
            last = await getq(queueId, h)
            if (last.state !== 'merging') {
                return last
            }
            await w.delay(200)
        }
        return { state: 'TIMEOUT', last }
    }

    //waitFile, 等檔案出現(用於等合併完成而不經 get 消費)
    let waitFile = async(fp, limit) => {
        let t0 = Date.now()
        while (Date.now() - t0 < limit) {
            if (fs.existsSync(fp)) {
                return true
            }
            await w.delay(50)
        }
        return false
    }

    //hashOf
    let hashOf = async(b) => {
        return await w.getFileXxHash(new Blob([b]))
    }

    //mkParts, 造可辨識內容之切片
    let mkParts = (seed, sizes) => {
        return sizes.map((n, k) => Buffer.alloc(n, (seed + k) % 251))
    }

    //putSlices, 於暫存夾放置切片檔, 回傳全檔雜湊
    let putSlices = async(parts) => {
        let h = await hashOf(Buffer.concat(parts))
        for (let i = 0; i < parts.length; i++) {
            fs.writeFileSync(path.resolve(pathUploadTemp, `${h}_${i}`), parts[i])
        }
        return h
    }

    //fakeQ, 以任意合法格式之 queueId 代表「另一個隊列」(qGet 只解析第三段之 fileHash, 前兩段為結果檔命名)
    let fakeQ = (h, tag = 'abcdef') => `20260908000000|${tag}|${h}`

    //fpOf, 各狀態檔之路徑
    let fpOf = (h) => path.resolve(pathUploadTemp, h)
    let roFiles = (h) => fs.readdirSync(pathUploadTemp).filter((v) => v.indexOf(`${h}.q`) === 0 && v.endsWith('.ro'))

    before(async function() {

        fs.rmSync(pathUploadTemp, { recursive: true, force: true })
        fs.mkdirSync(pathUploadTemp, { recursive: true })
        fs.rmSync(fdMoved, { recursive: true, force: true })
        fs.mkdirSync(fdMoved, { recursive: true })

        wsv = new WConverhpServer({ port, apiName: 'api', pathStaticFiles: '.', pathUploadTemp, sizeSlice, verifyConn: async() => true })
        wsv.on('upload', (input, pm) => {
            nUpload += 1
            calls.push(input)
            if (behavior.mode === 'reject') {
                pm.reject(behavior.value)
            }
            else if (behavior.mode === 'slow') {
                setTimeout(() => pm.resolve({ n: nUpload }), 400)
            }
            else if (behavior.mode === 'move') {
                //應用端常見作法: 合併檔移至處理資料夾(qGet 註解載明之情境)
                fs.renameSync(input.path, path.resolve(fdMoved, `${path.basename(input.path)}.moved`))
                pm.resolve({ moved: true, filename: input.filename })
            }
            else if (behavior.mode === 'undefined') {
                pm.resolve()
            }
            else {
                pm.resolve(behavior.value)
            }
        })
        wsv.on('error', (e) => errs.push(e))
        wsv.on('handler', () => {})

        await w.delay(1000) //待伺服器啟動

    })

    after(function() {
        wsv.stop()
        fs.rmSync(pathUploadTemp, { recursive: true, force: true })
        fs.rmSync(fdMoved, { recursive: true, force: true })
    })

    beforeEach(function() {
        behavior = { mode: 'resolve', value: 'ok' }
        nUpload = 0
        calls = []
        errs = []
    })

    it('S3 冪等: 應用端於 upload 事件移走合併檔後, 同一 queueId 重送 merge-slices-get 須回相同結果, 應用端不再被呼叫, .done 不得被刪(修正前: 刪 .done 並永遠 merging)', async function() {
        this.timeout(20000)
        behavior = { mode: 'move' }
        let h = await putSlices(mkParts(1, [sizeSlice, sizeSlice, 100]))
        let q1 = await push(h, 3)
        let r1 = await pollUntilSettled(q1, 8000, h)
        assert.strict.deepEqual(r1.state, 'success', JSON.stringify(r1))
        assert.strict.deepEqual(r1.msg, { moved: true, filename: 'x.bin' })
        assert.strict.deepEqual(nUpload, 1)
        assert.strict.deepEqual(fs.existsSync(fpOf(h)), false, '合併檔已被應用端移走')
        assert.strict.deepEqual(fs.existsSync(`${fpOf(h)}.done`), true)
        assert.strict.deepEqual(roFiles(h).length, 1, '首次消費須儲存結果')

        //重送兩次(回應遺失後之重試、逾時重送)
        for (let k = 0; k < 2; k++) {
            let r = await getq(q1, h)
            assert.strict.deepEqual(r.state, 'success', JSON.stringify(r))
            assert.strict.deepEqual(r.msg, { moved: true, filename: 'x.bin' })
        }
        assert.strict.deepEqual(nUpload, 1, '重送不得再呼叫應用端')
        assert.strict.deepEqual(fs.existsSync(`${fpOf(h)}.done`), true, 'qGet 不得刪 .done')
        assert.strict.deepEqual(errs, [])
    })

    it('S4 終結: 合併檔被他隊列消費並移走後, 無儲存結果之其他隊列須得終結錯誤 merged file already consumed(修正前: 永遠 merging)', async function() {
        this.timeout(20000)
        behavior = { mode: 'move' }
        let h = await putSlices(mkParts(2, [sizeSlice, 100]))
        let q1 = await push(h, 2)
        let r1 = await pollUntilSettled(q1, 8000, h)
        assert.strict.deepEqual(r1.state, 'success', JSON.stringify(r1))
        assert.strict.deepEqual(nUpload, 1)

        //另一隊列(如同檔並發上傳之另一 client, 或本隊列首次消費時結果未能儲存)
        for (let k = 0; k < 2; k++) {
            let r = await getq(fakeQ(h), h)
            assert.strict.deepEqual(r.state, 'error', JSON.stringify(r))
            assert.strict.deepEqual(r.msg, 'merged file already consumed')
        }
        assert.strict.deepEqual(nUpload, 1)
        assert.strict.deepEqual(fs.existsSync(`${fpOf(h)}.done`), true)
        await w.delay(50) //eeEmit 為 setTimeout 派發
        assert.strict.deepEqual(errs.length, 2)
        assert.strict.deepEqual(errs[0].indexOf(`merged file already consumed for fileHash[${h}]`) === 0, true, errs[0])
    })

    it('S0 終結: 從未 push 之 fileHash 查詢須得終結錯誤 no merge task(修正前: 永遠 merging)', async function() {
        let h = await hashOf(Buffer.alloc(10, 77)) //合法 16 位 hex, 但無任何產物
        for (let k = 0; k < 2; k++) {
            let r = await getq(fakeQ(h), h)
            assert.strict.deepEqual(r.state, 'error', JSON.stringify(r))
            assert.strict.deepEqual(r.msg, 'no merge task')
        }
        assert.strict.deepEqual(nUpload, 0)
    })

    it('S6 終結: 合併中行程中止之殘檔(合併檔在、.done 不在、內容不完整)查詢時須驗證後寫 .error 並回 merge slices failed(修正前: 永遠 merging)', async function() {
        this.timeout(20000)
        let full = Buffer.concat(mkParts(3, [sizeSlice, sizeSlice, 100]))
        let h = await hashOf(full)
        fs.writeFileSync(fpOf(h), full.subarray(0, sizeSlice + 50)) //殘檔: 只寫了一片半
        let r = await getq(fakeQ(h), h)
        assert.strict.deepEqual(r.state, 'error', JSON.stringify(r))
        assert.strict.deepEqual(r.msg, 'merge slices failed')
        assert.strict.deepEqual(fs.existsSync(`${fpOf(h)}.error`), true)
        assert.strict.deepEqual(fs.readFileSync(`${fpOf(h)}.error`, 'utf8').indexOf('is incomplete') > 0, true)
        assert.strict.deepEqual(fs.existsSync(`${fpOf(h)}.done`), false)
        let r2 = await getq(fakeQ(h), h)
        assert.strict.deepEqual(r2.msg, 'merge slices failed', '終結態須穩定')
        assert.strict.deepEqual(nUpload, 0, '殘檔不得觸發 upload 事件')

        //復原: 補齊切片後 push 須清 .error 重新合併並成功
        await putSlices(mkParts(3, [sizeSlice, sizeSlice, 100]))
        let q = await push(h, 3)
        let r3 = await pollUntilSettled(q, 8000, h)
        assert.strict.deepEqual(r3.state, 'success', JSON.stringify(r3))
        assert.strict.deepEqual(await hashOf(fs.readFileSync(fpOf(h))), h, '合併檔內容須正確')
        assert.strict.deepEqual(fs.existsSync(`${fpOf(h)}.error`), false)
        assert.strict.deepEqual(nUpload, 1)
    })

    it('S7 get: 合併完成後寫 .done 前中止(合併檔完整、.done 不在)查詢時須驗證通過補寫 .done 並消費, 應用端呼叫一次, 重送得同一結果', async function() {
        this.timeout(20000)
        let full = Buffer.concat(mkParts(4, [sizeSlice, 100]))
        let h = await hashOf(full)
        fs.writeFileSync(fpOf(h), full)
        let q = fakeQ(h)
        let r = await getq(q, h)
        assert.strict.deepEqual(r.state, 'success', JSON.stringify(r))
        assert.strict.deepEqual(r.msg, 'ok')
        assert.strict.deepEqual(nUpload, 1)
        assert.strict.deepEqual(calls[0].path, fpOf(h))
        assert.strict.deepEqual(fs.existsSync(`${fpOf(h)}.done`), true, '驗證通過須補寫 .done')
        assert.strict.deepEqual(roFiles(h).length, 1)
        let r2 = await getq(q, h)
        assert.strict.deepEqual(r2, { ...r2, state: 'success', msg: 'ok' })
        assert.strict.deepEqual(nUpload, 1)
    })

    it('S7 push: 同上狀態下 push 須驗證通過補寫 .done 而不重新合併(切片已不在, 重新合併必失敗), 隨後 get 消費一次', async function() {
        this.timeout(20000)
        let full = Buffer.concat(mkParts(5, [sizeSlice, 200]))
        let h = await hashOf(full)
        fs.writeFileSync(fpOf(h), full)
        let q = await push(h, 2)
        assert.strict.deepEqual(fs.existsSync(`${fpOf(h)}.done`), true, 'push 回應前即已補寫 .done')
        assert.strict.deepEqual(fs.existsSync(`${fpOf(h)}.error`), false, '不得因缺片而失敗')
        let r = await pollUntilSettled(q, 8000, h)
        assert.strict.deepEqual(r.state, 'success', JSON.stringify(r))
        assert.strict.deepEqual(nUpload, 1)
        assert.strict.deepEqual(await hashOf(fs.readFileSync(fpOf(h))), h, '合併檔不得被截斷')
    })

    it('S2 同隊列併發: 同一 queueId 之併發查詢(逾時重送而前一請求仍在應用端處理中)須共用同一次應用端呼叫並得同一結果', async function() {
        this.timeout(20000)
        behavior = { mode: 'slow' }
        let h = await putSlices(mkParts(6, [sizeSlice, 100]))
        let q = await push(h, 2)
        assert.strict.deepEqual(await waitFile(`${fpOf(h)}.done`, 8000), true, '待合併完成(不經 get, 避免消費)')
        let [a, b, c] = await Promise.all([getq(q, h), getq(q, h), getq(q, h)])
        assert.strict.deepEqual([a.state, b.state, c.state], ['success', 'success', 'success'], JSON.stringify([a, b, c]))
        assert.strict.deepEqual(a.msg, { n: 1 })
        assert.strict.deepEqual(b.msg, { n: 1 })
        assert.strict.deepEqual(c.msg, { n: 1 })
        assert.strict.deepEqual(nUpload, 1, '併發三次只得呼叫應用端一次')
        assert.strict.deepEqual(roFiles(h).length, 1)
    })

    it('S2 不同隊列: 不同 queueId(不同次 upload)各自消費, 應用端每次 upload 各被呼叫一次(去重語意不變), 結果各自儲存', async function() {
        this.timeout(20000)
        let h = await putSlices(mkParts(7, [sizeSlice, 100]))
        let q1 = await push(h, 2)
        let r1 = await pollUntilSettled(q1, 8000, h)
        assert.strict.deepEqual(r1.state, 'success', JSON.stringify(r1))
        assert.strict.deepEqual(nUpload, 1)

        //同檔再 push(合併檔與 .done 皆在, 為 no-op)得到新隊列, 其 get 為新一次 upload 之消費
        let q2 = await push(h, 2)
        assert.strict.notDeepEqual(q2, q1)
        let r2 = await pollUntilSettled(q2, 8000, h)
        assert.strict.deepEqual(r2.state, 'success', JSON.stringify(r2))
        assert.strict.deepEqual(nUpload, 2)
        assert.strict.deepEqual(roFiles(h).length, 2)

        //兩隊列各自重送皆冪等
        await getq(q1, h)
        await getq(q2, h)
        assert.strict.deepEqual(nUpload, 2)
    })

    it('應用端拒絕不儲存: 回應為拒絕值原樣, 重送再呼叫應用端(依重試原則); 之後成功即儲存, 再重送不再呼叫', async function() {
        this.timeout(20000)
        behavior = { mode: 'reject', value: { code: 'E1', detail: '暫時拒絕' } }
        let h = await putSlices(mkParts(8, [sizeSlice, 100]))
        let q = await push(h, 2)
        assert.strict.deepEqual(await waitFile(`${fpOf(h)}.done`, 8000), true)
        let r1 = await getq(q, h)
        assert.strict.deepEqual(r1, { error: { code: 'E1', detail: '暫時拒絕' } })
        let r2 = await getq(q, h)
        assert.strict.deepEqual(r2, { error: { code: 'E1', detail: '暫時拒絕' } })
        assert.strict.deepEqual(nUpload, 2, '拒絕不儲存, 重送須再呼叫')
        assert.strict.deepEqual(roFiles(h).length, 0)

        behavior = { mode: 'resolve', value: { code: 'OK' } }
        let r3 = await getq(q, h)
        assert.strict.deepEqual(r3.state, 'success', JSON.stringify(r3))
        assert.strict.deepEqual(r3.msg, { code: 'OK' })
        let r4 = await getq(q, h)
        assert.strict.deepEqual(r4.msg, { code: 'OK' })
        assert.strict.deepEqual(nUpload, 3, '成功後重送不得再呼叫')
        assert.strict.deepEqual(roFiles(h).length, 1)
    })

    it('S3 優先於 S5: 本隊列已消費後, 同 fileHash 之後續合併失敗寫 .error, 舊隊列重送仍得其儲存結果, 新隊列則得 merge slices failed', async function() {
        this.timeout(20000)
        let h = await putSlices(mkParts(9, [sizeSlice, 100]))
        let q1 = await push(h, 2)
        let r1 = await pollUntilSettled(q1, 8000, h)
        assert.strict.deepEqual(r1.state, 'success', JSON.stringify(r1))
        fs.writeFileSync(`${fpOf(h)}.error`, 'later merge failed', 'utf8')
        let r2 = await getq(q1, h)
        assert.strict.deepEqual(r2.state, 'success', JSON.stringify(r2))
        assert.strict.deepEqual(r2.msg, 'ok')
        let r3 = await getq(fakeQ(h), h)
        assert.strict.deepEqual(r3.msg, 'merge slices failed')
        assert.strict.deepEqual(nUpload, 1)
    })

    it('queueId 前兩段含非英數(- 或 /)須回 invalid queueId(其為結果檔名之一部分, 不得參與路徑組裝)', async function() {
        let h = await hashOf(Buffer.alloc(10, 3))
        for (let q of [`2026-09|abcdef|${h}`, `20260908|ab/cd|${h}`, `20260908|${h}`, `a|b|c|${h}`]) {
            let r = await getq(q, h)
            assert.strict.deepEqual(r.state, 'error', q)
            assert.strict.deepEqual(r.msg, 'invalid queueId', q)
        }
    })

    it('結果檔 <fileHash>.q<隊列>.ro 不得被 check-total-hash 誤判為切片(其索引解析會拋錯), 去重路徑仍正常', async function() {
        this.timeout(20000)
        let parts = mkParts(10, [sizeSlice, 100])
        let full = Buffer.concat(parts)
        let h = await putSlices(parts)
        let q = await push(h, 2)
        let r1 = await pollUntilSettled(q, 8000, h)
        assert.strict.deepEqual(r1.state, 'success', JSON.stringify(r1))
        assert.strict.deepEqual(roFiles(h).length, 1)

        //整檔已在: check-total-hash 須走去重路徑(bAllHash), 不得因結果檔而失敗
        let rc = await ulctr({ mode: 'check-total-hash', filename: 'x.bin', fileSize: full.length }, h)
        assert.strict.deepEqual(w.iseobj(rc.success), true, JSON.stringify(rc))
        assert.strict.deepEqual(rc.success.bAllHash, true)
        assert.strict.deepEqual(nUpload, 2, '去重路徑每次 upload 皆呼叫應用端(刻意設計)')
    })

    it('應用端以 pm.resolve() 不帶值結束時, 首次消費與重送皆須得 null(序列化無法表達 undefined, 兩者須一致)', async function() {
        this.timeout(20000)
        behavior = { mode: 'undefined' }
        let h = await putSlices(mkParts(11, [sizeSlice, 100]))
        let q = await push(h, 2)
        let r1 = await pollUntilSettled(q, 8000, h)
        assert.strict.deepEqual(r1.state, 'success', JSON.stringify(r1))
        assert.strict.deepEqual(r1.msg, null)
        let r2 = await getq(q, h)
        assert.strict.deepEqual(r2.msg, null)
        assert.strict.deepEqual(nUpload, 1)
    })

    it('前端流程回歸: 以 WConverhpClient 上傳且應用端移走合併檔, upload() 須 resolve 應用端結果, upload 事件只觸發一次', async function() {
        this.timeout(30000)
        behavior = { mode: 'move' }
        let wo = new WConverhpClient({ url: `http://127.0.0.1:${port}`, apiName: 'api', sizeSlice, getToken: () => 't', retryUpload: 0 })
        wo.on('error', () => {})
        let u8a = new Uint8Array(sizeSlice * 2 + 55)
        for (let i = 0; i < u8a.length; i++) {
            u8a[i] = (i * 31) % 251
        }
        let r = await wo.upload('client.bin', Buffer.from(u8a), () => {})
        assert.strict.deepEqual(r, { moved: true, filename: 'client.bin' })
        assert.strict.deepEqual(nUpload, 1)
    })

})
