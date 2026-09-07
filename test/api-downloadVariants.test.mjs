import assert from 'assert'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import w from 'wsemi'
import WConverhpServer from '../src/WConverhpServer.mjs'
import WConverhpClient from '../src/WConverhpClient.mjs'


describe('api-downloadVariants', function() {

    let port = 8188 //同時test故得要不同port
    let url = `http://localhost:${port}`
    let fdDownload = './tmp-api-downloadVariants' //各測試檔須用不同下載資料夾, 避免parallel互相干擾
    let fpSrc = './test/1mb.7z'
    let wsv = null

    //rsv, 記錄伺服器端收到的下載請求
    let rsv = []

    //md5File
    let md5File = (fp) => {
        return crypto.createHash('md5').update(fs.readFileSync(fp)).digest('hex')
    }

    //recorder
    let mkRecorder = () => {
        let evs = []
        let cb = (msg) => {
            evs.push(msg)
        }
        return { evs, cb }
    }

    before(async function() {

        let opt = {
            port,
            apiName: 'api',
            pathStaticFiles: '.',
            verifyConn: async({ authorization }) => {
                let token = w.strdelleft(authorization, 7) //刪除Bearer
                return w.isestr(token)
            },
        }

        //new
        wsv = new WConverhpServer(opt)

        wsv.on('download', (input, pm) => {
            rsv.push(input)
            try {

                //check, fileId決定回傳何種結果
                if (input.fileId === 'not-exist') {
                    pm.reject('file not found')
                    return
                }

                //filename, 依fileId決定檔名, 供測試中文與英文檔名
                let filename = input.fileId === 'ascii' ? 'plain-name.7z' : '中文檔名 測試.7z'

                let stats = fs.statSync(fpSrc)
                pm.resolve({
                    streamRead: fs.createReadStream(fpSrc),
                    filename,
                    fileSize: stats.size,
                    fileType: 'application/x-7z-compressed',
                })

            }
            catch (err) {
                pm.reject('download error')
            }
        })
        wsv.on('error', () => {})
        wsv.on('handler', () => {})

        await w.delay(1000) //待伺服器啟動

    })

    after(function() {
        wsv.stop()
        try {
            fs.rmSync(fdDownload, { recursive: true, force: true }) //清除本測試之下載資料夾
        }
        catch (err) {}
    })

    //mkClient
    let mkClient = (o = {}) => {
        return new WConverhpClient({
            url,
            apiName: 'api',
            getToken: () => 'token-for-test',
            ...o,
        })
    }

    it('下載後存檔內容須與來源檔完全一致', async function() {
        let wo = mkClient()
        wo.on('error', () => {})

        let fp = await wo.download('ascii', () => {}, { fdDownload })

        assert.strict.deepEqual(w.getFileName(fp), 'plain-name.7z')
        assert.strict.deepEqual(fs.existsSync(fp), true)
        assert.strict.deepEqual(fs.statSync(fp).size, fs.statSync(fpSrc).size)
        assert.strict.deepEqual(md5File(fp), md5File(fpSrc))

        fs.unlinkSync(fp)
    })

    it('中文檔名(含空白)下載須能正確還原檔名', async function() {
        let wo = mkClient()
        wo.on('error', () => {})

        let fp = await wo.download('id-for-file', () => {}, { fdDownload })

        assert.strict.deepEqual(w.getFileName(fp), '中文檔名 測試.7z')
        assert.strict.deepEqual(md5File(fp), md5File(fpSrc))

        fs.unlinkSync(fp)
    })

    it('下載進度須單調遞增至100, 且僅含upload與download兩類事件', async function() {
        let wo = mkClient()
        wo.on('error', () => {})

        let rec = mkRecorder()
        let fp = await wo.download('ascii', rec.cb, { fdDownload })

        //須有事件
        assert.strict.deepEqual(rec.evs.length > 0, true)

        //m僅允許upload與download, download亦會回報請求本體(fileId之json)的上傳進度
        let ms = [...new Set(rec.evs.map((v) => v.m))].sort()
        assert.strict.deepEqual(ms, ['download', 'upload'])

        //dws, 下載階段
        let dws = rec.evs.filter((v) => v.m === 'download')
        assert.strict.deepEqual(dws.length > 0, true)

        //單調遞增
        let bMono = true
        for (let i = 1; i < dws.length; i++) {
            if (dws[i].prog < dws[i - 1].prog) {
                bMono = false
            }
        }
        assert.strict.deepEqual(bMono, true)

        //末值須為100
        assert.strict.deepEqual(dws[dws.length - 1].prog, 100)

        //p須為數值且末值等於檔案大小
        assert.strict.deepEqual(rec.evs.every((v) => w.isnum(v.p)), true)
        assert.strict.deepEqual(dws[dws.length - 1].p, fs.statSync(fpSrc).size)

        fs.unlinkSync(fp)
    })

    it('伺服器download拒絕時, 呼叫端須收到伺服器統一的錯誤訊息', async function() {
        //注意: 與execute、upload不同, 伺服器對download事件之reject訊息不外傳,
        //WConverhpServer.mjs:1211與:1337一律改回固定訊息, 此處釘住的是該既有契約
        let wo = mkClient({ retryDownload: 0 })
        wo.on('error', () => {})

        let msg = null
        try {
            await wo.download('not-exist', () => {}, { fdDownload })
        }
        catch (err) {
            msg = err
        }
        assert.strict.deepEqual(msg, 'can not get file from fileId')
    })

    it('權限驗證失敗時, download須收到permission denied', async function() {
        let wo = mkClient({ getToken: () => '', retryDownload: 0 })
        wo.on('error', () => {})

        let msg = null
        try {
            await wo.download('ascii', () => {}, { fdDownload })
        }
        catch (err) {
            msg = err
        }
        assert.strict.deepEqual(msg, 'permission denied')
    })

    it('伺服器download事件須收到fileId與token', async function() {
        let wo = mkClient()
        wo.on('error', () => {})

        let n0 = rsv.length
        let fp = await wo.download('ascii', () => {}, { fdDownload })

        assert.strict.deepEqual(rsv.length, n0 + 1)
        assert.strict.deepEqual(rsv[rsv.length - 1], { fileId: 'ascii', token: 'token-for-test' })

        fs.unlinkSync(fp)
    })

    it('fdDownload指定之資料夾不存在時須自動建立', async function() {
        let wo = mkClient()
        wo.on('error', () => {})

        let fd = path.join(fdDownload, 'sub', 'deep')
        try {
            fs.rmSync(fd, { recursive: true, force: true })
        }
        catch (err) {}

        let fp = await wo.download('ascii', () => {}, { fdDownload: fd })

        assert.strict.deepEqual(fs.existsSync(fp), true)
        assert.strict.deepEqual(md5File(fp), md5File(fpSrc))

        fs.unlinkSync(fp)
    })

})
