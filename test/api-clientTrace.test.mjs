import assert from 'assert'
import http from 'http'
import w from 'wsemi'
import WConverhpClient from '../src/WConverhpClient.mjs'
import retryDelay from '../src/retryDelay.mjs'
import wPorts from './tools/ports.mjs'

let { portOf, reserved } = wPorts


/**
 * api: WConverhpClient 之觀察回調 opt.onTrace(重試退避與合併輪詢之內部事件, 供測試與診斷以事件而非等待毫秒同步)
 *
 * 規格(JSDoc opt.onTrace):
 *   事件為凍結物件 { type, ... }, 欄位皆為原始值; type: 'retry-wait'(n, delayMs)、'retry'(n)、
 *   'poll-tick'(busy)、'poll-result'(state: success|error|pending|fail)、'poll-stop'(reason: success|error|abort)
 *   回調同步呼叫、不帶接收者, 其拋錯與回傳之 rejection 皆忽略, 不影響請求與結果; 非函數時忽略; 未傳時行為不變
 *   中止後不再通知重試事件, 合併輪詢僅通知一次 reason 為 abort 之 poll-stop, 在途查詢之結果不再通知
 *
 * 合併輪詢以 stub 伺服器依本套件協定回應(同 api-uploadMergeError), 使 merge-slices-get 之回應可由測試逐次指定(含不回應、延後回應);
 * 同步點一律為 onTrace 事件, 不以固定毫秒等待
 */
describe('api-clientTrace', function() {
    this.timeout(60000)

    let port = portOf('api-clientTrace', 0)
    let sizeSlice = 64 * 1024
    let srv = null

    //onGet, 指定 merge-slices-get 之處理: (n, pl, res, req) => void, n 為第幾次查詢(自 1 起); 預設回 success
    let nGet = 0
    let onGet = null

    //resPacket, 以本套件之協定回應(body 為 obj2u8arr({success})之 octet-stream)
    let resPacket = (res, out) => {
        let b = Buffer.from(w.obj2u8arr({ success: out }))
        res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': b.length, 'Return-Type': 'success', 'Return-Msg': 'need to parse' })
        res.end(b)
    }

    //resGet, merge-slices-get 之標準回應
    let resGet = (res, pl, state, msg = 'stub-result') => {
        resPacket(res, { state, msg, queueId: pl.queueId, filename: pl.filename, path: '' })
    }

    let readBody = (req) => {
        return new Promise((resolve) => {
            let bs = []
            req.on('data', (c) => bs.push(c))
            req.on('end', () => resolve(Buffer.concat(bs)))
        })
    }

    before(async function() {
        srv = http.createServer(async(req, res) => {
            let body = await readBody(req)
            if (req.url.indexOf('/api/ulctr') === 0) {
                let pl = {}
                try {
                    pl = JSON.parse(body.toString('utf8'))
                }
                catch (err) {}
                if (pl.mode === 'check-total-hash') {
                    resPacket(res, { path: '/stub', bAllExist: false, bAllSize: false, bAllHash: false, bSls: false, slks: [] })
                    return
                }
                if (pl.mode === 'merge-slices-push') {
                    resPacket(res, { queueId: 'stub-queue-id' })
                    return
                }
                if (pl.mode === 'merge-slices-get') {
                    nGet += 1
                    if (onGet) {
                        onGet(nGet, pl, res, req)
                    }
                    else {
                        resGet(res, pl, 'success')
                    }
                    return
                }
            }
            if (req.url.indexOf('/api/slc') === 0) {
                resPacket(res, { ok: true })
                return
            }
            res.writeHead(404)
            res.end()
        })
        await new Promise((resolve) => srv.listen(port, '127.0.0.1', resolve)) //以 listening 回呼同步, 不以固定毫秒等待
    })

    after(function() {
        srv.closeAllConnections()
        srv.close()
    })

    beforeEach(function() {
        nGet = 0
        onGet = null
    })

    //mkRec, 紀錄器: onTrace 回調、until(等某事件出現, 40 秒防懸置上限, 事件到不了時以明確訊息失敗而非等到 mocha 逾時)
    let mkRec = () => {
        let evs = []
        let thisSeen = []
        let checks = []
        let onTrace = function(e) {
            thisSeen.push(this)
            evs.push(e)
            for (let c of [...checks]) {
                c()
            }
        }

        //until, 等到某事件出現(已出現者立即成立), 回傳該事件
        let until = (pred, label) => {
            return new Promise((resolve, reject) => {
                let t = setTimeout(() => reject(new Error(`等不到 trace 事件[${label}]: ${JSON.stringify(evs)}`)), 40000)
                let check = () => {
                    let e = evs.find(pred)
                    if (e) {
                        clearTimeout(t)
                        checks.splice(checks.indexOf(check), 1)
                        resolve(e)
                    }
                }
                checks.push(check)
                check()
            })
        }
        let sig = (e) => `${e.type}${e.type === 'poll-tick' ? `:${e.busy}` : ''}${e.type === 'poll-result' ? `:${e.state}` : ''}${e.type === 'poll-stop' ? `:${e.reason}` : ''}`
        return { evs, thisSeen, onTrace, until, sig, polls: () => evs.filter((e) => e.type.startsWith('poll-')) }
    }

    //mkClient, 指向 stub 伺服器之 client
    let mkClient = (o = {}) => {
        let wo = new WConverhpClient({ url: `http://127.0.0.1:${port}`, apiName: 'api', sizeSlice, getToken: () => 't', retryUpload: 0, ...o })
        let errs = []
        wo.on('error', (e) => errs.push(String(e)))
        wo.errs = errs
        return wo
    }

    let upload = (wo, o) => wo.upload('trace.bin', new Uint8Array(sizeSlice * 2), () => {}, o)

    //inflightMax, 依事件重放同時在途之查詢數(poll-tick busy:false 起、poll-result 止)之峰值
    let inflightMax = (polls) => {
        let n = 0
        let m = 0
        for (let e of polls) {
            if (e.type === 'poll-tick' && e.busy === false) {
                n += 1
            }
            if (e.type === 'poll-result') {
                n -= 1
            }
            m = Math.max(m, n)
        }
        return m
    }

    describe('合併輪詢事件', function() {

        it('pending 後 success: poll-result 依序為 pending、success, 結束於 poll-stop(success); 每個 poll-result 之前有一個 busy:false 之 poll-tick; 事件凍結、this 為 undefined、欄位皆為原始值', async function() {
            onGet = (n, pl, res) => resGet(res, pl, n === 1 ? 'merging' : 'success')
            let rec = mkRec()
            let wo = mkClient({ onTrace: rec.onTrace })
            let r = await upload(wo)
            assert.strict.deepEqual(r, 'stub-result')
            let ps = rec.polls()
            assert.strict.deepEqual(ps.filter((e) => e.type === 'poll-result').map((e) => e.state), ['pending', 'success'], JSON.stringify(ps))
            assert.strict.deepEqual(ps[ps.length - 1], { type: 'poll-stop', reason: 'success' }, JSON.stringify(ps))
            assert.strict.deepEqual(ps.filter((e) => e.type === 'poll-stop').length, 1)
            assert.strict.deepEqual(ps.filter((e) => e.type === 'poll-tick' && e.busy === false).length, 2, '兩次查詢各對應一個 busy:false 之 tick')
            assert.strict.deepEqual(inflightMax(ps), 1)
            for (let e of rec.evs) {
                assert.strict.deepEqual(Object.isFrozen(e), true, JSON.stringify(e))
                assert.strict.deepEqual(Object.values(e).every((v) => ['string', 'number', 'boolean'].includes(typeof v)), true, `欄位須為原始值: ${JSON.stringify(e)}`)
            }
            assert.strict.deepEqual(rec.thisSeen.every((v) => v === undefined), true, '回調不帶接收者')
            assert.strict.deepEqual(wo.errs, [])
        })

        it('state 為 error: poll-result(error) 後 poll-stop(error), upload 以訊息拒絕', async function() {
            onGet = (n, pl, res) => resGet(res, pl, 'error', 'merge slices failed')
            let rec = mkRec()
            let wo = mkClient({ onTrace: rec.onTrace })
            let r = await upload(wo).then((v) => ({ ok: v }), (e) => ({ err: e }))
            assert.strict.deepEqual(r, { err: 'merge slices failed' })
            assert.strict.deepEqual(rec.polls().map(rec.sig).filter((s) => s !== 'poll-tick:false'), ['poll-result:error', 'poll-stop:error'], JSON.stringify(rec.polls()))
        })

        it('前一條查詢在途時之 tick 為 busy:true(不另發查詢); 查詢失敗為 poll-result(fail)且持續輪詢, 同時在途恆為 1, 終以 success 結束', async function() {
            let held = null
            onGet = (n, pl, res) => {
                if (n === 1) {
                    held = res //不回應, 直到測試見到 busy:true 之 tick
                    return
                }
                resGet(res, pl, 'success')
            }
            let rec = mkRec()
            let wo = mkClient({ onTrace: rec.onTrace })
            let pmUp = upload(wo)
            await rec.until((e) => e.type === 'poll-tick' && e.busy === true, 'poll-tick busy:true')
            assert.strict.deepEqual(nGet, 1, 'busy 之 tick 不得另發查詢')
            held.writeHead(200, { 'Content-Length': 3 }) //非本套件協定之回應: 查詢本身失敗
            held.end('xyz')
            let r = await pmUp
            assert.strict.deepEqual(r, 'stub-result')
            let ps = rec.polls()
            let res = ps.filter((e) => e.type === 'poll-result').map((e) => e.state)
            assert.strict.deepEqual(res, ['fail', 'success'], JSON.stringify(ps))
            assert.strict.deepEqual(inflightMax(ps), 1, `序列化: 同時在途恆為 1, ${JSON.stringify(ps)}`)
            assert.strict.deepEqual(ps[ps.length - 1], { type: 'poll-stop', reason: 'success' })
        })

        it('輪詢中中止: 僅通知一次 poll-stop(abort); 在途查詢其後才回應亦不再通知 poll-result; upload 以 reason 拒絕', async function() {
            let held = null
            onGet = (n, pl, res) => {
                held = { res, pl }
            }
            let rec = mkRec()
            let ac = new AbortController()
            let wo = mkClient({ onTrace: rec.onTrace })
            let pmUp = upload(wo, { signal: ac.signal }).then((v) => ({ ok: v }), (e) => ({ err: e }))
            await rec.until((e) => e.type === 'poll-tick' && e.busy === false, 'poll-tick busy:false')
            ac.abort('stop-it')
            let r = await pmUp
            assert.strict.deepEqual(r, { err: 'stop-it' })
            let nBefore = rec.evs.length
            if (held && !held.res.destroyed) {
                try {
                    resGet(held.res, held.pl, 'success') //中止後在途查詢才回應(請求多半已被取消, 回應寫不寫得出去皆可)
                }
                catch (err) {}
            }
            await w.delay(150) //否定觀察窗: 其後不得再有事件(負載只會漏抓不會誤判)
            let stops = rec.polls().filter((e) => e.type === 'poll-stop')
            assert.strict.deepEqual(stops, [{ type: 'poll-stop', reason: 'abort' }], JSON.stringify(rec.polls()))
            assert.strict.deepEqual(rec.polls().filter((e) => e.type === 'poll-result').length, 0, JSON.stringify(rec.polls()))
            assert.strict.deepEqual(rec.evs.length, nBefore, '中止後不得再有事件')
            assert.strict.deepEqual(wo.errs, [])
        })

    })

    describe('重試退避事件', function() {

        let urlClosed = `http://127.0.0.1:${reserved.closed}`

        it('連線失敗且 retryMain=1: retry-wait(n=1, delayMs 為退避曲線值)後接 retry(n=1), 其後不再有重試事件', async function() {
            let rec = mkRec()
            let wo = mkClient({ url: urlClosed, retryMain: 1, onTrace: rec.onTrace })
            let r = await wo.execute('f', {}, null).then((v) => ({ ok: v }), (e) => ({ err: e }))
            assert.strict.deepEqual('err' in r, true, '重試用盡後須拒絕')
            assert.strict.deepEqual(rec.evs, [{ type: 'retry-wait', n: 1, delayMs: retryDelay(1) }, { type: 'retry', n: 1 }], JSON.stringify(rec.evs))
            assert.strict.deepEqual(wo.errs.length, 2, '每次嘗試各一則 error 事件')
        })

        it('retryMain=0 不重試: 0 則重試事件', async function() {
            let rec = mkRec()
            let wo = mkClient({ url: urlClosed, retryMain: 0, onTrace: rec.onTrace })
            await wo.execute('f', {}, null).then(() => {}, () => {})
            assert.strict.deepEqual(rec.evs, [])
        })

        it('於 retry-wait 之回調內中止: 以 reason 拒絕, 其後不再有 retry 事件', async function() {
            let ac = new AbortController()
            let evs = []
            let wo = mkClient({
                url: urlClosed,
                retryMain: 3,
                onTrace: (e) => {
                    evs.push(e)
                    if (e.type === 'retry-wait') {
                        ac.abort('abort-in-trace')
                    }
                },
            })
            let r = await wo.execute('f', {}, null, { signal: ac.signal }).then((v) => ({ ok: v }), (e) => ({ err: e }))
            assert.strict.deepEqual(r, { err: 'abort-in-trace' })
            assert.strict.deepEqual(evs, [{ type: 'retry-wait', n: 1, delayMs: retryDelay(1) }], JSON.stringify(evs))
        })

    })

    describe('回調的五種形態(未傳、紀錄器、拋錯、回傳 rejection、非函數): 對外行為與結果一致', function() {

        //run, 同一情境(pending 後 success)在某種 onTrace 下之結果; 另記 unhandledRejection 與 client 之 error 事件
        let run = async(opt) => {
            nGet = 0 //同一案內多次 run 時, 查詢序號須各自自 1 起
            onGet = (n, pl, res) => resGet(res, pl, n === 1 ? 'merging' : 'success')
            let nUnhandled = 0
            let onUn = () => {
                nUnhandled += 1
            }
            process.on('unhandledRejection', onUn)
            try {
                let wo = mkClient(opt)
                let r = await upload(wo).then((v) => ({ ok: v }), (e) => ({ err: String(e) }))
                await w.delay(50) //回傳 rejection 之未處理判定在 microtask 後的 process tick, 否定觀察窗
                return { r, errs: wo.errs, nUnhandled, nGet }
            }
            finally {
                process.off('unhandledRejection', onUn)
            }
        }

        let expectBase = { r: { ok: 'stub-result' }, errs: [], nUnhandled: 0, nGet: 2 }

        it('未傳 onTrace: 行為不變', async function() {
            assert.strict.deepEqual(await run({}), expectBase)
        })

        it('紀錄器: 收得到事件, 行為不變', async function() {
            let rec = mkRec()
            assert.strict.deepEqual(await run({ onTrace: rec.onTrace }), expectBase)
            assert.strict.deepEqual(rec.polls().length > 0, true)
        })

        it('回調拋錯: 被隔離, 不中斷輪詢、不改變結果、不發 error 事件', async function() {
            let n = 0
            let r = await run({
                onTrace: () => {
                    n += 1
                    throw new Error('trace boom')
                },
            })
            assert.strict.deepEqual(r, expectBase)
            assert.strict.deepEqual(n > 0, true, '回調確有被呼叫')
        })

        it('回調回傳 rejection: 被吞掉, 不產生 unhandledRejection、不改變結果', async function() {
            let n = 0
            let r = await run({
                onTrace: () => {
                    n += 1
                    return Promise.reject(new Error('trace rejected'))
                },
            })
            assert.strict.deepEqual(r, expectBase)
            assert.strict.deepEqual(n > 0, true)
        })

        it('非函數(字串、數值、物件、null): 忽略, 行為不變', async function() {
            for (let v of ['x', 123, {}, [], null, true]) {
                assert.strict.deepEqual(await run({ onTrace: v }), expectBase, `onTrace=${JSON.stringify(v)}`)
            }
        })

    })

})
