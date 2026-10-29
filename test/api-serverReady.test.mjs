import assert from 'assert'
import fs from 'fs'
import net from 'net'
import Hapi from '@hapi/hapi'
import w from 'wsemi'
import WConverhpServer from '../src/WConverhpServer.mjs'
import wPorts from './tools/ports.mjs'

let { portOf } = wPorts


/**
 * api: WConverhpServer 回傳物件之 ready(就緒 promise), 供使用端與測試以事件同步伺服器就緒而不以固定毫秒等待
 *
 * 規格(JSDoc @returns):
 *   - 自建伺服器: 已開始監聽且建構期事件(以 error 事件通知之失敗)皆已派發之後 resolve 為 true; 啟動失敗(失敗已以 error 事件通知)resolve 為 false
 *   - 給予 serverHapi: 路由註冊完成且建構期事件皆已派發之後 resolve(路由註冊失敗者為 false), 不等待外部伺服器啟動
 *   - 恆 resolve、不 reject, 不影響 stop
 * 建構期事件以 evEmitDelay(1ms 計時器)脫勾派發, ready 於其後再接同長度計時器 resolve(同長度計時器依建立順序觸發), 故 ready 之後斷言建構期事件數量無競態
 */
describe('api-serverReady', function() {
    this.timeout(30000)

    let fd = './test/_tmp/api-serverReady'

    before(function() {
        fs.rmSync(fd, { recursive: true, force: true })
    })

    after(function() {
        fs.rmSync(fd, { recursive: true, force: true })
    })

    //canConnect, 單次 TCP 連線(不重試): ready 已 resolve 時埠必已可連
    let canConnect = (port) => {
        return new Promise((resolve) => {
            let s = net.connect(port, '127.0.0.1')
            s.once('connect', () => {
                s.destroy()
                resolve(true)
            })
            s.once('error', () => resolve(false))
        })
    }

    it('自建伺服器: ready 為 promise, resolve 為 true 時埠已可連(單次連線不重試)且無建構期事件; stop 後埠關閉', async function() {
        let port = portOf('api-serverReady', 0)
        let evs = []
        let wsv = new WConverhpServer({ port, useInert: false, pathUploadTemp: `${fd}/t1` })
        wsv.on('error', (e) => evs.push(String(e)))
        assert.strict.deepEqual(w.ispm(wsv.ready), true, 'ready 須為 promise')
        let ok = await wsv.ready
        assert.strict.deepEqual(ok, true)
        assert.strict.deepEqual(await canConnect(port), true, 'ready 為 true 時埠須已可連')
        assert.strict.deepEqual(evs, [])
        await wsv.stop()
        assert.strict.deepEqual(await canConnect(port), false, 'stop 後埠須已關閉')
    })

    it('建構期事件: ready resolve 時已全數派發(外部 serverHapi 不佔埠: 兩個無效選項須恰兩則, 不得有競態)', async function() {
        let hs = Hapi.server()
        let evs = []
        let wsv = new WConverhpServer({ serverHapi: hs, pathUploadTemp: `${fd}/t2`, verifyConn: false, corsOrigins: ['http://a.example'] })
        wsv.on('error', (e) => evs.push(String(e)))
        let ok = await wsv.ready
        assert.strict.deepEqual(ok, true, '路由註冊成功者為 true')
        assert.strict.deepEqual(evs.length, 2, `建構期事件須於 ready 前派發完畢, 實得 ${JSON.stringify(evs)}`)
        assert.strict.deepEqual(evs.some((v) => v.includes('invalid verifyConn')), true, JSON.stringify(evs))
        assert.strict.deepEqual(evs.some((v) => v.includes('corsOrigins has no effect with serverHapi')), true, JSON.stringify(evs))
    })

    it('外部 serverHapi 路由註冊失敗(與既有路由衝突): ready resolve 為 false, 恰一則 register routes error 事件', async function() {
        let hs = Hapi.server()
        hs.route({ method: 'POST', path: '/api/main', handler: () => 'x' }) //與本套件之 /api/main 衝突
        let evs = []
        let wsv = new WConverhpServer({ serverHapi: hs, pathUploadTemp: `${fd}/t3` })
        wsv.on('error', (e) => evs.push(String(e)))
        let ok = await wsv.ready
        assert.strict.deepEqual(ok, false)
        assert.strict.deepEqual(evs.length, 1, JSON.stringify(evs))
        assert.strict.deepEqual(evs[0].includes('register routes error'), true, evs[0])
    })

    it('啟動失敗(埠被占用): ready 不 reject 而 resolve 為 false, 且 start server error 事件與建構期事件皆已於 ready 前派發(恰兩則)', async function() {
        let port = portOf('api-serverReady', 1)
        let a = new WConverhpServer({ port, useInert: false, pathUploadTemp: `${fd}/t4a` })
        a.on('error', () => {})
        assert.strict.deepEqual(await a.ready, true)
        let evs = []
        let b = new WConverhpServer({ port, useInert: false, pathUploadTemp: `${fd}/t4b`, verifyConn: false })
        b.on('error', (e) => evs.push(String(e)))
        let ok = await b.ready
        assert.strict.deepEqual(ok, false)
        assert.strict.deepEqual(evs.length, 2, JSON.stringify(evs))
        assert.strict.deepEqual(evs.some((v) => v.includes('invalid verifyConn')), true, JSON.stringify(evs))
        assert.strict.deepEqual(evs.some((v) => v.includes('start server error')), true, JSON.stringify(evs))
        await a.stop()
        await b.stop()
    })

    it('stop 搶先於啟動完成: stop 照常等啟動後停止, ready 仍 resolve 為 true, 其後埠已關閉', async function() {
        let port = portOf('api-serverReady', 2)
        let wsv = new WConverhpServer({ port, useInert: false, pathUploadTemp: `${fd}/t5` })
        wsv.on('error', () => {})
        let pmStop = wsv.stop()
        let ok = await wsv.ready
        await pmStop
        assert.strict.deepEqual(ok, true)
        assert.strict.deepEqual(await canConnect(port), false)
    })

})
