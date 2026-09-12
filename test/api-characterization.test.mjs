import assert from 'assert'
import fs from 'fs'
import net from 'net'
import stream from 'stream'
import Hapi from '@hapi/hapi'
import w from 'wsemi'
import u8arr2obj from 'wsemi/src/u8arr2obj.mjs'
import WConverhpServer from '../src/WConverhpServer.mjs'
import axes from './api-axes.mjs'

let { fetchDownload } = axes


/**
 * api: 特徵測試(characterization test)—— 記錄重構前之現況, 不判對錯
 *
 * 用途:重構之驗收判準是「行為不變」, 但沒有測試鎖住的行為在搬動時會悄悄改掉, 而既有測試全綠並不能證明沒改
 * (既有 217 個測試皆為「缺陷確認測試」, 每個 it 對應一個曾經壞過的格, 未涵蓋下列各格)。
 * 本檔逐格記錄**現況值**, 使重構後之差異必然浮現。
 *
 * 三類標記:
 *   [鎖定]     現況即應然, 重構後須維持
 *   [凍結待修] 現況即缺陷, 已編號; P2 落地修正時本格須改判, 並於此註明改判理由
 *   [不判]     現況為實作細節, 僅記錄以偵測非預期變動
 *
 * 驗收:本檔須在**修正前之 src** 全綠;重構後若某格轉紅, 須確認是刻意改判而非意外改動。
 */
describe('api-characterization', function() {

    let port = 8221 //同時test故得要不同port
    let portExt = 8222 //外部 serverHapi 之對照組
    let pathUploadTemp = './test/_tmp/uploadTemp-api-characterization'
    let wsv = null
    let wsvExt = null
    let serverHapi = null
    let errs = []
    let handlerSeen = []
    let executeSeen = []
    let tracked = {}
    let lifecycles = {}

    before(async function() {
        this.timeout(20000)

        wsv = new WConverhpServer({
            port,
            apiName: 'api',
            useInert: false,
            pathUploadTemp,
            verifyConn: async() => true,
        })
        wsv.on('handler', (d) => handlerSeen.push(d.api))
        wsv.on('error', (e) => errs.push(String(e)))
        wsv.on('execute', (func, input, pm) => {
            executeSeen.push({ func, input })
            pm.resolve({ ok: 1 })
        })
        wsv.on('upload', (input, pm) => pm.resolve({ n: 1 }))
        wsv.on('download', (input, pm) => {
            let id = input.fileId
            let base = { filename: 'x.bin', fileSize: 10, fileType: 'application/octet-stream' }
            let mkStream = (key, content) => {
                let s = new stream.PassThrough()
                s.end(Buffer.from(content))
                lifecycles[key] = { end: 0, close: 0, error: [] }
                s.on('end', () => {
                    lifecycles[key].end += 1
                })
                s.on('close', () => {
                    lifecycles[key].close += 1
                })
                s.on('error', (e) => {
                    lifecycles[key].error.push(e.message)
                })
                tracked[key] = s
                return s
            }
            if (id === 'multi-fault') {
                //同時給三個非法欄位: 三路由回哪一個訊息由各自之檢核順序決定
                pm.resolve({ streamRead: null, filename: 123, fileSize: NaN, fileType: 456 })
            }
            else if (id === 'bad-filename-with-stream') {
                //filename 非法但 streamRead 合法: 用於觀察 /dwgfn 之副作用順序
                pm.resolve({ ...base, streamRead: mkStream('bad-filename-with-stream', '0123456789'), filename: 123 })
            }
            else if (id === 'head-stream') {
                pm.resolve({ ...base, streamRead: mkStream('head-stream', '0123456789') })
            }
            else if (id === 'head-buffer') {
                pm.resolve({ ...base, streamRead: Buffer.from('0123456789') })
            }
            else if (id === 'range-stream') {
                pm.resolve({ ...base, streamRead: mkStream('range-stream', '0123456789') })
            }
            else if (id === 'range-buffer') {
                pm.resolve({ ...base, streamRead: Buffer.from('0123456789') })
            }
            else if (id === 'short-stream') {
                //宣告 10 但只送 3: 計數串流須於 flush 偵測並以錯誤中止
                pm.resolve({ ...base, streamRead: mkStream('short-stream', 'abc') })
            }
            else {
                pm.reject('invalid fileId')
            }
        })

        //外部 serverHapi: 設 json.replacer 以觀察 download 本體是否套用該政策(#29 之防線)
        serverHapi = Hapi.server({
            port: portExt,
            routes: {
                timeout: { server: false, socket: false },
                cors: { origin: ['*'], credentials: false, additionalExposedHeaders: ['Return-Type', 'Return-Msg', 'Return-Retryable', 'Content-Disposition'] },
                json: { replacer: (k, v) => (k === 'secret' ? undefined : v), space: 2 },
            },
        })
        wsvExt = new WConverhpServer({
            port: portExt,
            apiName: 'api',
            useInert: false,
            serverHapi,
            pathUploadTemp: `${pathUploadTemp}-ext`,
            verifyConn: async() => true,
        })
        wsvExt.on('handler', () => {})
        wsvExt.on('error', () => {})
        wsvExt.on('download', (input, pm) => {
            if (input.fileId === 'obj') {
                let o = { shown: 'yes', secret: 'S' }
                pm.resolve({ streamRead: o, filename: 'o.json', fileSize: Buffer.byteLength(JSON.stringify(o)), fileType: 'application/json' })
            }
            else if (input.fileId === 'number') {
                pm.resolve({ streamRead: 42, filename: 'n.txt', fileSize: 2, fileType: 'text/plain' })
            }
            else {
                pm.reject('invalid fileId')
            }
        })
        await serverHapi.start()

        await w.delay(1200) //待伺服器啟動
    })

    after(function() {
        wsv.stop()
        try {
            serverHapi.stop()
        }
        catch (err) {}
        for (let fd of [pathUploadTemp, `${pathUploadTemp}-ext`]) {
            try {
                fs.rmSync(fd, { recursive: true, force: true })
            }
            catch (err) {}
        }
    })

    //call, 打下載路由; 請求形狀取自路由軸(test/api-axes.mjs), 不在本檔另寫一份
    let call = async(route, fileId, opt = {}) => {
        errs = []
        let r = await fetchDownload(opt.port || port, route, fileId, {
            method: opt.method,
            range: opt.range,
            textLimit: 80,
            settleMs: 150, //eeEmit 為 setTimeout 派發
        })
        return { ...r, nErrs: errs.length }
    }

    //raw, 以原始 socket 送請求(HEAD 等 fetch 不便表達者)
    let raw = (reqText) => {
        return new Promise((resolve) => {
            let sk = net.connect(port, '127.0.0.1')
            let bufs = []
            let tm = setTimeout(() => {
                sk.destroy()
                resolve({ timeout: true })
            }, 5000)
            sk.on('connect', () => sk.write(reqText))
            sk.on('data', (d) => bufs.push(d))
            sk.on('close', () => {
                clearTimeout(tm)
                let all = Buffer.concat(bufs)
                let s = all.toString('latin1')
                let i = s.indexOf('\r\n\r\n')
                let head = s.slice(0, i)
                let get = (name) => {
                    let m = head.split('\r\n').find((v) => v.toLowerCase().startsWith(`${name}:`))
                    return m ? m.split(': ')[1] : null
                }
                resolve({ status: head.split('\r\n')[0], cl: get('content-length'), bodyBytes: all.length - (i + 4) })
            })
            sk.on('error', () => resolve({ sockErr: true }))
        })
    }

    it('[已改判 #26] /main 收到非套件格式之本體時, 須回錯誤封包且不觸發應用端 execute 事件', async function() {
        this.timeout(20000)
        //改判理由: 本格原記錄之現況(200 + Return-Type success + 觸發 execute 一次 + 0 則事件)為缺陷 #26 ——
        //寬鬆解碼對壞封包回 {} 而不報錯, procDeal 隨即以 func 為空字串觸發應用端, 之後把 output 寫進該空物件並「回報成功」。
        //本輪已改為嚴格解碼: 解不出或非有效物件即回錯誤封包、發一則 error 事件、且不觸發任何應用端事件。
        //屬傳輸不穩(截斷、中間層改寫), 依重試原則不標示 retryable
        errs = []
        executeSeen = []
        let r = await fetch(`http://127.0.0.1:${port}/api/main`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer t', 'Content-Type': 'application/octet-stream' },
            body: Buffer.from([1, 2, 3, 4, 5]),
        })
        let buf = Buffer.from(await r.arrayBuffer())
        let o = u8arr2obj(new Uint8Array(buf))
        await w.delay(200)
        assert.strict.deepEqual(r.status, 200)
        assert.strict.deepEqual(r.headers.get('return-type'), 'error', JSON.stringify(o))
        assert.strict.deepEqual(o.error, 'invalid request packet', JSON.stringify(o))
        assert.strict.deepEqual(w.haskey(o, 'retryable'), false, '傳輸不穩故不得標示不重試')
        assert.strict.deepEqual(executeSeen.length, 0, `畸形請求不得驚動應用端: ${JSON.stringify(executeSeen)}`)
        assert.strict.deepEqual(errs.length, 1, JSON.stringify(errs))
        assert.strict.deepEqual(errs[0].includes('invalid request packet'), true, errs[0])
    })

    it('[鎖定 #25] 錯誤訊息回顯之請求端可控字串含非法標頭值時, 須略過 Return-Msg 而非回裸 500', async function() {
        this.timeout(20000)
        //mode 會被回顯進 invalid mode[...] 之訊息, 該訊息同時進 Return-Msg 標頭
        for (let mode of ['a\r\nX-Injected: 1', '中文模式']) {
            let r = await fetch(`http://127.0.0.1:${port}/api/ulctr`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer t', 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode }),
            })
            let buf = Buffer.from(await r.arrayBuffer())
            let tag = `mode=${JSON.stringify(mode)} status=${r.status}`
            assert.strict.deepEqual(r.status, 200, `${tag} —— 不得為裸 HTTP 500`)
            assert.strict.deepEqual(r.headers.get('return-type'), 'error', tag)
            assert.strict.deepEqual(r.headers.get('return-msg'), null, `${tag} —— 非法標頭值須略過該標頭`)
            //完整訊息仍在本體, 前端解析本體即可取得
            let o = u8arr2obj(new Uint8Array(buf))
            assert.strict.deepEqual(o.error.indexOf('invalid mode[') === 0, true, JSON.stringify(o))
        }

        //對照組: 合法標頭值須照常送出 Return-Msg
        let r2 = await fetch(`http://127.0.0.1:${port}/api/ulctr`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer t', 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: 'bad-mode' }),
        })
        await r2.arrayBuffer()
        assert.strict.deepEqual(r2.headers.get('return-msg'), 'invalid mode[bad-mode] in payload')
    })

    it('[凍結待修] 多重形狀錯誤時三路由之訊息由各自檢核順序決定: /dw 與 /dwgfn 回 invalid filename, /dwgf 回 invalid fileSize, 各恰一則事件', async function() {
        this.timeout(20000)
        //現況即不對稱。P3 收斂三路由後本格須改判為三者一致(改判須先經裁示, 因會變動既有訊息字面)
        let a = await call('dw', 'multi-fault')
        assert.strict.deepEqual(a.error, 'invalid filename', JSON.stringify(a))
        assert.strict.deepEqual(a.nErrs, 1, JSON.stringify(a))

        let b = await call('dwgf', 'multi-fault')
        assert.strict.deepEqual(b.error, 'invalid fileSize', JSON.stringify(b))
        assert.strict.deepEqual(b.nErrs, 1, JSON.stringify(b))

        let c = await call('dwgfn', 'multi-fault')
        assert.strict.deepEqual(c.error, 'invalid filename', JSON.stringify(c))
        assert.strict.deepEqual(c.nErrs, 1, JSON.stringify(c))
    })

    it('[鎖定] /dwgfn 之副作用順序: 先銷毀應用端串流再檢核 filename, 故 filename 非法時串流已被銷毀', async function() {
        this.timeout(20000)
        let r = await call('dwgfn', 'bad-filename-with-stream')
        assert.strict.deepEqual(r.error, 'invalid filename', JSON.stringify(r))
        assert.strict.deepEqual(tracked['bad-filename-with-stream'].destroyed, true, '串流須已被銷毀(順序反轉會使應用端串流洩漏)')
    })

    it('[鎖定] 控制封包之 Content-Length 等於實際本體位元組數, 且成功時 Return-Msg 為 need to parse', async function() {
        this.timeout(20000)
        let r = await fetch(`http://127.0.0.1:${port}/api/main`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer t', 'Content-Type': 'application/octet-stream' },
            body: Buffer.from(w.obj2u8arr({ func: 'x', input: { a: 1 } })),
        })
        let buf = Buffer.from(await r.arrayBuffer())
        assert.strict.deepEqual(r.headers.get('return-type'), 'success')
        assert.strict.deepEqual(r.headers.get('return-msg'), 'need to parse')
        assert.strict.deepEqual(Number(r.headers.get('content-length')), buf.length, 'Content-Length 須等於實際本體位元組數')
    })

    it('[已改判 #36] HEAD 對真串流: HTTP 正確, 且來源不得收到錯誤(P0a 修正前為 Premature close)', async function() {
        this.timeout(20000)
        //改判理由: 本格原記錄之現況(來源收到 Premature close)為缺陷 #36 —— 計數串流以 pipeline 接於來源之後,
        //HEAD 時 hapi 銷毀下游計數串流, pipeline 隨即以 premature close 銷毀上游, 使應用端把一次成功的 HEAD 當成傳輸失敗。
        //P0a 已修(buildDownloadSource 之 forHead 不建 pipeline), 故本格改判為「來源不得收到錯誤」, 與 hapi 原生行為一致。
        let rs = await raw(`HEAD /api/dwgf?fileId=head-stream&token=t HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nConnection: close\r\n\r\n`)
        await w.delay(300)
        assert.strict.deepEqual(rs.status, 'HTTP/1.1 200 OK', JSON.stringify(rs))
        assert.strict.deepEqual(rs.cl, '10', JSON.stringify(rs))
        assert.strict.deepEqual(rs.bodyBytes, 0, JSON.stringify(rs))
        assert.strict.deepEqual(lifecycles['head-stream'].error, [], JSON.stringify(lifecycles['head-stream']))

        let rb = await raw(`HEAD /api/dwgf?fileId=head-buffer&token=t HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nConnection: close\r\n\r\n`)
        assert.strict.deepEqual(rb.status, 'HTTP/1.1 200 OK', JSON.stringify(rb))
        assert.strict.deepEqual(rb.bodyBytes, 0, JSON.stringify(rb))
    })

    it('[鎖定] GET(非 HEAD)之長度一致性檢核不受 forHead 影響: 實送少於宣告仍須中止連線並發一則事件', async function() {
        this.timeout(20000)
        //防止 forHead 之引入把計數串流整條關掉。
        //宣告 10 而實送 3 時, 計數串流於 flush 產生錯誤 → hapi 中止回應 → 前端取本體時連線已斷(此為 #20 之正確行為, 不是測試失敗)
        errs = []
        let aborted = false
        try {
            let r = await fetch(`http://127.0.0.1:${port}/api/dwgf?fileId=short-stream&token=t`)
            await r.arrayBuffer()
        }
        catch (err) {
            aborted = true
        }
        await w.delay(250)
        assert.strict.deepEqual(aborted, true, '長度不符時須中止連線, 不得把不完整本體當成功交出')
        assert.strict.deepEqual(errs.length, 1, JSON.stringify(errs))
        assert.strict.deepEqual(errs[0].includes('ended at 3 bytes but fileSize is 10'), true, errs[0])
    })

    it('[鎖定] Range 對真串流與 Buffer 皆正確: 部分範圍 206 + content-range, 超界 416, 且不誤發 error 事件', async function() {
        this.timeout(20000)
        for (let id of ['range-stream', 'range-buffer']) {
            let a = await call('dwgf', id, { range: 'bytes=0-4' })
            assert.strict.deepEqual(a.status, 206, `${id} ${JSON.stringify(a)}`)
            assert.strict.deepEqual(a.contentRange, 'bytes 0-4/10', `${id} ${JSON.stringify(a)}`)
            assert.strict.deepEqual(a.bytes, 5, `${id} ${JSON.stringify(a)}`)
            assert.strict.deepEqual(a.nErrs, 0, `${id} ${JSON.stringify(a)}`)
        }
        let b = await call('dwgf', 'range-buffer', { range: 'bytes=100-200' })
        assert.strict.deepEqual(b.status, 416, JSON.stringify(b))
        assert.strict.deepEqual(b.nErrs, 0, JSON.stringify(b))
    })

    it('[鎖定] handler 事件早於參數檢核: 參數非法時 handler 事件仍會發', async function() {
        this.timeout(20000)
        handlerSeen = []
        let r = await fetch(`http://127.0.0.1:${port}/api/dw`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer t', 'Content-Type': 'application/json' },
            body: JSON.stringify({}), //無 fileId
        })
        let buf = Buffer.from(await r.arrayBuffer())
        await w.delay(200)
        assert.strict.deepEqual(u8arr2obj(new Uint8Array(buf)).error, 'invalid fileId in payload')
        assert.strict.deepEqual(handlerSeen.includes('apiDownload'), true, 'handler 事件須早於參數檢核而仍被發出')
    })

    it('[鎖定] 請求參數之刻意寬鬆: chunkIndex 為超出安全整數之值仍被接受並落地', async function() {
        this.timeout(20000)
        //此為五輪裁定之刻意設計(見 CLAUDE.md 之「規則帳本」R4 站點 14-16), 重構時不得「順手統一」改嚴
        let r = await fetch(`http://127.0.0.1:${port}/api/slc`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer t',
                'Content-Type': 'application/octet-stream',
                'chunk-index': '1e21',
                'chunk-total': '1',
                'package-id': 'chartest01',
            },
            body: Buffer.from('ab'),
        })
        let buf = Buffer.from(await r.arrayBuffer())
        let o = u8arr2obj(new Uint8Array(buf))
        assert.strict.deepEqual(w.haskey(o, 'success'), true, `超大 chunkIndex 須仍被接受(刻意寬鬆): ${JSON.stringify(o)}`)
        let fps = fs.readdirSync(pathUploadTemp).filter((v) => v.indexOf('chartest01_') === 0)
        assert.strict.deepEqual(fps.length, 1, `須落地一個切片檔: ${JSON.stringify(fps)}`)
    })

    it('[鎖定 #29 之防線] 外部 serverHapi 設 json.replacer 時, download 本體不套用該政策; number 型別須可下載', async function() {
        this.timeout(20000)
        //此為第四輪 #29 之裁定(套件以 JSON.stringify 具體化以取得長度, route 之 json 政策不套用於下載本體)
        //模組化搬動時極易被「改回交給 hapi marshal」而使 #20 之長度保證失效, 故鎖住
        let a = await call('dw', 'obj', { port: portExt })
        assert.strict.deepEqual(a.status, 200, JSON.stringify(a))
        assert.strict.deepEqual(a.text, '{"shown":"yes","secret":"S"}', `本體須為 compact JSON 且未套用 replacer: ${JSON.stringify(a)}`)

        let b = await call('dw', 'number', { port: portExt })
        assert.strict.deepEqual(b.status, 200, JSON.stringify(b))
        assert.strict.deepEqual(b.text, '42', `number 須可下載: ${JSON.stringify(b)}`)
    })

})
