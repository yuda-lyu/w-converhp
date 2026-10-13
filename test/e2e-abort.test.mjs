import assert from 'assert'
import fs from 'fs'
import path from 'path'
import stream from 'stream'
import w from 'wsemi'
import setup from './tools/e2e-setup.mjs'
import wPorts from './tools/ports.mjs'

let { portOf, reserved } = wPorts

let { HOST, projRoot, launchBrowser, buildClientBundle, writePage, startServer } = setup


/**
 * e2e: 瀏覽器端之前端中止(opt.signal; 規則帳本 R27)
 *
 * 真實 user path(技能 §2.3; 本套件於瀏覽器端無 UI, 呼叫端是應用程式碼, 定位見 test/tools/e2e-setup.mjs 檔頭):
 *   ①開啟載入 w-converhp client(自現行 src 打包)之頁面
 *   ②應用端建立 AbortController, 呼叫 execute / upload / download 並以第 4 參數(download 為第 3 參數)之 opt.signal 交出其 signal
 *   ③於某一階段(伺服端處理中、接收中、切片之間、取 token 中、交給下載管理器前後)呼叫 abort()
 *   ④觀察: 公開 promise 以 signal.reason 拒絕; 自 abort() 被呼叫(含其同步期間)起不再有 error 事件、cbProgress、getToken、重試訊息
 *   ⑤觀察: 瀏覽器下載管理器於交出前中止者 0 次下載, 交出後中止者照常下載
 *   ⑥後端副作用: 伺服端之應用端事件(中止前已送達者照常執行, 結果未知)
 *
 * 規格: src/WConverhpClient.mjs 建構函數 @returns 之「中止(opt.signal)」段(契約 C1–C12 見 test/api-clientAbort.test.mjs 檔頭)。
 * 本檔為 run01 全盤 M2 之瀏覽器兩欄(blob、下載管理器)與 execute、upload 之瀏覽器對照; Node 側各格見 test/api-clientAbort.test.mjs。
 *
 * 瀏覽器專屬之兩個機制(Node 側測不到):
 *   - XHR 之中止: axios 之 xhr adapter 於 abort() 之**同步期間**經 onCanceled → done() → flushDownload 補送節流中之進度(run01 複審 RB2x),
 *     故「abort() 同步期間之 cbProgress 呼叫數」須於頁內量(abort() 前後之計數差)
 *   - 下載管理器路徑: 交給瀏覽器(<a download>.click())之前可中止、之後不可中止(JSDoc 明載)
 *
 * 「回應已到、續行未執行」之決定性時點: client 於瀏覽器以 Blob.prototype.arrayBuffer 轉換回應本體(res2u8arr), 該呼叫即位於回應已通過 axios、
 * 續行尚未完成之窗口; 頁內掛鉤該呼叫並於其內中止。下載管理器「已取得 token、交出前」之時點: client 以 encodeURIComponent 組下載網址,
 * 掛鉤其對該 token 之呼叫並於其內中止。blob 下載之續行(downloadStream 之瀏覽器分支)只有微任務而無可掛鉤之呼叫,
 * 該格之正確性與 execute 同由入口競速(ctx.run)保證, 以本檔之 execute 一格與 api-clientAbort 之 T2–T6 代表。
 */
describe('e2e-abort', function() {

    let port = portOf('e2e-abort')
    let baseUrl = `http://${HOST}:${port}`
    let urlClosed = `http://${HOST}:${reserved.closed}` //刻意無人監聽: 連線失敗而進入重試退避
    let fdUp = path.resolve(projRoot, 'test', '_tmp', 'e2e-abort', 'up')
    let wsv = null
    let browser = null
    let urlPage = ''
    let msgInvalidSignal = 'invalid opt.signal: must be an AbortSignal'

    //sv, 伺服端之觀察(每個 case 重設)
    let sv = null
    let resetSv = () => {
        sv = { reqs: [], exec: { calls: 0, done: 0 }, upload: { calls: 0 }, download: [] }
    }
    resetSv()

    before(async function() {
        this.timeout(180000) //首次須打包 bundle

        await buildClientBundle()

        //頁內之共用函數(不用樣板字串之 ${}: 本段為 node 端之樣板字串)
        urlPage = writePage('e2e-abort.html', `
let C = WConverhpClient
window.sleep = function(ms) {
    return new Promise(function(r) {
        setTimeout(r, ms)
    })
}

//genRec, 一次被測呼叫之觀察紀錄: 各輸出通道之每一次輸出記下當下 signal 是否已中止(aborted)與是否發生於 abort() 之同步期間(inAbort)
window.genRec = function(signal) {
    let rec = { signal: signal, inAbort: false, tAbort: null, events: [], progress: [], tokens: [], logs: [] }
    rec.mark = function(k, v) {
        rec[k].push({ v: String(v), aborted: rec.signal ? rec.signal.aborted === true : false, inAbort: rec.inAbort })
    }
    rec.abort = function(ac, reason) {
        rec.inAbort = true
        try {
            ac.abort(reason)
        }
        finally {
            rec.inAbort = false
            rec.tAbort = Date.now()
        }
    }
    rec.sum = function() {
        let f = function(k) {
            return {
                total: rec[k].length,
                after: rec[k].filter(function(x) { return x.aborted }).length,
                inside: rec[k].filter(function(x) { return x.inAbort }).length,
            }
        }
        return { events: f('events'), progress: f('progress'), tokens: f('tokens'), logs: f('logs') }
    }
    window.__rec = rec
    return rec
}

//console 重試訊息('wait ...'、'retry n=...')記入當下之 rec
let oriLog = console.log
console.log = function() {
    let s = Array.prototype.map.call(arguments, String).join(' ')
    if (window.__rec && /^(wait |retry n=)/.test(s)) {
        window.__rec.mark('logs', s)
        return
    }
    oriLog.apply(console, arguments)
}

//mk, 被測之 client: getToken 與 error 事件經 rec 記錄
window.mk = function(rec, o) {
    o = o || {}
    let wo = new C(Object.assign({
        url: location.origin,
        apiName: 'api',
        sizeSlice: 65536,
        getToken: function() {
            rec.mark('tokens', '')
            return o.token ? o.token(rec.tokens.length) : 't'
        },
    }, o.opt || {}))
    wo.on('error', function(e) {
        rec.mark('events', e)
        if (o.onError) {
            o.onError(e)
        }
    })
    return wo
}

//settle, 結局轉為可傳回 node 之描述: isReason 為拒絕值是否即 signal.reason(同一個物件)
window.settle = function(p, signal) {
    return p.then(function(v) {
        return { ok: true, v: v }
    }, function(e) {
        return { ok: false, isReason: !!signal && e === signal.reason, name: e && e.name, e: typeof e === 'string' ? e : String(e) }
    })
}

//__hookAB, 掛鉤 Blob.prototype.arrayBuffer 之下一次呼叫(client 轉換回應本體之時點); 觸發一次即解除
let oriAB = Blob.prototype.arrayBuffer
window.__hookAB = null
Blob.prototype.arrayBuffer = function() {
    let h = window.__hookAB
    if (h) {
        window.__hookAB = null
        h()
    }
    return oriAB.apply(this, arguments)
}

//__hookEnc, 掛鉤 encodeURIComponent(client 組下載管理器網址之時點); 判斷函數回 true 即解除
let oriEnc = window.encodeURIComponent
window.__hookEnc = null
window.encodeURIComponent = function(v) {
    let h = window.__hookEnc
    if (h && h(v)) {
        window.__hookEnc = null
    }
    return oriEnc(v)
}
`)

        fs.rmSync(fdUp, { recursive: true, force: true })
        wsv = await startServer({ port, apiName: 'api', pathUploadTemp: fdUp, sizeSlice: 64 * 1024, delayForSlice: 0 })
        wsv.on('error', () => {})
        wsv.on('handler', (d) => {
            sv.reqs.push(d.api)
        })
        wsv.on('execute', (func, input, pm) => {
            sv.exec.calls += 1
            if (func === 'slow') {
                setTimeout(() => {
                    sv.exec.done += 1
                    pm.resolve({ v: func })
                }, 600)
                return
            }
            sv.exec.done += 1
            pm.resolve({ v: func })
        })
        wsv.on('upload', (input, pm) => {
            sv.upload.calls += 1
            pm.resolve({ got: input.filenameSafe })
        })
        wsv.on('download', (input, pm) => {
            sv.download.push(input.fileId)
            let small = () => {
                let s = new stream.PassThrough() //不可用 Readable.from([b]): 其為 objectMode, hapi 拒收
                s.end(Buffer.alloc(2000, 1))
                return { streamRead: s, filename: 'small.bin', fileSize: 2000, fileType: 'application/octet-stream' }
            }
            if (input.fileId === 'slow') {
                //慢串流: 每 50ms 1000B, 共 60 次(約 3 秒)
                let n = 0
                let rs = new stream.Readable({
                    read() {
                        setTimeout(() => {
                            n += 1
                            this.push(n <= 60 ? Buffer.alloc(1000, n) : null)
                        }, 50)
                    },
                })
                pm.resolve({ streamRead: rs, filename: 'slow.bin', fileSize: 60000, fileType: 'application/octet-stream' })
                return
            }
            if (input.fileId === 'delay') {
                setTimeout(() => pm.resolve(small()), 1000) //伺服端處理 1 秒
                return
            }
            pm.resolve(small())
        })
    })

    after(async function() {
        if (wsv) {
            await wsv.stop()
        }
        fs.rmSync(path.resolve(projRoot, 'test', '_tmp', 'e2e-abort'), { recursive: true, force: true })
    })

    //每 case fresh browser(技能 §6)
    beforeEach(async function() {
        resetSv()
        browser = await launchBrowser()
    })

    afterEach(async function() {
        if (browser) {
            await browser.close()
            browser = null
        }
    })

    //openPage, 回傳 page 與其下載事件計數
    let openPage = async() => {
        let page = await browser.newPage()
        let dl = { n: 0 }
        page.on('download', () => {
            dl.n += 1
        })
        await page.goto(`${baseUrl}${urlPage}`, { waitUntil: 'load' })
        return { page, dl }
    }

    it('未給 signal(對照組): execute、upload(File)、blob 下載、下載管理器皆照常完成, 0 則事件(C1)', async function() {
        let { page, dl } = await openPage()
        let r = await page.evaluate(async() => {
            let rec = window.genRec(null)
            let wo = window.mk(rec)
            let out = {}
            out.exec = await window.settle(wo.execute('plain', { a: 1 }))
            out.execNull = await window.settle(wo.execute('plain', { a: 1 }, null, { signal: null }))
            let file = new File([new Uint8Array(65536 * 2 + 7).fill(11)], 'c.bin')
            out.up = await window.settle(wo.upload('c.bin', file, null))
            let d = await window.settle(wo.download('small', null, { downloadByManager: false, signal: undefined }))
            out.dl = d.ok ? { ok: true, filename: d.v.filename, size: d.v.bb.size } : d
            out.mgr = await window.settle(wo.download('small', null, {}))
            return { out, sum: rec.sum() }
        })
        await w.delay(1000)
        assert.strict.deepEqual(r.out, {
            exec: { ok: true, v: { v: 'plain' } },
            execNull: { ok: true, v: { v: 'plain' } },
            up: { ok: true, v: { got: 'c.bin' } },
            dl: { ok: true, filename: 'small.bin', size: 2000 },
            mgr: { ok: true, v: 'small.bin' },
        })
        assert.strict.deepEqual(r.sum.events.total, 0)
        assert.strict.deepEqual(dl.n, 1) //下載管理器照常下載
    })

    it('入口(四入口: execute、upload、blob 下載、下載管理器): 有給而非 AbortSignal 者以 invalid opt.signal 拒絕且每次一則事件; 呼叫時已中止者以 signal.reason 拒絕、0 則事件、不呼叫 getToken、不送出(C2、C3)', async function() {
        let { page, dl } = await openPage()
        let r = await page.evaluate(async() => {
            let rec = window.genRec(null)
            let wo = window.mk(rec)
            let msgs = []
            let bads = [{}, 'x', true, 1, { aborted: false }, new AbortController()]
            for (let bad of bads) {
                msgs.push((await window.settle(wo.execute('f', {}, null, { signal: bad }))).e)
                msgs.push((await window.settle(wo.upload('x.bin', new File([new Uint8Array(10)], 'x.bin'), null, { signal: bad }))).e)
                msgs.push((await window.settle(wo.download('small', null, { downloadByManager: false, signal: bad }))).e)
                msgs.push((await window.settle(wo.download('small', null, { signal: bad }))).e)
            }
            let nEventsInvalid = rec.events.length
            let ac = new AbortController()
            ac.abort()
            rec.signal = ac.signal
            let calls = [
                () => wo.execute('f', {}, null, { signal: ac.signal }),
                () => wo.upload('x.bin', new File([new Uint8Array(10)], 'x.bin'), null, { signal: ac.signal }),
                () => wo.upload('x.bin', null, null, { signal: ac.signal }), //輸入亦不支援: 中止優先
                () => wo.download('small', null, { downloadByManager: false, signal: ac.signal }),
                () => wo.download('small', null, { signal: ac.signal }),
            ]
            let pre = []
            for (let call of calls) {
                let x = await window.settle(call(), ac.signal)
                pre.push({ ok: x.ok, isReason: x.isReason })
            }
            await window.sleep(500)
            return { msgs, nEventsInvalid, nBads: bads.length, pre, sum: rec.sum() }
        })
        assert.strict.deepEqual(r.msgs, r.msgs.map(() => msgInvalidSignal))
        assert.strict.deepEqual(r.msgs.length, r.nBads * 4)
        assert.strict.deepEqual(r.nEventsInvalid, r.nBads * 4) //每次呼叫恰一則
        assert.strict.deepEqual(r.pre, r.pre.map(() => ({ ok: false, isReason: true })))
        assert.strict.deepEqual(r.sum.events.total, r.nBads * 4) //已中止之 5 次呼叫 0 則
        assert.strict.deepEqual(r.sum.tokens.total, 0)
        assert.strict.deepEqual(sv.reqs, [])
        assert.strict.deepEqual(dl.n, 0)
    })

    it('execute: 伺服端處理中中止(XHR 中止)→ 立即以 reason 拒絕、0 則事件; 伺服端之應用端照常執行完畢(C11 結果未知)', async function() {
        let { page } = await openPage()
        let r = await page.evaluate(async() => {
            let ac = new AbortController()
            let rec = window.genRec(ac.signal)
            let wo = window.mk(rec)
            let p = window.settle(wo.execute('slow', {}, null, { signal: ac.signal }), ac.signal)
            setTimeout(() => rec.abort(ac), 200)
            let x = await p
            let lag = Date.now() - rec.tAbort
            return { x, lag, sum: rec.sum() }
        })
        await w.delay(800)
        assert.strict.deepEqual({ ok: r.x.ok, isReason: r.x.isReason, name: r.x.name }, { ok: false, isReason: true, name: 'AbortError' })
        assert.strict.deepEqual(r.lag < 300, true, `中止至拒絕 ${r.lag}ms`)
        assert.strict.deepEqual(r.sum.events.total, 0)
        assert.strict.deepEqual(sv.exec, { calls: 1, done: 1 })
    })

    it('execute: 回應已到、續行未執行時(轉換回應本體之時點)中止 → 以 reason 拒絕而非以值 resolve、0 則事件(C7)', async function() {
        let { page } = await openPage()
        let r = await page.evaluate(async() => {
            let ac = new AbortController()
            let rec = window.genRec(ac.signal)
            let wo = window.mk(rec)
            window.__hookAB = () => rec.abort(ac)
            let x = await window.settle(wo.execute('plain', {}, null, { signal: ac.signal }), ac.signal)
            let hooked = window.__hookAB === null && rec.tAbort !== null
            window.__hookAB = null
            return { x, hooked, sum: rec.sum() }
        })
        assert.strict.deepEqual(r.hooked, true, '未於轉換回應本體時中止, 本格未測到')
        assert.strict.deepEqual({ ok: r.x.ok, isReason: r.x.isReason }, { ok: false, isReason: true })
        assert.strict.deepEqual(r.sum.events.total, 0)
        assert.strict.deepEqual(sv.exec.calls, 1)
    })

    it('upload(File): 切片之間於 cbProgress 內中止 → 以 reason 拒絕、0 則事件、其後 cbProgress 0 次、不再送切片; 伺服端保留已傳切片', async function() {
        let { page } = await openPage()
        let size = 65536 * 20 + 5
        let fill = 13
        let h = await w.getFileXxHash(new Blob([Buffer.alloc(size, fill)]))
        let r = await page.evaluate(async({ size, fill }) => {
            let ac = new AbortController()
            let rec = window.genRec(ac.signal)
            let wo = window.mk(rec)
            let file = new File([new Uint8Array(size).fill(fill)], 'b5.bin')
            let x = await window.settle(wo.upload('b5.bin', file, (m) => {
                rec.mark('progress', m.prog)
                if (m.prog > 30 && !ac.signal.aborted) {
                    rec.abort(ac)
                }
            }, { signal: ac.signal }), ac.signal)
            await window.sleep(500)
            return { x, sum: rec.sum() }
        }, { size, fill })
        let kept = fs.readdirSync(fdUp).filter((n) => n.startsWith(`${h}_`)).length
        assert.strict.deepEqual({ ok: r.x.ok, isReason: r.x.isReason }, { ok: false, isReason: true })
        assert.strict.deepEqual(r.sum.progress.after, 0)
        assert.strict.deepEqual(r.sum.events.total, 0)
        assert.strict.deepEqual(kept > 0 && kept < 21, true, `已存切片 ${kept}`)
        assert.strict.deepEqual(sv.reqs.filter((x) => x === 'apiUploadSlice').length, kept) //中止後未再送切片
        assert.strict.deepEqual(sv.upload.calls, 0)
    })

    it('blob 下載: 接收中於 6 個時點中止(涵蓋 axios 進度節流之相位; 複審 RB2x、RB2t)→ abort() 同步期間與其後 cbProgress 皆 0 次, 拋錯之 cbProgress 不發事件', async function() {
        let { page } = await openPage()
        let rows = await page.evaluate(async() => {
            let out = []
            let ats = [600, 710, 820, 930, 1040, 1150]
            for (let i = 0; i < ats.length; i++) {
                let ac = new AbortController()
                let rec = window.genRec(ac.signal)
                let throwing = i % 2 === 1 //奇數列: cbProgress 於中止後拋錯
                let wo = window.mk(rec)
                let p = window.settle(wo.download('slow', (m) => {
                    rec.mark('progress', m.p)
                    if (throwing && ac.signal.aborted) {
                        throw new Error('ui already torn down')
                    }
                }, { downloadByManager: false, signal: ac.signal }), ac.signal)
                setTimeout(() => rec.abort(ac), ats[i])
                let x = await p
                await window.sleep(700) //axios 之節流尾端計時器 ≤ 1000/3 ms
                let s = rec.sum()
                out.push({ at: ats[i], throwing, ok: x.ok, isReason: x.isReason, before: s.progress.total - s.progress.after, inside: s.progress.inside, after: s.progress.after, events: s.events.total })
            }
            return out
        })
        for (let row of rows) {
            assert.strict.deepEqual({ ...row, before: row.before > 0 }, { at: row.at, throwing: row.throwing, ok: false, isReason: true, before: true, inside: 0, after: 0, events: 0 }, JSON.stringify(rows))
        }
    })

    it('blob 下載: getToken 懸置中中止 → 立即以 reason 拒絕、不送出、0 則事件; 其後 getToken 之 promise 才 resolve 亦不送出', async function() {
        let { page } = await openPage()
        let r = await page.evaluate(async() => {
            let ac = new AbortController()
            let rec = window.genRec(ac.signal)
            let wo = window.mk(rec, { token: () => window.sleep(1500).then(() => 't') })
            let p = window.settle(wo.download('small', null, { downloadByManager: false, signal: ac.signal }), ac.signal)
            setTimeout(() => rec.abort(ac), 100)
            let x = await p
            let lag = Date.now() - rec.tAbort
            await window.sleep(1700)
            return { x, lag, sum: rec.sum() }
        })
        assert.strict.deepEqual({ ok: r.x.ok, isReason: r.x.isReason }, { ok: false, isReason: true })
        assert.strict.deepEqual(r.lag < 500, true, `中止至拒絕 ${r.lag}ms`)
        assert.strict.deepEqual(r.sum.tokens, { total: 1, after: 0, inside: 0 })
        assert.strict.deepEqual(r.sum.events.total, 0)
        assert.strict.deepEqual(sv.reqs, [])
    })

    it('blob 下載: 伺服端處理中中止 → 立即以 reason 拒絕、0 則事件; 伺服端之應用端 download 事件已觸發(C11)', async function() {
        let { page } = await openPage()
        let r = await page.evaluate(async() => {
            let ac = new AbortController()
            let rec = window.genRec(ac.signal)
            let wo = window.mk(rec)
            let p = window.settle(wo.download('delay', null, { downloadByManager: false, signal: ac.signal }), ac.signal)
            setTimeout(() => rec.abort(ac), 300)
            let x = await p
            let lag = Date.now() - rec.tAbort
            await window.sleep(1000)
            return { x, lag, sum: rec.sum() }
        })
        assert.strict.deepEqual({ ok: r.x.ok, isReason: r.x.isReason }, { ok: false, isReason: true })
        assert.strict.deepEqual(r.lag < 300, true, `中止至拒絕 ${r.lag}ms`)
        assert.strict.deepEqual(r.sum.events.total, 0)
        assert.strict.deepEqual(sv.download, ['delay'])
    })

    it('blob 下載: 退避中中止(連不上, retryDownload=2)→ 立即拒絕; 事件與重試訊息只有中止前那一次, 其後不再重試、不再呼叫 getToken(C4、C9)', async function() {
        let { page } = await openPage()
        let r = await page.evaluate(async(urlClosed) => {
            let ac = new AbortController()
            let rec = window.genRec(ac.signal)
            let wo = window.mk(rec, { opt: { url: urlClosed, retryDownload: 2 } })
            let p = window.settle(wo.download('small', null, { downloadByManager: false, signal: ac.signal }), ac.signal)
            let t0 = Date.now()
            while (rec.events.length < 1 && Date.now() - t0 < 10000) {
                await window.sleep(10)
            }
            await window.sleep(150) //落在第 1 次退避(1 秒)之中
            rec.abort(ac)
            let x = await p
            let lag = Date.now() - rec.tAbort
            await window.sleep(1500) //未中止時第 2 次嘗試約於第 1 次失敗後 1 秒發生
            return { x, lag, sum: rec.sum() }
        }, urlClosed)
        assert.strict.deepEqual({ ok: r.x.ok, isReason: r.x.isReason }, { ok: false, isReason: true })
        assert.strict.deepEqual(r.lag < 300, true, `中止至拒絕 ${r.lag}ms(退避計時器未被中止時約 850ms)`)
        assert.strict.deepEqual(r.sum.events, { total: 1, after: 0, inside: 0 })
        assert.strict.deepEqual(r.sum.logs, { total: 1, after: 0, inside: 0 })
        assert.strict.deepEqual(r.sum.tokens, { total: 1, after: 0, inside: 0 })
    })

    it('blob 下載: 已 settle 之後中止 → 無作用(值照常、0 則事件)(C6)', async function() {
        let { page } = await openPage()
        let r = await page.evaluate(async() => {
            let ac = new AbortController()
            let rec = window.genRec(ac.signal)
            let wo = window.mk(rec)
            let x = await window.settle(wo.download('small', null, { downloadByManager: false, signal: ac.signal }), ac.signal)
            rec.abort(ac)
            await window.sleep(200)
            return { ok: x.ok, filename: x.ok ? x.v.filename : null, size: x.ok ? x.v.bb.size : null, sum: rec.sum() }
        })
        assert.strict.deepEqual({ ok: r.ok, filename: r.filename, size: r.size }, { ok: true, filename: 'small.bin', size: 2000 })
        assert.strict.deepEqual(r.sum.events.total, 0)
    })

    it('下載管理器: 交出前之取 token 懸置中中止 → 以 reason 拒絕、不交給瀏覽器(0 次下載)、不再呼叫 getToken、0 則事件(C10)', async function() {
        let { page, dl } = await openPage()
        let r = await page.evaluate(async() => {
            let ac = new AbortController()
            let rec = window.genRec(ac.signal)
            //第 1 次 getToken 供取檔名之請求(立即); 第 2 次為交給下載管理器前之取 token(懸置 1 秒), 於其開始後 100ms 中止
            let wo = window.mk(rec, {
                token: (n) => {
                    if (n === 1) {
                        return 't'
                    }
                    setTimeout(() => rec.abort(ac), 100)
                    return window.sleep(1000).then(() => 't2')
                },
            })
            let x = await window.settle(wo.download('small', null, { signal: ac.signal }), ac.signal)
            await window.sleep(1500)
            return { x, sum: rec.sum() }
        })
        assert.strict.deepEqual({ ok: r.x.ok, isReason: r.x.isReason }, { ok: false, isReason: true })
        assert.strict.deepEqual(r.sum.tokens, { total: 2, after: 0, inside: 0 })
        assert.strict.deepEqual(r.sum.events.total, 0)
        assert.strict.deepEqual(dl.n, 0)
        assert.strict.deepEqual(sv.reqs.filter((x) => x === 'apiDownloadGetFile'), [])
        assert.strict.deepEqual(sv.download, ['small']) //只有取檔名之請求觸發之一次
    })

    it('下載管理器: 已取得 token、交給瀏覽器之前(組下載網址之時點)中止 → 以 reason 拒絕、0 次下載(交出前最後一次檢查; C10)', async function() {
        let { page, dl } = await openPage()
        let r = await page.evaluate(async() => {
            let ac = new AbortController()
            let rec = window.genRec(ac.signal)
            let wo = window.mk(rec, { token: (n) => (n === 1 ? 't' : 'tk-handoff') })
            window.__hookEnc = (v) => {
                if (v === 'tk-handoff') {
                    rec.abort(ac)
                    return true
                }
                return false
            }
            let x = await window.settle(wo.download('small', null, { signal: ac.signal }), ac.signal)
            let hooked = window.__hookEnc === null && rec.tAbort !== null
            window.__hookEnc = null
            await window.sleep(1500)
            return { x, hooked, sum: rec.sum() }
        })
        assert.strict.deepEqual(r.hooked, true, '未於組下載網址時中止, 本格未測到')
        assert.strict.deepEqual({ ok: r.x.ok, isReason: r.x.isReason }, { ok: false, isReason: true })
        assert.strict.deepEqual(r.sum.events.total, 0)
        assert.strict.deepEqual(dl.n, 0)
        assert.strict.deepEqual(sv.reqs.filter((x) => x === 'apiDownloadGetFile'), [])
    })

    it('下載管理器: 取檔名之回應已到、續行未執行時中止 → 以 reason 拒絕、不再呼叫 getToken、0 次下載(C7、C10)', async function() {
        let { page, dl } = await openPage()
        let r = await page.evaluate(async() => {
            let ac = new AbortController()
            let rec = window.genRec(ac.signal)
            let wo = window.mk(rec)
            window.__hookAB = () => rec.abort(ac)
            let x = await window.settle(wo.download('small', null, { signal: ac.signal }), ac.signal)
            let hooked = window.__hookAB === null && rec.tAbort !== null
            window.__hookAB = null
            await window.sleep(1500)
            return { x, hooked, sum: rec.sum() }
        })
        assert.strict.deepEqual(r.hooked, true, '未於轉換回應本體時中止, 本格未測到')
        assert.strict.deepEqual({ ok: r.x.ok, isReason: r.x.isReason }, { ok: false, isReason: true })
        assert.strict.deepEqual(r.sum.tokens, { total: 1, after: 0, inside: 0 }) //只有取檔名之請求那一次
        assert.strict.deepEqual(r.sum.events.total, 0)
        assert.strict.deepEqual(dl.n, 0)
        assert.strict.deepEqual(sv.download, ['small'])
    })

    it('下載管理器: 交給瀏覽器之後中止 → 無作用, 下載照常由瀏覽器完成(JSDoc: 交出後不可中止)', async function() {
        let { page, dl } = await openPage()
        let pmDownload = page.waitForEvent('download', { timeout: 60000 })
        let r = await page.evaluate(async() => {
            let ac = new AbortController()
            let rec = window.genRec(ac.signal)
            let wo = window.mk(rec)
            let x = await window.settle(wo.download('small', null, { signal: ac.signal }), ac.signal)
            rec.abort(ac)
            return { x, sum: rec.sum() }
        })
        let download = await pmDownload
        assert.strict.deepEqual(r.x, { ok: true, v: 'small.bin' })
        assert.strict.deepEqual(download.suggestedFilename(), 'small.bin')
        assert.strict.deepEqual(dl.n, 1)
        assert.strict.deepEqual(r.sum.events.total, 0)
    })

})
