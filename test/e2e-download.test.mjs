import assert from 'assert'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import w from 'wsemi'
import { HOST, projRoot, launchBrowser, buildClientBundle, writePage, startServer } from './e2e-setup.mjs'


/**
 * e2e: 瀏覽器端 download
 *
 * 真實 user path (技能 §2.3):
 *   ①開啟載入 w-converhp client 之頁面
 *   ②呼叫 wo.download(fileId, cbProgress, opt)
 *   ③downloadByManager=true(預設): client 先取檔名, 再以 <a download> 打 GET /dwgf,
 *     由瀏覽器下載管理器接手 → 使用者在瀏覽器下載清單看到檔案
 *   ④downloadByManager=false: 走 POST /dw 取回 Blob, 由呼叫端自行處理
 *   ⑤觀察進度序列(僅 false 模式有, true 模式交由瀏覽器管理故無)
 *   ⑥後端副作用: 伺服器 download 事件收到 fileId 與 token
 *
 * 變體覆蓋 (技能 §2.1 第6維): 兩種 downloadByManager 分支 × 中文/英文檔名 × 成功/拒絕/權限失敗
 * 註: downloadByManager=true 走的 GET /dwgf 端點只存在於瀏覽器路徑, node 端與 api-* 測試皆無法覆蓋
 */
describe('e2e-download', function() {

    let port = 8192 //各測試檔須用不同 port
    let baseUrl = `http://${HOST}:${port}`
    let fpSrc = path.resolve(projRoot, 'test', '1mb.7z')
    let wsv = null
    let browser = null
    let urlPage = ''

    //rsv, 記錄伺服器端收到的下載請求
    let rsv = []

    //md5File
    let md5File = (fp) => {
        return crypto.createHash('md5').update(fs.readFileSync(fp)).digest('hex')
    }

    before(async function() {
        this.timeout(180000) //首次須打包 bundle

        await buildClientBundle()

        urlPage = writePage('e2e-download.html', `
let mk = (o) => new WConverhpClient({
    url: location.origin,
    apiName: 'api',
    getToken: () => 'token-for-test',
    ...o,
})

let cat = async (fn) => {
    try {
        return { state: 'resolve', msg: await fn() }
    }
    catch (e) {
        return { state: 'reject', msg: e }
    }
}

//tDownloadBlob, downloadByManager=false, 取回 Blob 供呼叫端處理
window.tDownloadBlob = async (fileId, o) => {
    let wo = mk(o || {})
    wo.on('error', () => {})
    let evs = []
    let r = await cat(() => wo.download(fileId, (m) => evs.push({ prog: Math.floor(m.prog), p: m.p, m: m.m }), { downloadByManager: false }))
    if (r.state === 'resolve') {
        //把 Blob 轉為可跨進程傳遞之資訊
        let u8a = new Uint8Array(await r.msg.bb.arrayBuffer())
        let sum = 0
        for (let i = 0; i < u8a.length; i++) {
            sum = (sum + u8a[i]) % 4294967296
        }
        return { state: r.state, filename: r.msg.filename, size: r.msg.bb.size, sum, evs }
    }
    return { state: r.state, msg: String(r.msg), evs }
}

//tDownloadManager, downloadByManager=true(預設), 交由瀏覽器下載管理器
window.tDownloadManager = async (fileId, o) => {
    let wo = mk(o || {})
    wo.on('error', () => {})
    let r = await cat(() => wo.download(fileId, () => {}, {}))
    return { state: r.state, msg: String(r.msg) }
}
`)

        wsv = await startServer({
            port,
            apiName: 'api',
            verifyConn: async({ authorization }) => {
                let token = w.strdelleft(authorization, 7) //刪除 Bearer
                return w.isestr(token)
            },
        })

        wsv.on('download', (input, pm) => {
            rsv.push(input)
            try {

                //check, fileId 決定回傳何種結果
                if (input.fileId === 'not-exist') {
                    pm.reject('file not found')
                    return
                }

                //filename, 依 fileId 決定檔名, 供測試中文與英文檔名
                let filename = input.fileId === 'ascii' ? 'plain-name.7z' : '中文檔名 測試.7z'

                pm.resolve({
                    streamRead: fs.createReadStream(fpSrc),
                    filename,
                    fileSize: fs.statSync(fpSrc).size,
                    fileType: 'application/x-7z-compressed',
                })

            }
            catch (err) {
                pm.reject('download error')
            }
        })
        wsv.on('error', () => {})

    })

    after(function() {
        if (wsv) {
            wsv.stop()
        }

    })

    //每 case fresh browser (技能 §6)
    beforeEach(async function() {
        browser = await launchBrowser()
    })

    afterEach(async function() {
        if (browser) {
            await browser.close()
            browser = null
        }
    })

    //openPage
    let openPage = async() => {
        let page = await browser.newPage()
        await page.goto(`${baseUrl}${urlPage}`, { waitUntil: 'load' })
        return page
    }

    //sumOfFile, 與頁面內之 sum 算法一致, 供跨環境比對內容
    let sumOfFile = (fp) => {
        let b = fs.readFileSync(fp)
        let sum = 0
        for (let i = 0; i < b.length; i++) {
            sum = (sum + b[i]) % 4294967296
        }
        return sum
    }

    it('downloadByManager=false時, 須取回Blob且內容與來源檔一致', async function() {
        let page = await openPage()

        let r = await page.evaluate(() => window.tDownloadBlob('ascii'))

        //使用者觀察: 取得檔名與 Blob
        assert.strict.deepEqual(r.state, 'resolve')
        assert.strict.deepEqual(r.filename, 'plain-name.7z')
        assert.strict.deepEqual(r.size, fs.statSync(fpSrc).size)

        //內容須與來源檔一致
        assert.strict.deepEqual(r.sum, sumOfFile(fpSrc))
    })

    it('downloadByManager=false時, 下載進度須單調遞增至100', async function() {
        let page = await openPage()

        let r = await page.evaluate(() => window.tDownloadBlob('ascii'))
        assert.strict.deepEqual(r.state, 'resolve')

        //m 僅允許 upload 與 download, download 亦會回報請求本體(fileId 之 json)的上傳進度
        assert.strict.deepEqual([...new Set(r.evs.map((v) => v.m))].sort(), ['download', 'upload'])

        let dws = r.evs.filter((v) => v.m === 'download')
        assert.strict.deepEqual(dws.length > 0, true)

        let bMono = true
        for (let i = 1; i < dws.length; i++) {
            if (dws[i].prog < dws[i - 1].prog) {
                bMono = false
            }
        }
        assert.strict.deepEqual(bMono, true)
        assert.strict.deepEqual(dws[dws.length - 1].prog, 100)
        assert.strict.deepEqual(dws[dws.length - 1].p, fs.statSync(fpSrc).size)
    })

    it('downloadByManager=false時, 中文檔名須能正確還原', async function() {
        let page = await openPage()

        let r = await page.evaluate(() => window.tDownloadBlob('id-for-file'))
        assert.strict.deepEqual(r.state, 'resolve')
        assert.strict.deepEqual(r.filename, '中文檔名 測試.7z')
        assert.strict.deepEqual(r.sum, sumOfFile(fpSrc))
    })

    it('downloadByManager=true時, 須由瀏覽器下載管理器取得檔案且內容與來源檔一致', async function() {
        let page = await openPage()

        //先掛監聽再觸發, 否則會漏接
        let pmDownload = page.waitForEvent('download', { timeout: 60000 })

        let r = await page.evaluate(() => window.tDownloadManager('ascii'))
        assert.strict.deepEqual(r.state, 'resolve')

        //瀏覽器下載管理器須真的收到檔案
        let download = await pmDownload
        assert.strict.deepEqual(download.suggestedFilename(), 'plain-name.7z')

        //存檔後內容須與來源檔一致
        let fpOut = path.resolve(projRoot, 'test', '_tmp', 'dl-manager-ascii.7z')
        await download.saveAs(fpOut)
        assert.strict.deepEqual(fs.statSync(fpOut).size, fs.statSync(fpSrc).size)
        assert.strict.deepEqual(md5File(fpOut), md5File(fpSrc))
    })

    it('downloadByManager=true時, 中文檔名須能正確還原', async function() {
        let page = await openPage()

        let pmDownload = page.waitForEvent('download', { timeout: 60000 })

        let r = await page.evaluate(() => window.tDownloadManager('id-for-file'))

        //使用者觀察: download 回傳的是檔名字串
        assert.strict.deepEqual(r.state, 'resolve')
        assert.strict.deepEqual(r.msg, '中文檔名 測試.7z')

        let download = await pmDownload
        assert.strict.deepEqual(download.suggestedFilename(), '中文檔名 測試.7z')

        let fpOut = path.resolve(projRoot, 'test', '_tmp', 'dl-manager-cht.7z')
        await download.saveAs(fpOut)
        assert.strict.deepEqual(md5File(fpOut), md5File(fpSrc))
    })

    it('伺服器download拒絕時, 瀏覽器端須收到伺服器統一的錯誤訊息', async function() {
        let page = await openPage()

        //注意: 與 execute、upload 不同, 伺服器對 download 事件之 reject 訊息不外傳,
        //WConverhpServer.mjs:1211 與 :1337 一律改回固定訊息, 此處釘住的是該既有契約
        let r = await page.evaluate(() => window.tDownloadBlob('not-exist', { retryDownload: 0 }))
        assert.strict.deepEqual(r.state, 'reject')
        assert.strict.deepEqual(r.msg, 'can not get file from fileId')
    })

    it('權限驗證失敗時, 瀏覽器端須收到permission denied', async function() {
        let page = await openPage()

        let r = await page.evaluate(() => window.tDownloadBlob('ascii', { retryDownload: 0, getToken: () => '' }))
        assert.strict.deepEqual(r.state, 'reject')
        assert.strict.deepEqual(r.msg, 'permission denied')
    })

    it('伺服器download事件須收到fileId與token', async function() {
        let page = await openPage()

        let n0 = rsv.length
        await page.evaluate(() => window.tDownloadBlob('ascii'))

        assert.strict.deepEqual(rsv.length, n0 + 1)
        assert.strict.deepEqual(rsv[rsv.length - 1], { fileId: 'ascii', token: 'token-for-test' })
    })

})
