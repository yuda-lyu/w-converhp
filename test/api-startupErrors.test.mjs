import assert from 'assert'
import fs from 'fs'
import path from 'path'
import w from 'wsemi'
import WConverhpServer from '../src/WConverhpServer.mjs'
import wPorts from './tools/ports.mjs'

let { portOf } = wPorts


/**
 * api: 建構期之啟動失敗須於建構期以 error 事件通知(不拋出)
 *
 * 缺陷(第十輪 D7, tmp/probe_r10_misc.mjs 之 G2): 埠被占以 evEmitDelay 通知, 而暫存資料夾無法建立時
 * wsemi 之 fsCreateFolder 回 { error } 物件不拋, 被丟棄 —— 建構期 0 則, 之後每一個切片各報一次 ENOENT。
 * 對標: Node net.Server 之 listen 失敗與 hapi 之 start 皆於「啟動」這一個時點回報全部啟動失敗。
 */
describe('api-startupErrors', function() {
    this.timeout(30000)

    let fd = path.resolve('./test/_tmp/api-startupErrors')

    it('pathUploadTemp 無法建立(該路徑為既有檔案)時, 建構不得拋出, 且須於建構期恰發一則 error 事件', async function() {
        fs.mkdirSync(fd, { recursive: true })
        let fpFile = path.join(fd, 'is-a-file')
        fs.writeFileSync(fpFile, 'x')
        let evs = []
        let wsv = new WConverhpServer({ port: portOf('api-startupErrors'), useInert: false, pathUploadTemp: fpFile })
        wsv.on('error', (e) => evs.push(String(e)))
        await wsv.ready //待伺服器就緒(ready): 其 resolve 時建構期事件已派發完畢, 可直接斷言恰一則, 不以固定毫秒等待
        await wsv.stop()
        assert.strict.deepEqual(evs.length, 1, JSON.stringify(evs))
        assert.strict.deepEqual(evs[0].includes('pathUploadTemp'), true, evs[0])
    })

    it('執行期暫存資料夾消失時, check-slices-hash 與 check-total-hash 須同樣以 <mode> failed 回應且各恰一則事件(修正前 check-slices-hash 吞掉 readdir 錯誤而回 slks 空陣列)', async function() {
        let up = path.join(fd, 'gone')
        let evs = []
        let wsv = new WConverhpServer({ port: portOf('api-startupErrors', 1), useInert: false, pathUploadTemp: up })
        wsv.on('error', (e) => evs.push(String(e)))
        wsv.on('upload', (input, pm) => pm.resolve(input)) //第十二輪: 上傳管線受理新工作前須有 upload 接聽者; 本案驗的是其後之 internal 錯誤
        await wsv.ready //待伺服器就緒(ready), 其後才可移除暫存夾以模擬執行期消失
        fs.rmSync(up, { recursive: true, force: true })
        let call = async(body) => {
            evs.length = 0
            let r = await fetch(`http://127.0.0.1:${portOf('api-startupErrors', 1)}/api/ulctr`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer t', 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })
            let o = w.u8arr2obj(new Uint8Array(await r.arrayBuffer()))
            await w.delay(150)
            return { status: r.status, error: o.error, nEvs: evs.length, evs: [...evs] }
        }
        let rs = await call({ mode: 'check-slices-hash', fileHash: 'abcdef0123456789', fileSliceHashs: [{ i: 0, h: 'x' }] })
        let rt = await call({ mode: 'check-total-hash', fileHash: 'abcdef0123456789', filename: 'a', fileSize: 1 })
        await wsv.stop()
        assert.strict.deepEqual(rs.error, 'check-slices-hash failed', JSON.stringify(rs))
        assert.strict.deepEqual(rs.nEvs, 1, JSON.stringify(rs))
        assert.strict.deepEqual(rs.evs[0].includes(path.resolve(up)), true, '細節(含路徑)須在事件內')
        assert.strict.deepEqual(rt.error, 'check-total-hash failed', JSON.stringify(rt))
        assert.strict.deepEqual(rt.nEvs, 1, JSON.stringify(rt))
    })

    it('對照組: 埠被占時仍須於建構期恰發一則 error 事件', async function() {
        let a = new WConverhpServer({ port: portOf('api-startupErrors', 2), useInert: false, pathUploadTemp: path.join(fd, 'a') })
        a.on('error', () => {})
        let bReadyA = await a.ready //待 a 綁埠完成(ready 為 true), b 才會撞到被占用之埠
        let evs = []
        let b = new WConverhpServer({ port: portOf('api-startupErrors', 2), useInert: false, pathUploadTemp: path.join(fd, 'b') })
        b.on('error', (e) => evs.push(String(e)))
        let bReadyB = await b.ready //待 b 啟動失敗(ready 為 false)且其建構期 error 事件已派發, 不以固定毫秒等待
        await a.stop()
        await b.stop()
        assert.strict.deepEqual(evs.length >= 1, true, JSON.stringify(evs))
        assert.strict.deepEqual(evs[0].includes('start server error'), true, evs[0])
        assert.strict.deepEqual(bReadyA, true, 'a 為埠之第一個占用者, 須啟動成功')
        assert.strict.deepEqual(bReadyB, false, 'b 埠被占用, ready 須為 false')
    })

    after(function() {
        //清除本檔之暫存夾(測試中介資料測完即刪, 不留殘留)
        fs.rmSync(fd, { recursive: true, force: true })
    })

})
