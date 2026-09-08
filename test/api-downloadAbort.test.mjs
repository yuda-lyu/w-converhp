import assert from 'assert'
import fs from 'fs'
import path from 'path'
import stream from 'stream'
import { syncBuiltinESMExports } from 'module'
import w from 'wsemi'
import WConverhpServer from '../src/WConverhpServer.mjs'
import WConverhpClient from '../src/WConverhpClient.mjs'


/**
 * api: nodejs 端 download() 於伺服器串流中途失敗時之收尾
 *
 * 修正前 client 以 streamRecv.pipe(streamWriter) 落地, 源串流出錯時目的串流既不 end 也不 destroy: download() 永不 settle(axios 之 timeout 只涵蓋到回應標頭, 不涵蓋串流本體)、
 * 寫入 fd 開啟、殘留部分檔; 失敗從未被偵測, 連 send 之重試都進不去。
 * client 以動態 import('fs') 取得 ESM namespace, 於此置換 CJS 物件後須 syncBuiltinESMExports 才會反映到 namespace(mocha --parallel 下每檔獨立進程, 不影響他檔)
 */
describe('api-downloadAbort', function() {

    let port = 8212 //同時test故得要不同port
    let fdDownload = './test/_tmp/download-api-downloadAbort'
    let pathUploadTemp = './test/_tmp/uploadTemp-api-downloadAbort'
    let fpSrc = path.resolve('test/1mb.7z')
    let wsv = null

    //nDownload, 伺服器 download 事件依 fileId 之觸發次數
    let nDownload = {}

    //tracked, client 建立之 WriteStream
    let tracked = []
    let _cws = fs.createWriteStream

    before(async function() {

        fs.createWriteStream = function(...args) {
            let ws = _cws.apply(this, args)
            tracked.push({ path: String(args[0]), ws })
            return ws
        }
        syncBuiltinESMExports()

        wsv = new WConverhpServer({
            port,
            apiName: 'api',
            pathStaticFiles: '.',
            pathUploadTemp,
            verifyConn: async({ authorization }) => {
                let token = w.strdelleft(authorization, 7) //刪除Bearer
                return w.isestr(token)
            },
        })
        wsv.on('download', (input, pm) => {
            nDownload[input.fileId] = (nDownload[input.fileId] || 0) + 1

            if (input.fileId === 'srvfail') {
                //推 3 段後以錯誤終止(模擬來源磁碟/串流故障), 宣告大小 10MB 使 client 認定尚未收完
                let s = new stream.PassThrough()
                let n = 0
                let t = setInterval(() => {
                    n += 1
                    s.write(Buffer.alloc(64 * 1024, 1))
                    if (n >= 3) {
                        clearInterval(t)
                        setTimeout(() => s.destroy(new Error('source failed')), 100)
                    }
                }, 30)
                pm.resolve({ streamRead: s, filename: 'srvfail.bin', fileSize: 10 * 1024 * 1024, fileType: 'application/octet-stream' })
                return
            }

            pm.resolve({
                streamRead: fs.createReadStream(fpSrc),
                filename: 'ok.7z',
                fileSize: fs.statSync(fpSrc).size,
                fileType: 'application/x-7z-compressed',
            })
        })
        wsv.on('error', () => {})
        wsv.on('handler', () => {})

        await w.delay(1000) //待伺服器啟動

    })

    after(function() {
        fs.createWriteStream = _cws
        syncBuiltinESMExports()
        wsv.stop()
        for (let fd of [fdDownload, pathUploadTemp]) {
            try {
                fs.rmSync(fd, { recursive: true, force: true })
            }
            catch (err) {}
        }
    })

    //mkClient
    let mkClient = (o = {}) => {
        let wo = new WConverhpClient({
            url: `http://127.0.0.1:${port}`,
            apiName: 'api',
            getToken: () => 'token-for-test',
            retryDownload: 0,
            ...o,
        })
        wo.on('error', () => {})
        return wo
    }

    //settleOf, 於限時內取得 settle 結果, 逾時回 'pending'(修正前 download() 永不 settle, 不得讓測試整個卡到 mocha 逾時)
    let settleOf = async(pm, ms) => {
        let r = await Promise.race([
            pm.then((msg) => ({ state: 'resolve', msg })).catch((msg) => ({ state: 'reject', msg })),
            w.delay(ms).then(() => ({ state: 'pending' })),
        ])
        return r
    }

    //stateOf
    let stateOf = (ws) => `fd=${ws.fd} closed=${ws.closed} destroyed=${ws.destroyed}`

    it('伺服器串流中途失敗時, download() 須以錯誤拒絕而非永不 settle, 寫入串流須關閉(fd 不洩漏), 不完整檔須刪除', async function() {
        this.timeout(30000)
        tracked = []
        let wo = mkClient()

        let r = await settleOf(wo.download('srvfail', () => {}, { fdDownload }), 15000)
        assert.strict.deepEqual(r.state, 'reject', JSON.stringify(r))
        assert.strict.deepEqual(w.isestr(r.msg), true, JSON.stringify(r)) //本地傳輸失敗經 send 之 catch 轉為非空錯誤訊息
        await w.delay(500) //待 fd 關閉與刪檔

        assert.strict.deepEqual(tracked.length, 1)
        let t = tracked[0]
        assert.strict.deepEqual(path.basename(t.path), 'srvfail.bin')
        assert.strict.deepEqual(t.ws.closed, true, stateOf(t.ws))
        assert.strict.deepEqual(t.ws.fd, null, stateOf(t.ws))
        assert.strict.deepEqual(fs.existsSync(t.path), false, t.path) //修正前殘留 196608 bytes 部分檔
    })

    it('失敗須進入重試: retryDownload=2 時伺服器 download 事件對同一 fileId 須觸發 3 次(修正前永不 settle, 一次都不重試)', async function() {
        this.timeout(60000)
        nDownload.srvfail = 0
        let wo = mkClient({ retryDownload: 2 })

        let r = await settleOf(wo.download('srvfail', () => {}, { fdDownload }), 40000) //退避 1s + 1.9s, 加三次傳輸
        assert.strict.deepEqual(r.state, 'reject', JSON.stringify(r))
        assert.strict.deepEqual(nDownload.srvfail, 3)
    })

    it('對照組: 正常下載須 resolve 落地路徑, 檔案大小與來源一致, 寫入串流關閉', async function() {
        this.timeout(30000)
        tracked = []
        let wo = mkClient()

        let r = await settleOf(wo.download('ok', () => {}, { fdDownload }), 15000)
        assert.strict.deepEqual(r.state, 'resolve', JSON.stringify(r))
        assert.strict.deepEqual(path.basename(r.msg), 'ok.7z')
        assert.strict.deepEqual(fs.statSync(r.msg).size, fs.statSync(fpSrc).size)
        await w.delay(200)

        assert.strict.deepEqual(tracked.length, 1)
        assert.strict.deepEqual(tracked[0].ws.closed, true, stateOf(tracked[0].ws))
    })

})
