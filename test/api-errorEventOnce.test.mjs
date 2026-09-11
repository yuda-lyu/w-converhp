import assert from 'assert'
import w from 'wsemi'
import u8arr2obj from 'wsemi/src/u8arr2obj.mjs'
import WConverhpServer from '../src/WConverhpServer.mjs'
import { allRoutes } from './api-axes.mjs'


/**
 * api: 「同一種失敗 × 六路由」之行為表 —— 帳本 R5(一次失敗恰一則事件)之機械化保護
 *
 * why 需要這張表(第十一輪, 兩份複審一致): 帳本 R5 之 server 側原以 evEmit('error' 之站點總數(28)為鎖, 而總數只能偵測「有人增刪了一處」,
 * 偵測不到「同一次失敗發了兩則」或「某條路由漏了處置」; 路由層收斂(routeSpec / admit / reply)之後總數必變, 若只改數字則鎖形同虛設。
 * 本表以「失敗種類 × 路由」為格, 成員取自 test/api-axes.mjs 之 allRoutes(遵 R8), 每格斷言則數、回前端之訊息、HTTP 狀態碼(取自軸上之 errorStatus),
 * 另鎖兩件原本沒有測試守著之既有行為: ①permission denied 時不發 handler 事件 ②應用端於六路由所見之 authorization(五路由取自標頭原樣, /dwgf 由 query 之 token 合成)
 */
describe('api-errorEventOnce', function() {
    this.timeout(60000)

    let portA = 8624 //有監聽器
    let portB = 8625 //無應用端監聽器
    let fd = './test/_tmp/api-errorEventOnce'
    let wsvA = null
    let wsvB = null
    let errsA = []
    let errsB = []
    let handlersA = []
    let auths = []

    let verifyConnOf = (tag) => {
        return ({ apiType, authorization, headers }) => {
            let scn = (headers && headers['x-scn']) || ''
            if (scn === 'deny') {
                return false
            }
            if (scn === 'throw') {
                throw new Error(`boom-${tag}`)
            }
            auths.push({ apiType, authorization })
            return true
        }
    }

    before(async function() {
        wsvA = new WConverhpServer({ port: portA, useInert: false, pathUploadTemp: `${fd}/a`, verifyConn: verifyConnOf('a') })
        wsvA.on('error', (e) => errsA.push(String(e)))
        wsvA.on('handler', (d) => handlersA.push(d.api))
        wsvA.on('execute', (func, input, pm) => {
            if (func === 'reject') {
                pm.reject('app says no')
                return
            }
            if (func === 'throw') {
                throw new Error('listener boom')
            }
            pm.resolve({ ok: 1 })
        })
        wsvA.on('download', (input, pm) => {
            if (input.fileId === 'reject') {
                pm.reject('app says no')
                return
            }
            if (input.fileId === 'throw') {
                throw new Error('listener boom')
            }
            pm.resolve({ streamRead: Buffer.from('abc'), filename: 'a.txt', fileSize: 3, fileType: 'text/plain' })
        })
        wsvB = new WConverhpServer({ port: portB, useInert: false, pathUploadTemp: `${fd}/b`, verifyConn: verifyConnOf('b') })
        wsvB.on('error', (e) => errsB.push(String(e)))
        await w.delay(900)
    })

    after(async function() {
        await wsvA.stop()
        await wsvB.stop()
    })

    //hit, 打一格並取觀察值
    let hit = async(req, opt = {}) => {
        let { url, init } = req
        init = { ...init, headers: { ...init.headers, ...(opt.headers || {}) } }
        let errs = opt.server === 'b' ? errsB : errsA
        errs.length = 0
        handlersA.length = 0
        let r = await fetch(url, init)
        let buf = Buffer.from(await r.arrayBuffer())
        await w.delay(150)
        let rt = r.headers.get('return-type')
        return {
            status: r.status,
            returnType: rt,
            error: rt === 'error' ? u8arr2obj(new Uint8Array(buf)).error : undefined,
            nErrs: errs.length,
            errs: [...errs],
            nHandler: handlersA.length,
            handlers: [...handlersA],
        }
    }

    let keys = Object.keys(allRoutes)

    it('正常路徑: 六路由各恰發一則 handler 事件(api 字面取自軸), 0 則 error 事件, 且應用端所見之 authorization 六路由一致為 Bearer t(/dwgf 由 query 之 token 合成)', async function() {
        auths.length = 0
        for (let k of keys) {
            let df = allRoutes[k]
            let r = await hit(df.requestOf(portA, 'ok'))
            assert.strict.deepEqual(r.returnType !== 'error', true, `${k}: ${JSON.stringify(r)}`)
            assert.strict.deepEqual(r.nErrs, 0, `${k}: ${JSON.stringify(r)}`)
            assert.strict.deepEqual(r.handlers, [df.api], `${k}: ${JSON.stringify(r)}`)
        }
        for (let k of keys) {
            let df = allRoutes[k]
            let seen = auths.filter((v) => v.apiType === df.apiType).map((v) => v.authorization)
            assert.strict.deepEqual(seen.length >= 1, true, `${k}: verifyConn 未收到 apiType[${df.apiType}]`)
            assert.strict.deepEqual(seen.every((v) => v === 'Bearer t'), true, `${k}(authFrom=${df.authFrom}): ${JSON.stringify(seen)}`)
        }
    })

    it('verifyConn 回 false: 六路由皆 permission denied、狀態碼取自軸、0 則 error 事件, 且不發 handler 事件', async function() {
        for (let k of keys) {
            let df = allRoutes[k]
            let r = await hit(df.requestOf(portA, 'ok'), { headers: { 'x-scn': 'deny' } })
            assert.strict.deepEqual(r.status, df.errorStatus.permission, `${k}: ${JSON.stringify(r)}`)
            assert.strict.deepEqual(r.error, 'permission denied', `${k}: ${JSON.stringify(r)}`)
            assert.strict.deepEqual(r.nErrs, 0, `${k}: ${JSON.stringify(r)}`)
            assert.strict.deepEqual(r.nHandler, 0, `${k}: 權限未通過不得發 handler 事件 ${JSON.stringify(r)}`)
        }
    })

    it('verifyConn 拋錯: 六路由皆 permission denied、恰一則帶 apiType 之 error 事件, 且不發 handler 事件', async function() {
        for (let k of keys) {
            let df = allRoutes[k]
            let r = await hit(df.requestOf(portA, 'ok'), { headers: { 'x-scn': 'throw' } })
            assert.strict.deepEqual(r.status, df.errorStatus.permission, `${k}: ${JSON.stringify(r)}`)
            assert.strict.deepEqual(r.error, 'permission denied', `${k}: ${JSON.stringify(r)}`)
            assert.strict.deepEqual(r.nErrs, 1, `${k}: ${JSON.stringify(r)}`)
            assert.strict.deepEqual(r.errs[0].includes(`verifyConn error for apiType[${df.apiType}]`), true, `${k}: ${r.errs[0]}`)
            assert.strict.deepEqual(r.nHandler, 0, `${k}: ${JSON.stringify(r)}`)
        }
    })

    it('本體無法解析: 適用之路由皆回 invalid request packet(狀態碼取自軸之 packet)、恰一則事件, 不觸發應用端', async function() {
        for (let k of keys) {
            let df = allRoutes[k]
            let req = df.malformedOf(portA)
            if (req === null) {
                continue
            }
            let r = await hit(req)
            assert.strict.deepEqual(r.status, df.errorStatus.packet, `${k}: ${JSON.stringify(r)}`)
            assert.strict.deepEqual(r.error, 'invalid request packet', `${k}: ${JSON.stringify(r)}`)
            assert.strict.deepEqual(r.nErrs, 1, `${k}: ${JSON.stringify(r)}`)
        }
    })

    it('無人接聽: 直接觸發應用端事件之路由皆恰一則 no listener 事件、狀態碼取自軸之 app; execute 回 no listener for event[execute], download 三路由回固定字串', async function() {
        for (let k of keys) {
            let df = allRoutes[k]
            if (df.appEvent === null) {
                continue
            }
            let r = await hit(df.requestOf(portB, 'ok'), { server: 'b' })
            assert.strict.deepEqual(r.status, df.errorStatus.app, `${k}: ${JSON.stringify(r)}`)
            assert.strict.deepEqual(r.error, df.appEvent === 'execute' ? 'no listener for event[execute]' : 'can not get file from fileId', `${k}: ${JSON.stringify(r)}`)
            assert.strict.deepEqual(r.nErrs, 1, `${k}: ${JSON.stringify(r)}`)
            assert.strict.deepEqual(r.errs[0], `no listener for event[${df.appEvent}]`, `${k}: ${r.errs[0]}`)
        }
    })

    it('監聽器同步拋錯: 恰一則事件; execute 回 listener of event[execute] error, download 三路由回 can not get file from fileId', async function() {
        for (let k of keys) {
            let df = allRoutes[k]
            if (df.appEvent === null) {
                continue
            }
            let r = await hit(df.requestOf(portA, 'throw'))
            assert.strict.deepEqual(r.status, df.errorStatus.app, `${k}: ${JSON.stringify(r)}`)
            assert.strict.deepEqual(r.error, df.appEvent === 'execute' ? 'listener of event[execute] error' : 'can not get file from fileId', `${k}: ${JSON.stringify(r)}`)
            assert.strict.deepEqual(r.nErrs, 1, `${k}: ${JSON.stringify(r)}`)
            assert.strict.deepEqual(r.errs[0].includes(`listener of event[${df.appEvent}] error`), true, `${k}: ${r.errs[0]}`)
        }
    })

    it('應用端拒絕: 0 則事件(既有對稱行為); execute 原樣傳回拒絕值, download 三路由回固定字串', async function() {
        for (let k of keys) {
            let df = allRoutes[k]
            if (df.appEvent === null) {
                continue
            }
            let r = await hit(df.requestOf(portA, 'reject'))
            assert.strict.deepEqual(r.status, df.errorStatus.app, `${k}: ${JSON.stringify(r)}`)
            assert.strict.deepEqual(r.error, df.appEvent === 'execute' ? 'app says no' : 'can not get file from fileId', `${k}: ${JSON.stringify(r)}`)
            assert.strict.deepEqual(r.nErrs, 0, `${k}: ${JSON.stringify(r)}`)
        }
    })

})
