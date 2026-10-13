import assert from 'assert'
import fs from 'fs'
import path from 'path'
import stream from 'stream'
import events from 'events'
import { spawn } from 'child_process'
import { pathToFileURL } from 'url'
import axios from 'axios'
import w from 'wsemi'
import WConverhpServer from '../src/WConverhpServer.mjs'
import WConverhpClient from '../src/WConverhpClient.mjs'
import wPorts from './tools/ports.mjs'


let { portOf, reserved } = wPorts


/**
 * api: client 之前端中止(opt.signal; 規則帳本 R27)
 *
 * 規格為 src/WConverhpClient.mjs 建構函數 @returns 之「中止(opt.signal)」段與三個公開方法之 @param opt.signal(以下以契約代號標註, 見 run01 審計回應 §5.2):
 *   C1 未給(undefined、null)或未給 opt: 行為與未支援中止前相同, 交 axios 之組態不帶 signal
 *   C2 有給而非 AbortSignal: 入口即以 'invalid opt.signal: must be an AbortSignal' 拒絕並發一則 error 事件
 *   C3 呼叫時已中止: 以 signal.reason 拒絕、0 則事件、不呼叫 getToken、不送出(先於其他入口檢核)
 *   C4 自 abort() 被呼叫(含其同步期間)起: 不再發 error 事件、不再呼叫 getToken 與 cbProgress、不再印重試訊息、不再重試; 中止前已發出者不收回
 *   C5 拒絕值為 signal.reason 原樣(不經訊息轉換); 以 signal.aborted 判別中止
 *   C6 已 settle 之呼叫不受影響; 呼叫結束即移除對外部 signal 之監聽
 *   C7 中止時尚未 settle 者一律以 reason 拒絕, 即使內部已取得回應而續行尚未執行
 *   C8 只及於該次呼叫(含其全部內部請求); 同一物件之其他呼叫不受影響
 *   C9 釋放本端之等待(在途請求、退避、合併輪詢), 中止後行程可立即結束
 *   C11 只保證本端: 伺服端已開始之處理照常完成, 結果未知; upload 中止後再傳同一內容自已存之切片續傳
 *
 * 軸(run01 全盤 M2、M3、M5): 入口(execute、upload、download nodejs)× 中止階段(呼叫時已中止、getToken 懸置、本體傳送中、伺服端處理中、
 * 回應接收中、退避中、雜湊中、切片之間、合併輪詢中、回應已到而續行未執行、已 settle)× 觸發時序(巨任務、微任務、同步於 cbProgress / error 監聽器 / getToken 內)。
 * 瀏覽器兩欄(blob、下載管理器)見 test/e2e-abort.test.mjs。
 *
 * 量測定義:「中止之後」= 自 abort() 被呼叫起(含其同步期間), 不是 settle 之後 —— run01 曾以「settle 之後」代替而量不到 axios 於取消時補送之進度(複審 R1)。
 * 各輸出通道之每一次輸出於發生當下記錄 signal.aborted: DOM 規範之 signal abort 先設 aborted 與 reason, 才執行中止演算法並派發 abort 事件,
 * 故 abort() 同步期間之輸出其 signal.aborted 已為 true, 一併計入。
 * 「回應已到、續行未執行」之時點以 axios 之 response interceptor 決定性取得(於回應通過 axios 之後、client 之續行之前呼叫 abort())。
 */
describe('api-clientAbort', function() {
    this.timeout(60000)

    let port = portOf('api-clientAbort', 0)
    let portMismatch = portOf('api-clientAbort', 1)
    let portBigSlice = portOf('api-clientAbort', 2)
    let portClosed = reserved.closed //刻意無人監聽: 連線失敗而進入重試退避

    let sizeSlice = 64 * 1024
    let sizeSliceBig = 16 * 1024 * 1024

    let fdRoot = path.resolve('./test/_tmp/api-clientAbort')
    let fdUp = path.join(fdRoot, 'up')
    let fdUpMismatch = path.join(fdRoot, 'upMismatch')
    let fdUpBig = path.join(fdRoot, 'upBig')
    let fdDl = path.join(fdRoot, 'dl')

    let msgInvalidSignal = 'invalid opt.signal: must be an AbortSignal'

    let listenersOf = (signal) => events.getEventListeners(signal, 'abort').length
    let settle = (p) => p.then((v) => ({ ok: true, v }), (e) => ({ ok: false, e }))
    let hashOf = (b) => w.getFileXxHash(new Blob([b]))
    let waitFor = async(fn, ms = 15000) => {
        let t0 = Date.now()
        while (!fn()) {
            if (Date.now() - t0 > ms) {
                throw new Error(`waitFor: ${ms}ms 內條件未成立`)
            }
            await w.delay(10)
        }
    }

    //uniq, 每次上傳之內容皆不同: 同一伺服器之暫存夾跨測試共用, 內容相同會被 check-total-hash 去重而改走另一條路徑
    let seq = 0
    let uniq = (n) => {
        seq += 1
        let b = Buffer.alloc(n, (seq % 250) + 1)
        b.writeUInt32LE(seq * 7919, 0)
        return b
    }

    //st, 伺服端之觀察(每個測試重設)
    let st = null
    let resetSt = () => {
        st = {
            errs: [], //伺服端 error 事件
            reqs: [], //通過權限之請求(handler 事件): { api, t }
            exec: { calls: 0, done: 0 },
            upload: { calls: 0, froms: [], mode: 'accept', onCall: null },
            download: { calls: 0 },
            onHandler: null,
        }
    }
    resetSt()

    //genRec, 一次被測呼叫之觀察紀錄: error 事件、cbProgress、console 重試訊息、getToken 之每一次輸出各記一筆, 並記當下 signal 是否已中止(見檔頭之量測定義)
    let curRec = null
    let genRec = () => {
        let rec = { signal: null, inAbort: false, events: [], progress: [], logs: [], tokens: [], tAbort: null }
        rec.mark = (k, v) => {
            rec[k].push({ v, aborted: rec.signal ? rec.signal.aborted === true : false, inAbort: rec.inAbort })
        }
        rec.abort = (ac, reason) => {
            rec.inAbort = true
            try {
                ac.abort(reason)
            }
            finally {
                rec.inAbort = false
                rec.tAbort = Date.now()
            }
        }
        rec.after = (k) => rec[k].filter((x) => x.aborted)
        rec.inside = (k) => rec[k].filter((x) => x.inAbort)
        curRec = rec
        return rec
    }

    //mkClient, 被測之 client: getToken 與 error 事件經 rec 記錄
    let mkClient = (rec, o = {}) => {
        let wo = new WConverhpClient({
            url: `http://127.0.0.1:${o.port !== undefined ? o.port : port}`,
            apiName: 'api',
            sizeSlice,
            timeout: 8000,
            getToken: () => {
                rec.mark('tokens')
                return o.getToken ? o.getToken() : 't'
            },
            ...o.opt,
        })
        wo.on('error', (e) => {
            rec.mark('events', e)
            if (o.onError) {
                o.onError(e)
            }
        })
        return wo
    }

    //cbOf, 記錄每一次 cbProgress 之呼叫; act 可於其內中止或拋錯
    let cbOf = (rec, act) => {
        return (m) => {
            rec.mark('progress', m)
            if (act) {
                act(m)
            }
        }
    }

    //interceptor: hookRes 於回應通過 axios 之後、client 續行之前被呼叫(「回應已到、續行未執行」之決定性時點); reqSignals 為陣列時記錄每個請求交給 axios 之 config.signal
    let hookRes = null
    let reqSignals = null
    let idRes = null
    let idReq = null
    let infoOf = (config) => {
        let mode = ''
        try {
            mode = JSON.parse(config.data).mode || ''
        }
        catch (err) {}
        return { url: String(config.url), mode }
    }

    let wss = []
    let mkServer = (p, pathUploadTemp, sz) => {
        let ws = new WConverhpServer({ port: p, apiName: 'api', useInert: false, pathUploadTemp, sizeSlice: sz, delayForSlice: 0 })
        ws.on('error', (e) => {
            st.errs.push(String(e))
        })
        ws.on('handler', (d) => {
            st.reqs.push({ api: d.api, t: Date.now() })
            if (st.onHandler) {
                st.onHandler(d)
            }
        })
        ws.on('execute', (func, input, pm) => {
            st.exec.calls += 1
            if (String(func).startsWith('slow')) {
                setTimeout(() => {
                    st.exec.done += 1
                    pm.resolve({ v: func })
                }, 600)
                return
            }
            st.exec.done += 1
            pm.resolve({ v: func })
        })
        ws.on('upload', (input, pm) => {
            st.upload.calls += 1
            st.upload.froms.push(input.from)
            if (st.upload.onCall) {
                st.upload.onCall(input)
            }
            if (st.upload.mode === 'reject') {
                pm.reject('app rejects')
                return
            }
            if (st.upload.mode === 'delay') {
                setTimeout(() => pm.resolve({ got: input.filenameSafe }), 1000)
                return
            }
            pm.resolve({ got: input.filenameSafe })
        })
        ws.on('download', (input, pm) => {
            st.download.calls += 1
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
            pm.resolve({ streamRead: stream.Readable.from([Buffer.alloc(2000, 1)], { objectMode: false }), filename: 'small.bin', fileSize: 2000, fileType: 'application/octet-stream' }) //hapi 不接受 objectMode 之串流, Readable.from 預設為 objectMode
        })
        wss.push(ws)
        return ws
    }

    let oriLog = console.log

    before(async function() {
        fs.rmSync(fdRoot, { recursive: true, force: true })
        for (let fd of [fdUp, fdUpMismatch, fdUpBig, fdDl]) {
            fs.mkdirSync(fd, { recursive: true })
        }
        mkServer(port, fdUp, sizeSlice)
        mkServer(portMismatch, fdUpMismatch, sizeSlice * 2) //與 client 之 sizeSlice 不一致
        mkServer(portBigSlice, fdUpBig, sizeSliceBig)
        idRes = axios.interceptors.response.use((res) => {
            if (hookRes) {
                hookRes(infoOf(res.config))
            }
            return res
        })
        idReq = axios.interceptors.request.use((c) => {
            if (reqSignals) {
                reqSignals.push(c.signal)
            }
            return c
        })
        await w.delay(1000) //待伺服器啟動
    })

    after(async function() {
        axios.interceptors.response.eject(idRes)
        axios.interceptors.request.eject(idReq)
        for (let ws of wss) {
            await ws.stop()
        }
        fs.rmSync(fdRoot, { recursive: true, force: true })
    })

    beforeEach(function() {
        resetSt()
        hookRes = null
        reqSignals = null
        curRec = null
        //console 重試訊息('wait ...'、'retry n=...')記入當下之 rec, 其餘照常輸出
        console.log = (...a) => {
            let s = a.map(String).join(' ')
            if (curRec && /^(wait |retry n=)/.test(s)) {
                curRec.mark('logs', s)
                return
            }
            oriLog(...a)
        }
    })

    afterEach(function() {
        console.log = oriLog
        hookRes = null
        reqSignals = null
        curRec = null
    })

    describe('一、入口: signal 之形態(M3)', function() {

        it('C1 未給 opt、opt 為 {}、signal 為 undefined 或 null: 照常完成、0 則事件, 交給 axios 之每個請求之組態皆不帶 signal', async function() {
            let rec = genRec()
            let wo = mkClient(rec)
            reqSignals = []
            let rs = [
                await settle(wo.execute('plain', { a: 1 })),
                await settle(wo.execute('plain', { a: 1 }, null)),
                await settle(wo.execute('plain', { a: 1 }, null, {})),
                await settle(wo.execute('plain', { a: 1 }, null, { signal: undefined })),
                await settle(wo.execute('plain', { a: 1 }, null, { signal: null })),
                await settle(wo.upload('c1.bin', uniq(1000), null, { signal: null })),
                await settle(wo.download('small', null, { fdDownload: path.join(fdDl, 'c1'), signal: undefined })),
            ]
            let sigs = reqSignals
            reqSignals = null
            for (let i = 0; i < 5; i++) {
                assert.strict.deepEqual(rs[i], { ok: true, v: { v: 'plain' } }, `execute #${i}`)
            }
            assert.strict.deepEqual(rs[5], { ok: true, v: { got: 'c1.bin' } })
            assert.strict.deepEqual(rs[6].ok, true)
            assert.strict.deepEqual(fs.readFileSync(rs[6].v).length, 2000)
            assert.strict.deepEqual(rec.events.length, 0)
            //C1: 交 axios 之組態不帶 signal(與未支援中止前相同)
            assert.strict.deepEqual(sigs.length >= 7, true, `請求數 ${sigs.length}`)
            assert.strict.deepEqual(sigs.filter((s) => s !== undefined).length, 0)
        })

        it('C2(Q2) 有給而非 AbortSignal(含誤把 AbortController 本身給入): 三方法皆於入口以 invalid opt.signal 拒絕、每次呼叫恰一則事件、不呼叫 getToken、不送出', async function() {
            let rec = genRec()
            let wo = mkClient(rec)
            let bads = [{}, 'x', true, 1, { aborted: false }, new AbortController()]
            let rs = []
            for (let bad of bads) {
                rs.push(await settle(wo.execute('f', {}, null, { signal: bad })))
                rs.push(await settle(wo.upload('c2.bin', uniq(100), null, { signal: bad })))
                rs.push(await settle(wo.download('small', null, { fdDownload: path.join(fdDl, 'c2'), signal: bad })))
            }
            for (let r of rs) {
                assert.strict.deepEqual(r, { ok: false, e: msgInvalidSignal })
            }
            assert.strict.deepEqual(rec.events.map((x) => x.v), rs.map(() => msgInvalidSignal)) //每次呼叫恰一則
            assert.strict.deepEqual(rec.tokens.length, 0)
            assert.strict.deepEqual(st.reqs.length, 0)
        })

        it('C3(Q3) 呼叫時已中止: 以 signal.reason 原樣拒絕、0 則事件、不呼叫 getToken 與 cbProgress、不送出; 先於其他入口檢核(upload 輸入不支援、未給 fdDownload)', async function() {
            let rec = genRec()
            let wo = mkClient(rec)
            let ac = new AbortController()
            ac.abort()
            rec.signal = ac.signal
            let sigCustom = AbortSignal.abort('pre-custom')
            let cb = cbOf(rec)
            let rs = [
                [ac.signal, await settle(wo.execute('f', {}, cb, { signal: ac.signal }))],
                [ac.signal, await settle(wo.upload('c3.bin', uniq(100), cb, { signal: ac.signal }))],
                [ac.signal, await settle(wo.upload('c3.bin', null, cb, { signal: ac.signal }))], //輸入亦不支援: 中止優先
                [ac.signal, await settle(wo.download('small', cb, { signal: ac.signal }))], //未給 fdDownload: 中止優先
                [ac.signal, await settle(wo.download('small', cb, { fdDownload: path.join(fdDl, 'c3'), signal: ac.signal }))],
                [sigCustom, await settle(wo.execute('f', {}, cb, { signal: sigCustom }))],
            ]
            await w.delay(200)
            for (let [sig, r] of rs) {
                assert.strict.deepEqual(r.ok, false)
                assert.strict.equal(r.e, sig.reason) //C5: 原樣
            }
            assert.strict.deepEqual(rs[0][1].e.name, 'AbortError')
            assert.strict.deepEqual(rs[5][1].e, 'pre-custom')
            assert.strict.deepEqual(rec.events.length, 0)
            assert.strict.deepEqual(rec.tokens.length, 0)
            assert.strict.deepEqual(rec.progress.length, 0)
            assert.strict.deepEqual(st.reqs.length, 0)
            assert.strict.deepEqual(fs.existsSync(path.join(fdDl, 'c3')), false)
            assert.strict.deepEqual(listenersOf(ac.signal), 0)
        })

    })

    describe('二、execute 之中止階段(M2 execute 欄)與觸發時序(M5)', function() {

        it('getToken 懸置中中止(巨任務): 立即以 reason 拒絕、不送出、0 則事件; 其後 getToken 之 promise 才 resolve 亦不送出', async function() {
            let rec = genRec()
            let ac = new AbortController()
            rec.signal = ac.signal
            let wo = mkClient(rec, { getToken: () => w.delay(1500).then(() => 't') })
            let p = settle(wo.execute('f', {}, null, { signal: ac.signal }))
            setTimeout(() => rec.abort(ac), 100)
            let r = await p
            let lag = Date.now() - rec.tAbort
            await w.delay(1700)
            assert.strict.deepEqual(r.ok, false)
            assert.strict.equal(r.e, ac.signal.reason)
            assert.strict.deepEqual(lag < 500, true, `中止至拒絕 ${lag}ms`)
            assert.strict.deepEqual(rec.tokens.length, 1) //中止前之那一次
            assert.strict.deepEqual(rec.after('tokens').length, 0)
            assert.strict.deepEqual(st.reqs.length, 0)
            assert.strict.deepEqual(rec.events.length, 0)
            assert.strict.deepEqual(listenersOf(ac.signal), 0)
        })

        it('同步於 getToken 內中止: 以 reason 拒絕、不送出、0 則事件、不再呼叫 getToken', async function() {
            let rec = genRec()
            let ac = new AbortController()
            rec.signal = ac.signal
            let wo = mkClient(rec, {
                getToken: () => {
                    rec.abort(ac, 'abort-in-getToken')
                    return 't'
                },
            })
            let r = await settle(wo.execute('f', {}, null, { signal: ac.signal }))
            await w.delay(300)
            assert.strict.deepEqual(r, { ok: false, e: 'abort-in-getToken' })
            assert.strict.deepEqual(rec.tokens.length, 1)
            assert.strict.deepEqual(st.reqs.length, 0)
            assert.strict.deepEqual(rec.events.length, 0)
        })

        it('本體傳送中中止(伺服端收到請求、本體未收完時): 以 reason 拒絕、0 則事件; 伺服端恰一則 receive payload error、應用端 0 次', async function() {
            let rec = genRec()
            let ac = new AbortController()
            rec.signal = ac.signal
            let wo = mkClient(rec)
            st.onHandler = (d) => {
                if (d.api === 'apiMain' && !ac.signal.aborted) {
                    rec.abort(ac)
                }
            }
            let r = await settle(wo.execute('f', { big: new Uint8Array(32 * 1024 * 1024) }, null, { signal: ac.signal }))
            await w.delay(800)
            assert.strict.deepEqual(r.ok, false)
            assert.strict.equal(r.e, ac.signal.reason)
            assert.strict.deepEqual(rec.events.length, 0)
            assert.strict.deepEqual(st.exec.calls, 0)
            assert.strict.deepEqual(st.errs, ['receive payload error: aborted']) //與斷線不可分辨, 刻意允許(run01 全盤 M4)
        })

        it('伺服端處理中中止: 立即以 reason 拒絕、0 則事件; 伺服端之應用端照常執行完畢且伺服端 0 則事件(C11 結果未知)', async function() {
            let rec = genRec()
            let ac = new AbortController()
            rec.signal = ac.signal
            let wo = mkClient(rec)
            let p = settle(wo.execute('slow', {}, null, { signal: ac.signal }))
            setTimeout(() => rec.abort(ac), 200)
            let r = await p
            let lag = Date.now() - rec.tAbort
            await w.delay(800)
            assert.strict.deepEqual(r.ok, false)
            assert.strict.equal(r.e, ac.signal.reason)
            assert.strict.deepEqual(lag < 300, true, `中止至拒絕 ${lag}ms`)
            assert.strict.deepEqual(rec.events.length, 0)
            assert.strict.deepEqual(st.exec, { calls: 1, done: 1 })
            assert.strict.deepEqual(st.errs, [])
        })

        it('同步於 cbProgress 內中止: 以 reason 拒絕、0 則事件; 其後(含 abort() 同步期間與 axios 取消時之補送)cbProgress 0 次', async function() {
            let rec = genRec()
            let ac = new AbortController()
            rec.signal = ac.signal
            let wo = mkClient(rec)
            let r = await settle(wo.execute('plain', { big: new Uint8Array(4 * 1024 * 1024) }, cbOf(rec, () => {
                if (!ac.signal.aborted) {
                    rec.abort(ac)
                }
            }), { signal: ac.signal }))
            await w.delay(800)
            assert.strict.deepEqual(r.ok, false)
            assert.strict.equal(r.e, ac.signal.reason)
            assert.strict.deepEqual(rec.progress.length, 1)
            assert.strict.deepEqual(rec.after('progress').length, 0)
            assert.strict.deepEqual(rec.events.length, 0)
        })

        it('退避中中止(連不上, retryMain=3): 立即拒絕; 事件與重試訊息只有中止前那一次, 其後 0 則、不再重試、不再呼叫 getToken(C4、C9)', async function() {
            let rec = genRec()
            let ac = new AbortController()
            rec.signal = ac.signal
            let wo = mkClient(rec, { port: portClosed, opt: { retryMain: 3 } })
            let p = settle(wo.execute('f', {}, null, { signal: ac.signal }))
            await waitFor(() => rec.events.length >= 1)
            await w.delay(150) //落在第 1 次退避(1 秒)之中
            rec.abort(ac)
            let r = await p
            let lag = Date.now() - rec.tAbort
            await w.delay(2000) //未中止時第 2 次嘗試約於第 1 次失敗後 1 秒發生
            assert.strict.deepEqual(r.ok, false)
            assert.strict.equal(r.e, ac.signal.reason)
            assert.strict.deepEqual(lag < 300, true, `中止至拒絕 ${lag}ms(退避計時器未被中止時約 850ms)`)
            assert.strict.deepEqual(rec.events.length, 1)
            assert.strict.deepEqual(rec.after('events').length, 0)
            assert.strict.deepEqual(rec.logs.map((x) => /^wait [0-9.]+\(second\) to retry\.\.\.$/.test(x.v)), [true]) //第 1 次退避之訊息, 於中止前印出
            assert.strict.deepEqual(rec.after('logs').length, 0)
            assert.strict.deepEqual(rec.tokens.length, 1)
            assert.strict.deepEqual(listenersOf(ac.signal), 0)
        })

        it('同步於 error 監聽器內中止(重入; 連不上, retryMain=3): 派發中之那一則之後 0 則、不印重試訊息、不再重試, 以 reason 拒絕', async function() {
            let rec = genRec()
            let ac = new AbortController()
            rec.signal = ac.signal
            let wo = mkClient(rec, { port: portClosed, opt: { retryMain: 3 }, onError: () => rec.abort(ac, 'abort-in-listener') })
            let r = await settle(wo.execute('f', {}, null, { signal: ac.signal }))
            await w.delay(1500)
            assert.strict.deepEqual(r, { ok: false, e: 'abort-in-listener' })
            assert.strict.deepEqual(rec.events.length, 1)
            assert.strict.deepEqual(rec.after('events').length, 0)
            assert.strict.deepEqual(rec.logs.length, 0)
            assert.strict.deepEqual(rec.tokens.length, 1)
            assert.strict.deepEqual(listenersOf(ac.signal), 0)
        })

        it('回應已到、續行未執行時中止(微任務窗口; 複審 T2): 以 reason 拒絕而非以值 resolve、0 則事件(C7); 伺服端已執行(C11)', async function() {
            let rec = genRec()
            let ac = new AbortController()
            rec.signal = ac.signal
            let wo = mkClient(rec)
            hookRes = (info) => {
                if (info.url.endsWith('/main') && !ac.signal.aborted) {
                    rec.abort(ac)
                }
            }
            let r = await settle(wo.execute('plain', {}, null, { signal: ac.signal }))
            assert.strict.deepEqual(rec.tAbort !== null, true, '未於回應通過 axios 後中止, 本格未測到')
            assert.strict.deepEqual(r.ok, false)
            assert.strict.equal(r.e, ac.signal.reason)
            assert.strict.deepEqual(rec.events.length, 0)
            assert.strict.deepEqual(st.exec.calls, 1)
        })

        it('已 settle 之後中止: 無作用(值照常、0 則事件), settle 時外部 signal 之監聽已為 0(C6)', async function() {
            let rec = genRec()
            let ac = new AbortController()
            rec.signal = ac.signal
            let wo = mkClient(rec)
            let r = await settle(wo.execute('plain', {}, null, { signal: ac.signal }))
            let l = listenersOf(ac.signal)
            rec.abort(ac)
            await w.delay(100)
            assert.strict.deepEqual(r, { ok: true, v: { v: 'plain' } })
            assert.strict.deepEqual(l, 0)
            assert.strict.deepEqual(rec.events.length, 0)
        })

        it('自訂 reason(字串、物件)原樣拒絕, 以 signal.aborted 判別中止; AbortSignal.timeout 為整體上限, 以 TimeoutError 拒絕(C5)', async function() {
            let rec = genRec()
            let wo = mkClient(rec)
            let out = []
            for (let reason of ['stop-by-broadcast', { code: 'teardown' }]) {
                let ac = new AbortController()
                let p = settle(wo.execute('slow', {}, null, { signal: ac.signal }))
                setTimeout(() => ac.abort(reason), 100)
                let r = await p
                out.push({ r, aborted: ac.signal.aborted, reason })
            }
            let sig = AbortSignal.timeout(150)
            let rt = await settle(wo.execute('slow', {}, null, { signal: sig }))
            await w.delay(700)
            for (let { r, aborted, reason } of out) {
                assert.strict.deepEqual(r.ok, false)
                assert.strict.equal(r.e, reason)
                assert.strict.deepEqual(aborted, true) //判別法: signal.aborted, 不以拒絕值之型別(字串 reason 與伺服器之業務錯誤字串同型)
            }
            assert.strict.deepEqual(rt.ok, false)
            assert.strict.equal(rt.e, sig.reason)
            assert.strict.deepEqual(rt.e.name, 'TimeoutError')
            assert.strict.deepEqual(rec.events.length, 0)
        })

        it('長壽 signal: 循序 100 次後外部監聽 0; 並發 30 次時每呼叫 1 個、結束後 0; 無 MaxListeners 警告(C6)', async function() {
            let rec = genRec()
            let wo = mkClient(rec)
            let warnings = []
            let onWarning = (x) => warnings.push(`${x.name}: ${x.message}`)
            process.on('warning', onWarning)
            try {
                let ac = new AbortController()
                for (let i = 0; i < 100; i++) {
                    await wo.execute('plain', { i }, null, { signal: ac.signal })
                }
                let lSeq = listenersOf(ac.signal)
                let ps = []
                for (let i = 0; i < 30; i++) {
                    ps.push(wo.execute('slow', { i }, null, { signal: ac.signal }))
                }
                await w.delay(50)
                let lPeak = listenersOf(ac.signal)
                await Promise.all(ps)
                let lEnd = listenersOf(ac.signal)
                await w.delay(50)
                assert.strict.deepEqual({ lSeq, lPeak, lEnd }, { lSeq: 0, lPeak: 30, lEnd: 0 })
                assert.strict.deepEqual(warnings, [])
                assert.strict.deepEqual(rec.events.length, 0)
            }
            finally {
                process.off('warning', onWarning)
            }
        })

        it('同一通訊物件之其他呼叫不受影響: A、B 各帶 signal 與 C 不帶, 只中止 A → 只有 A 拒絕(C8)', async function() {
            let rec = genRec()
            let wo = mkClient(rec)
            let acA = new AbortController()
            let acB = new AbortController()
            let pA = settle(wo.execute('slowA', {}, null, { signal: acA.signal }))
            let pB = settle(wo.execute('slowB', {}, null, { signal: acB.signal }))
            let pC = settle(wo.execute('slowC', {}))
            setTimeout(() => acA.abort(), 100)
            let [a, b, c] = await Promise.all([pA, pB, pC])
            assert.strict.deepEqual(a.ok, false)
            assert.strict.equal(a.e, acA.signal.reason)
            assert.strict.deepEqual(b, { ok: true, v: { v: 'slowB' } })
            assert.strict.deepEqual(c, { ok: true, v: { v: 'slowC' } })
            assert.strict.deepEqual(rec.events.length, 0)
        })

    })

    describe('三、upload 之中止階段(M2 upload 欄)', function() {

        it('整檔雜湊中中止(48MB): 立即以 reason 拒絕; 伺服端 0 請求、0 檔, 不呼叫 getToken', async function() {
            let rec = genRec()
            let ac = new AbortController()
            rec.signal = ac.signal
            let wo = mkClient(rec)
            let big = uniq(48 * 1024 * 1024)
            let h = await hashOf(big)
            //upload() 返回時其整檔雜湊必在等待中(calcHash 之第一個 await 之後), 於此同步中止即決定性地落在雜湊中;
            //不以計時器中止: 雜湊之 hasher.update 為同步計算, 計時器於其完成前無法觸發, 實測 30ms 之計時器會落在雜湊完成、check-total-hash 已送出之後
            let p = settle(wo.upload('u1.bin', big, null, { signal: ac.signal }))
            rec.abort(ac)
            let r = await p
            let lag = Date.now() - rec.tAbort
            await w.delay(1500)
            assert.strict.deepEqual(r.ok, false)
            assert.strict.equal(r.e, ac.signal.reason)
            assert.strict.deepEqual(lag < 500, true, `中止至拒絕 ${lag}ms`)
            assert.strict.deepEqual(st.reqs.length, 0)
            assert.strict.deepEqual(rec.tokens.length, 0)
            assert.strict.deepEqual(rec.events.length, 0)
            assert.strict.deepEqual(fs.readdirSync(fdUp).filter((n) => n.startsWith(h)), [])
        })

        it('切片之間於 cbProgress 內中止: 以 reason 拒絕、0 則事件、其後 cbProgress 0 次、不再送切片; 已存之切片保留, 再傳同一內容只補缺片並成功(C11)', async function() {
            let rec = genRec()
            let ac = new AbortController()
            rec.signal = ac.signal
            let wo = mkClient(rec)
            let buf = uniq(sizeSlice * 40 + 100) //41 片
            let h = await hashOf(buf)
            let nReqAtAbort = null
            let r = await settle(wo.upload('u2.bin', buf, cbOf(rec, (m) => {
                if (m.prog > 30 && !ac.signal.aborted) {
                    nReqAtAbort = st.reqs.length
                    rec.abort(ac)
                }
            }), { signal: ac.signal }))
            await w.delay(300)
            let kept = fs.readdirSync(fdUp).filter((n) => n.startsWith(`${h}_`)).length
            let nReqAfterAbort = st.reqs.length - nReqAtAbort
            assert.strict.deepEqual(r.ok, false)
            assert.strict.equal(r.e, ac.signal.reason)
            assert.strict.deepEqual(rec.after('progress').length, 0)
            assert.strict.deepEqual(rec.events.length, 0)
            assert.strict.deepEqual(nReqAfterAbort, 0)
            assert.strict.deepEqual(kept > 0 && kept < 41, true, `已存切片 ${kept}`)

            //再傳同一內容(不帶 signal): 只補缺片
            let n0 = st.reqs.filter((x) => x.api === 'apiUploadSlice').length
            let r2 = await settle(wo.upload('u2.bin', buf, null))
            let nSlice = st.reqs.filter((x) => x.api === 'apiUploadSlice').length - n0
            assert.strict.deepEqual(r2, { ok: true, v: { got: 'u2.bin' } })
            assert.strict.deepEqual(nSlice, 41 - kept)
        })

        it('切片本體傳送中中止(伺服端收到切片請求、本體未收完時): 以 reason 拒絕、0 則事件; 伺服端恰一則 receive chunk error 且不留不完整切片', async function() {
            let rec = genRec()
            let ac = new AbortController()
            rec.signal = ac.signal
            let wo = mkClient(rec, { port: portBigSlice, opt: { sizeSlice: sizeSliceBig } })
            let buf = uniq(sizeSliceBig * 2 + 10)
            let h = await hashOf(buf)
            st.onHandler = (d) => {
                if (d.api === 'apiUploadSlice' && !ac.signal.aborted) {
                    rec.abort(ac)
                }
            }
            let r = await settle(wo.upload('big.bin', buf, null, { signal: ac.signal }))
            await w.delay(800)
            assert.strict.deepEqual(r.ok, false)
            assert.strict.equal(r.e, ac.signal.reason)
            assert.strict.deepEqual(rec.events.length, 0)
            assert.strict.deepEqual(st.errs.length, 1, JSON.stringify(st.errs))
            assert.strict.deepEqual(st.errs[0].startsWith(`receive chunk[1/3] of packageId[${h}] error: `), true, st.errs[0]) //與斷線不可分辨, 刻意允許(run01 全盤 M4)
            assert.strict.deepEqual(fs.readdirSync(fdUpBig).filter((n) => n.startsWith(`${h}_`)), [])
            assert.strict.deepEqual(st.upload.calls, 0)
        })

        it('合併輪詢中中止(應用端恆拒絕之無限輪詢, retryUpload=0): 以 reason 拒絕、停止輪詢、其後 0 則事件與 0 個請求(C9)', async function() {
            let rec = genRec()
            let ac = new AbortController()
            rec.signal = ac.signal
            let wo = mkClient(rec, { opt: { retryUpload: 0 } })
            st.upload.mode = 'reject'
            let p = settle(wo.upload('u3.bin', uniq(1000), null, { signal: ac.signal }))
            await waitFor(() => rec.events.length >= 1) //第一輪查詢之業務錯誤
            let nReq = st.reqs.length
            let nApp = st.upload.calls
            rec.abort(ac)
            let r = await p
            await w.delay(4500) //輪詢間隔 2 秒: 未停止時此期間至少再 2 輪
            assert.strict.deepEqual(r.ok, false)
            assert.strict.equal(r.e, ac.signal.reason)
            assert.strict.deepEqual(rec.after('events').length, 0)
            assert.strict.deepEqual(st.reqs.length - nReq, 0)
            assert.strict.deepEqual(st.upload.calls - nApp, 0)
            assert.strict.deepEqual(listenersOf(ac.signal), 0)
        })

        it('merge-slices-push 之回應到達時中止: 以 reason 拒絕; 伺服端合併照常完成而應用端 0 次; 再傳同一內容以 check-total-hash 去重(C11)', async function() {
            let rec = genRec()
            let ac = new AbortController()
            rec.signal = ac.signal
            let wo = mkClient(rec, { opt: { retryUpload: 0 } })
            let buf = uniq(sizeSlice * 3 + 7)
            let h = await hashOf(buf)
            hookRes = (info) => {
                if (info.mode === 'merge-slices-push' && !ac.signal.aborted) {
                    rec.abort(ac)
                }
            }
            let r = await settle(wo.upload('u5.bin', buf, null, { signal: ac.signal }))
            hookRes = null
            await w.delay(1500)
            let fpMerged = path.join(fdUp, h)
            assert.strict.deepEqual(r.ok, false)
            assert.strict.equal(r.e, ac.signal.reason)
            assert.strict.deepEqual(rec.events.length, 0)
            assert.strict.deepEqual(st.upload.calls, 0)
            assert.strict.deepEqual(fs.existsSync(fpMerged) ? fs.statSync(fpMerged).size : -1, buf.length)
            let r2 = await settle(wo.upload('u5.bin', buf, null))
            assert.strict.deepEqual(r2, { ok: true, v: { got: 'u5.bin' } })
            assert.strict.deepEqual(st.upload.froms, ['check-total-hash'])
        })

        it('merge-slices-get 在途且伺服端已呼叫應用端時中止: 前端以 reason 拒絕, 應用端仍受理並寫入結果; 再傳同一內容時應用端再被呼叫一次(C11 結果未知)', async function() {
            let rec = genRec()
            let ac = new AbortController()
            rec.signal = ac.signal
            let wo = mkClient(rec, { opt: { retryUpload: 0 } })
            let buf = uniq(sizeSlice * 2 + 3)
            let h = await hashOf(buf)
            st.upload.mode = 'delay' //應用端 1 秒後才接受
            st.upload.onCall = () => {
                setTimeout(() => rec.abort(ac), 200)
            }
            let r = await settle(wo.upload('u6.bin', buf, null, { signal: ac.signal }))
            st.upload.onCall = null
            await w.delay(1500)
            let ro = fs.readdirSync(fdUp).filter((n) => n.startsWith(`${h}.q`) && n.endsWith('.ro'))
            assert.strict.deepEqual(r.ok, false)
            assert.strict.equal(r.e, ac.signal.reason)
            assert.strict.deepEqual(rec.events.length, 0)
            assert.strict.deepEqual(ro.length, 1)
            st.upload.mode = 'accept'
            let r2 = await settle(wo.upload('u6.bin', buf, null))
            assert.strict.deepEqual(r2, { ok: true, v: { got: 'u6.bin' } })
            assert.strict.deepEqual(st.upload.froms, ['merge-slices-get', 'check-total-hash'])
        })

        it('check-total-hash 之回應(sizeSlice 不一致)到達時中止(複審 T3): 以 reason 拒絕, 不發 sizeSlice mismatch 事件', async function() {
            let rec = genRec()
            let ac = new AbortController()
            rec.signal = ac.signal
            let wo = mkClient(rec, { port: portMismatch })
            hookRes = (info) => {
                if (info.mode === 'check-total-hash' && !ac.signal.aborted) {
                    rec.abort(ac, 'user-cancel')
                }
            }
            let r = await settle(wo.upload('t3.bin', uniq(1000), null, { signal: ac.signal }))
            assert.strict.deepEqual(rec.tAbort !== null, true, '未於回應通過 axios 後中止, 本格未測到')
            assert.strict.deepEqual(r, { ok: false, e: 'user-cancel' })
            assert.strict.deepEqual(rec.events.length, 0)
        })

        it('已上傳過之內容(bAllHash 早返), check-total-hash 之回應到達時中止(複審 T4): 以 reason 拒絕而非以值 resolve, 其後 cbProgress 0 次', async function() {
            let rec = genRec()
            let ac = new AbortController()
            rec.signal = ac.signal
            let wo = mkClient(rec)
            let buf = uniq(sizeSlice * 2 + 5)
            let r0 = await settle(wo.upload('t4.bin', buf, null))
            assert.strict.deepEqual(r0.ok, true)
            hookRes = (info) => {
                if (info.mode === 'check-total-hash' && !ac.signal.aborted) {
                    rec.abort(ac, 'user-cancel')
                }
            }
            let r = await settle(wo.upload('t4.bin', buf, cbOf(rec), { signal: ac.signal }))
            await w.delay(300)
            assert.strict.deepEqual(rec.tAbort !== null, true, '未於回應通過 axios 後中止, 本格未測到')
            assert.strict.deepEqual(r, { ok: false, e: 'user-cancel' })
            assert.strict.deepEqual(rec.after('progress').length, 0)
            assert.strict.deepEqual(rec.events.length, 0)
        })

        it('第一片之回應到達時中止(複審 T5): 以 reason 拒絕, 其後 cbProgress 0 次、不再送切片', async function() {
            let rec = genRec()
            let ac = new AbortController()
            rec.signal = ac.signal
            let wo = mkClient(rec)
            let nReqAtAbort = null
            hookRes = (info) => {
                if (info.url.endsWith('/slc') && !ac.signal.aborted) {
                    nReqAtAbort = st.reqs.length
                    rec.abort(ac, 'user-cancel')
                }
            }
            let r = await settle(wo.upload('t5.bin', uniq(sizeSlice * 4), cbOf(rec), { signal: ac.signal }))
            await w.delay(300)
            assert.strict.deepEqual(nReqAtAbort !== null, true, '未於回應通過 axios 後中止, 本格未測到')
            assert.strict.deepEqual(r, { ok: false, e: 'user-cancel' })
            assert.strict.deepEqual(rec.after('progress').length, 0)
            assert.strict.deepEqual(rec.events.length, 0)
            assert.strict.deepEqual(st.reqs.length - nReqAtAbort, 0)
        })

    })

    describe('四、download(nodejs)之中止階段(M2 download nodejs 欄)', function() {

        it('串流接收中中止: 以 reason 拒絕、0 則事件、不留不完整檔; 伺服端 0 則事件', async function() {
            let rec = genRec()
            let ac = new AbortController()
            rec.signal = ac.signal
            let wo = mkClient(rec)
            let fd = path.join(fdDl, 'd1')
            let p = settle(wo.download('slow', null, { fdDownload: fd, signal: ac.signal }))
            setTimeout(() => rec.abort(ac), 500)
            let r = await p
            let lag = Date.now() - rec.tAbort
            let filesAtReject = fs.existsSync(fd) ? fs.readdirSync(fd) : [] //拒絕當下(其續行之微任務內)即須無不完整檔, 不是事後才刪
            await w.delay(500)
            assert.strict.deepEqual(r.ok, false)
            assert.strict.equal(r.e, ac.signal.reason)
            assert.strict.deepEqual(lag < 300, true, `中止至拒絕 ${lag}ms`)
            assert.strict.deepEqual(rec.events.length, 0)
            assert.strict.deepEqual(filesAtReject, [])
            assert.strict.deepEqual(fs.existsSync(fd) ? fs.readdirSync(fd) : [], [])
            assert.strict.deepEqual(st.errs, [])
        })

        it('帶 cbProgress 之串流接收中中止(3 個時點, 涵蓋 axios 進度節流之相位; 複審 T1、T1b): 其後 cbProgress 0 次, 拋錯之 cbProgress 不發 cbProgress error', async function() {
            let rows = []
            for (let at of [700, 811, 922]) {
                let rec = genRec()
                let ac = new AbortController()
                rec.signal = ac.signal
                let wo = mkClient(rec)
                let fd = path.join(fdDl, `t1_${at}`)
                let p = settle(wo.download('slow', cbOf(rec, () => {
                    if (ac.signal.aborted) {
                        throw new Error('ui already torn down')
                    }
                }), { fdDownload: fd, signal: ac.signal }))
                setTimeout(() => rec.abort(ac), at)
                let r = await p
                let atReject = fs.existsSync(fd) ? fs.readdirSync(fd).length : 0
                await w.delay(800) //axios 之節流尾端計時器 ≤ 1000/3 ms
                rows.push({ at, atReject, ok: r.ok, isReason: r.e === ac.signal.reason, before: rec.progress.length - rec.after('progress').length, after: rec.after('progress').length, inside: rec.inside('progress').length, events: rec.events.length, files: fs.existsSync(fd) ? fs.readdirSync(fd).length : 0, listeners: listenersOf(ac.signal) })
            }
            for (let row of rows) {
                assert.strict.deepEqual({ ...row, before: row.before > 0 }, { at: row.at, atReject: 0, ok: false, isReason: true, before: true, after: 0, inside: 0, events: 0, files: 0, listeners: 0 }, JSON.stringify(rows))
            }
        })

        it('/dw 之標頭已到時中止(複審 T6): 以 reason 拒絕、0 則事件、不留檔', async function() {
            let rec = genRec()
            let ac = new AbortController()
            rec.signal = ac.signal
            let wo = mkClient(rec)
            let fd = path.join(fdDl, 't6')
            hookRes = (info) => {
                if (info.url.endsWith('/dw') && !ac.signal.aborted) {
                    rec.abort(ac)
                }
            }
            let r = await settle(wo.download('slow', null, { fdDownload: fd, signal: ac.signal }))
            await w.delay(400)
            assert.strict.deepEqual(rec.tAbort !== null, true, '未於回應通過 axios 後中止, 本格未測到')
            assert.strict.deepEqual(r.ok, false)
            assert.strict.equal(r.e, ac.signal.reason)
            assert.strict.deepEqual(rec.events.length, 0)
            assert.strict.deepEqual(fs.existsSync(fd) ? fs.readdirSync(fd) : [], [])
        })

        it('/dw 之標頭已到時中止後立即重新下載同一檔至同一資料夾(使用者「取消後重試」): 新下載完整 —— 被中止之呼叫不得再建檔、不得刪到新檔', async function() {
            let rec = genRec()
            let ac = new AbortController()
            rec.signal = ac.signal
            let wo = mkClient(rec)
            let fd = path.join(fdDl, 't6r')
            hookRes = (info) => {
                if (info.url.endsWith('/dw') && !ac.signal.aborted) {
                    rec.abort(ac)
                }
            }
            let r1 = await settle(wo.download('slow', null, { fdDownload: fd, signal: ac.signal }))
            hookRes = null
            let r2 = await settle(wo.download('slow', null, { fdDownload: fd })) //立即重試, 不帶 signal
            await w.delay(400)
            assert.strict.deepEqual(rec.tAbort !== null, true, '未於回應通過 axios 後中止, 本格未測到')
            assert.strict.deepEqual(r1.ok, false)
            assert.strict.equal(r1.e, ac.signal.reason)
            assert.strict.deepEqual(r2.ok, true, JSON.stringify(r2))
            assert.strict.deepEqual(fs.existsSync(r2.v) ? fs.statSync(r2.v).size : -1, 60000) //新下載之檔完整, 未被舊呼叫截斷或刪除
            assert.strict.deepEqual(fs.readdirSync(fd), ['slow.bin'])
            assert.strict.deepEqual(rec.events.length, 0)
        })

    })

    describe('五、中止後行程可立即結束(子行程; C9)', function() {

        //runChild, 於子行程內只跑 client(伺服器在本行程), 中止後不呼叫 process.exit, 讓事件迴圈自然清空;
        //子行程於 exit 事件記錄時間, 「中止至事件迴圈清空」之延遲於子行程內量測(不含行程拆除之時間)
        let urlClient = pathToFileURL(path.resolve('./src/WConverhpClient.mjs')).href
        let runChild = (kase, env) => new Promise((resolve) => {
            let code = `
import fs from 'fs'
let { default: WConverhpClient } = await import(${JSON.stringify(urlClient)})
console.log = () => {}
let out = { kase: process.env.W_KASE, events: 0, tAbort: null, reason: null, progressAfterAbort: 0 }
process.on('exit', () => {
    out.tExit = Date.now()
    fs.writeSync(1, 'RESULT:' + JSON.stringify(out) + '\\n')
})
let wo = new WConverhpClient({ url: 'http://127.0.0.1:' + process.env.W_PORT, apiName: 'api', sizeSlice: ${sizeSlice}, retryMain: 3, retryUpload: 0 })
let ac = new AbortController()
let abort = () => {
    ac.abort()
    out.tAbort = Date.now()
}
wo.on('error', () => {
    out.events += 1
    if (out.events === 1 && process.env.W_KASE !== 'download') {
        setTimeout(abort, 150)
    }
})
let p = null
if (process.env.W_KASE === 'execute') {
    p = wo.execute('f', {}, null, { signal: ac.signal })
}
if (process.env.W_KASE === 'upload') {
    let b = Buffer.alloc(1000, 77)
    b.writeUInt32LE(Number(process.env.W_SEQ), 0)
    p = wo.upload('child.bin', b, null, { signal: ac.signal })
}
if (process.env.W_KASE === 'download') {
    p = wo.download('slow', () => {
        if (ac.signal.aborted) {
            out.progressAfterAbort += 1
        }
    }, { fdDownload: process.env.W_FD, signal: ac.signal })
    setTimeout(abort, 700)
}
p.then(() => {
    out.reason = 'resolved'
}, (e) => {
    out.reason = e === ac.signal.reason ? 'signal.reason' : String(e)
})
`
            let cp = spawn(process.execPath, ['--input-type=module', '-e', code], { env: { ...process.env, W_KASE: kase, ...env }, stdio: ['ignore', 'pipe', 'pipe'] })
            let o = ''
            let e = ''
            cp.stdout.on('data', (b) => {
                o += b
            })
            cp.stderr.on('data', (b) => {
                e += b
            })
            let killer = setTimeout(() => cp.kill(), 20000)
            cp.on('close', (exitCode) => {
                clearTimeout(killer)
                let line = o.split(/\r?\n/).find((l) => l.startsWith('RESULT:'))
                let res = line ? JSON.parse(line.slice(7)) : null
                resolve({ exitCode, res, lag: res && res.tAbort ? res.tExit - res.tAbort : null, stderr: e.slice(0, 500) })
            })
        })

        it('execute 於退避中中止(P1): 子行程於中止後 500ms 內自然結束, 事件只有中止前那一則', async function() {
            let r = await runChild('execute', { W_PORT: String(portClosed) })
            assert.strict.deepEqual(r.res !== null, true, `子行程未輸出結果(未結束而被終止?): ${r.stderr}`)
            assert.strict.deepEqual(r.exitCode, 0, r.stderr)
            assert.strict.deepEqual(r.res.reason, 'signal.reason')
            assert.strict.deepEqual(r.res.events, 1)
            assert.strict.deepEqual(r.lag !== null && r.lag < 500, true, `中止至事件迴圈清空 ${r.lag}ms(退避計時器未被中止時約 850ms 以上)`)
        })

        it('upload 於無限合併輪詢中中止(P2): 子行程於中止後 500ms 內自然結束', async function() {
            st.upload.mode = 'reject'
            seq += 1
            let r = await runChild('upload', { W_PORT: String(port), W_SEQ: String(seq * 104729) })
            assert.strict.deepEqual(r.res !== null, true, `子行程未輸出結果(未結束而被終止?): ${r.stderr}`)
            assert.strict.deepEqual(r.exitCode, 0, r.stderr)
            assert.strict.deepEqual(r.res.reason, 'signal.reason')
            assert.strict.deepEqual(r.res.events, 1)
            assert.strict.deepEqual(r.lag !== null && r.lag < 500, true, `中止至事件迴圈清空 ${r.lag}ms(輪詢未停止時永不結束)`)
        })

        it('帶 cbProgress 之 nodejs download 於串流中中止(K4): 子行程於中止後 500ms 內自然結束, 中止後 cbProgress 0 次', async function() {
            let fd = path.join(fdDl, 'child')
            let r = await runChild('download', { W_PORT: String(port), W_FD: fd })
            assert.strict.deepEqual(r.res !== null, true, `子行程未輸出結果(未結束而被終止?): ${r.stderr}`)
            assert.strict.deepEqual(r.exitCode, 0, r.stderr)
            assert.strict.deepEqual(r.res.reason, 'signal.reason')
            assert.strict.deepEqual(r.res.events, 0)
            assert.strict.deepEqual(r.res.progressAfterAbort, 0)
            assert.strict.deepEqual(r.lag !== null && r.lag < 500, true, `中止至事件迴圈清空 ${r.lag}ms`)
            assert.strict.deepEqual(fs.existsSync(fd) ? fs.readdirSync(fd) : [], [])
        })

    })

})
