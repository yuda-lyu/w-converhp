import assert from 'assert'
import fs from 'fs'
import net from 'net'
import path from 'path'
import get from 'lodash-es/get.js'
import Hapi from '@hapi/hapi'
import w from 'wsemi'
import WConverhpServer from '../src/WConverhpServer.mjs'
import WConverhpClient from '../src/WConverhpClient.mjs'
import wPorts from './tools/ports.mjs'
import wCapture from './tools/consoleCapture.mjs'
import wFakeApi from './tools/fakeApi.mjs'

let { portOf, reserved } = wPorts
let { capture, textOf } = wCapture
let { startFakeApi } = wFakeApi


/**
 * 診斷輸出(console)不得含資料值(跨套件規格〈診斷輸出與遮罩〉D1、D2、D4; 本套件帳本 R33)
 *
 * 契約(每條 assertion 之對應句寫在其上方):
 *   P1 預設只輸出固定詞彙與安全摘要({ errType, errCode }、{ msgShape }、章節編號等), 不輸出回應物件、錯誤訊息原文、錯誤堆疊、請求內容、id、伺服器路徑
 *   P2 opt.logDetail 為 true 時改輸出遮罩後之細節(使用端自行選擇還原)
 *   P3 opt.funLog 為函數時診斷輸出只交給它(label, safe, detail), 不寫 console(使用端可由此關閉或轉接)
 *   P4 重試提示之字樣不變(帳本 R16/R27 之外之既有觀察點: api-noRetry、api-clientAbort、e2e-abort 以字樣判讀)
 *   P5 app 端 error 事件(供應用端診斷)與回前端之訊息不變(帳本 R10、R17)
 *
 * 觀察面: console.log/error/warn/info 與 process.stdout/stderr.write(伺服端之 worker 執行緒輸出經後者回主執行緒)
 */
describe('api-consoleNoValues', function() {

    let port = portOf('api-consoleNoValues', 0)
    let portFun = portOf('api-consoleNoValues', 1)
    let portDetail = portOf('api-consoleNoValues', 2)
    let portCors = portOf('api-consoleNoValues', 3)
    let portFake = portOf('api-consoleNoValues', 4)
    let pathUploadTemp = path.resolve('./test/_tmp/uploadTemp-api-consoleNoValues')
    let pathUploadTempFun = path.resolve('./test/_tmp/uploadTemp-api-consoleNoValues-fun')
    let pathUploadTempDetail = path.resolve('./test/_tmp/uploadTemp-api-consoleNoValues-detail')

    //servers
    let wsv = null
    let wsvFun = null
    let wsvDetail = null
    let errs = [] //主伺服器之 error 事件(應用端診斷)
    let funRecs = [] //funLog 伺服器之 funLog 呼叫紀錄

    //byLabel, 取第一個引數(label)符合者
    let byLabel = (recs, label) => {
        return recs.filter((r) => r.args[0] === label)
    }

    //noLeak, 診斷文字不得含: 指定之資料值、堆疊列、套件與專案路徑
    let noLeak = (recs, canaries, tag) => {
        let t = textOf(recs)
        for (let c of canaries) {
            assert.strict.deepEqual(t.includes(c), false, `${tag}: 診斷輸出含資料值[${c}]: ${t.slice(0, 600)}`)
        }
        assert.strict.deepEqual(/\n\s+at /.test(t), false, `${tag}: 診斷輸出含堆疊列: ${t.slice(0, 600)}`)
        assert.strict.deepEqual(t.includes('node_modules'), false, `${tag}: 診斷輸出含 node_modules 路徑`)
        assert.strict.deepEqual(t.includes('WConverhpServer.mjs'), false, `${tag}: 診斷輸出含套件原始檔名`)
    }

    //mkClient
    let mkClient = (p, o = {}) => {
        let wo = new WConverhpClient({ url: `http://127.0.0.1:${p}`, apiName: 'api', getToken: () => 't', retryMain: 0, timeout: 5000, ...o })
        wo.on('error', () => {})
        return wo
    }

    //cat
    let cat = async(pm) => {
        try {
            return { ok: true, msg: await pm }
        }
        catch (err) {
            return { ok: false, msg: err }
        }
    }

    //raw, 以原始 socket 送請求; abort 為真時送出部分本體即斷線
    let raw = ({ p, urlPath, headers, body, declared, abort, ct }) => {
        return new Promise((resolve) => {
            let bs = []
            let sock = net.connect(p, '127.0.0.1', () => {
                sock.write(
                    `POST ${urlPath} HTTP/1.1\r\n` +
                    `Host: 127.0.0.1:${p}\r\n` +
                    `Authorization: Bearer t\r\n` +
                    `Content-Type: ${ct}\r\n` +
                    headers.map((v) => `${v}\r\n`).join('') +
                    `Content-Length: ${declared}\r\n` +
                    `Connection: close\r\n` +
                    `\r\n`
                )
                sock.write(body)
                if (abort) {
                    setTimeout(() => {
                        sock.destroy()
                        resolve({ aborted: true })
                    }, 150)
                }
            })
            sock.on('data', (d) => bs.push(d))
            sock.on('close', () => resolve({ aborted: false, raw: Buffer.concat(bs).toString('latin1') }))
            sock.on('error', () => resolve({ aborted: true }))
        })
    }

    //postJson, 直接打 /ulctr 等
    let postJson = async(p, urlPath, obj) => {
        let r = await fetch(`http://127.0.0.1:${p}/api${urlPath}`, { method: 'POST', headers: { 'Authorization': 'Bearer t', 'Content-Type': 'application/json' }, body: JSON.stringify(obj) })
        let bb = Buffer.from(await r.arrayBuffer())
        return w.u8arr2obj(new Uint8Array(bb))
    }

    //mkServer
    let mkServer = async(o) => {
        let wo = new WConverhpServer({ apiName: 'api', sizeSlice: 64 * 1024, pathUploadTemp: o.pathUploadTemp, ...o })
        wo.on('execute', (func, input, pm) => {
            if (func === 'throwCanary') {
                throw new Error('listener secret token=CANARY-LISTENER')
            }
            pm.resolve({ ok: 1 })
        })
        wo.on('upload', (input, pm) => {
            pm.resolve('ok')
        })
        wo.on('download', (input, pm) => {
            pm.reject('no such file')
        })
        return wo
    }

    //verifyConn, token 為 boom 者拋含資料值之錯誤
    let verifyConn = async({ authorization }) => {
        let token = w.strdelleft(authorization, 7)
        if (token === 'boom') {
            throw new Error('verifyConn secret token=CANARY-VERIFY')
        }
        return true
    }

    before(async function() {
        this.timeout(30000)
        for (let fd of [pathUploadTemp, pathUploadTempFun, pathUploadTempDetail]) {
            fs.rmSync(fd, { recursive: true, force: true })
            fs.mkdirSync(fd, { recursive: true })
        }

        //主伺服器: 預設輸出(P1)
        wsv = await mkServer({ port, pathUploadTemp, verifyConn })
        wsv.on('error', (e) => {
            errs.push(e)
        })
        await wsv.ready

        //funLog 伺服器(P3)
        wsvFun = await mkServer({ port: portFun, pathUploadTemp: pathUploadTempFun, verifyConn, funLog: (label, safe, detail) => funRecs.push({ label, safe, detail }) })
        wsvFun.on('error', () => {})
        await wsvFun.ready

        //logDetail 伺服器(P2)
        wsvDetail = await mkServer({ port: portDetail, pathUploadTemp: pathUploadTempDetail, verifyConn, logDetail: true })
        wsvDetail.on('error', () => {})
        await wsvDetail.ready
    })

    after(async function() {
        await wsv.stop()
        await wsvFun.stop()
        await wsvDetail.stop()
        for (let fd of [pathUploadTemp, pathUploadTempFun, pathUploadTempDetail]) {
            fs.rmSync(fd, { recursive: true, force: true })
        }
    })

    //fakeApi, 以固定封包回應任何請求之假伺服器(模擬回應形狀不合之後端; 共用層 test/tools/fakeApi.mjs)
    let fakeApi = (obj) => {
        return startFakeApi({ port: portFake, obj })
    }

    describe('前端(瀏覽器與 Node 共用同一出口 ctx.log)', function() {

        it('P1 回應形狀不合(無 output): 只輸出固定詞彙與鍵名形狀, 不輸出回應物件之值; 呼叫端之拒絕值與以往相同', async function() {
            let fk = await fakeApi({ success: { func: 'f', note: 'CANARY-RESP-NOTE', token: 'CANARY-RESP-TOKEN' } })
            let cp = capture()
            let r
            try {
                r = await cat(mkClient(portFake).execute('f', { a: 1 }))
            }
            finally {
                cp.stop()
                await fk.close()
            }
            assert.strict.deepEqual(r, { ok: false, msg: 'invalid msg.output' }) //P5 對呼叫端不變
            assert.strict.deepEqual(cp.recs.map((v) => v.args), [['invalid msg.output', { msgShape: '(keys: func,note,token)' }]], textOf(cp.recs))
            noLeak(cp.recs, ['CANARY-RESP-NOTE', 'CANARY-RESP-TOKEN'], 'C01')
        })

        it('P1 回應非有效物件(數字、布林、空物件): 只輸出型別/鍵名形狀, 不輸出值', async function() {
            let cases = [
                [{ success: 424242 }, '(number)', '424242'],
                [{ success: true }, '(boolean)', 'true'],
                [{ success: {} }, '(keys: none)', '{}'],
            ]
            for (let [obj, shape, rawText] of cases) {
                let fk = await fakeApi(obj)
                let cp = capture()
                let r
                try {
                    r = await cat(mkClient(portFake).execute('f', { a: 1 }))
                }
                finally {
                    cp.stop()
                    await fk.close()
                }
                assert.strict.deepEqual(r, { ok: false, msg: 'msg is not an effective object' }, rawText)
                assert.strict.deepEqual(cp.recs.map((v) => v.args), [['msg is not an effective object', { msgShape: shape }]], `${rawText}: ${textOf(cp.recs)}`)
            }
        })

        it('P4 重試提示字樣不變(單一字串引數, 不夾帶網址、權杖、回應內容)', async function() {
            let cp = capture()
            let r
            try {
                r = await cat(mkClient(reserved.closed, { retryMain: 1, getToken: () => 'CANARY-TOKEN-RETRY' }).execute('f', { a: 'CANARY-INPUT-RETRY' }))
            }
            finally {
                cp.stop()
            }
            assert.strict.deepEqual(r.ok, false)
            let logs = cp.recs.filter((v) => v.ch === 'log')
            assert.strict.deepEqual(logs.length, 2, textOf(cp.recs))
            assert.strict.deepEqual(logs.map((v) => v.args.length), [1, 1], textOf(cp.recs))
            assert.strict.deepEqual(/^wait \d+\.\d\(second\) to retry\.\.\.$/.test(logs[0].args[0]), true, logs[0].args[0])
            assert.strict.deepEqual(logs[1].args[0], 'retry n=1...')
            noLeak(cp.recs, ['CANARY-TOKEN-RETRY', 'CANARY-INPUT-RETRY', String(reserved.closed)], 'C03')
        })

        it('P3 funLog 為函數: 診斷輸出只交給它, console 零輸出; 重試提示與形狀不合之診斷皆經它', async function() {
            let fk = await fakeApi({ success: { func: 'f', note: 'CANARY-RESP-NOTE', token: 'CANARY-RESP-TOKEN' } })
            let got = []
            let cp = capture()
            let r1
            let r2
            try {
                let wo = mkClient(portFake, { funLog: (label, safe, detail) => got.push({ label, safe, detail }) })
                r1 = await cat(wo.execute('f', { a: 1 }))
                let wo2 = mkClient(reserved.closed, { retryMain: 1, funLog: (label, safe) => got.push({ label, safe }) })
                r2 = await cat(wo2.execute('f', { a: 1 }))
            }
            finally {
                cp.stop()
                await fk.close()
            }
            assert.strict.deepEqual(r1, { ok: false, msg: 'invalid msg.output' })
            assert.strict.deepEqual(r2.ok, false)
            assert.strict.deepEqual(cp.recs.length, 0, `funLog 為函數時 console 須零輸出: ${textOf(cp.recs)}`)
            assert.strict.deepEqual(got.map((v) => v.label).filter((v) => v === 'invalid msg.output').length, 1, JSON.stringify(got))
            assert.strict.deepEqual(got.filter((v) => /^wait /.test(v.label)).length, 1, JSON.stringify(got))
            assert.strict.deepEqual(got.filter((v) => v.label === 'retry n=1...').length, 1, JSON.stringify(got))
            let g = got.find((v) => v.label === 'invalid msg.output')
            assert.strict.deepEqual(g.safe, { msgShape: '(keys: func,note,token)' })
            //細節交給使用端: 憑證鍵名之值遮罩(token), 其餘照給(使用端自行收取)
            assert.strict.deepEqual(g.detail.note, 'CANARY-RESP-NOTE')
            assert.strict.deepEqual(g.detail.token === 'CANARY-RESP-TOKEN', false, `憑證鍵名之值須遮罩: ${JSON.stringify(g.detail)}`)
        })

        it('P2 logDetail 為 true: console 輸出遮罩後之細節(憑證鍵名之值為 ***)', async function() {
            let fk = await fakeApi({ success: { func: 'f', note: 'CANARY-RESP-NOTE', token: 'CANARY-RESP-TOKEN' } })
            let cp = capture()
            try {
                await cat(mkClient(portFake, { logDetail: true }).execute('f', { a: 1 }))
            }
            finally {
                cp.stop()
                await fk.close()
            }
            let t = textOf(cp.recs)
            assert.strict.deepEqual(byLabel(cp.recs, 'invalid msg.output').length, 1, t)
            assert.strict.deepEqual(t.includes('CANARY-RESP-NOTE'), true, t)
            assert.strict.deepEqual(t.includes('CANARY-RESP-TOKEN'), false, `憑證鍵名之值須遮罩: ${t}`)
        })

        it('D4 funLog 拋錯或回傳 rejected promise: 不影響呼叫結果, 不產生未處理之 rejection', async function() {
            let fk = await fakeApi({ success: { func: 'f' } })
            let unhandled = []
            let onUn = (e) => unhandled.push(e)
            process.on('unhandledRejection', onUn)
            let r1
            let r2
            try {
                let funBoom = () => {
                    throw new Error('funLog boom')
                }
                r1 = await cat(mkClient(portFake, { funLog: funBoom }).execute('f', {}))
                r2 = await cat(mkClient(portFake, { funLog: () => Promise.reject(new Error('funLog async boom')) }).execute('f', {}))
                await w.delay(50)
            }
            finally {
                process.removeListener('unhandledRejection', onUn)
                await fk.close()
            }
            assert.strict.deepEqual(r1, { ok: false, msg: 'invalid msg.output' })
            assert.strict.deepEqual(r2, { ok: false, msg: 'invalid msg.output' })
            assert.strict.deepEqual(unhandled.length, 0, String(unhandled[0]))
        })

        it('P1/P3 error 監聽器自身拋錯之通報(wsemi evEmit): 預設只輸出摘要; 給 funLog 時改交 funLog(不再寫 console)', async function() {
            //預設
            let cp = capture()
            try {
                let wo = new WConverhpClient({ url: `http://127.0.0.1:${reserved.closed}`, apiName: 'api', getToken: () => 't', retryMain: 0, timeout: 3000 })
                wo.on('error', () => {
                    throw new Error('listener secret token=CANARY-EVL')
                })
                await cat(wo.execute('f', {}))
            }
            finally {
                cp.stop()
            }
            noLeak(cp.recs, ['CANARY-EVL'], 'C07-default')
            assert.strict.deepEqual(cp.recs.map((v) => v.args), [['[wsemi w-converhp-client] listener threw', { errType: 'Error' }]], textOf(cp.recs))

            //funLog
            let got = []
            let cp2 = capture()
            try {
                let wo = new WConverhpClient({ url: `http://127.0.0.1:${reserved.closed}`, apiName: 'api', getToken: () => 't', retryMain: 0, timeout: 3000, funLog: (label, safe) => got.push({ label, safe }) })
                wo.on('error', () => {
                    throw new Error('listener secret token=CANARY-EVL')
                })
                await cat(wo.execute('f', {}))
            }
            finally {
                cp2.stop()
            }
            assert.strict.deepEqual(cp2.recs.length, 0, `funLog 為函數時 console 須零輸出: ${textOf(cp2.recs)}`)
            assert.strict.deepEqual(got, [{ label: '[wsemi w-converhp-client] listener threw', safe: { errType: 'Error' } }])
        })

        it('R27 中止後診斷不輸出: onTrace 於 retry 事件內中止(其後緊接 retry 提示), 該提示不得輸出(console 與 funLog 皆是)', async function() {
            for (let useFun of [false, true]) {
                let ac = new AbortController()
                let got = []
                let o = {
                    retryMain: 1,
                    onTrace: (e) => {
                        if (e.type === 'retry') {
                            ac.abort()
                        }
                    },
                }
                if (useFun) {
                    o.funLog = (label) => got.push(label)
                }
                let cp = capture()
                let r
                try {
                    r = await cat(mkClient(reserved.closed, o).execute('f', {}, null, { signal: ac.signal }))
                }
                finally {
                    cp.stop()
                }
                assert.strict.deepEqual(r.ok, false)
                assert.strict.deepEqual(r.msg, ac.signal.reason)
                let labels = useFun ? got : cp.recs.map((v) => v.args[0])
                assert.strict.deepEqual(labels.length, 1, `useFun=${useFun}: ${JSON.stringify(labels)}`)
                assert.strict.deepEqual(/^wait \d+\.\d\(second\) to retry\.\.\.$/.test(labels[0]), true, labels[0])
                if (useFun) {
                    assert.strict.deepEqual(cp.recs.length, 0, textOf(cp.recs))
                }
            }
        })

        it('D4 診斷選項為拋錯之 getter: 前端建構子不拋錯, 視為未給(診斷照常走預設)', async function() {
            let getBoom = () => {
                throw new Error('boom')
            }
            let o = { url: `http://127.0.0.1:${reserved.closed}`, apiName: 'api', getToken: () => 't', retryMain: 0, timeout: 3000 }
            Object.defineProperty(o, 'logDetail', { get: getBoom, enumerable: true })
            Object.defineProperty(o, 'funLog', { get: getBoom, enumerable: true })
            let wo = null
            assert.doesNotThrow(() => {
                wo = new WConverhpClient(o)
            })
            wo.on('error', () => {})
            let r = await cat(wo.execute('f', {}))
            assert.strict.deepEqual(r.ok, false)
        })

    })

    describe('伺服端(Node)', function() {

        it('P1 應用端監聽器拋錯: console 只有固定詞彙與 { errType }, 不含訊息原文與堆疊; error 事件(應用端診斷)與回前端之訊息不變', async function() {
            errs.length = 0
            let cp = capture()
            let r
            try {
                r = await cat(mkClient(port).execute('throwCanary', {}))
            }
            finally {
                cp.stop()
            }
            assert.strict.deepEqual(r, { ok: false, msg: 'listener of event[execute] error' }) //P5 回前端不含細節
            assert.strict.deepEqual(cp.recs.map((v) => v.args), [['listener of event[execute] error', { errType: 'Error' }]], textOf(cp.recs))
            noLeak(cp.recs, ['CANARY-LISTENER', process.cwd()], 'S01')
            assert.strict.deepEqual(errs.some((e) => typeof e === 'string' && e.includes('listener secret token=CANARY-LISTENER')), true, JSON.stringify(errs)) //P5 事件供應用端診斷, 不變
        })

        it('P1 verifyConn 拋錯: 同上', async function() {
            errs.length = 0
            let cp = capture()
            let r
            try {
                r = await cat(mkClient(port, { getToken: () => 'boom' }).execute('f', {}))
            }
            finally {
                cp.stop()
            }
            assert.strict.deepEqual(r, { ok: false, msg: 'permission denied' })
            assert.strict.deepEqual(cp.recs.map((v) => v.args), [['verifyConn error for apiType[main]', { errType: 'Error' }]], textOf(cp.recs))
            noLeak(cp.recs, ['CANARY-VERIFY', process.cwd()], 'S02')
            assert.strict.deepEqual(errs.some((e) => typeof e === 'string' && e.includes('verifyConn secret token=CANARY-VERIFY')), true, JSON.stringify(errs))
        })

        it('P1 建構期: corsOrigins 無效(hapi 拋錯)只輸出固定詞彙與 { errType }; 啟動訊息之字樣不變且經同一出口', async function() {
            let cp = capture()
            let wo = null
            try {
                wo = await mkServer({ port: portCors, pathUploadTemp: pathUploadTempFun, corsOrigins: [123] })
                wo.on('error', () => {})
                await wo.ready
            }
            finally {
                cp.stop()
                if (wo) {
                    await wo.stop()
                }
            }
            assert.strict.deepEqual(cp.recs.length, 2, textOf(cp.recs))
            assert.strict.deepEqual(cp.recs[0].args, ['invalid corsOrigins', { errType: 'TypeError' }], textOf(cp.recs))
            assert.strict.deepEqual(cp.recs[1].args.length, 1, textOf(cp.recs))
            assert.strict.deepEqual(/^Server running at: http:\/\/\S+:\d+$/.test(cp.recs[1].args[0]), true, cp.recs[1].args[0])
            noLeak([cp.recs[0]], ['indexOf is not a function', process.cwd()], 'S03')
        })

        it('P1 無效 queueId(請求內容): console 不輸出請求值; error 事件(應用端診斷)不變', async function() {
            errs.length = 0
            let cp = capture()
            let o
            try {
                o = await postJson(port, '/ulctr', { mode: 'merge-slices-get', fileHash: 'a1b2c3d4e5f60718', queueId: 'CANARY-QUEUEID' })
            }
            finally {
                cp.stop()
            }
            assert.strict.deepEqual(get(o, 'success.msg'), 'invalid queueId', JSON.stringify(o))
            assert.strict.deepEqual(cp.recs.map((v) => v.args), [['invalid queueId']], textOf(cp.recs))
            assert.strict.deepEqual(errs.some((e) => typeof e === 'string' && e.includes('CANARY-QUEUEID')), true, JSON.stringify(errs))
        })

        it('P1 /main 本體接收中斷: console 只有固定詞彙與 { errType, errCode }', async function() {
            errs.length = 0
            let cp = capture()
            try {
                await raw({ p: port, urlPath: '/api/main', headers: [], body: Buffer.alloc(2000, 7), declared: 500000, abort: true, ct: 'application/octet-stream' })
                await w.waitFun(() => errs.length >= 1, { timeInterval: 10, attemptNum: 1500 })
            }
            finally {
                cp.stop()
            }
            let ks = byLabel(cp.recs, 'apiMain req.payload err')
            assert.strict.deepEqual(ks.length, 1, textOf(cp.recs))
            assert.strict.deepEqual(Object.keys(ks[0].args[1]).every((k) => ['errType', 'errCode'].includes(k)), true, textOf(cp.recs))
            assert.strict.deepEqual(ks[0].args.length, 2)
            noLeak(cp.recs, [process.cwd()], 'S06')
        })

        it('P1 /slc 本體接收中斷: console 不含 packageId; 只有進度(第幾片/共幾片)與 { errType, errCode }', async function() {
            errs.length = 0
            let cp = capture()
            try {
                await raw({ p: port, urlPath: '/api/slc', headers: ['chunk-index: 2', 'chunk-total: 5', 'package-id: pkgCanaryAbort01'], body: Buffer.alloc(3000, 7), declared: 50000, abort: true, ct: 'application/octet-stream' })
                await w.waitFun(() => errs.some((e) => typeof e === 'string' && e.startsWith('receive chunk[3/5] of packageId[pkgCanaryAbort01] error')), { timeInterval: 10, attemptNum: 1500 })
            }
            finally {
                cp.stop()
            }
            let ks = byLabel(cp.recs, 'apiUploadSlice req.payload err')
            assert.strict.deepEqual(ks.length, 1, textOf(cp.recs))
            assert.strict.deepEqual(ks[0].args.length, 2)
            assert.strict.deepEqual(ks[0].args[1].chunkNo, 3)
            assert.strict.deepEqual(ks[0].args[1].chunkTotal, 5)
            assert.strict.deepEqual(Object.keys(ks[0].args[1]).every((k) => ['errType', 'errCode', 'chunkNo', 'chunkTotal'].includes(k)), true, textOf(cp.recs))
            noLeak(cp.recs, ['pkgCanaryAbort01', process.cwd()], 'S07')
        })

        it('P1 /slc 寫入失敗(切片路徑已是資料夾): 同上, 不含 packageId 與伺服器路徑', async function() {
            errs.length = 0
            fs.mkdirSync(path.resolve(pathUploadTemp, 'pkgCanaryWrite01_0'), { recursive: true })
            let cp = capture()
            try {
                let b = Buffer.alloc(1024, 7)
                await raw({ p: port, urlPath: '/api/slc', headers: ['chunk-index: 0', 'chunk-total: 1', 'package-id: pkgCanaryWrite01'], body: b, declared: b.length, abort: false, ct: 'application/octet-stream' })
                await w.waitFun(() => errs.some((e) => typeof e === 'string' && e.startsWith('write chunk[1/1] of packageId[pkgCanaryWrite01] error')), { timeInterval: 10, attemptNum: 1500 })
            }
            finally {
                cp.stop()
                fs.rmSync(path.resolve(pathUploadTemp, 'pkgCanaryWrite01_0'), { recursive: true, force: true })
            }
            let ks = byLabel(cp.recs, 'apiUploadSlice streamWrite err')
            assert.strict.deepEqual(ks.length, 1, textOf(cp.recs))
            assert.strict.deepEqual(ks[0].args.length, 2)
            assert.strict.deepEqual(ks[0].args[1].chunkNo, 1)
            assert.strict.deepEqual(ks[0].args[1].chunkTotal, 1)
            assert.strict.deepEqual(typeof ks[0].args[1].errType, 'string')
            noLeak(cp.recs, ['pkgCanaryWrite01', process.cwd()], 'S08')
        })

        it('P1 合併失敗與暫存夾內非本套件之檔名(worker 與合併佇列之輸出): console 不含檔名、雜湊、路徑; 細節交 funLog', async function() {
            //worker: 暫存夾內有 <fileHash>_<非整數> 之檔(check-total-hash 略過之並以詞彙告知)
            let fileHash = 'a1b2c3d4e5f60718'
            fs.writeFileSync(path.resolve(pathUploadTempFun, `${fileHash}_canaryname`), 'x')
            funRecs.length = 0
            let cp = capture()
            try {
                let o = await postJson(portFun, '/ulctr', { mode: 'check-total-hash', fileHash, fileSize: 100 })
                assert.strict.deepEqual(get(o, 'success.slks'), [], JSON.stringify(o)) //回前端之形狀不變, 不夾帶診斷鍵
                assert.strict.deepEqual(Object.keys(o.success).sort(), ['bAllExist', 'bAllHash', 'bAllSize', 'bSls', 'sizeSlice', 'slks'], JSON.stringify(o))

                //merge: 缺片之合併(合併佇列於脫勾後失敗, 寫 .error)
                let fileHash2 = 'b1b2c3d4e5f60718'
                await postJson(portFun, '/ulctr', { mode: 'merge-slices-push', fileHash: fileHash2, chunkTotal: 2 })
                await w.waitFun(() => fs.existsSync(path.resolve(pathUploadTempFun, `${fileHash2}.error`)), { timeInterval: 10, attemptNum: 3000 })
                await w.waitFun(() => funRecs.some((v) => v.label === 'merge slices error'), { timeInterval: 10, attemptNum: 3000 })
            }
            finally {
                cp.stop()
            }
            assert.strict.deepEqual(cp.recs.length, 0, `funLog 為函數時含 worker 與合併佇列之 console 須零輸出: ${textOf(cp.recs)}`)
            let sk = funRecs.find((v) => v.label === 'skip file: can not parse chunk index')
            assert.strict.deepEqual(sk !== undefined, true, JSON.stringify(funRecs))
            assert.strict.deepEqual(sk.safe, undefined)
            assert.strict.deepEqual(JSON.stringify(sk.detail).includes(`${fileHash}_canaryname`), true, JSON.stringify(sk))
            let me = funRecs.find((v) => v.label === 'merge slices error')
            assert.strict.deepEqual(typeof me.safe.errType, 'string', JSON.stringify(me))
            assert.strict.deepEqual(JSON.stringify(me.safe).includes('canary'), false)
        })

        it('P1 worker 內之真實檔案系統錯誤(暫存夾內一個指向不存在目標之 junction): 錯誤代碼隨記錄回主執行緒, 輸出 { errType: Error, errCode: ENOENT }, 路徑只在細節', async function() {
            //junction 之目標不存在 → worker 內 fs.statSync 於逐檔讀大小時得 ENOENT(真實錯誤, 不以替身); 無法建立 junction 之環境略過
            let fileHash = 'f1b2c3d4e5f60718'
            let link = path.resolve(pathUploadTempFun, `${fileHash}_9`)
            try {
                fs.symlinkSync(path.resolve(pathUploadTempFun, 'no-such-target'), link, 'junction')
            }
            catch (err) {
                this.skip()
            }
            funRecs.length = 0
            let cp = capture()
            try {
                await postJson(portFun, '/ulctr', { mode: 'check-total-hash', fileHash, fileSize: 100 })
            }
            finally {
                cp.stop()
                try {
                    fs.rmdirSync(link) //只拆連結本身(不遞迴)
                }
                catch (err) {}
            }
            assert.strict.deepEqual(cp.recs.length, 0, textOf(cp.recs))
            let rec = funRecs.find((v) => v.label === 'check each file size: statSync error')
            assert.strict.deepEqual(rec !== undefined, true, JSON.stringify(funRecs))
            assert.strict.deepEqual(rec.safe, { errType: 'Error', errCode: 'ENOENT' }) //代碼經 worker 記錄、主執行緒重建後仍可得
            assert.strict.deepEqual(rec.detail.path, link) //路徑只在細節
            assert.strict.deepEqual(fs.existsSync(link), false) //連結已拆
        })

        it('D4 診斷選項為拋錯之 getter: 伺服端建構子不拋錯, 視為未給', async function() {
            let getBoom = () => {
                throw new Error('boom')
            }
            let o = { port: portCors, apiName: 'api', pathUploadTemp: pathUploadTempFun }
            Object.defineProperty(o, 'logDetail', { get: getBoom, enumerable: true })
            Object.defineProperty(o, 'funLog', { get: getBoom, enumerable: true })
            let wo = null
            let cp = capture()
            try {
                assert.doesNotThrow(() => {
                    wo = new WConverhpServer(o)
                })
                wo.on('error', () => {})
                assert.strict.deepEqual(await wo.ready, true)
            }
            finally {
                cp.stop()
                if (wo) {
                    await wo.stop()
                }
            }
            assert.strict.deepEqual(cp.recs.map((v) => v.args.length), [1], textOf(cp.recs)) //預設出口: 啟動訊息(單一字串)
        })

        it('P1 啟動失敗(埠被占用)、路由註冊失敗(外部 serverHapi)、停止失敗: 只輸出固定詞彙與 { errType, errCode }; error 事件不變', async function() {
            //埠被占用: 於主伺服器之埠再起一台
            let cp = capture()
            let wo2 = null
            let evs = []
            try {
                wo2 = await mkServer({ port, pathUploadTemp: pathUploadTempFun })
                wo2.on('error', (e) => evs.push(e))
                await wo2.ready
            }
            finally {
                cp.stop()
            }
            let ks = byLabel(cp.recs, 'start server error')
            assert.strict.deepEqual(ks.length, 1, textOf(cp.recs))
            assert.strict.deepEqual(ks[0].args[1], { errType: 'Error', errCode: 'EADDRINUSE' }, textOf(cp.recs))
            assert.strict.deepEqual(ks[0].args.length, 2)
            noLeak(cp.recs, [process.cwd()], 'S09')

            //路由註冊失敗: 外部 serverHapi 已有 /api/main
            let hs = Hapi.server() //外部 serverHapi 不啟動(本檔不令其監聽)
            hs.route({ method: 'POST', path: '/api/main', handler: () => 'x' })
            let cp2 = capture()
            let wo3 = null
            try {
                wo3 = await mkServer({ serverHapi: hs, pathUploadTemp: pathUploadTempFun })
                wo3.on('error', () => {})
                await wo3.ready
            }
            finally {
                cp2.stop()
            }
            let k2 = byLabel(cp2.recs, 'register routes error')
            assert.strict.deepEqual(k2.length, 1, textOf(cp2.recs))
            assert.strict.deepEqual(Object.keys(k2[0].args[1]).every((k) => ['errType', 'errCode'].includes(k)), true, textOf(cp2.recs))
            noLeak(cp2.recs, [process.cwd(), '/api/main'], 'S10')

            //停止失敗: serverHapi.stop 拋含資料值之錯誤
            let hs2 = Hapi.server()
            hs2.stop = async() => {
                throw new Error('stop secret token=CANARY-STOP')
            }
            let wo4 = await mkServer({ serverHapi: hs2, pathUploadTemp: pathUploadTempFun })
            let evs4 = []
            wo4.on('error', (e) => evs4.push(e))
            await wo4.ready
            let cp3 = capture()
            try {
                await wo4.stop()
            }
            finally {
                cp3.stop()
            }
            assert.strict.deepEqual(cp3.recs.map((v) => v.args), [['stop server error', { errType: 'Error' }]], textOf(cp3.recs))
            noLeak(cp3.recs, ['CANARY-STOP'], 'S11')
            assert.strict.deepEqual(evs4.some((e) => typeof e === 'string' && e.includes('CANARY-STOP')), true, JSON.stringify(evs4)) //P5 事件不變
        })

        it('P3 funLog 伺服器: 應用端監聽器拋錯、verifyConn 拋錯、無效 queueId 之診斷全交 funLog, console 零輸出; 細節遮罩後交付', async function() {
            funRecs.length = 0
            let cp = capture()
            try {
                await cat(mkClient(portFun).execute('throwCanary', {}))
                await cat(mkClient(portFun, { getToken: () => 'boom' }).execute('f', {}))
                await postJson(portFun, '/ulctr', { mode: 'merge-slices-get', fileHash: 'a1b2c3d4e5f60718', queueId: 'CANARY-QUEUEID' })
            }
            finally {
                cp.stop()
            }
            assert.strict.deepEqual(cp.recs.length, 0, `funLog 為函數時 console 須零輸出: ${textOf(cp.recs)}`)
            let labels = funRecs.map((v) => v.label)
            assert.strict.deepEqual(labels.includes('listener of event[execute] error'), true, JSON.stringify(labels))
            assert.strict.deepEqual(labels.includes('verifyConn error for apiType[main]'), true, JSON.stringify(labels))
            assert.strict.deepEqual(labels.includes('invalid queueId'), true, JSON.stringify(labels))
            let le = funRecs.find((v) => v.label === 'listener of event[execute] error')
            assert.strict.deepEqual(le.safe, { errType: 'Error' })
            assert.strict.deepEqual(String(le.detail.message).includes('CANARY-LISTENER'), false, `細節之憑證樣式須遮罩(token=***): ${String(le.detail.message)}`)
            assert.strict.deepEqual(String(le.detail.message).includes('listener secret'), true, String(le.detail.message))
            let qi = funRecs.find((v) => v.label === 'invalid queueId')
            assert.strict.deepEqual(qi.detail, { id: 'CANARY-QUEUEID' })
        })

        it('P2 logDetail 伺服器: console 輸出遮罩後之細節(憑證樣式 token=*** , 其餘照列)', async function() {
            let cp = capture()
            try {
                await cat(mkClient(portDetail).execute('throwCanary', {}))
            }
            finally {
                cp.stop()
            }
            let ks = byLabel(cp.recs, 'listener of event[execute] error')
            assert.strict.deepEqual(ks.length, 1, textOf(cp.recs))

            //第二引數為遮罩後之 Error 副本: 斷言其 message 欄位, 不依 util.inspect 之文字化(同一行程內若有他檔改了 Error.prepareStackTrace〔如載入 Playwright 後〕,
            //inspect 對該副本只印 [[Stack unavailable]] 而不含訊息, 使本案隨檔案順序時紅時綠)
            let m = String(get(ks[0].args[1], 'message', ''))
            assert.strict.deepEqual(m.includes('listener secret'), true, m)
            assert.strict.deepEqual(m.includes('CANARY-LISTENER'), false, m)
        })

        it('P3 funLog 伺服器之啟動訊息: 不寫 console, 改交 funLog(字樣不變)', async function() {
            let got = []
            let cp = capture()
            let wo = null
            try {
                wo = await mkServer({ port: portCors, pathUploadTemp: pathUploadTempFun, funLog: (label, safe, detail) => got.push({ label, safe, detail }) })
                wo.on('error', () => {})
                await wo.ready
            }
            finally {
                cp.stop()
                if (wo) {
                    await wo.stop()
                }
            }
            assert.strict.deepEqual(cp.recs.length, 0, `funLog 為函數時啟動訊息不得寫 console: ${textOf(cp.recs)}`)
            assert.strict.deepEqual(got.length, 1, JSON.stringify(got))
            assert.strict.deepEqual(/^Server running at: http:\/\/\S+:\d+$/.test(got[0].label), true, got[0].label)
        })

        it('P1/P3 應用端未註冊 error 監聽器時監聽器拋錯之通報(wsemi evEmit): 預設只輸出摘要(console.error); 給 funLog 時改交 funLog', async function() {
            //預設(無 error 監聽器, 通報由 wsemi 之 evEmit 直接輸出)
            let cp = capture()
            let wo = null
            try {
                wo = await mkServer({ port: portCors, pathUploadTemp: pathUploadTempFun })
                await wo.ready
                await cat(mkClient(portCors).execute('throwCanary', {}))
            }
            finally {
                cp.stop()
                if (wo) {
                    await wo.stop()
                }
            }
            let ks = cp.recs.filter((v) => v.args[0] === '[wsemi w-converhp] listener threw')
            assert.strict.deepEqual(ks.length, 1, textOf(cp.recs))
            assert.strict.deepEqual(ks[0].ch, 'error')
            assert.strict.deepEqual(ks[0].args.slice(1), [{ errType: 'Error' }])
            noLeak(cp.recs, ['CANARY-LISTENER', process.cwd()], 'S12-default')

            //funLog
            let got = []
            let cp2 = capture()
            let wo2 = null
            try {
                wo2 = await mkServer({ port: portCors, pathUploadTemp: pathUploadTempFun, funLog: (label, safe, detail) => got.push({ label, safe, detail }) })
                await wo2.ready
                await cat(mkClient(portCors).execute('throwCanary', {}))
            }
            finally {
                cp2.stop()
                if (wo2) {
                    await wo2.stop()
                }
            }
            assert.strict.deepEqual(cp2.recs.length, 0, `funLog 為函數時 console 須零輸出: ${textOf(cp2.recs)}`)
            let g = got.find((v) => v.label === '[wsemi w-converhp] listener threw')
            assert.strict.deepEqual(g !== undefined, true, JSON.stringify(got.map((v) => v.label)))
            assert.strict.deepEqual(g.safe, { errType: 'Error' })
            assert.strict.deepEqual(g.detail.event, 'execute')
        })

    })

})
