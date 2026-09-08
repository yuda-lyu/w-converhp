import assert from 'assert'
import fs from 'fs'
import net from 'net'
import path from 'path'
import w from 'wsemi'
import WConverhpServer from '../src/WConverhpServer.mjs'
import WConverhpClient from '../src/WConverhpClient.mjs'


/**
 * api: /slc 切片上傳中途斷線之收尾
 *
 * .pipe() 不會因源串流出錯而關閉目的串流: 修正前每次斷線留下一個開啟中的寫入 fd(實測 5/5)與不完整切片, 且 handler 與 catch 對同一失敗各 emit 一則 error 事件。
 * fd 是否關閉不能以「檔案可否刪除」推論(libuv 於 Windows 開檔帶 FILE_SHARE_DELETE, 開啟中亦可 unlink), 故直接追蹤伺服器建立之 WriteStream 實例:
 * 伺服器以 import fs from 'fs' 取得同一單例並於請求時才查 createWriteStream, 於此置換即可攔截(mocha --parallel 下每檔獨立進程, 不影響他檔)
 */
describe('api-sliceAbort', function() {

    let port = 8211 //同時test故得要不同port
    let pathUploadTemp = './test/_tmp/uploadTemp-api-sliceAbort'
    let sizeSlice = 1024 * 1024
    let wsv = null

    //errs, 伺服器 error 事件
    let errs = []

    //tracked, 伺服器建立之 WriteStream
    let tracked = []
    let _cws = fs.createWriteStream

    before(async function() {

        fs.createWriteStream = function(...args) {
            let ws = _cws.apply(this, args)
            tracked.push({ path: String(args[0]), ws })
            return ws
        }

        wsv = new WConverhpServer({
            port,
            apiName: 'api',
            pathStaticFiles: '.',
            pathUploadTemp,
            sizeSlice,
            verifyConn: async({ authorization }) => {
                let token = w.strdelleft(authorization, 7) //刪除Bearer
                return w.isestr(token)
            },
        })
        wsv.on('execute', (func, input, pm) => {
            pm.resolve({ ok: 1 })
        })
        wsv.on('error', (e) => {
            errs.push(e)
        })
        wsv.on('handler', () => {})

        await w.delay(1000) //待伺服器啟動

    })

    after(function() {
        fs.createWriteStream = _cws
        wsv.stop()
        try {
            fs.rmSync(pathUploadTemp, { recursive: true, force: true })
        }
        catch (err) {}
    })

    //sendSlice, 以原始 socket 送切片; abort 為真時只送出 body 即斷線(宣告之 Content-Length 大於 body 長度, 即中途中斷)
    let sendSlice = ({ packageId, chunkIndex, chunkTotal, declared, body, abort }) => {
        return new Promise((resolve) => {
            let bs = []
            let sock = net.connect(port, '127.0.0.1', () => {
                sock.write(
                    `POST /api/slc HTTP/1.1\r\n` +
                    `Host: 127.0.0.1:${port}\r\n` +
                    `Authorization: Bearer token-for-test\r\n` +
                    `Content-Type: application/octet-stream\r\n` +
                    `chunk-index: ${chunkIndex}\r\n` +
                    `chunk-total: ${chunkTotal}\r\n` +
                    `package-id: ${packageId}\r\n` +
                    `Content-Length: ${declared}\r\n` +
                    `Connection: close\r\n` +
                    `\r\n`
                )
                sock.write(body)
                if (abort) {
                    setTimeout(() => {
                        sock.destroy()
                        resolve({ aborted: true })
                    }, 200)
                }
            })
            sock.on('data', (d) => bs.push(d))
            sock.on('close', () => resolve({ aborted: false, raw: Buffer.concat(bs).toString('latin1') }))
            sock.on('error', () => resolve({ aborted: true }))
        })
    }

    //stateOf
    let stateOf = (ws) => `fd=${ws.fd} closed=${ws.closed} destroyed=${ws.destroyed}`

    it('切片上傳中途斷線 5 次: 每次斷線後伺服器之寫入串流須關閉(fd 不洩漏)、不完整切片須刪除, 且每次恰發一則 error 事件', async function() {
        this.timeout(20000)
        errs = []
        tracked = []
        let packageId = 'abort0123456789ab'
        let chunkTotal = 9

        for (let i = 0; i < 5; i++) {
            await sendSlice({ packageId, chunkIndex: i, chunkTotal, declared: 500000, body: Buffer.alloc(3000, 7), abort: true })
        }
        await w.delay(1500) //待伺服器收尾(error/close 事件、fd 關閉、刪檔)

        //每次斷線恰建立一條寫入串流
        assert.strict.deepEqual(tracked.length, 5, JSON.stringify(tracked.map((t) => path.basename(t.path))))

        for (let i = 0; i < 5; i++) {
            let t = tracked[i]

            //fd 須關閉(修正前: fd 仍為數值、closed=false)
            assert.strict.deepEqual(t.ws.closed, true, `${path.basename(t.path)}: ${stateOf(t.ws)}`)
            assert.strict.deepEqual(t.ws.fd, null, `${path.basename(t.path)}: ${stateOf(t.ws)}`)

            //不完整切片須刪除(修正前: 殘留 3000 bytes)
            assert.strict.deepEqual(fs.existsSync(t.path), false, t.path)

            //每個切片恰一則 error 事件(修正前: handler 與 catch 各一則, 共兩則相同訊息)
            let ks = errs.filter((v) => typeof v === 'string' && v.indexOf(`receive chunk[${i + 1}/${chunkTotal}] of packageId[${packageId}] error`) === 0)
            assert.strict.deepEqual(ks.length, 1, JSON.stringify(errs))
        }
        assert.strict.deepEqual(errs.length, 5, JSON.stringify(errs))
    })

    it('對照組: 完整送達之切片, 寫入串流須正常關閉、檔案保留且大小正確, 不發 error 事件', async function() {
        this.timeout(20000)
        errs = []
        tracked = []
        let packageId = 'normal0123456789'
        let body = Buffer.alloc(3000, 9)

        for (let i = 0; i < 2; i++) {
            let r = await sendSlice({ packageId, chunkIndex: i, chunkTotal: 9, declared: body.length, body, abort: false })
            assert.strict.deepEqual(r.aborted, false)
            assert.strict.deepEqual(r.raw.indexOf('200 OK') > 0, true, r.raw.slice(0, 80))
        }
        await w.delay(500)

        assert.strict.deepEqual(tracked.length, 2)
        for (let t of tracked) {
            assert.strict.deepEqual(t.ws.closed, true, stateOf(t.ws))
            assert.strict.deepEqual(fs.statSync(t.path).size, body.length)
        }
        assert.strict.deepEqual(errs, [])
    })

    it('斷線後伺服器須仍可服務: execute 與後續切片上傳皆正常', async function() {
        this.timeout(20000)
        let packageId = 'after0123456789ab'
        await sendSlice({ packageId, chunkIndex: 0, chunkTotal: 2, declared: 500000, body: Buffer.alloc(3000, 7), abort: true })
        await w.delay(500)

        let wo = new WConverhpClient({ url: `http://127.0.0.1:${port}`, apiName: 'api', getToken: () => 'token-for-test', retryMain: 0 })
        wo.on('error', () => {})
        let re = await wo.execute('echo', {}, () => {})
        assert.strict.deepEqual(re, { ok: 1 })

        let body = Buffer.alloc(3000, 9)
        let r = await sendSlice({ packageId, chunkIndex: 1, chunkTotal: 2, declared: body.length, body, abort: false })
        assert.strict.deepEqual(r.aborted, false)
        assert.strict.deepEqual(r.raw.indexOf('200 OK') > 0, true, r.raw.slice(0, 80))
        assert.strict.deepEqual(fs.statSync(path.resolve(pathUploadTemp, `${packageId}_1`)).size, body.length)
    })

})
