import assert from 'assert'
import fs from 'fs'
import w from 'wsemi'
import u8arr2obj from 'wsemi/src/u8arr2obj.mjs'
import WConverhpServer from '../src/WConverhpServer.mjs'
import WConverhpClient from '../src/WConverhpClient.mjs'


/**
 * api: 回應封包之協定鍵保形, 與已儲存結果之 canonical 一致性
 *
 * #34 —— encodeOut 原本只判 wsemi 之 state, 但 JSON 對值為 undefined / function / symbol 之鍵是**靜默丟棄整個鍵**而非拋錯,
 *   故 obj2u8arr({error: undefined}) 回 state success 卻解回 {} —— 連 error 鍵都不存在。
 *   前端只能以無意義之 'data does not contain success or error' 拒絕, 而伺服器 0 則事件。
 *   修法為結構保證: 協定鍵之值先經 canonProtocolValue 正規化為 null, 使該鍵不可能消失(不採 encode 後再 decode 檢查, 大輸出代價加倍)。
 *
 * #34b —— consume 原本落地一次(鍵為 ro)後回傳**原物件**, 外層組回應時再序列化一次(鍵為 msg);
 *   帶 toJSON 之結果因此被呼叫兩次且兩次結果可不同(實測首次得 seq=2、重送得 seq=1), 破壞同一 queueId 之冪等。
 *   修法為落地後解回 canonical 值, 以之作為首次回應。
 *
 * #33 —— 應用端結果無法序列化時, mmg 與外層各報一則, 同一失敗兩則事件。修法為由外層唯一持有此失敗之回報。
 */
describe('api-envelopeShape', function() {

    let port = 8224 //同時test故得要不同port
    let pathUploadTemp = './test/_tmp/uploadTemp-api-envelopeShape'
    let wsv = null
    let errs = []
    let nToJSON = 0
    let uploadMode = 'normal'

    before(async function() {
        this.timeout(20000)

        wsv = new WConverhpServer({
            port,
            apiName: 'api',
            useInert: false,
            pathUploadTemp,
            verifyConn: async() => true,
        })
        wsv.on('handler', () => {})
        wsv.on('error', (e) => errs.push(String(e)))
        wsv.on('execute', (func, input, pm) => {
            if (func === 'reject-undefined') {
                pm.reject(undefined)
            }
            else if (func === 'reject-function') {
                pm.reject(() => {})
            }
            else if (func === 'resolve-ok') {
                pm.resolve({ v: 1 })
            }
            else {
                pm.reject('invalid func')
            }
        })
        wsv.on('upload', (input, pm) => {
            if (uploadMode === 'tojson') {
                //帶 toJSON 之結果: 每次序列化都回一個遞增序號, 用以偵測被序列化幾次
                pm.resolve({
                    toJSON() {
                        nToJSON += 1
                        return { seq: nToJSON }
                    },
                })
                return
            }
            if (uploadMode === 'bigint') {
                pm.resolve({ id: 1n }) //不可序列化
                return
            }
            pm.resolve({ ok: 1 })
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

    //raw, 直接打 /main 取回線上封包
    let raw = async(func) => {
        errs = []
        let r = await fetch(`http://127.0.0.1:${port}/api/main`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer t', 'Content-Type': 'application/octet-stream' },
            body: Buffer.from(w.obj2u8arr({ func, input: null })),
        })
        let buf = Buffer.from(await r.arrayBuffer())
        let o = u8arr2obj(new Uint8Array(buf))
        await w.delay(200) //eeEmit 為 setTimeout 派發
        return { status: r.status, returnType: r.headers.get('return-type'), obj: o, nErrs: errs.length }
    }

    it('[#34] 應用端以 undefined 拒絕時, 封包仍須保有 error 鍵(修正前該鍵被 JSON 靜默丟棄, 解回空物件)', async function() {
        this.timeout(20000)
        let r = await raw('reject-undefined')
        assert.strict.deepEqual(r.status, 200, JSON.stringify(r))
        assert.strict.deepEqual(r.returnType, 'error', JSON.stringify(r))
        assert.strict.deepEqual(w.haskey(r.obj, 'error'), true, `協定鍵須存在: ${JSON.stringify(r.obj)}`)
        assert.strict.deepEqual(r.obj.error, null, `不可序列化之拒絕值須正規化為 null: ${JSON.stringify(r.obj)}`)
    })

    it('[#34] 應用端以 function 拒絕時, 封包仍須保有 error 鍵', async function() {
        this.timeout(20000)
        let r = await raw('reject-function')
        assert.strict.deepEqual(r.returnType, 'error', JSON.stringify(r))
        assert.strict.deepEqual(w.haskey(r.obj, 'error'), true, `協定鍵須存在: ${JSON.stringify(r.obj)}`)
        assert.strict.deepEqual(r.obj.error, null, JSON.stringify(r.obj))
    })

    it('[#34] client 端結局須為可辨識之拒絕, 而非 data does not contain success or error', async function() {
        this.timeout(20000)
        let wo = new WConverhpClient({ url: `http://127.0.0.1:${port}`, apiName: 'api', getToken: () => 't', retryMain: 0, timeout: 10000 })
        wo.on('error', () => {})
        let r = await wo.execute('reject-undefined', {}, () => {}).then((v) => ({ resolve: v })).catch((e) => ({ reject: e }))
        assert.strict.deepEqual(r, { reject: null }, `修正前為 data does not contain success or error: ${JSON.stringify(r)}`)
    })

    it('[對照組] 正常回傳不受影響', async function() {
        this.timeout(20000)
        let r = await raw('resolve-ok')
        assert.strict.deepEqual(r.returnType, 'success', JSON.stringify(r))
        assert.strict.deepEqual(r.obj.success.output, { v: 1 }, JSON.stringify(r))
        assert.strict.deepEqual(r.nErrs, 0, JSON.stringify(r))
    })

    it('[#34b] 帶 toJSON 之上傳結果只被序列化一次, 且同一 queueId 之首次與重送回應相同', async function() {
        this.timeout(40000)
        uploadMode = 'tojson'
        nToJSON = 0

        //直接造出 S2 之磁碟狀態(合併檔 + .done)並以同一 queueId 連打兩次 merge-slices-get:
        //第一次消費並落地 .ro, 第二次讀已落地者。不以 client.upload 重送, 因為第二次 upload 走 check-total-hash 之去重路徑,
        //該路徑本就每次都呼叫應用端(刻意設計), 驗不到 .ro 之重播
        let hash = 'bbbb000000000001'
        let seg0 = 'D20260909'
        let seg1 = 'BBB001'
        let fp = `${pathUploadTemp}/${hash}`
        fs.mkdirSync(pathUploadTemp, { recursive: true })
        fs.writeFileSync(fp, 'merged', 'utf8')
        fs.writeFileSync(`${fp}.done`, '', 'utf8')
        let queueId = `${seg0}|${seg1}|${hash}`

        let get = async() => {
            let r = await fetch(`http://127.0.0.1:${port}/api/ulctr`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer t', 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: 'merge-slices-get', fileHash: hash, filename: 't.bin', queueId }),
            })
            let buf = Buffer.from(await r.arrayBuffer())
            return u8arr2obj(new Uint8Array(buf)).success
        }

        let first = await get()
        assert.strict.deepEqual(first.state, 'success', JSON.stringify(first))
        assert.strict.deepEqual(nToJSON, 1, `toJSON 須只被呼叫一次, 實得 ${nToJSON}(修正前落地與回應各序列化一次共 2 次)`)
        assert.strict.deepEqual(first.msg, { seq: 1 }, JSON.stringify(first))

        let second = await get()
        assert.strict.deepEqual(second.msg, first.msg, `重送須得與首次相同之結果, 實得 ${JSON.stringify(second.msg)} vs ${JSON.stringify(first.msg)}`)
        assert.strict.deepEqual(nToJSON, 1, `重送不得再呼叫應用端與再序列化, 實得 ${nToJSON}`)
        uploadMode = 'normal'
    })

    it('[#33] 應用端上傳結果無法序列化時, 同一次失敗恰發一則 error 事件(修正前為兩則)', async function() {
        this.timeout(40000)
        uploadMode = 'bigint'
        errs = []
        let wo = new WConverhpClient({ url: `http://127.0.0.1:${port}`, apiName: 'api', getToken: () => 't', retryUpload: 0, timeout: 8000 })
        wo.on('error', () => {})

        //持續輪詢者於此不等其結束, 只觀察一輪之事件數
        let pmUp = wo.upload('b.bin', Buffer.alloc(400, 66), () => {}).catch(() => {})
        await w.delay(6000)

        //每一輪查詢應恰產生一則「無法序列化」之事件; 取第一輪之窗口計數
        let nSer = errs.filter((v) => v.includes('can not be serialized')).length
        let nStore = errs.filter((v) => v.includes('can not serialize consumed result')).length
        assert.strict.deepEqual(nStore, 0, `mmg 不得另報一則儲存失敗(同一失敗兩則): ${JSON.stringify(errs)}`)
        assert.strict.deepEqual(nSer >= 1, true, `外層須報告此失敗: ${JSON.stringify(errs)}`)
        assert.strict.deepEqual(nSer, errs.length, `不得有其他來源之事件混入: ${JSON.stringify(errs)}`)

        uploadMode = 'normal'
        await pmUp
    })

})
