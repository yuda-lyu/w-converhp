import assert from 'assert'
import fs from 'fs'
import path from 'path'
import w from 'wsemi'
import WConverhpServer from '../src/WConverhpServer.mjs'


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
        let wsv = new WConverhpServer({ port: 8498, useInert: false, pathUploadTemp: fpFile })
        wsv.on('error', (e) => evs.push(String(e)))
        await w.delay(900)
        await wsv.stop()
        assert.strict.deepEqual(evs.length, 1, JSON.stringify(evs))
        assert.strict.deepEqual(evs[0].includes('pathUploadTemp'), true, evs[0])
    })

    it('執行期暫存資料夾消失時, check-slices-hash 與 check-total-hash 須同樣以 <mode> failed 回應且各恰一則事件(修正前 check-slices-hash 吞掉 readdir 錯誤而回 slks 空陣列)', async function() {
        let up = path.join(fd, 'gone')
        let evs = []
        let wsv = new WConverhpServer({ port: 8497, useInert: false, pathUploadTemp: up })
        wsv.on('error', (e) => evs.push(String(e)))
        await w.delay(700)
        fs.rmSync(up, { recursive: true, force: true })
        let call = async(body) => {
            evs.length = 0
            let r = await fetch(`http://127.0.0.1:8497/api/ulctr`, {
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
        let a = new WConverhpServer({ port: 8499, useInert: false, pathUploadTemp: path.join(fd, 'a') })
        a.on('error', () => {})
        await w.delay(600)
        let evs = []
        let b = new WConverhpServer({ port: 8499, useInert: false, pathUploadTemp: path.join(fd, 'b') })
        b.on('error', (e) => evs.push(String(e)))
        await w.delay(900)
        await a.stop()
        await b.stop()
        assert.strict.deepEqual(evs.length >= 1, true, JSON.stringify(evs))
        assert.strict.deepEqual(evs[0].includes('start server error'), true, evs[0])
    })

})
