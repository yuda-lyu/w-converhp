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
