import assert from 'assert'
import http from 'http'
import path from 'path'
import w from 'wsemi'
import WConverhpServer from '../src/WConverhpServer.mjs'
import WConverhpClient from '../src/WConverhpClient.mjs'


/**
 * api: client 之 error 事件 —— 每一次請求嘗試失敗恰發一則, 不分傳輸層失敗與伺服器回之業務錯誤(帳本 R5 client 側, 第十一輪 N3)
 *
 * 缺陷(tmp/probe_r11_a.mjs P3): 連不上、413 等傳輸層失敗 0 則; 業務錯誤每次嘗試 1 則 —— 同一個「這次嘗試失敗了」兩種處置, 應用端完全觀察不到斷線。
 * 對照組(B 卷 §③-3.3(2)): 業務錯誤於 retry > 0 之則數不得因收斂為單一擁有者而變; 以 retry=0 驗不出這一句
 */
describe('api-clientAttemptEvents', function() {
    this.timeout(90000)

    let port = 8626
    let port500 = 8627
    let portHang = 8628
    let fd = path.resolve('./test/_tmp/api-clientAttemptEvents')
    let wsv = null
    let srv500 = null
    let srvHang = null

    before(async function() {
        wsv = new WConverhpServer({ port, useInert: false, pathUploadTemp: path.join(fd, 'up'), sizeMsg: 300 })
        wsv.on('error', () => {})
        wsv.on('execute', (func, input, pm) => (func === 'reject' ? pm.reject('app says no') : pm.resolve({ ok: 1 })))
        srv500 = http.createServer((req, res) => {
            req.resume()
            req.on('end', () => {
                res.writeHead(500, { 'Content-Type': 'text/plain' })
                res.end('boom')
            })
        })
        srvHang = http.createServer((req, res) => {
            req.resume() //不回應, 使 client 逾時
        })
        await new Promise((resolve) => srv500.listen(port500, '127.0.0.1', resolve))
        await new Promise((resolve) => srvHang.listen(portHang, '127.0.0.1', resolve))
        await w.delay(700)
    })

    after(async function() {
        await wsv.stop()
        srv500.closeAllConnections()
        srvHang.closeAllConnections()
        await new Promise((resolve) => srv500.close(resolve))
        await new Promise((resolve) => srvHang.close(resolve))
    })

    let run = async(optClient, fn) => {
        let evs = []
        let wc = new WConverhpClient({ url: `http://127.0.0.1:${port}`, ...optClient })
        wc.on('error', (e) => evs.push(e))
        let r = await fn(wc).then((v) => ({ ok: v }), (e) => ({ err: e }))
        return { r, evs }
    }

    it('execute 連不上(ECONNREFUSED)且 retryMain=2: 恰 3 則(每次嘗試 1 則)且皆為字串(修正前 0 則)', async function() {
        let { r, evs } = await run({ url: 'http://127.0.0.1:1', retryMain: 2 }, (wc) => wc.execute('f', {}))
        assert.strict.deepEqual(evs.length, 3, JSON.stringify(evs))
        assert.strict.deepEqual(evs.every((e) => typeof e === 'string' && e.includes('ECONNREFUSED')), true, JSON.stringify(evs))
        assert.strict.deepEqual(typeof r.err === 'string' && r.err.includes('ECONNREFUSED'), true, JSON.stringify(r))
    })

    it('execute 本體超過 sizeMsg(HTTP 413)且 retryMain=3: 恰 1 則(413 為可證明不需重試, 中止)', async function() {
        let { r, evs } = await run({ retryMain: 3 }, (wc) => wc.execute('f', { pad: 'x'.repeat(2000) }))
        assert.strict.deepEqual(evs, ['Payload Too Large'])
        assert.strict.deepEqual(r, { err: 'Payload Too Large' })
    })

    it('download(nodejs) 對回 HTTP 500 之伺服器且 retryDownload=2: 恰 3 則字串', async function() {
        let { evs } = await run({ url: `http://127.0.0.1:${port500}`, retryDownload: 2 }, (wc) => wc.download('x', () => {}, { fdDownload: path.join(fd, 'dl') }))
        assert.strict.deepEqual(evs.length, 3, JSON.stringify(evs))
        assert.strict.deepEqual(evs.every((e) => typeof e === 'string' && e.length > 0), true, JSON.stringify(evs))
    })

    it('download(nodejs) 逾時(timeout=300, 伺服器不回應)且 retryDownload=1: 恰 2 則字串', async function() {
        let { evs } = await run({ url: `http://127.0.0.1:${portHang}`, retryDownload: 1, timeout: 300 }, (wc) => wc.download('x', () => {}, { fdDownload: path.join(fd, 'dl') }))
        assert.strict.deepEqual(evs.length, 2, JSON.stringify(evs))
        assert.strict.deepEqual(evs.every((e) => typeof e === 'string' && /timeout/i.test(e)), true, JSON.stringify(evs))
    })

    it('對照組: 業務錯誤(應用端拒絕)且 retryMain=2 仍恰 3 則且值原樣(現況即 3, 不得因收斂為單一擁有者而變); 成功 0 則', async function() {
        let a = await run({ retryMain: 2 }, (wc) => wc.execute('reject', {}))
        assert.strict.deepEqual(a.evs, ['app says no', 'app says no', 'app says no'])
        assert.strict.deepEqual(a.r, { err: 'app says no' })
        let b = await run({ retryMain: 2 }, (wc) => wc.execute('ok', {}))
        assert.strict.deepEqual(b.evs, [])
        assert.strict.deepEqual(b.r, { ok: { ok: 1 } })
    })

})
