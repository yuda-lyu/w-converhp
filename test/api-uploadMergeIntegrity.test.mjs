import assert from 'assert'
import fs from 'fs'
import path from 'path'
import w from 'wsemi'
import WConverhpServer from '../src/WConverhpServer.mjs'


/**
 * api: 合併完成之宣稱須經內容核對 —— 合併檔之雜湊與 fileHash 不符時不得寫 .done、不得呼叫應用端
 *
 * 缺陷(第十輪 D1/D2 之伺服器側): 一般合併路徑寫 .done 前不核對雜湊(src/mergeSlices.mjs 之 writeFileSync .done),
 * 而同一個「此檔即 fileHash」之宣稱, 去重路徑(checkTotalHash)與中止復原(verifyMerged)皆有核對 —— 三條寫入路徑兩驗一不驗。
 * 實測後果: 用戶端以 ArrayBuffer 上傳時只送出 1 byte, 伺服器照樣合併、寫 .done, 應用端以 success 收到 1 byte 之檔(tmp/probe_r10_ab.mjs)。
 * 對標: S3 CompleteMultipartUpload、GCS resumable finalize、tus Checksum 擴充皆於完成時核對, 不符即不產生物件。
 */
describe('api-uploadMergeIntegrity', function() {
    this.timeout(60000)

    let port = 8492
    let base = `http://127.0.0.1:${port}/api`
    let pathUploadTemp = path.resolve('./test/_tmp/uploadTemp-api-uploadMergeIntegrity')
    let wsv = null
    let calls = []
    let errs = []

    let parse = async(r) => {
        return w.u8arr2obj(new Uint8Array(Buffer.from(await r.arrayBuffer())))
    }
    let ulctr = async(payload, h) => {
        let r = await fetch(`${base}/ulctr`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer t', 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileHash: h, ...payload }),
        })
        return await parse(r)
    }
    let push = async(h, chunkTotal) => {
        let rp = await ulctr({ mode: 'merge-slices-push', chunkTotal }, h)
        return w.iseobj(rp.success) ? rp.success.queueId : ''
    }
    let poll = async(queueId, h, limit = 15000) => {
        let t0 = Date.now()
        while (Date.now() - t0 < limit) {
            let r = await ulctr({ mode: 'merge-slices-get', filename: 'x.bin', queueId }, h)
            let s = w.iseobj(r.success) ? r.success : r
            if (s.state !== 'merging') {
                return s
            }
            await w.delay(150)
        }
        return { state: 'TIMEOUT' }
    }

    let mk = (n, seed) => {
        let b = Buffer.alloc(n)
        for (let i = 0; i < n; i++) {
            b[i] = (i * seed + 1) % 256
        }
        return b
    }

    before(async function() {
        fs.rmSync(pathUploadTemp, { recursive: true, force: true })
        wsv = new WConverhpServer({ port, useInert: false, pathUploadTemp })
        wsv.on('error', (e) => errs.push(String(e)))
        wsv.on('upload', (input, pm) => {
            calls.push(fs.statSync(input.path).size)
            pm.resolve({ size: fs.statSync(input.path).size })
        })
        await w.delay(600)
    })

    after(async function() {
        if (wsv) {
            await wsv.stop()
        }
    })

    it('切片內容之雜湊與 fileHash 不符時, 合併須以失敗終結: 不得寫 .done、不得呼叫應用端(修正前 success 交出錯檔)', async function() {
        let right = mk(150000, 7)
        let h = await w.getFileXxHash(new Blob([right]))
        fs.writeFileSync(path.resolve(pathUploadTemp, `${h}_0`), right.subarray(0, 1)) //內容與 fileHash 不符(如 ArrayBuffer 只送出 1 byte)
        calls.length = 0
        errs.length = 0

        let q = await push(h, 1)
        let r = await poll(q, h)
        assert.strict.deepEqual(r.state, 'error', `須為 error, 實得 ${JSON.stringify(r)}`)
        assert.strict.deepEqual(r.msg, 'merge slices failed', '回前端之訊息沿用既有之合併失敗字面(不含伺服器路徑)')
        assert.strict.deepEqual(calls.length, 0, '內容不符者不得交給應用端')
        assert.strict.deepEqual(fs.existsSync(path.resolve(pathUploadTemp, `${h}.done`)), false, '不得寫 .done')
        assert.strict.deepEqual(errs.some((e) => e.includes(h)), true, '失敗細節須以 error 事件通知應用端')
    })

    it('對照組: 切片內容正確時須合併成功並交出完整檔', async function() {
        let right = mk(150000, 11)
        let h = await w.getFileXxHash(new Blob([right]))
        fs.writeFileSync(path.resolve(pathUploadTemp, `${h}_0`), right)
        calls.length = 0

        let q = await push(h, 1)
        let r = await poll(q, h)
        assert.strict.deepEqual(r.state, 'success', JSON.stringify(r))
        assert.strict.deepEqual(calls, [right.length])
        assert.strict.deepEqual(fs.existsSync(path.resolve(pathUploadTemp, `${h}.done`)), true)
    })

})
