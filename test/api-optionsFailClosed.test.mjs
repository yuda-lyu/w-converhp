import assert from 'assert'
import fs from 'fs'
import Hapi from '@hapi/hapi'
import w from 'wsemi'
import obj2u8arr from 'wsemi/src/obj2u8arr.mjs'
import u8arr2obj from 'wsemi/src/u8arr2obj.mjs'
import WConverhpServer from '../src/WConverhpServer.mjs'
import axes from './tools/api-axes.mjs'
import wPorts from './tools/ports.mjs'

let { portOf } = wPorts

let { allRoutes } = axes


/**
 * api: 存取控制選項(verifyConn、corsOrigins)給了無效值時須收緊而非放寬, 並以建構期 error 事件告知(規則帳本 R26, 第十二輪)
 *
 * 修正前(實測 tmp/r12/probe_inject.mjs、tmp/r12/probe_cors_values.mjs):
 *   verifyConn 給 false、字串、物件等非函數 → 換成「全部放行」且 0 則事件 —— 使用端以為設了關卡, 實際完全沒擋;
 *     而同一道關卡之回傳值只認 === true(checkConn), 型別判定卻放寬, 兩層規則相反
 *   corsOrigins 給字串、[]、{}、[''] → 退回 ['*'], 惡意來源亦得 Access-Control-Allow-Origin, 0 則事件;
 *     [123] → 建構子同步拋出 origin.indexOf is not a function(違反「建構期失敗以 error 事件通知、不拋出」)
 *
 * 「未給」(鍵不存在、undefined、null)維持原預設; 收緊只針對「有給但無效」。建構期失敗之通道與埠被占用、暫存資料夾建立失敗相同(evEmitDelay, 帳本 R11)。
 */
describe('api-optionsFailClosed', function() {
    this.timeout(60000)

    let fd = './test/_tmp/api-optionsFailClosed'

    before(function() {
        fs.rmSync(fd, { recursive: true, force: true })
    })

    after(function() {
        fs.rmSync(fd, { recursive: true, force: true })
    })

    //packet, /main 之請求本體
    let packet = () => Buffer.from(obj2u8arr({ func: 'f', input: {} }))

    it('verifyConn 有給但非函數(false): 建構期恰一則 error 事件; 六路由一律 permission denied(狀態碼取自軸)、不發 handler 事件、不呼叫應用端', async function() {
        let port = portOf('api-optionsFailClosed')
        let evs = []
        let handlers = []
        let nApp = 0
        let wsv = new WConverhpServer({ port, useInert: false, pathUploadTemp: `${fd}/v-false`, verifyConn: false })
        wsv.on('error', (e) => evs.push(String(e)))
        wsv.on('handler', (d) => handlers.push(d.api))
        wsv.on('execute', (func, input, pm) => {
            nApp += 1
            pm.resolve({ ok: 1 })
        })
        wsv.on('upload', (input, pm) => {
            nApp += 1
            pm.resolve({ ok: 1 })
        })
        wsv.on('download', (input, pm) => {
            nApp += 1
            pm.resolve({ streamRead: Buffer.from('abc'), filename: 'a.txt', fileSize: 3, fileType: 'text/plain' })
        })
        try {
            await wsv.ready //待伺服器就緒(ready), 其 resolve 時建構期事件必已派發完畢
            assert.strict.deepEqual(evs.length, 1, `建構期事件須恰一則, 實得 ${JSON.stringify(evs)}`)
            assert.strict.deepEqual(evs[0].includes('invalid verifyConn'), true, evs[0])
            evs.length = 0
            for (let k of Object.keys(allRoutes)) {
                let df = allRoutes[k]
                let { url, init } = df.requestOf(port, 'ok')
                let r = await fetch(url, init)
                let buf = Buffer.from(await r.arrayBuffer())
                assert.strict.deepEqual(r.status, df.errorStatus.permission, `${k}: 狀態碼`)
                assert.strict.deepEqual(r.headers.get('return-type'), 'error', `${k}: Return-Type`)
                assert.strict.deepEqual(u8arr2obj(new Uint8Array(buf)).error, 'permission denied', `${k}: 錯誤封包`)
            }
            await w.delay(200) //否定觀察窗(六路由後不得有 handler/應用端呼叫/多餘事件; 負載只會漏抓不會誤判), 非同步點
            assert.strict.deepEqual(handlers, [], `權限未通過不得發 handler 事件: ${JSON.stringify(handlers)}`)
            assert.strict.deepEqual(nApp, 0, '不得呼叫應用端')
            assert.strict.deepEqual(evs, [], `permission denied 不另發事件(建構期已告知一次): ${JSON.stringify(evs)}`)
        }
        finally {
            await wsv.stop()
        }
    })

    it('對照組: verifyConn 為 null 視同未給 —— 依預設全部放行, 且無任何事件', async function() {
        let port = portOf('api-optionsFailClosed', 1)
        let evs = []
        let wsv = new WConverhpServer({ port, useInert: false, pathUploadTemp: `${fd}/v-null`, verifyConn: null })
        wsv.on('error', (e) => evs.push(String(e)))
        wsv.on('execute', (func, input, pm) => pm.resolve({ ok: 1 }))
        try {
            await wsv.ready //待伺服器就緒(ready)
            let { url, init } = allRoutes.main.requestOf(port, 'ok')
            let r = await fetch(url, init)
            let o = u8arr2obj(new Uint8Array(Buffer.from(await r.arrayBuffer())))
            assert.strict.deepEqual(r.headers.get('return-type'), 'success', JSON.stringify(o))
            assert.strict.deepEqual(o.success.output, { ok: 1 })
            assert.strict.deepEqual(evs, [])
        }
        finally {
            await wsv.stop()
        }
    })

    it('verifyConn 之值域: 非函數之各值一律拒絕並各發一則建構期事件; 未給、undefined、null、sync/async 函數照舊(以未啟動之外部 serverHapi 與 inject 驗, 不佔 port)', async function() {
        //run, 以外部 serverHapi 建構(verifyConn 於兩種部署皆作用), 不 start 而以 hapi 之 inject 打 /main
        let run = async(o) => {
            let hs = Hapi.server()
            let evs = []
            let wsv = new WConverhpServer({ serverHapi: hs, pathUploadTemp: `${fd}/inject`, ...o })
            wsv.on('error', (e) => evs.push(String(e)))
            wsv.on('execute', (func, input, pm) => pm.resolve({ ok: 1 }))
            await wsv.ready //外部 serverHapi 模式之 ready 於建構期事件派發後 resolve(不等外部伺服器啟動, 不佔 port)
            let res = await hs.inject({ method: 'POST', url: '/api/main', headers: { 'authorization': 'Bearer t', 'content-type': 'application/octet-stream' }, payload: packet() })
            return { evs, returnType: res.headers['return-type'], body: u8arr2obj(new Uint8Array(res.rawPayload)) }
        }
        let invalid = [
            ['false', false],
            ['true', true],
            ['0', 0],
            ['1', 1],
            ['空字串', ''],
            ['字串', 'x'],
            ['物件', {}],
            ['陣列', []],
            ['Promise', Promise.resolve(true)],
            ['async generator 函數(lodash isFunction 為 false)', async function * () {}],
            ['已撤銷之 Proxy(判定時拋錯, 修正前建構子同步拋出)', (() => {
                let r = Proxy.revocable(() => true, {})
                r.revoke()
                return r.proxy
            })()],
        ]
        for (let [label, v] of invalid) {
            let r = null
            try {
                r = await run({ verifyConn: v })
            }
            catch (err) {
                assert.fail(`${label}: 建構不得同步拋錯(建構期失敗須以 error 事件通知): ${err.message}`)
            }
            assert.strict.deepEqual(r.returnType, 'error', `${label}: 須拒絕, 實得 ${JSON.stringify(r.body)}`)
            assert.strict.deepEqual(r.body.error, 'permission denied', `${label}: ${JSON.stringify(r.body)}`)
            assert.strict.deepEqual(r.evs.length, 1, `${label}: 建構期事件須恰一則, 實得 ${JSON.stringify(r.evs)}`)
            assert.strict.deepEqual(r.evs[0].includes('invalid verifyConn'), true, `${label}: ${r.evs[0]}`)
        }
        let valid = [
            ['鍵不存在', {}],
            ['undefined', { verifyConn: undefined }],
            ['null', { verifyConn: null }],
            ['sync 函數', { verifyConn: () => true }],
            ['async 函數', { verifyConn: async() => true }],
        ]
        for (let [label, o] of valid) {
            let r = await run(o)
            assert.strict.deepEqual(r.returnType, 'success', `${label}: 須放行, 實得 ${JSON.stringify(r.body)}`)
            assert.strict.deepEqual(r.evs, [], `${label}: 不得有事件`)
        }
    })

    it('useInert 與 pathStaticFiles 有給而無效: 不提供靜態檔並各恰發一則建構期事件(修正前退回預設而公開資料夾); 對照組: 合法者照常提供', async function() {
        //以 JSDoc 範例之 pathStaticFiles '.'(公開專案資料夾)為情境, 以 GET /package.json 判定是否公開
        let cases = [
            { label: 'useInert 為字串 \'false\'(環境變數之常見誤用)', o: { useInert: 'false', pathStaticFiles: '.' }, k: 10, ev: 'invalid useInert', status: 404 },
            { label: 'pathStaticFiles 非字串', o: { pathStaticFiles: 123 }, k: 11, ev: 'invalid pathStaticFiles', status: 404 },
            { label: '對照組: useInert 為 true 且 pathStaticFiles 合法', o: { useInert: true, pathStaticFiles: '.' }, k: 12, ev: '', status: 200 },
        ]
        for (let c of cases) {
            let port = portOf('api-optionsFailClosed', c.k)
            let evs = []
            let wsv = new WConverhpServer({ port, pathUploadTemp: `${fd}/static${c.k}`, ...c.o })
            wsv.on('error', (e) => evs.push(String(e)))
            try {
                await wsv.ready //待伺服器就緒(ready), 其 resolve 時建構期事件必已派發完畢
                let r = await fetch(`http://127.0.0.1:${port}/package.json`)
                await r.arrayBuffer()
                assert.strict.deepEqual(r.status, c.status, `${c.label}: GET /package.json`)
                if (c.ev) {
                    assert.strict.deepEqual(evs.length, 1, `${c.label}: 建構期事件須恰一則, 實得 ${JSON.stringify(evs)}`)
                    assert.strict.deepEqual(evs[0].includes(c.ev), true, `${c.label}: ${evs[0]}`)
                }
                else {
                    assert.strict.deepEqual(evs, [], `${c.label}: 不得有事件`)
                }
            }
            finally {
                await wsv.stop()
            }
        }
    })

    it('corsOrigins 於外部 serverHapi 模式下不作用: 有給即須恰發一則建構期事件告知(修正前靜默忽略); 未給者不得有事件', async function() {
        let run = async(o) => {
            let hs = Hapi.server()
            let evs = []
            let wsv = new WConverhpServer({ serverHapi: hs, pathUploadTemp: `${fd}/inject-cors`, ...o })
            wsv.on('error', (e) => evs.push(String(e)))
            await wsv.ready //外部 serverHapi 模式之 ready 於建構期事件派發後 resolve
            return evs
        }
        let evs1 = await run({ corsOrigins: ['http://a.example'] })
        assert.strict.deepEqual(evs1.length, 1, JSON.stringify(evs1))
        assert.strict.deepEqual(evs1[0].includes('corsOrigins has no effect with serverHapi'), true, evs1[0])
        let evs2 = await run({})
        assert.strict.deepEqual(evs2, [], '未給 corsOrigins 者不得有事件(如 w-serv-hapi 之用法)')
    })

    //corsCase, 以自建伺服器觀察 corsOrigins 之結果: 建構是否拋、事件、指定來源(實際請求與預檢)之 ACAO、同源請求是否照常
    let corsCase = async(k, v, origins) => {
        let port = portOf('api-optionsFailClosed', k)
        let base = `http://127.0.0.1:${port}/api/main`
        let evs = []
        let wsv = null
        try {
            wsv = new WConverhpServer({ port, useInert: false, pathUploadTemp: `${fd}/cors${k}`, corsOrigins: v })
        }
        catch (err) {
            return { thrown: err.message }
        }
        wsv.on('error', (e) => evs.push(String(e)))
        wsv.on('execute', (func, input, pm) => pm.resolve({ ok: 1 }))
        try {
            await wsv.ready //待伺服器就緒(ready), 其 resolve 時建構期事件必已派發完畢
            let acao = {}
            for (let origin of origins) {
                let r1 = await fetch(base, { method: 'POST', headers: { 'Authorization': 'Bearer t', 'Content-Type': 'application/octet-stream', 'Origin': origin }, body: packet() })
                await r1.arrayBuffer()
                let r2 = await fetch(base, { method: 'OPTIONS', headers: { 'Origin': origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization' } })
                await r2.arrayBuffer()
                acao[origin] = { actual: r1.headers.get('access-control-allow-origin'), preflight: r2.headers.get('access-control-allow-origin') }
            }
            let r3 = await fetch(base, { method: 'POST', headers: { 'Authorization': 'Bearer t', 'Content-Type': 'application/octet-stream' }, body: packet() })
            await r3.arrayBuffer()
            return { evs, acao, sameOrigin: r3.headers.get('return-type') }
        }
        finally {
            await wsv.stop()
        }
    }

    it('corsOrigins 有給而無效(物件、hapi 拒絕之陣列 [123] 與 [\'*\', 其他]): 建構不拋錯、恰一則建構期事件、停用 CORS(實際請求與預檢皆無 ACAO), 同源請求照常(修正前退回 [\'*\'] 或建構子同步拋)', async function() {
        let cases = [
            ['物件', {}, 2],
            ['元素非字串(hapi 於建構時拋 TypeError)', [123], 3],
            ['\'*\' 混入其他來源(hapi 於建構時 assert)', ['*', 'http://a.example'], 4],
        ]
        for (let [label, v, k] of cases) {
            let r = await corsCase(k, v, ['http://evil.example', 'http://a.example'])
            assert.strict.deepEqual(r.thrown, undefined, `${label}: 建構不得同步拋錯(建構期失敗須以 error 事件通知): ${r.thrown}`)
            assert.strict.deepEqual(r.evs.length, 1, `${label}: 建構期事件須恰一則, 實得 ${JSON.stringify(r.evs)}`)
            assert.strict.deepEqual(r.evs[0].includes('invalid corsOrigins'), true, `${label}: ${r.evs[0]}`)
            for (let origin of Object.keys(r.acao)) {
                assert.strict.deepEqual(r.acao[origin], { actual: null, preflight: null }, `${label}: ${origin} 不得取得 CORS 授權標頭`)
            }
            assert.strict.deepEqual(r.sameOrigin, 'success', `${label}: 同源請求須照常服務`)
        }
    })

    it('corsOrigins 明示停用(false、[]、只含空字串之陣列): 停用 CORS 且不發事件 —— 為「不允許跨來源讀取」之合法寫法(修正前 [] 與 [\'\'] 退回 [\'*\'] 而放行任何來源)', async function() {
        let cases = [
            ['false', false, 5],
            ['空陣列', [], 6],
            ['只含空字串', [''], 7],
        ]
        for (let [label, v, k] of cases) {
            let r = await corsCase(k, v, ['http://evil.example'])
            assert.strict.deepEqual(r.thrown, undefined, `${label}: ${r.thrown}`)
            assert.strict.deepEqual(r.evs, [], `${label}: 明示停用不得發事件`)
            assert.strict.deepEqual(r.acao['http://evil.example'], { actual: null, preflight: null }, `${label}: 不得取得 CORS 授權標頭`)
            assert.strict.deepEqual(r.sameOrigin, 'success', `${label}: 同源請求須照常服務`)
        }
    })

    it('corsOrigins 合法之寬鬆寫法: 單一字串視為單一來源、陣列剔除空字串元素後照用 —— 指定來源得 ACAO, 其他來源不得, 不發事件(修正前字串退回 [\'*\'] 而放行任何來源)', async function() {
        let cases = [
            ['單一字串', 'http://a.example', 8],
            ['含空字串之陣列(如以逗號分割設定值之尾逗號)', ['', 'http://a.example'], 9],
        ]
        for (let [label, v, k] of cases) {
            let r = await corsCase(k, v, ['http://a.example', 'http://evil.example'])
            assert.strict.deepEqual(r.thrown, undefined, `${label}: ${r.thrown}`)
            assert.strict.deepEqual(r.evs, [], `${label}: 不得有事件`)
            assert.strict.deepEqual(r.acao['http://a.example'].actual, 'http://a.example', `${label}: 指定來源之實際請求須得 ACAO`)
            assert.strict.deepEqual(r.acao['http://a.example'].preflight, 'http://a.example', `${label}: 指定來源之預檢須得 ACAO`)
            assert.strict.deepEqual(r.acao['http://evil.example'].actual, null, `${label}: 其他來源不得取得 ACAO`)
            assert.strict.deepEqual(r.sameOrigin, 'success', `${label}: 同源請求須照常服務`)
        }
    })

})
