import assert from 'assert'
import fs from 'fs'
import path from 'path'
import w from 'wsemi'
import WConverhpServer from '../src/WConverhpServer.mjs'
import WConverhpClient from '../src/WConverhpClient.mjs'


/**
 * api: 應用端 upload 以 pm.resolve() 不帶值結束時, upload() 之回傳須與伺服器端走哪條交付路徑無關
 *
 * 缺陷(第十輪 D5, tmp/probe_r10_undef.mjs): 「應用端結果 undefined → null」寫在兩處(procDeal 之 output、managerMergeSlices 之 consume),
 * check-total-hash 去重路徑無此正規化 —— 其 msg 鍵於序列化時消失, 同一檔第 1 次上傳(合併路徑)回 null、第 2 次(去重路徑)回 undefined。
 */
describe('api-uploadResultShape', function() {
    this.timeout(60000)

    let port = 8495
    let pathUploadTemp = path.resolve('./test/_tmp/uploadTemp-api-uploadResultShape')
    let wsv = null
    let from = []

    before(async function() {
        fs.rmSync(pathUploadTemp, { recursive: true, force: true })
        wsv = new WConverhpServer({ port, useInert: false, pathUploadTemp })
        wsv.on('error', () => {})
        wsv.on('upload', (input, pm) => {
            from.push(input.from)
            pm.resolve()
        })
        wsv.on('execute', (f, i, pm) => pm.resolve())
        await w.delay(600)
    })

    after(async function() {
        if (wsv) {
            await wsv.stop()
        }
    })

    it('同一檔連傳兩次(合併路徑、去重路徑), 應用端不帶值時兩者皆須回 null, 與 execute 一致', async function() {
        let wc = new WConverhpClient({ url: `http://127.0.0.1:${port}`, retryUpload: 0, retryMain: 0 })
        wc.on('error', () => {})
        let buf = Buffer.from('api-uploadResultShape payload')
        let v1 = await wc.upload('a.txt', buf, () => {})
        let v2 = await wc.upload('a.txt', buf, () => {})
        assert.strict.deepEqual(from, ['merge-slices-get', 'check-total-hash'], '前提: 兩次須分別走合併與去重兩條路徑')
        assert.strict.deepEqual(v1, null, '合併路徑')
        assert.strict.deepEqual(v2, null, `去重路徑(修正前為 undefined)`)
        assert.strict.deepEqual(await wc.execute('f', {}), null, '對照: execute')
    })

})
