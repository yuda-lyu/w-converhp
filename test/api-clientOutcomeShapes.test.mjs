import assert from 'assert'
import fs from 'fs'
import path from 'path'
import http from 'http'
import axios from 'axios'
import w from 'wsemi'
import WConverhpServer from '../src/WConverhpServer.mjs'
import WConverhpClient from '../src/WConverhpClient.mjs'
import axes from './tools/api-axes.mjs'
import wPorts from './tools/ports.mjs'

let { portOf } = wPorts

let { rejectShapes, rejectShapesCodec, rejectSequences, hostileShapes } = axes


/**
 * api: 前端「一次嘗試之結局」之行為表(帳本 R29, 2026-10-14)—— 形狀軸 × 來源(應用端拒絕值經伺服器、getToken 之拒絕值)× 路徑
 *
 * 各斷言對應之契約(src/WConverhpClient.mjs 之 JSDoc 與 classifyFailure 說明、專案 CLAUDE.md 之重試原則):
 *   甲、伺服器回傳值(應用端之拒絕值)與 getToken 之拒絕值, 非 Error 者不論形狀皆原樣交出(classifyFailure; 惡意值亦原樣, 主控裁示)
 *   乙、每一次請求嘗試失敗恰發一則 error 事件(建構函數 @returns)
 *   丙、凡失敗皆重試(retryMain/retryUpload/retryDownload), 唯可證明不需重試者(伺服器標示 retryable:false、本套件之請求收到 HTTP 413)除外
 *   丁、getToken 每一次請求嘗試各呼叫一次(getToken 之 JSDoc)
 *   戊、成功須能證明是本套件之回應(帳本 R6、R29): 下載須帶本套件之下載標頭, 否則以 invalid download response from server 拒絕並照常重試
 *   己、入口即拒絕者一則事件、不重試(upload 之輸入讀取失敗亦同, 主控裁示 N6)
 *
 * 修正前之實測(審計 run01, tmp/cancelled-全盤.md):
 *   client 以 wsemi 之 pmConvertResolve 分類每次嘗試, 拒絕值之 reason 為 'cancelled' 者被判為第三態 → 以空字串結束、0 則、不重試;
 *   惡意之 getToken 拒絕值使其 .catch 內讀 reason 拋錯 → 呼叫永不 settle + 未處理之 rejection;
 *   isNoRetry 以 get(msg, 'response.status') === 413 對任意值判不重試;
 *   下載以「沒有 Return-Type: error」判成功 → 非本套件之 2xx 回應(網址誤指 SPA 主機)被當成檔案落地;
 *   宿主之 axios.defaults.validateStatus 全放行時 404 之下載被當成功; upload 之雜湊計算失敗以原始錯誤物件拒絕且 0 則。
 * 既有 492 條測試無一能分辨上述任一格 —— 形狀清單手寫在單一測試檔且漏成員(經驗 E1), 本檔之成員一律取自 test/tools/api-axes.mjs(帳本 R8)
 */
describe('api-clientOutcomeShapes', function() {
    this.timeout(120000)

    let port = portOf('api-clientOutcomeShapes', 0)
    let portSpa = portOf('api-clientOutcomeShapes', 1)
    let fdRoot = path.resolve('./test/_tmp/api-clientOutcomeShapes')
    let pathUploadTemp = path.join(fdRoot, 'up')
    let fdDl = path.join(fdRoot, 'dl')
    let sizeSlice = 64 * 1024

    let wsv = null
    let srvSpa = null

    //plan, 應用端之逐次結局: 鍵為 exec:<func> 或 up:<filename>:<from>; 第 k 次呼叫取第 k 個元素(超出者取最後一個), 元素為 { reject: 工廠 } 或 { resolve: 值 }
    let plan = {}
    let calls = {}
    let outcomeOf = (key) => {
        calls[key] = (calls[key] || 0) + 1
        let seq = plan[key]
        if (!seq) {
            return null
        }
        return seq[Math.min(calls[key], seq.length) - 1]
    }
    let settlePm = (o, pm, dflt) => {
        if (o === null) {
            pm.resolve(dflt)
            return
        }
        if (o.reject) {
            pm.reject(o.reject())
            return
        }
        pm.resolve(o.resolve)
    }

    //nHandler, 通過權限之請求數(伺服器之 handler 事件); nSpa, 非本套件之伺服器收到之請求數
    let nHandler = 0
    let nSpa = 0

    let settle = (p) => p.then((v) => ({ ok: true, v }), (e) => ({ ok: false, e }))
    let bytesOf = (tag) => Buffer.from(`content-${tag}-${'x'.repeat(200)}`)
    let filesOf = (fd) => fs.existsSync(fd) ? fs.readdirSync(fd) : []

    //mkClient, 被測之 client: 記錄 error 事件與 getToken 之呼叫次數
    let mkClient = (o = {}) => {
        let rec = { events: [], nGetToken: 0 }
        let wo = new WConverhpClient({
            url: `http://127.0.0.1:${o.port !== undefined ? o.port : port}`,
            apiName: o.apiName || 'api',
            sizeSlice,
            timeout: 8000,
            retryMain: 1,
            retryUpload: 1,
            retryDownload: 1,
            ...o.opt,
            getToken: () => {
                rec.nGetToken += 1
                return o.getToken ? o.getToken() : 't'
            },
        })
        wo.on('error', (e) => {
            rec.events.push(e)
        })
        return { wo, rec }
    }

    before(async function() {
        fs.rmSync(fdRoot, { recursive: true, force: true })
        fs.mkdirSync(fdDl, { recursive: true })

        wsv = new WConverhpServer({ port, apiName: 'api', useInert: false, pathUploadTemp, sizeSlice, verifyConn: () => true })
        wsv.on('error', () => {})
        wsv.on('handler', () => {
            nHandler += 1
        })
        wsv.on('execute', (func, input, pm) => {
            settlePm(outcomeOf(`exec:${func}`), pm, { ok: func })
        })
        wsv.on('upload', (input, pm) => {
            //不刪合併檔: 同內容之第二次上傳須走 check-total-hash 之去重路徑(該路徑呼叫應用端)
            settlePm(outcomeOf(`up:${input.filename}:${input.from}`), pm, { got: input.from })
        })
        wsv.on('download', (input, pm) => {
            let buf = Buffer.from(`download-${input.fileId}`)
            pm.resolve({ streamRead: buf, filename: `${input.fileId}.txt`, fileSize: buf.length, fileType: 'application/octet-stream' })
        })

        //srvSpa, 非本套件之伺服器: 對任何路徑回 200 text/html(網址誤指 SPA 主機之情形)
        srvSpa = http.createServer((req, res) => {
            nSpa += 1
            req.resume()
            req.on('end', () => {
                let html = '<!DOCTYPE html><html><body>SPA index</body></html>'
                res.writeHead(200, { 'Content-Type': 'text/html', 'Content-Length': Buffer.byteLength(html) })
                res.end(html)
            })
        })
        await new Promise((resolve) => srvSpa.listen(portSpa, resolve))

        await wsv.ready //待伺服器就緒(ready); srvSpa 已以 listen 回呼確認開始監聽
    })

    after(async function() {
        await wsv.stop()
        await new Promise((resolve) => srvSpa.close(resolve))
        fs.rmSync(fdRoot, { recursive: true, force: true })
    })

    it('G1 execute: 應用端以形狀軸之每一員拒絕 → 呼叫端收到同一值、每次嘗試恰一則事件且值相同、伺服端被呼叫 1+retryMain 次(修正前取消形狀為空字串 0 則 1 次、413 形狀為 1 則 1 次)', async function() {
        let keys = Object.keys(rejectShapes)
        let rs = await Promise.all(keys.map(async(k) => {
            plan[`exec:g1-${k}`] = [{ reject: rejectShapes[k].value }]
            let { wo, rec } = mkClient()
            let r = await settle(wo.execute(`g1-${k}`, {}))
            return { k, r, rec }
        }))
        for (let { k, r, rec } of rs) {
            let v = rejectShapes[k].value()
            let tag = `${k}: ${JSON.stringify(r)} events=${JSON.stringify(rec.events)}`
            assert.strict.deepEqual(r.ok, false, tag)
            assert.strict.deepEqual(r.e, v, tag) //甲
            assert.strict.deepEqual(rec.events, [v, v], tag) //乙
            assert.strict.deepEqual(calls[`exec:g1-${k}`], 2, tag) //丙
        }
    })

    it('G1 execute: 經伺服器 codec 才成為取消形狀者(應用端值之 toJSON)→ 呼叫端收到抵達之值、每次一則、1+retryMain 次(修正前為空字串 0 則)', async function() {
        for (let k of Object.keys(rejectShapesCodec)) {
            let m = rejectShapesCodec[k]
            plan[`exec:codec-${k}`] = [{ reject: m.value }]
            let { wo, rec } = mkClient()
            let r = await settle(wo.execute(`codec-${k}`, {}))
            let tag = `${k}: ${JSON.stringify(r)}`
            assert.strict.deepEqual(r.ok, false, tag)
            assert.strict.deepEqual(r.e, m.arrive, tag) //甲(抵達之值)
            assert.strict.deepEqual(rec.events, [m.arrive, m.arrive], tag) //乙
            assert.strict.deepEqual(calls[`exec:codec-${k}`], 2, tag) //丙
        }
    })

    it('G1 upload 去重路徑(check-total-hash 呼叫應用端): 應用端以形狀軸之每一員拒絕 → 同一值、每次一則、應用端 1+retryUpload 次', async function() {
        let keys = Object.keys(rejectShapes)
        let rs = await Promise.all(keys.map(async(k) => {
            let fn = `dedupe-${k}.bin`
            let b = bytesOf(`dedupe-${k}`)
            let first = await settle(mkClient().wo.upload(fn, b)) //首次: 合併後應用端接受, 合併檔留存
            plan[`up:${fn}:check-total-hash`] = [{ reject: rejectShapes[k].value }]
            let { wo, rec } = mkClient()
            let r = await settle(wo.upload(fn, b))
            return { k, fn, first, r, rec }
        }))
        for (let { k, fn, first, r, rec } of rs) {
            let v = rejectShapes[k].value()
            let tag = `${k}: first=${JSON.stringify(first)} r=${JSON.stringify(r)} events=${JSON.stringify(rec.events)}`
            assert.strict.deepEqual(first, { ok: true, v: { got: 'merge-slices-get' } }, tag) //前提: 首次上傳成功
            assert.strict.deepEqual(r.ok, false, tag)
            assert.strict.deepEqual(r.e, v, tag) //甲
            assert.strict.deepEqual(rec.events, [v, v], tag) //乙
            assert.strict.deepEqual(calls[`up:${fn}:check-total-hash`], 2, tag) //丙
        }
    })

    it('G1 upload 合併路徑(merge-slices-get 消費): 應用端前兩次以形狀軸之每一員拒絕、第三次接受 → resolve、每次被拒之嘗試恰一則(修正前取消形狀 0 則且輪詢內不退避重試)', async function() {
        let keys = Object.keys(rejectShapes)
        let rs = await Promise.all(keys.map(async(k) => {
            let fn = `merge-${k}.bin`
            plan[`up:${fn}:merge-slices-get`] = [{ reject: rejectShapes[k].value }, { reject: rejectShapes[k].value }, { resolve: { got: k } }]
            let { wo, rec } = mkClient()
            let r = await settle(wo.upload(fn, bytesOf(`merge-${k}`)))
            return { k, fn, r, rec }
        }))
        for (let { k, fn, r, rec } of rs) {
            let v = rejectShapes[k].value()
            let tag = `${k}: ${JSON.stringify(r)} events=${JSON.stringify(rec.events)}`
            assert.strict.deepEqual(r, { ok: true, v: { got: k } }, tag) //合併輪詢依設計持續至應用端接受
            assert.strict.deepEqual(rec.events, [v, v], tag) //乙: 每次被拒之嘗試一則
            assert.strict.deepEqual(calls[`up:${fn}:merge-slices-get`], 3, tag)
        }
    })

    it('G7 getToken: 以形狀軸之每一員拒絕(execute、upload、download nodejs)→ 同一值、每次嘗試一則、getToken 1+retry 次(修正前取消形狀為空字串 0 則 1 次)', async function() {
        let keys = Object.keys(rejectShapes)
        let methods = {
            execute: (wo, k) => wo.execute(`g7-${k}`, {}),
            upload: (wo, k) => wo.upload(`g7-${k}.bin`, bytesOf(`g7-${k}`)),
            download: (wo, k) => wo.download(`g7-${k}`, null, { fdDownload: fdDl }),
        }
        let jobs = []
        for (let k of keys) {
            for (let mt of Object.keys(methods)) {
                jobs.push((async() => {
                    let { wo, rec } = mkClient({ getToken: () => Promise.reject(rejectShapes[k].value()) })
                    let r = await settle(methods[mt](wo, k))
                    return { k, mt, r, rec }
                })())
            }
        }
        let rs = await Promise.all(jobs)
        for (let { k, mt, r, rec } of rs) {
            let v = rejectShapes[k].value()
            let tag = `${k} / ${mt}: ${JSON.stringify(r)} events=${JSON.stringify(rec.events)} nGetToken=${rec.nGetToken}`
            assert.strict.deepEqual(r.ok, false, tag)
            assert.strict.deepEqual(r.e, v, tag) //甲
            assert.strict.deepEqual(rec.events, [v, v], tag) //乙
            assert.strict.deepEqual(rec.nGetToken, 2, tag) //丙、丁
        }
    })

    it('G7 getToken 之拒絕方式(同步拋出、thenable 拒絕)× 取消形狀 → 同一值、每次一則、重試; Error 帶 reason:cancelled → 以其訊息拒絕(classifyFailure)', async function() {
        let modes = {
            syncThrow: () => {
                let e = { reason: 'cancelled', code: 7 }
                throw e
            },
            thenableReject: () => {
                return {
                    then: (resolve, reject) => {
                        reject({ reason: 'cancelled', code: 7 })
                    },
                }
            },
            errorWithReason: () => Promise.reject(Object.assign(new Error('token svc down'), { reason: 'cancelled' })),
        }
        let expect = {
            syncThrow: { reason: 'cancelled', code: 7 },
            thenableReject: { reason: 'cancelled', code: 7 },
            errorWithReason: 'token svc down',
        }
        for (let k of Object.keys(modes)) {
            let { wo, rec } = mkClient({ getToken: modes[k] })
            let r = await settle(wo.execute('g7-mode', {}))
            let tag = `${k}: ${JSON.stringify(r)} events=${JSON.stringify(rec.events)}`
            assert.strict.deepEqual(r.ok, false, tag)
            assert.strict.deepEqual(r.e, expect[k], tag) //甲(Error 者為其訊息)
            assert.strict.deepEqual(rec.events, [expect[k], expect[k]], tag) //乙
            assert.strict.deepEqual(rec.nGetToken, 2, tag) //丙、丁
        }
    })

    it('嘗試序列: 取消形狀出現在第 k 次(retryMain 3)→ 依「每次失敗一則、重試至成功或次數用盡」結局(CLAUDE.md 之 failTwice 契約以取消形狀實作須最終成功; 修正前於取消形狀處以空字串結束)', async function() {
        let keys = Object.keys(rejectSequences)
        let rs = await Promise.all(keys.map(async(k) => {
            let seq = rejectSequences[k].seq
            plan[`exec:seq-${k}`] = seq.map((x) => x === 'ok' ? { resolve: { ok: k } } : { reject: () => JSON.parse(JSON.stringify(x)) })
            let { wo, rec } = mkClient({ opt: { retryMain: 3 } })
            let r = await settle(wo.execute(`seq-${k}`, {}))
            return { k, seq, r, rec }
        }))
        for (let { k, seq, r, rec } of rs) {
            let tag = `${k}: ${JSON.stringify(r)} events=${JSON.stringify(rec.events)}`
            let iOk = seq.indexOf('ok')
            if (iOk >= 0) {
                assert.strict.deepEqual(r, { ok: true, v: { ok: k } }, tag)
                assert.strict.deepEqual(rec.events, seq.slice(0, iOk), tag)
                assert.strict.deepEqual(calls[`exec:seq-${k}`], iOk + 1, tag)
            }
            else {
                assert.strict.deepEqual(r, { ok: false, e: seq[seq.length - 1] }, tag)
                assert.strict.deepEqual(rec.events, seq, tag)
                assert.strict.deepEqual(calls[`exec:seq-${k}`], seq.length, tag)
            }
        }
    })

    it('惡意值: getToken 以 hostileShapes 之每一員拒絕 → 3 秒內 settle、未處理之 rejection 0 次、每次嘗試一則、以原值(同一參照)拒絕(修正前: 已撤銷之 Proxy 與拋錯之 reason getter 使呼叫永不 settle 並產生未處理之 rejection)', async function() {
        let nUnhandled = 0
        let onUnhandled = () => {
            nUnhandled += 1
        }
        process.on('unhandledRejection', onUnhandled)
        try {
            let hs = hostileShapes()
            for (let k of Object.keys(hs)) {
                let hv = hs[k]
                let { wo, rec } = mkClient({ getToken: () => Promise.reject(hv) })
                let r = await Promise.race([
                    settle(wo.execute('hostile', {})),
                    w.delay(3000).then(() => ({ timeout: true })),
                ])
                assert.strict.deepEqual(r.timeout, undefined, `${k}: 3 秒內未 settle`)
                assert.strict.deepEqual(r.ok, false, k)
                assert.strict.equal(r.e === hv, true, `${k}: 須以原值(同一參照)拒絕`) //甲(惡意值原樣)
                assert.strict.deepEqual(rec.events.length, 2, k) //乙
                assert.strict.equal(rec.events.every((x) => x === hv), true, `${k}: 事件值須為原值`)
                assert.strict.deepEqual(rec.nGetToken, 2, k) //丙、丁
            }
            await w.delay(50)
            assert.strict.deepEqual(nUnhandled, 0, '不得產生未處理之 rejection')
        }
        finally {
            process.off('unhandledRejection', onUnhandled)
        }
    })

    it('非本套件之 2xx 回應(網址誤指 SPA 主機): execute 與 upload 以 invalid packet 拒絕並重試(對照); download nodejs 以 invalid download response from server 拒絕、每次一則、照常重試、不落檔(修正前 resolve 並把 HTML 存為 unknown、0 則)', async function() {
        let fdSpa = path.join(fdRoot, 'dlSpa')
        fs.mkdirSync(fdSpa, { recursive: true })

        nSpa = 0
        let e = mkClient({ port: portSpa })
        let re = await settle(e.wo.execute('x', {}))
        assert.strict.deepEqual(re.ok, false)
        assert.strict.deepEqual(String(re.e).startsWith('invalid packet from server'), true, JSON.stringify(re))
        assert.strict.deepEqual(e.rec.events.length, 2)
        assert.strict.deepEqual(nSpa, 2)

        nSpa = 0
        let u = mkClient({ port: portSpa })
        let ru = await settle(u.wo.upload('spa.bin', bytesOf('spa')))
        assert.strict.deepEqual(ru.ok, false)
        assert.strict.deepEqual(String(ru.e).startsWith('invalid packet from server'), true, JSON.stringify(ru))
        assert.strict.deepEqual(u.rec.events.length, 2)

        nSpa = 0
        let d = mkClient({ port: portSpa })
        let rd = await settle(d.wo.download('f1', null, { fdDownload: fdSpa }))
        assert.strict.deepEqual(rd, { ok: false, e: 'invalid download response from server' }) //戊
        assert.strict.deepEqual(d.rec.events, ['invalid download response from server', 'invalid download response from server']) //乙
        assert.strict.deepEqual(nSpa, 2) //丙: 照常重試
        assert.strict.deepEqual(filesOf(fdSpa), [], '不得把非本套件之回應本體落檔')
    })

    it('宿主把共用 axios 實例之 defaults.validateStatus 設為全放行: download 打到不存在之路由(404)仍以失敗拒絕、每次一則、不落檔(本套件之狀態碼判定明給; 修正前 resolve 並把 404 本體落檔)', async function() {
        let fdHost = path.join(fdRoot, 'dlHost')
        fs.mkdirSync(fdHost, { recursive: true })
        let ori = axios.defaults.validateStatus
        axios.defaults.validateStatus = () => true
        try {
            let { wo, rec } = mkClient({ apiName: 'nosuchapi' })
            let r = await settle(wo.download('f1', null, { fdDownload: fdHost }))
            assert.strict.deepEqual(r, { ok: false, e: 'Not Found' }, JSON.stringify(r))
            assert.strict.deepEqual(rec.events, ['Not Found', 'Not Found'])
            assert.strict.deepEqual(filesOf(fdHost), [])
        }
        finally {
            axios.defaults.validateStatus = ori
        }
    })

    it('upload 之雜湊計算失敗(輸入讀取失敗: fs.openAsBlob 後改寫檔案)→ 入口失敗: 一則事件、以 classifyFailure 之訊息(字串)拒絕、不重試、不送出請求(修正前以原始錯誤物件拒絕且 0 則)', async function() {
        let fp = path.join(fdRoot, 'blob-src.bin')
        fs.writeFileSync(fp, Buffer.alloc(1000, 1))
        let blob = await fs.openAsBlob(fp)
        fs.writeFileSync(fp, Buffer.alloc(2000, 2)) //改寫: 其後讀取該 Blob 即失敗
        nHandler = 0
        let { wo, rec } = mkClient()
        let r = await settle(wo.upload('hash-fail.bin', blob))
        assert.strict.deepEqual(r.ok, false)
        assert.strict.deepEqual(typeof r.e === 'string' && r.e !== '', true, `須為訊息字串: ${String(r.e)}`) //己
        assert.strict.deepEqual(rec.events, [r.e]) //己: 一則
        assert.strict.deepEqual(rec.nGetToken, 0, '不送出請求')
        assert.strict.deepEqual(nHandler, 0, '不送出請求')
    })

    it('對照: 正常之 execute、upload、download nodejs(帶本套件之下載標頭)照常成功、0 則事件', async function() {
        let { wo, rec } = mkClient()
        let r1 = await settle(wo.execute('plain', {}))
        assert.strict.deepEqual(r1, { ok: true, v: { ok: 'plain' } })
        let r2 = await settle(wo.upload('plain.bin', bytesOf('plain')))
        assert.strict.deepEqual(r2, { ok: true, v: { got: 'merge-slices-get' } })
        let r3 = await settle(wo.download('plain', null, { fdDownload: fdDl }))
        assert.strict.deepEqual(r3.ok, true, JSON.stringify(r3))
        assert.strict.deepEqual(fs.readFileSync(r3.v, 'utf8'), 'download-plain')
        assert.strict.deepEqual(rec.events, [])
    })

})
