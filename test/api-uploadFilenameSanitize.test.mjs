import assert from 'assert'
import fs from 'fs'
import w from 'wsemi'
import WConverhpServer from '../src/WConverhpServer.mjs'
import WConverhpClient from '../src/WConverhpClient.mjs'


/**
 * api: upload 事件交予應用端之 filename 為用戶端原值(不可信), 另給 filenameSafe(淨化值); 兩條路徑(合併消費、去重)皆同
 *
 * 缺陷(第十一輪 N4): /ulctr 之 check-total-hash 與 merge-slices-get 各自讀 payload.filename 原樣交應用端 ——
 * ../../evil.txt、C:evil、CON 皆可達應用端, 而應用端多以之組落地路徑, 且套件未告知此值不可信。
 * 兩份複審一致反對「就地淨化」: 本套件自身不以此值組路徑, 而淨化會刪掉合法資料(a:b.txt 於 Linux 合法、
 * 瀏覽器 webkitdirectory 之 docs/2024/report.pdf 會只剩 report.pdf)。對標 multer: originalname 原樣且明載不可信, 另給 filename
 */
describe('api-uploadFilenameSanitize', function() {
    this.timeout(60000)

    let port = 8621
    let pathUploadTemp = './test/_tmp/uploadTemp-api-uploadFilenameSanitize'
    let sizeSlice = 64 * 1024
    let wsv = null
    let seen = []

    before(async function() {
        wsv = new WConverhpServer({ port, useInert: false, pathUploadTemp, sizeSlice })
        wsv.on('upload', (input, pm) => {
            seen.push({ from: input.from, filename: input.filename, filenameSafe: input.filenameSafe })
            pm.resolve({ filename: input.filename, filenameSafe: input.filenameSafe })
        })
        wsv.on('error', () => {})
        await w.delay(800)
    })

    after(async function() {
        await wsv.stop()
        try {
            fs.rmSync(pathUploadTemp, { recursive: true, force: true })
        }
        catch (err) {}
    })

    //cases, [client 給之檔名, 應用端所見之 filenameSafe]; filename 恆為原值
    let cases = [
        ['../../evil.txt', 'evil.txt'],
        ['C:evil.txt', 'C_evil.txt'],
        ['CON', '_CON'],
        ['a\\b/c.txt', 'c.txt'],
        ['docs/2024/report.pdf', 'report.pdf'], //webkitdirectory 之相對路徑: 原值須保留目錄結構
        ['中文 報告 (v2).pdf', '中文 報告 (v2).pdf'],
        ['a:b.txt', 'a_b.txt'], //Linux 合法而 Windows 非法: 原值不動, 安全值改寫
    ]

    it('合併消費路徑(merge-slices-get)與去重路徑(check-total-hash)交予應用端之 filename 皆為原值、filenameSafe 皆為淨化值', async function() {
        let wc = new WConverhpClient({ url: `http://127.0.0.1:${port}`, sizeSlice, retryUpload: 0 })
        wc.on('error', () => {})
        let k = 0
        for (let [given, safe] of cases) {
            k += 1
            let buf = Buffer.alloc(sizeSlice + 100 + k, k) //各案內容不同, 使首次走合併; 第二次同內容走去重
            seen.length = 0
            let r1 = await wc.upload(given, buf, () => {})
            let r2 = await wc.upload(given, buf, () => {})
            assert.strict.deepEqual(r1, { filename: given, filenameSafe: safe }, `merge path: seen=${JSON.stringify(seen)}`)
            assert.strict.deepEqual(r2, { filename: given, filenameSafe: safe }, `dedup path: seen=${JSON.stringify(seen)}`)
            assert.strict.deepEqual(seen.map((v) => v.from), ['merge-slices-get', 'check-total-hash'], JSON.stringify(seen))
        }
    })

    it('未給、非字串或淨化後為空之 filename: filenameSafe 為空字串(套件不代為發明 unknown), filename 維持原值', async function() {
        let wc = new WConverhpClient({ url: `http://127.0.0.1:${port}`, sizeSlice, retryUpload: 0 })
        wc.on('error', () => {})
        for (let [given, raw] of [['..', '..'], ['///', '///'], ['. ', '. '], [undefined, '']]) {
            seen.length = 0
            let buf = Buffer.from(`content-${String(given)}`)
            let r = await wc.upload(given, buf, () => {})
            assert.strict.deepEqual(r, { filename: raw, filenameSafe: '' }, `given=${JSON.stringify(given)} seen=${JSON.stringify(seen)}`)
        }

        //直接打 /ulctr 以非字串之 filename: 不得使路由拋錯(本例檔案不存在, 去重不成立, 不呼叫應用端)
        let rr = await fetch(`http://127.0.0.1:${port}/api/ulctr`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer t', 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: 'check-total-hash', fileHash: 'abcdef0123456789', filename: { toString: 1 }, fileSize: 1 }),
        })
        assert.strict.deepEqual(rr.status, 200)
        assert.strict.deepEqual(rr.headers.get('return-type'), 'success')
    })

})
