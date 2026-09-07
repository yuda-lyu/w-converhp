import assert from 'assert'
import fs from 'fs'
import path from 'path'
import http from 'http'
import w from 'wsemi'
import WConverhpServer from '../src/WConverhpServer.mjs'
import WConverhpClient from '../src/WConverhpClient.mjs'


/**
 * 前端可控字串參與路徑組裝之防護(S1–S5、Q)
 *   S1 /slc header package-id            S2 merge-slices-push fileHash
 *   S3 check-total-hash fileHash + 回應含伺服器絕對路徑
 *   S4 check-slices-hash v.i + 缺片時 ENOENT 訊息外洩路徑
 *   S5 merge-slices-get 失敗訊息外洩路徑    Q  node client 信任伺服器 header 檔名
 * 沙箱: test/_tmp/pt/{uploadTemp,dl}, 逸出目標為其上一層 test/_tmp/pt
 */
describe('api-pathTraversal', function() {

    let port = 8195 //同時test故得要不同port
    let base = `http://127.0.0.1:${port}/api`
    let fdSand = path.resolve('./test/_tmp/pt')
    let pathUploadTemp = path.resolve(fdSand, 'uploadTemp')
    let sizeSlice = 64 * 1024
    let wsv = null

    //errs, 伺服器 error 事件
    let errs = []

    //parse
    let parse = async(r) => {
        let bb = Buffer.from(await r.arrayBuffer())
        return w.u8arr2obj(new Uint8Array(bb))
    }

    //slc
    let slc = async(pkg, i, total, buf) => {
        let r = await fetch(`${base}/slc`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer t', 'Content-Type': 'application/octet-stream', 'chunk-index': String(i), 'chunk-total': String(total), 'package-id': pkg },
            body: buf,
        })
        return await parse(r)
    }

    //ulctr
    let ulctr = async(payload) => {
        let r = await fetch(`${base}/ulctr`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer t', 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        })
        return await parse(r)
    }

    //lsEscaped, 沙箱內 uploadTemp/dl 之外的項目 = 逸出證據
    let lsEscaped = () => {
        return fs.readdirSync(fdSand).filter((v) => v !== 'uploadTemp' && v !== 'dl')
    }

    //hasAbsPath, 字串是否含伺服器絕對路徑(Windows 磁碟機或本沙箱路徑片段)
    let hasAbsPath = (s) => {
        s = String(s)
        return /[A-Za-z]:[\\/]/.test(s) || s.indexOf('uploadTemp') >= 0 || s.indexOf(fdSand) >= 0
    }

    before(async function() {
        fs.rmSync(fdSand, { recursive: true, force: true })
        fs.mkdirSync(pathUploadTemp, { recursive: true })

        wsv = new WConverhpServer({
            port,
            apiName: 'api',
            pathStaticFiles: '.',
            pathUploadTemp,
            sizeSlice,
            verifyConn: async() => true, //已通過授權之使用者
        })
        wsv.on('upload', (input, pm) => pm.resolve({ ok: true }))
        wsv.on('error', (e) => errs.push(String(e)))

        await w.delay(1000)
    })

    after(function() {
        wsv.stop()
        fs.rmSync(fdSand, { recursive: true, force: true })
    })

    it('S1: /slc 之 package-id 含 ../ 須被拒絕, 且不得在 uploadTemp 之外建檔', async function() {
        let r = await slc('../escapedA', 0, 1, Buffer.from('ESCAPED'))
        assert.strict.deepEqual(r, { error: 'invalid packageId in headers' })
        assert.strict.deepEqual(fs.existsSync(path.resolve(fdSand, 'escapedA_0')), false)
        assert.strict.deepEqual(lsEscaped(), [])
    })

    it('S2: merge-slices-push 之 fileHash 含 ../ 須被拒絕, 且不得在 uploadTemp 之外產生合併檔或 .done', async function() {
        let r = await ulctr({ mode: 'merge-slices-push', fileHash: '../escapedC', chunkTotal: 1 })
        assert.strict.deepEqual(r, { error: 'invalid fileHash in payload' })
        await w.delay(300)
        assert.strict.deepEqual(fs.existsSync(path.resolve(fdSand, 'escapedC')), false)
        assert.strict.deepEqual(fs.existsSync(path.resolve(fdSand, 'escapedC.done')), false)
        assert.strict.deepEqual(lsEscaped(), [])
    })

    it('S3: check-total-hash 之 fileHash 含 ../ 須被拒絕, 不得探測 uploadTemp 之外的檔案', async function() {
        fs.writeFileSync(path.resolve(fdSand, 'secretB'), 'SECRET', 'utf8')
        let r = await ulctr({ mode: 'check-total-hash', fileHash: '../secretB', filename: 'x', fileSize: 6 })
        assert.strict.deepEqual(r, { error: 'invalid fileHash in payload' })
        fs.rmSync(path.resolve(fdSand, 'secretB'))
    })

    it('S3: check-total-hash 正常回應不得含伺服器絕對路徑', async function() {
        let r = await ulctr({ mode: 'check-total-hash', fileHash: 'a1b2c3d4e5f60718', filename: 'x', fileSize: 10 })
        assert.strict.deepEqual(w.iseobj(r.success), true, JSON.stringify(r))
        assert.strict.deepEqual(Object.keys(r.success).indexOf('path') < 0, true, JSON.stringify(r))
        assert.strict.deepEqual(hasAbsPath(JSON.stringify(r)), false, JSON.stringify(r))
    })

    it('S4: check-slices-hash 對不存在或非法索引之切片須視為未確認, 不得回 ENOENT 或伺服器路徑', async function() {
        let r = await ulctr({ mode: 'check-slices-hash', fileHash: 'a1b2c3d4e5f60718', fileSliceHashs: [{ i: 999, h: 'x' }, { i: '../x', h: 'x' }, { i: -1, h: 'x' }] })
        assert.strict.deepEqual(r, { success: { slks: [] } })
    })

    it('S4: check-slices-hash 之 fileHash 含 ../ 須被拒絕', async function() {
        let r = await ulctr({ mode: 'check-slices-hash', fileHash: '../x', fileSliceHashs: [{ i: 0, h: 'x' }] })
        assert.strict.deepEqual(r, { error: 'invalid fileHash in payload' })
    })

    it('S5: merge-slices-get 以偽造 queueId 夾帶 ../ 時須回 error 且不含路徑', async function() {
        let r = await ulctr({ mode: 'merge-slices-get', fileHash: 'a1b2c3d4e5f60718', filename: 'x', queueId: '20260907|abcdef|../escapedZ' })
        assert.strict.deepEqual(w.iseobj(r.success), true, JSON.stringify(r))
        assert.strict.deepEqual(r.success.state, 'error')
        assert.strict.deepEqual(r.success.msg, 'invalid queueId')
        assert.strict.deepEqual(Object.keys(r.success).indexOf('path') < 0 && Object.keys(r.success).indexOf('reason') < 0, true, JSON.stringify(r))
        assert.strict.deepEqual(hasAbsPath(JSON.stringify(r)), false, JSON.stringify(r))
    })

    it('S5: 真實合併失敗時, 前端只收固定訊息, 含路徑之細節僅以伺服器 error 事件通知', async function() {
        this.timeout(20000)
        let hash = 'c3d4e5f607182930'
        await slc(hash, 0, 3, Buffer.alloc(sizeSlice, 1)) //宣稱 3 片只送 1 片
        let rp = await ulctr({ mode: 'merge-slices-push', fileHash: hash, chunkTotal: 3 })
        let queueId = rp.success.queueId

        errs = []
        let r = null
        for (let k = 0; k < 20; k++) {
            r = await ulctr({ mode: 'merge-slices-get', fileHash: hash, filename: 'x', queueId })
            if (r.success.state !== 'merging') {
                break
            }
            await w.delay(500)
        }
        await w.delay(200) //eeEmit 為 setTimeout 發送

        //前端: 固定訊息, 無路徑, 無 reason/path 欄位
        assert.strict.deepEqual(r.success.state, 'error', JSON.stringify(r))
        assert.strict.deepEqual(r.success.msg, 'merge slices failed')
        assert.strict.deepEqual(hasAbsPath(JSON.stringify(r)), false, JSON.stringify(r))

        //伺服器端: error 事件須含 fileHash 與底層原因(此處才允許出現路徑)
        let hit = errs.filter((v) => v.indexOf(`merge slices failed for fileHash[${hash}]`) === 0)
        assert.strict.deepEqual(hit.length >= 1, true, JSON.stringify(errs))
        assert.strict.deepEqual(hit[0].indexOf('is not a file') >= 0, true, hit[0])
    })

    //---------------------------------------------------------------
    //Q: node client 對伺服器給的檔名之防護
    //stub 伺服器, /dw 依 body.fileId 回 Content-Disposition 檔名(base64)為該字串之串流
    describe('Q: node client 信任伺服器檔名', function() {

        let port2 = 8196
        let srv = null
        let fdDownload = path.resolve(fdSand, 'dl')
        let wo = null

        before(async function() {
            srv = http.createServer((req, res) => {
                let bs = []
                req.on('data', (c) => bs.push(c))
                req.on('end', () => {
                    let fileId = ''
                    try {
                        fileId = JSON.parse(Buffer.concat(bs).toString('utf8')).fileId
                    }
                    catch (err) {}
                    let body = Buffer.from('CONTENT-FROM-SERVER')
                    res.writeHead(200, {
                        'Content-Type': 'application/octet-stream',
                        'Content-Length': body.length,
                        'Content-Disposition': `attachment; filename="${w.str2b64(fileId)}"`,
                    })
                    res.end(body)
                })
            })
            srv.listen(port2)
            await w.delay(300)
            fs.mkdirSync(fdDownload, { recursive: true })
            wo = new WConverhpClient({ url: `http://127.0.0.1:${port2}`, apiName: 'api', getToken: () => 't', retryDownload: 0 })
            wo.on('error', () => {})
        })

        after(function() {
            srv.close()
        })

        //dl, 以伺服器回傳之檔名(即 fileId)下載, 回傳落地路徑
        let dl = async(name) => {
            return await wo.download(name, () => {}, { fdDownload })
        }

        let cases = [
            //[伺服器給的檔名, 期望落地檔名, 說明]
            ['../escaped-by-server.bin', 'escaped-by-server.bin', '../ 只取最末段'],
            ['..\\..\\evil-bs.bin', 'evil-bs.bin', '反斜線路徑只取最末段'],
            ['C:evil-drive.bin', 'C_evil-drive.bin', 'Windows 磁碟機相對路徑(node-tar CVE-2026-31802 手法)冒號被替換'],
            ['CON', '_CON', '保留裝置名前置底線, 不寫入裝置'],
            ['..', 'unknown', '純 .. 落回預設檔名'],
            ['中文 檔名.7z', '中文 檔名.7z', '中文與空白原樣'],
        ]

        for (let [given, expect, note] of cases) {
            it(`${note}: ${JSON.stringify(given)} 須落於 fdDownload/${expect}`, async function() {
                let fp = await dl(given)
                assert.strict.deepEqual(fp, path.resolve(fdDownload, expect))
                assert.strict.deepEqual(fs.readFileSync(fp, 'utf8'), 'CONTENT-FROM-SERVER')
                assert.strict.deepEqual(lsEscaped(), []) //沙箱上一層不得出現任何逸出檔
            })
        }

        it('目標已被預先植入為指向資料夾外之符號連結時, 須拒絕而非穿過連結寫入', async function() {
            //預先植入: fdDownload/planted.bin -> 沙箱上一層之 target-outside.bin
            let fpOutside = path.resolve(fdSand, 'target-outside.bin')
            fs.writeFileSync(fpOutside, 'ORIGINAL', 'utf8')
            let fpLink = path.resolve(fdDownload, 'planted.bin')
            try {
                fs.symlinkSync(fpOutside, fpLink, 'file')
            }
            catch (err) {
                //Windows 建立符號連結需權限或開發人員模式, 無法建立時本案例不適用
                fs.rmSync(fpOutside, { force: true })
                this.skip()
            }

            let msg = null
            try {
                await dl('planted.bin')
            }
            catch (err) {
                msg = err
            }

            //須拒絕, 且資料夾外之目標內容不得被改寫
            assert.strict.deepEqual(msg, 'invalid filename from server')
            assert.strict.deepEqual(fs.readFileSync(fpOutside, 'utf8'), 'ORIGINAL')

            fs.rmSync(fpLink, { force: true })
            fs.rmSync(fpOutside, { force: true })
        })

    })

})
