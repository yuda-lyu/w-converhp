import assert from 'assert'
import fs from 'fs'
import path from 'path'
import stream from 'stream'
import w from 'wsemi'
import WConverhpServer from '../src/WConverhpServer.mjs'
import WConverhpClient from '../src/WConverhpClient.mjs'


/**
 * api: 下載回應之 HTTP 分框(空檔之狀態碼、可壓縮型別之 Content-Length)
 *
 * 兩者皆為「hapi 之預設政策與本套件之交付需求不符」, 修正前:
 *   (1) fileSize 為 0 時 hapi 依 routes.response.emptyStatusCode 預設值把 200 改為 204 並刪除 Content-Length.
 *       204 之語意為「沒有回應內容」而非「有一個長度為 0 的內容」, 瀏覽器下載管理器路徑(a[download] 打 /dwgf)因而
 *       把下載標記為 canceled 且不落地檔案, 而 nodejs 與 blob 兩路徑卻正常 —— 同一 download API 三條交付路徑不對稱.
 *       nginx、Express 之 sendFile、S3 取空物件皆以 200 + Content-Length: 0 表達空檔.
 *   (2) 應用端宣告可壓縮 fileType(text/plain、application/json 等)時, hapi 於前端帶 Accept-Encoding 時會壓縮並刪除
 *       Content-Length; 而 axios 於 nodejs 預設即送 Accept-Encoding, 故 onDownloadProgress 之 ev.total 恆為 undefined,
 *       cbProgress 之 prog 恆為 0 直到結束 —— 下載二進位有進度、下載 CSV/JSON 卻沒有.
 * 修正後兩條下載路由各以 response.emptyStatusCode=200 與 Content-Encoding: identity 表達
 */
describe('api-downloadFraming', function() {

    let port = 8217 //同時test故得要不同port
    let pathUploadTemp = './test/_tmp/uploadTemp-api-downloadFraming'
    let fdDownload = './test/_tmp/download-api-downloadFraming'
    let wsv = null

    //txt, 高可壓縮之文字內容(壓縮後遠小於原始, 使「有無壓縮」可由位元組數分辨)
    let txt = 'abcdefghij'.repeat(20000)
    let sizeTxt = Buffer.byteLength(txt, 'utf8')

    //bin, 不可壓縮型別之對照組
    let bin = Buffer.alloc(sizeTxt, 7)

    let errs = []

    before(async function() {

        wsv = new WConverhpServer({
            port,
            apiName: 'api',
            useInert: false,
            pathUploadTemp,
            verifyConn: async({ authorization }) => {
                return w.isestr(w.strdelleft(authorization, 7))
            },
        })
        wsv.on('download', (input, pm) => {
            let id = input.fileId
            if (id === 'empty') {
                pm.resolve({ streamRead: Buffer.alloc(0), filename: 'empty.txt', fileSize: 0, fileType: 'text/plain' })
            }
            else if (id === 'empty-stream') {
                let s = new stream.PassThrough()
                s.end()
                pm.resolve({ streamRead: s, filename: 'empty2.bin', fileSize: 0, fileType: 'application/octet-stream' })
            }
            else if (id === 'text') {
                pm.resolve({ streamRead: txt, filename: 'a.txt', fileSize: sizeTxt, fileType: 'text/plain' })
            }
            else if (id === 'json') {
                pm.resolve({ streamRead: txt, filename: 'a.json', fileSize: sizeTxt, fileType: 'application/json' })
            }
            else if (id === 'bin') {
                pm.resolve({ streamRead: bin, filename: 'a.bin', fileSize: sizeTxt, fileType: 'application/octet-stream' })
            }
            else {
                pm.reject('invalid fileId')
            }
        })
        wsv.on('error', (e) => errs.push(String(e)))
        wsv.on('handler', () => {})

        await w.delay(1000) //待伺服器啟動

    })

    after(function() {
        wsv.stop()
        for (let fd of [fdDownload, pathUploadTemp]) {
            try {
                fs.rmSync(fd, { recursive: true, force: true })
            }
            catch (err) {}
        }
    })

    //call, 直接打路由並取回應標頭; 一律帶 Accept-Encoding 以重現 axios 與瀏覽器之預設行為
    let call = async(route, fileId) => {
        let r = null
        if (route === 'dw') {
            r = await fetch(`http://127.0.0.1:${port}/api/dw`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer t', 'Content-Type': 'application/json', 'Accept-Encoding': 'gzip, deflate, br' },
                body: JSON.stringify({ fileId }),
            })
        }
        else {
            r = await fetch(`http://127.0.0.1:${port}/api/dwgf?fileId=${encodeURIComponent(fileId)}&token=t`, {
                headers: { 'Accept-Encoding': 'gzip, deflate, br' },
            })
        }
        let buf = Buffer.from(await r.arrayBuffer())
        return {
            status: r.status,
            contentLength: r.headers.get('content-length'),
            contentEncoding: r.headers.get('content-encoding'),
            bytes: buf.length,
            text: buf.length <= 64 ? buf.toString('utf8') : null,
        }
    }

    it('fileSize 為 0 時兩路由皆須回 HTTP 200 與 Content-Length: 0, 不得回 204(修正前 hapi 依 emptyStatusCode 改為 204 並刪除長度)', async function() {
        this.timeout(20000)
        for (let route of ['dw', 'dwgf']) {
            for (let id of ['empty', 'empty-stream']) {
                let r = await call(route, id)
                let tag = `${route}/${id}: ${JSON.stringify(r)}`
                assert.strict.deepEqual(r.status, 200, tag)
                assert.strict.deepEqual(r.contentLength, '0', tag)
                assert.strict.deepEqual(r.bytes, 0, tag)
            }
        }
    })

    it('可壓縮 fileType 於前端帶 Accept-Encoding 時仍須保留 Content-Length(修正前被 hapi 壓縮並刪除該標頭)', async function() {
        this.timeout(20000)
        for (let route of ['dw', 'dwgf']) {
            for (let id of ['text', 'json']) {
                let r = await call(route, id)
                let tag = `${route}/${id}: ${JSON.stringify(r)}`
                assert.strict.deepEqual(r.status, 200, tag)
                assert.strict.deepEqual(r.contentLength, String(sizeTxt), tag)
                assert.strict.deepEqual(r.contentEncoding, 'identity', tag)
                assert.strict.deepEqual(r.bytes, sizeTxt, tag) //未被壓縮, 實送位元組等於原始長度
            }
        }
    })

    it('對照組: 不可壓縮型別本就保留 Content-Length, 行為不得改變', async function() {
        this.timeout(20000)
        for (let route of ['dw', 'dwgf']) {
            let r = await call(route, 'bin')
            assert.strict.deepEqual(r.status, 200, JSON.stringify(r))
            assert.strict.deepEqual(r.contentLength, String(sizeTxt), JSON.stringify(r))
            assert.strict.deepEqual(r.bytes, sizeTxt, JSON.stringify(r))
        }
    })

    it('nodejs client 下載可壓縮型別時, cbProgress 之 prog 須能到達 100(修正前恆為 0)', async function() {
        this.timeout(30000)
        let wo = new WConverhpClient({ url: `http://127.0.0.1:${port}`, apiName: 'api', getToken: () => 'token-for-test', retryDownload: 0, timeout: 20000 })
        wo.on('error', () => {})
        for (let id of ['text', 'json', 'bin']) {
            let progs = []
            let fd = path.resolve(fdDownload, id)
            let fp = await wo.download(id, (m) => {
                if (m.m === 'download') {
                    progs.push(m.prog)
                }
            }, { fdDownload: fd })
            assert.strict.deepEqual(fs.statSync(fp).size, sizeTxt, `${id} 落地大小`)
            assert.strict.deepEqual(Math.max(...progs), 100, `${id} 進度須到 100, 實得 ${JSON.stringify(progs)}`)
        }
    })

    it('nodejs client 下載 0-byte 檔須 resolve 且落地 0-byte 檔', async function() {
        this.timeout(20000)
        let wo = new WConverhpClient({ url: `http://127.0.0.1:${port}`, apiName: 'api', getToken: () => 'token-for-test', retryDownload: 0, timeout: 20000 })
        wo.on('error', () => {})
        let fd = path.resolve(fdDownload, 'empty')
        let fp = await wo.download('empty', () => {}, { fdDownload: fd })
        assert.strict.deepEqual(fs.statSync(fp).size, 0)
    })

    it('錯誤封包不受影響: 應用端 reject 時仍為 200 + 可解析之錯誤封包', async function() {
        this.timeout(20000)
        for (let route of ['dw', 'dwgf']) {
            let r = await call(route, 'nope')
            assert.strict.deepEqual(r.status, 200, JSON.stringify(r))
            assert.strict.deepEqual(r.bytes > 0, true, JSON.stringify(r))
        }
    })

})
