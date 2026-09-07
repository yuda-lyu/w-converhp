import assert from 'assert'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import w from 'wsemi'
import { HOST, projRoot, launchBrowser, buildClientBundle, writePage, startServer } from './e2e-setup.mjs'


/**
 * e2e: 瀏覽器端 upload (切片上傳)
 *
 * 真實 user path (技能 §2.3):
 *   ①開啟載入 w-converhp client 之頁面
 *   ②使用者取得 File(此處以 File 建構子造出, 等同 <input type=file> 選檔之結果)
 *   ③呼叫 wo.upload(filename, file, cbProgress)
 *   ④觀察進度序列
 *   ⑤觀察 promise 之 resolve/reject
 *   ⑥後端副作用: 伺服器 upload 事件收到合併後之檔案
 *
 * 變體覆蓋 (技能 §2.1 第6維): 單切片 / 多切片 / 中文檔名 / 重複內容去重
 */
describe('e2e-upload', function() {

    let port = 8191 //各測試檔須用不同 port
    let baseUrl = `http://${HOST}:${port}`
    let sizeSlice = 64 * 1024 //縮小切片, 使小檔亦能造出多切片情境
    let pathUploadTemp = path.resolve(projRoot, 'test', '_tmp', 'uploadTemp-e2e-upload')
    let wsv = null
    let browser = null
    let urlPage = ''

    //rsv, 記錄伺服器端收到的上傳結果
    let rsv = []

    //md5
    let md5 = (buf) => {
        return crypto.createHash('md5').update(buf).digest('hex')
    }

    //mkU8a, 與頁面內造法一致
    let mkU8a = (n, seed) => {
        let u8a = new Uint8Array(n)
        for (let i = 0; i < n; i++) {
            u8a[i] = (i + seed) % 251
        }
        return u8a
    }

    before(async function() {
        this.timeout(180000) //首次須打包 bundle

        await buildClientBundle()

        urlPage = writePage('e2e-upload.html', `
let mk = (o) => new WConverhpClient({
    url: location.origin,
    apiName: 'api',
    sizeSlice: ${sizeSlice},
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

//mkFile, 以 File 建構子造出等同使用者選檔之結果
let mkFile = (n, seed, name) => {
    let u8a = new Uint8Array(n)
    for (let i = 0; i < n; i++) {
        u8a[i] = (i + seed) % 251
    }
    return new File([u8a], name)
}

window.tUpload = async (n, seed, name, o) => {
    let wo = mk(o || {})
    wo.on('error', () => {})
    let evs = []
    let file = mkFile(n, seed, name)
    let r = await cat(() => wo.upload(file.name, file, (m) => evs.push({ prog: Math.floor(m.prog), p: m.p, m: m.m })))
    return { state: r.state, msg: r.state === 'resolve' ? r.msg : String(r.msg), evs }
}
`)

        wsv = await startServer({
            port,
            apiName: 'api',
            pathUploadTemp,
            sizeSlice,
            verifyConn: async({ authorization }) => {
                let token = w.strdelleft(authorization, 7) //刪除 Bearer
                return w.isestr(token)
            },
        })

        wsv.on('upload', (input, pm) => {
            try {
                //讀取合併後檔案, 記錄其內容雜湊供比對
                //注意: 此處不刪除檔案, 因去重測試須依賴伺服器已存在該檔
                let b = fs.readFileSync(input.path)
                rsv.push({
                    from: input.from,
                    filename: input.filename,
                    size: b.length,
                    hash: md5(b),
                })
                pm.resolve({ filename: input.filename, size: b.length })
            }
            catch (err) {
                pm.reject('upload error')
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

    //assertProgress, 進度序列之共同檢核
    let assertProgress = (evs) => {
        assert.strict.deepEqual(evs.length > 0, true)
        assert.strict.deepEqual([...new Set(evs.map((v) => v.m))], ['upload'])
        let bMono = true
        for (let i = 1; i < evs.length; i++) {
            if (evs[i].prog < evs[i - 1].prog) {
                bMono = false
            }
        }
        assert.strict.deepEqual(bMono, true)
        assert.strict.deepEqual(evs[evs.length - 1].prog, 100)
        assert.strict.deepEqual(evs.every((v) => typeof v.p === 'number'), true)
    }

    it('單一切片(小於sizeSlice)之File上傳後, 伺服器所得內容須與來源一致', async function() {
        let page = await openPage()

        let n = 10 * 1024
        let seed = 3
        let n0 = rsv.length
        let r = await page.evaluate(({ n, seed }) => window.tUpload(n, seed, 'small.bin'), { n, seed })

        assert.strict.deepEqual(r.state, 'resolve')
        assert.strict.deepEqual(rsv.length, n0 + 1)

        let last = rsv[rsv.length - 1]
        assert.strict.deepEqual(last.size, n)
        assert.strict.deepEqual(last.hash, md5(Buffer.from(mkU8a(n, seed))))
        assert.strict.deepEqual(r.msg.filename, 'small.bin')
    })

    it('多切片(大於sizeSlice)之File上傳後, 伺服器所得內容須與來源一致且進度遞增至100', async function() {
        let page = await openPage()

        let n = sizeSlice * 5 + 123 //5片多一點, 確保切片與合併路徑被走到
        let seed = 7
        let n0 = rsv.length
        let r = await page.evaluate(({ n, seed }) => window.tUpload(n, seed, 'multi.bin'), { n, seed })

        assert.strict.deepEqual(r.state, 'resolve')
        assert.strict.deepEqual(rsv.length, n0 + 1)

        let last = rsv[rsv.length - 1]
        assert.strict.deepEqual(last.size, n)
        assert.strict.deepEqual(last.hash, md5(Buffer.from(mkU8a(n, seed))))
        assert.strict.deepEqual(last.from, 'merge-slices-get')

        assertProgress(r.evs)
    })

    it('中文檔名上傳須可正常處理', async function() {
        let page = await openPage()

        let n = sizeSlice * 2
        let seed = 13
        let r = await page.evaluate(({ n, seed }) => window.tUpload(n, seed, '中文檔名 測試.bin'), { n, seed })

        assert.strict.deepEqual(r.state, 'resolve')
        let last = rsv[rsv.length - 1]
        assert.strict.deepEqual(last.filename, '中文檔名 測試.bin')
        assert.strict.deepEqual(last.hash, md5(Buffer.from(mkU8a(n, seed))))
    })

    it('重複上傳相同內容時, 伺服器須以既有檔案去重', async function() {
        let page = await openPage()

        let n = sizeSlice * 3
        let seed = 17

        let r1 = await page.evaluate(({ n, seed }) => window.tUpload(n, seed, 'dup.bin'), { n, seed })
        let a1 = rsv[rsv.length - 1]

        let r2 = await page.evaluate(({ n, seed }) => window.tUpload(n, seed, 'dup.bin'), { n, seed })
        let a2 = rsv[rsv.length - 1]

        assert.strict.deepEqual(r1.state, 'resolve')
        assert.strict.deepEqual(r2.state, 'resolve')
        assert.strict.deepEqual(a1.hash, md5(Buffer.from(mkU8a(n, seed))))
        assert.strict.deepEqual(a2.hash, a1.hash)
        assert.strict.deepEqual(a2.from, 'check-total-hash') //第2次應走去重路徑
    })

})
