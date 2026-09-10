import assert from 'assert'
import fs from 'fs'
import path from 'path'
import w from 'wsemi'
import obj2u8arr from 'wsemi/src/obj2u8arr.mjs'
import u8arr2obj from 'wsemi/src/u8arr2obj.mjs'
import WConverhpServer from '../src/WConverhpServer.mjs'


/**
 * api: 合併佇列之已儲存結果(.ro)讀取須封口
 *
 * 修正前 readStored 以寬鬆模式解封包並以 get(o,'ro',null) 取值, 於是三種壞掉的 .ro 都被當成「一個值為 null 的成功結果」:
 *   - 隨機壞位元組:寬鬆 u8arr2obj 回 {} 而不報錯 → msg 為 null
 *   - 合法封包但無 ro 鍵:同上
 *   - 二進位區截尾:長度表宣告與實際剩餘不符時 TypedArray.slice 只縮短不拋錯 → 回傳被截短之二進位
 * 三者皆回 state success 且應用端 upload 呼叫數為 0 —— 壞掉的結果不但被當成功, 還「擋住」了本可正常進行的重新消費,
 * 使應用端永遠拿不到真結果(合併檔與 .done 都還在, S2 本可重新消費)。
 *
 * 修正後 readStored 以嚴格模式取狀態, 並要求解出之值為物件且自有 ro 鍵; 不符者視為未儲存, 落到 S2 重新消費。
 */
describe('api-storedResult', function() {

    let port = 8223 //同時test故得要不同port
    let pathUploadTemp = './test/_tmp/uploadTemp-api-storedResult'
    let wsv = null
    let errs = []
    let nUpload = 0

    before(async function() {
        this.timeout(20000)
        fs.rmSync(pathUploadTemp, { recursive: true, force: true })
        fs.mkdirSync(pathUploadTemp, { recursive: true })

        wsv = new WConverhpServer({
            port,
            apiName: 'api',
            useInert: false,
            pathUploadTemp,
            verifyConn: async() => true,
        })
        wsv.on('handler', () => {})
        wsv.on('error', (e) => errs.push(String(e)))
        wsv.on('upload', (input, pm) => {
            nUpload += 1
            pm.resolve({ consumed: nUpload })
        })

        await w.delay(1200) //待伺服器啟動
    })

    after(function() {
        wsv.stop()
        try {
            fs.rmSync(pathUploadTemp, { recursive: true, force: true })
        }
        catch (err) {}
    })

    //mkState, 造出 S3 之磁碟狀態: 合併檔 + .done + 指定內容之 .ro
    //why 合併檔與 .done 都要在: 使「.ro 被判為未儲存」時可落到 S2 重新消費, 才驗得出「壞包是否擋住重新消費」
    //queueId 之三段以 | 分隔(見 managerMergeSlices 之 qGet), .ro 檔名之隊列段為前兩段串接, 故此處由同一來源導出兩者以免不一致
    let seg0 = 'D20260909'
    let seg1 = 'AAA001'
    let mkState = (hash, roBytes) => {
        let fp = path.resolve(pathUploadTemp, hash)
        fs.writeFileSync(fp, 'merged-content', 'utf8')
        fs.writeFileSync(`${fp}.done`, '', 'utf8')
        fs.writeFileSync(`${fp}.q${seg0}${seg1}.ro`, Buffer.from(roBytes))
        return `${seg0}|${seg1}|${hash}`
    }

    //get, 呼叫 merge-slices-get
    let get = async(queueId, filename) => {
        errs = []
        nUpload = 0
        let r = await fetch(`http://127.0.0.1:${port}/api/ulctr`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer t', 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: 'merge-slices-get', fileHash: queueId.split('|')[2], filename, queueId }),
        })
        let buf = Buffer.from(await r.arrayBuffer())
        let o = u8arr2obj(new Uint8Array(buf))
        await w.delay(200) //eeEmit 為 setTimeout 派發
        return { status: r.status, out: o.success, nUpload, errs: [...errs] }
    }

    it('隨機壞位元組之 .ro 須視為未儲存並重新消費(修正前回 success 且 msg 為 null, 應用端 0 次呼叫)', async function() {
        this.timeout(20000)
        let qid = mkState('aaaa000000000001', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
        let r = await get(qid, 'a.bin')
        assert.strict.deepEqual(r.out.state, 'success', JSON.stringify(r))
        assert.strict.deepEqual(r.nUpload, 1, `須重新消費一次, 實得 ${r.nUpload}: ${JSON.stringify(r)}`)
        assert.strict.deepEqual(r.out.msg, { consumed: 1 }, JSON.stringify(r))
        assert.strict.deepEqual(r.errs.length >= 1, true, `須記錄一則壞包訊息: ${JSON.stringify(r.errs)}`)
        assert.strict.deepEqual(r.errs.some((v) => v.includes('corrupted')), true, JSON.stringify(r.errs))
    })

    it('合法封包但缺 ro 鍵之 .ro 須視為未儲存並重新消費(修正前回 success 且 msg 為 null)', async function() {
        this.timeout(20000)
        //以套件自身之編碼器造一個「合法但沒有 ro 鍵」之封包
        let bad = obj2u8arr({ other: 1 })
        let qid = mkState('aaaa000000000002', bad)
        let r = await get(qid, 'b.bin')
        assert.strict.deepEqual(r.out.state, 'success', JSON.stringify(r))
        assert.strict.deepEqual(r.nUpload, 1, `須重新消費一次, 實得 ${r.nUpload}: ${JSON.stringify(r)}`)
        assert.strict.deepEqual(r.out.msg, { consumed: 1 }, JSON.stringify(r))
        assert.strict.deepEqual(r.errs.some((v) => v.includes(`no own 'ro' key`)), true, JSON.stringify(r.errs))
    })

    it('[凍結待修 · 待 wsemi] 二進位區截尾之 .ro 目前仍被當成功並回傳截短之二進位', async function() {
        this.timeout(20000)
        //本格為 #35 之第三種形狀, **本套件側修不掉**:
        //截尾時長度表宣告與實際剩餘不符, 而 TypedArray.slice 只縮短不拋錯, 故 wsemi 之 decode 仍回 state success,
        //本套件之「state 成功 + 自有 ro 鍵」兩道檢核皆通過, 無從分辨。須由 wsemi 於 decode 時驗證分塊 framing
        //(各段宣告長度總和須恰等於剩餘位元組數)。wsemi 修正後本格須改判為「視為未儲存並重新消費」。
        let full = obj2u8arr({ ro: { bin: new Uint8Array([1, 2, 3, 4]) } })
        let cut = full.slice(0, full.length - 2) //截掉尾端 2 bytes
        let qid = mkState('aaaa000000000003', cut)
        let r = await get(qid, 'c.bin')
        assert.strict.deepEqual(r.out.state, 'success', JSON.stringify(r))
        assert.strict.deepEqual(r.nUpload, 0, `現況: 未重新消費(壞包擋住了消費): ${JSON.stringify(r)}`)
        assert.strict.deepEqual(r.out.msg.bin instanceof Uint8Array, true, JSON.stringify(r))
        assert.strict.deepEqual(Array.from(r.out.msg.bin), [1, 2], `現況: 回傳被截短之二進位(原為 4 bytes): ${JSON.stringify(r)}`)
    })

    it('對照組: 完好之 .ro 須直接回其儲存值且不重新消費(冪等保證不得因本次修正而失效)', async function() {
        this.timeout(20000)
        let good = obj2u8arr({ ro: { consumed: 99 } })
        let qid = mkState('aaaa000000000004', good)
        let r = await get(qid, 'd.bin')
        assert.strict.deepEqual(r.out.state, 'success', JSON.stringify(r))
        assert.strict.deepEqual(r.out.msg, { consumed: 99 }, JSON.stringify(r))
        assert.strict.deepEqual(r.nUpload, 0, `完好之 .ro 不得重新呼叫應用端: ${JSON.stringify(r)}`)
        assert.strict.deepEqual(r.errs, [])
    })

    it('對照組: 儲存值為 null 之完好 .ro 須回 null 而非重新消費(區分「真的存了 null」與「壞包」)', async function() {
        this.timeout(20000)
        //應用端以 pm.resolve() 不帶值結束時, consume 正規化為 null 並落地; 此為合法之已儲存結果
        let good = obj2u8arr({ ro: null })
        let qid = mkState('aaaa000000000005', good)
        let r = await get(qid, 'e.bin')
        assert.strict.deepEqual(r.out.state, 'success', JSON.stringify(r))
        assert.strict.deepEqual(r.out.msg, null, JSON.stringify(r))
        assert.strict.deepEqual(r.nUpload, 0, `真的存了 null 者不得重新消費: ${JSON.stringify(r)}`)
    })

})
