import assert from 'assert'
import obj2u8arr from 'wsemi/src/obj2u8arr.mjs'
import u8arr2obj from 'wsemi/src/u8arr2obj.mjs'
import w from 'wsemi'
import WConverhpServer from '../src/WConverhpServer.mjs'
import { downloadRouteKeys, downloadErrorStatus, fetchDownload } from './api-axes.mjs'


/**
 * api: 應用端未註冊監聽器時, 請求須立即以錯誤封包終結而非永久懸置(規則帳本 R12)
 *
 * 修正前之徵狀(實測 tmp/probe_r9_hang.mjs 與 probe_r9_hang2.mjs):
 *   未註冊 execute → /main            6000ms 未回應, 0 則 error 事件
 *   未註冊 download → /dw、/dwgf、/dwgfn  同上
 *   未註冊 upload  → /ulctr merge-slices-get  同上, 且 managerMergeSlices 之 consuming Map 永久保留一個永不 settle 之 promise
 *
 * 成因: 路由層刻意關閉 timeout.server 與 timeout.socket(大檔傳輸本就超過任何固定值), 宿主之兜底因此不存在;
 * 而 eventemitter3 之 emit 對無監聽器回 false —— 該事實早在套件手上, 只是被丟棄。
 *
 * 本檔之軸: 三個 RPC 事件 × 其入口, 下載路由之成員取自 test/api-axes.mjs(遵 R8, 不得手寫成員陣列)。
 *
 * 刻意不測者:「監聽器註冊了但不 settle pm」「verifyConn 回 pending promise」「resolve 一個 pending promise」
 * 「應用端串流永不 end」—— 四者已裁定為呼叫端責任(見 CLAUDE_rulebook.md 之 R12 分界線)。
 * 替它們寫測試等於把它們收編為套件契約, 故不寫。
 */

let genPort = () => 9200 + Math.floor(Math.random() * 300)

//mkServer, 只註冊 error 監聽器, 三個 RPC 事件一律不註冊
let mkServer = async(opt = {}) => {
    let port = genPort()
    let evs = []
    let wsv = new WConverhpServer({
        port,
        useInert: false,
        pathUploadTemp: `./test/_tmp/noListener_${port}`,
        ...opt,
    })
    wsv.on('error', (e) => {
        evs.push(String(e))
    })
    await w.delay(600)
    return { port, wsv, evs }
}

//callMain, 打 /main 並以 timeoutMs 使「懸置」成為可斷言之觀察值
let callMain = async(port, body, timeoutMs = 4000) => {
    let ac = new AbortController()
    let tm = setTimeout(() => ac.abort(), timeoutMs)
    try {
        let r = await fetch(`http://127.0.0.1:${port}/api/main`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream', 'Authorization': 'Bearer t' },
            body: Buffer.from(obj2u8arr(body)),
            signal: ac.signal,
        })
        let buf = Buffer.from(await r.arrayBuffer())
        let rd = u8arr2obj(new Uint8Array(buf), { returnWithStateAndMsg: true })
        return {
            status: r.status,
            returnType: r.headers.get('return-type'),
            body: rd.state === 'success' ? rd.msg : null,
        }
    }
    catch (err) {
        return { hang: true }
    }
    finally {
        clearTimeout(tm)
    }
}


describe('api-noListener', function() {
    this.timeout(60000)

    let srv = null
    before(async function() {
        srv = await mkServer()
    })
    after(async function() {
        if (srv) {
            await srv.wsv.stop()
        }
    })

    it('未註冊 execute 時, /main 須立即回錯誤封包而不得懸置(修正前 6000ms 未回應)', async function() {
        srv.evs.length = 0
        let r = await callMain(srv.port, { func: 'add', input: { a: 1 } })
        assert.strict.deepEqual(r.hang, undefined, '/main —— 不得懸置')
        assert.strict.deepEqual(r.status, 200, '/main —— 須為 HTTP 200')
        assert.strict.deepEqual(r.returnType, 'error', '/main —— Return-Type 須為 error')
        assert.strict.deepEqual(w.isestr(w.cstr(r.body.error)), true, '/main —— 本體須帶可解析之 error')
    })

    it('未註冊 execute 時, 須發恰好一則指出無人接聽之 error 事件', async function() {
        srv.evs.length = 0
        await callMain(srv.port, { func: 'add', input: { a: 1 } })
        await w.delay(200)
        assert.strict.deepEqual(srv.evs.length, 1, `execute —— 事件則數須為 1, 實得 ${srv.evs.length}: ${srv.evs.join(' | ')}`)
        assert.strict.deepEqual(srv.evs[0].includes('no listener for event[execute]'), true, `execute —— 事件訊息須指出無人接聽, 實得: ${srv.evs[0]}`)
    })

    it('未註冊 download 時, 三條下載路由皆須立即回錯誤封包而不得懸置(成員取自路由軸)', async function() {
        for (let route of downloadRouteKeys()) {
            srv.evs.length = 0
            let r = await fetchDownload(srv.port, route, 'any-id', { timeoutMs: 4000, settleMs: 150 })
            assert.strict.deepEqual(r.hang, undefined, `[${route}] —— 不得懸置`)
            assert.strict.deepEqual(r.status, downloadErrorStatus(route, 'app'), `[${route}] —— 狀態碼須依路由軸(無人接聽與應用端拒絕同一類)`)
            assert.strict.deepEqual(r.returnType, 'error', `[${route}] —— Return-Type 須為 error`)
        }
    })

    it('未註冊 download 時, 三條路由各須發恰好一則 error 事件(不得為 0 則亦不得為兩則)', async function() {
        for (let route of downloadRouteKeys()) {
            srv.evs.length = 0
            await fetchDownload(srv.port, route, 'any-id', { timeoutMs: 4000, settleMs: 200 })
            assert.strict.deepEqual(srv.evs.length, 1, `[${route}] —— 事件則數須為 1, 實得 ${srv.evs.length}: ${srv.evs.join(' | ')}`)
            assert.strict.deepEqual(srv.evs[0].includes('no listener for event[download]'), true, `[${route}] —— 事件訊息須指出無人接聽, 實得: ${srv.evs[0]}`)
        }
    })

    it('對照組: 註冊監聽器後同一請求須正常成功, 且不得再發 no listener 事件', async function() {
        let s2 = await mkServer()
        s2.wsv.on('execute', (func, input, pm) => {
            pm.resolve({ ok: 1 })
        })
        try {
            s2.evs.length = 0
            let r = await callMain(s2.port, { func: 'add', input: { a: 1 } })
            assert.strict.deepEqual(r.hang, undefined, '對照組 —— 不得懸置')
            assert.strict.deepEqual(r.returnType, 'success', '對照組 —— Return-Type 須為 success')
            assert.strict.deepEqual(r.body.success.output.ok, 1, '對照組 —— 須取得應用端之結果')
            assert.strict.deepEqual(s2.evs.length, 0, `對照組 —— 不得有 error 事件, 實得: ${s2.evs.join(' | ')}`)
        }
        finally {
            await s2.wsv.stop()
        }
    })

    it('對照組: 監聽器同步拋錯時仍只發一則事件(no listener 之判定不得誤傷此格)', async function() {
        //why: 若以 evEmit 之回傳值判定有無監聽器, 監聽器拋錯亦回 false, 該格會被再補一則假的 no listener 事件而成兩則(違反 R5)
        let s3 = await mkServer()
        s3.wsv.on('execute', () => {
            throw new Error('listener boom')
        })
        try {
            s3.evs.length = 0
            let r = await callMain(s3.port, { func: 'add', input: { a: 1 } })
            await w.delay(200)
            assert.strict.deepEqual(r.hang, undefined, '拋錯格 —— 不得懸置')
            assert.strict.deepEqual(s3.evs.length, 1, `拋錯格 —— 事件則數須為 1, 實得 ${s3.evs.length}: ${s3.evs.join(' | ')}`)
            assert.strict.deepEqual(s3.evs[0].includes('no listener'), false, `拋錯格 —— 不得誤報為無人接聽, 實得: ${s3.evs[0]}`)
        }
        finally {
            await s3.wsv.stop()
        }
    })

})
