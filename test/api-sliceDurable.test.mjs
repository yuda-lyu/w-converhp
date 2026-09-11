import assert from 'assert'
import fs from 'fs'
import path from 'path'
import w from 'wsemi'
import WConverhpServer from '../src/WConverhpServer.mjs'
import WConverhpClient from '../src/WConverhpClient.mjs'


/**
 * api: /slc 之「done」須代表切片已寫入 OS(寫入串流 close 之後), 不得於 request 本體 end 即回
 *
 * 缺陷(第十一輪 N1, tmp/probe_r11_a.mjs P1): pipe 於 request end 時只是把最後一片**交給**寫入串流, 其 fs.write 尚未完成;
 * 伺服器原於 end 即排程回 done, 慢磁碟下前端已送出 merge-slices-push, 合併讀到短切片而整個上傳以 merge slices failed 告終。
 * 預設磁碟通過只是時窗未被命中。對標: tus / S3 UploadPart 皆於資料寫入完成後才回應。
 *
 * 作法: 置換 fs.createWriteStream, 使伺服器建立之寫入串流每次 _write 延後 300ms 才真正寫入(模擬慢磁碟);
 * mocha --parallel 下每檔獨立進程, 不影響他檔。合併之寫入串流亦被延後, 故整體耗時數秒為預期
 */
describe('api-sliceDurable', function() {
    this.timeout(90000)

    let port = 8620
    let pathUploadTemp = './test/_tmp/uploadTemp-api-sliceDurable'
    let sizeSlice = 64 * 1024
    let wsv = null
    let errs = []
    let _cws = fs.createWriteStream
    let nSlow = 0

    //finalErrFor, 路徑含此字串之寫入串流於 flush 階段(所有 write 完成後之 _final)延後 80ms 才以錯誤失敗, 模擬「request 已 end、最後一批寫入才失敗」(如 ENOSPC)
    let finalErrFor = ''

    before(async function() {

        fs.createWriteStream = function(...args) {
            let ws = _cws.apply(this, args)
            let ow = ws._write.bind(ws)
            ws._write = (chunk, enc, cb) => {
                nSlow += 1
                setTimeout(() => ow(chunk, enc, cb), 300)
            }
            if (finalErrFor !== '' && String(args[0]).includes(finalErrFor)) {
                ws._final = (cb) => {
                    setTimeout(() => cb(new Error('simulated ENOSPC at flush')), 80)
                }
            }
            return ws
        }

        wsv = new WConverhpServer({
            port,
            useInert: false,
            pathUploadTemp,
            sizeSlice,
            delayForSlice: 0, //把回應延遲歸零, 使時窗完全由「是否等 close」決定
        })
        wsv.on('upload', (input, pm) => {
            pm.resolve({ size: fs.statSync(input.path).size })
        })
        wsv.on('error', (e) => errs.push(String(e)))
        await w.delay(800)

    })

    after(async function() {
        fs.createWriteStream = _cws
        await wsv.stop()
        try {
            fs.rmSync(pathUploadTemp, { recursive: true, force: true })
        }
        catch (err) {}
    })

    it('慢磁碟(每次寫入延後 300ms)下多切片上傳須成功且大小正確, 伺服器 0 則 error 事件(修正前: merge slices failed)', async function() {
        let wc = new WConverhpClient({ url: `http://127.0.0.1:${port}`, sizeSlice, retryUpload: 0 })
        let cevs = []
        wc.on('error', (e) => cevs.push(String(e)))
        let buf = Buffer.alloc(sizeSlice * 3 + 12345, 7)
        let r = await wc.upload('slow.bin', buf, () => {}).then((v) => ({ ok: v }), (e) => ({ err: String(e) }))
        assert.strict.deepEqual(r, { ok: { size: buf.length } }, JSON.stringify({ r, errs, cevs }))
        assert.strict.deepEqual(errs, [])
        assert.strict.deepEqual(cevs, [])
        assert.strict.deepEqual(nSlow > 0, true, '前提: 慢寫入確有被注入')
    })

    it('request 已 end、寫入於 flush 階段才失敗時, 須以錯誤回應且切片被清除、恰一則事件(修正前 delayForSlice 內即回 success, 內容不完整卻被當成功)', async function() {
        finalErrFor = 'finalerr01_'
        errs.length = 0
        let body = Buffer.alloc(sizeSlice, 5)
        let r = await fetch(`http://127.0.0.1:${port}/api/slc`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer t',
                'Content-Type': 'application/octet-stream',
                'chunk-index': '0',
                'chunk-total': '1',
                'package-id': 'finalerr01',
            },
            body,
        })
        finalErrFor = ''
        let o = w.u8arr2obj(new Uint8Array(await r.arrayBuffer()))
        await w.delay(200)
        assert.strict.deepEqual(r.status, 200)
        assert.strict.deepEqual(r.headers.get('return-type'), 'error', JSON.stringify(o))
        assert.strict.deepEqual(o.error, 'write chunk[1/1] of packageId[finalerr01] error')
        assert.strict.deepEqual(errs.length, 1, JSON.stringify(errs))
        assert.strict.deepEqual(errs[0].includes('simulated ENOSPC at flush'), true, errs[0])
        assert.strict.deepEqual(fs.existsSync(path.resolve(pathUploadTemp, 'finalerr01_0')), false, '失敗之切片須被清除')
    })

    it('對照組: 切片回 done 時檔案大小須已等於切片大小(直接打 /slc 後立即 stat)', async function() {
        let body = Buffer.alloc(sizeSlice, 9)
        let r = await fetch(`http://127.0.0.1:${port}/api/slc`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer t',
                'Content-Type': 'application/octet-stream',
                'chunk-index': '0',
                'chunk-total': '1',
                'package-id': 'abc123',
            },
            body,
        })
        assert.strict.deepEqual(r.status, 200)
        assert.strict.deepEqual(r.headers.get('return-type'), 'success')
        let st = fs.statSync(path.resolve(pathUploadTemp, 'abc123_0')) //回應已到, 檔案須已完整
        assert.strict.deepEqual(st.size, sizeSlice)
    })

})
