import assert from 'assert'
import fs from 'fs'
import path from 'path'
import w from 'wsemi'
import getFileXxHash from 'wsemi/src/getFileXxHash.mjs'
import WConverhpServer from '../src/WConverhpServer.mjs'
import WConverhpClient from '../src/WConverhpClient.mjs'


/**
 * api: 續傳時已在伺服器上之末片(大小小於 sizeSlice 之合法短片)不得重傳
 *
 * 優化(第十一輪 A3): checkTotalHash 之第一階段以 stats.size === sizeSlice 挑候選, 末片結構上永不進候選 → 每次續傳皆重送末片;
 * 而「這片已在伺服器上」之判定本由第二階段之雜湊(check-slices-hash)定奪, 第一階段只該排除結構上不可能者(0 byte、超過 sizeSlice)。
 * 注意 R14: checkTotalHash 之實際執行者為 .wk.umd.js, 須重建
 */
describe('api-uploadResumeLastSlice', function() {
    this.timeout(60000)

    let port = 8622
    let pathUploadTemp = './test/_tmp/uploadTemp-api-uploadResumeLastSlice'
    let sizeSlice = 1024
    let wsv = null
    let handlers = []

    before(async function() {
        wsv = new WConverhpServer({ port, useInert: false, pathUploadTemp, sizeSlice })
        wsv.on('upload', (input, pm) => {
            pm.resolve({ from: input.from, size: fs.statSync(input.path).size })
        })
        wsv.on('handler', (d) => handlers.push(d.api))
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

    //mkBuf
    let mkBuf = (n, seed) => {
        let b = Buffer.alloc(n)
        for (let i = 0; i < n; i++) {
            b[i] = (i * 7 + seed) % 251
        }
        return b
    }

    //placeSlices, 把切片預先放進暫存夾(模擬前次上傳已送達但尚未合併), 回傳 fileHash
    let placeSlices = async(buf, mutate = () => {}) => {
        let hash = await getFileXxHash(new Blob([buf]))
        let n = Math.ceil(buf.length / sizeSlice)
        for (let i = 0; i < n; i++) {
            let chunk = buf.subarray(i * sizeSlice, Math.min((i + 1) * sizeSlice, buf.length))
            fs.writeFileSync(path.resolve(pathUploadTemp, `${hash}_${i}`), chunk)
        }
        mutate(hash)
        return hash
    }

    //nSlice, /slc 之請求數
    let nSlice = () => handlers.filter((v) => v === 'apiUploadSlice').length

    it('三片皆已在伺服器(末片為 452 byte 之合法短片): check-total-hash 須把末片列入候選, 上傳須 0 次 /slc 且結果正確(修正前: 末片不在候選而重傳 1 次)', async function() {
        let buf = mkBuf(sizeSlice * 2 + 452, 3)
        let hash = await placeSlices(buf)

        //直接問 check-total-hash
        let r = await fetch(`http://127.0.0.1:${port}/api/ulctr`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer t', 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: 'check-total-hash', fileHash: hash, filename: 'resume.bin', fileSize: buf.length }),
        })
        let o = w.u8arr2obj(new Uint8Array(await r.arrayBuffer()))
        assert.strict.deepEqual([...o.success.slks].sort(), [0, 1, 2], JSON.stringify(o))

        //真實呼叫端: upload 須不重送任何切片
        let wc = new WConverhpClient({ url: `http://127.0.0.1:${port}`, sizeSlice, retryUpload: 0 })
        wc.on('error', () => {})
        let n0 = nSlice()
        let res = await wc.upload('resume.bin', buf, () => {})
        assert.strict.deepEqual(res, { from: 'merge-slices-get', size: buf.length })
        assert.strict.deepEqual(nSlice() - n0, 0, '末片已在伺服器上, 不得重傳')
    })

    it('中間片被截斷(500 byte)時: 候選含該片, 但雜湊階段不予確認, 上傳恰重送 1 片且結果正確', async function() {
        let buf = mkBuf(sizeSlice * 2 + 452, 5)
        let hash = await placeSlices(buf, (h) => {
            fs.writeFileSync(path.resolve(pathUploadTemp, `${h}_1`), buf.subarray(sizeSlice, sizeSlice + 500))
        })

        let wc = new WConverhpClient({ url: `http://127.0.0.1:${port}`, sizeSlice, retryUpload: 0 })
        wc.on('error', () => {})
        let n0 = nSlice()
        let res = await wc.upload('resume2.bin', buf, () => {})
        assert.strict.deepEqual(res, { from: 'merge-slices-get', size: buf.length })
        assert.strict.deepEqual(nSlice() - n0, 1, '只有被截斷之中間片須重傳')
        assert.strict.deepEqual(hash.length, 16)
    })

})
