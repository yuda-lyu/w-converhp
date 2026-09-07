import assert from 'assert'
import net from 'net'
import w from 'wsemi'
import WConverhpServer from '../src/WConverhpServer.mjs'
import WConverhpClient from '../src/WConverhpClient.mjs'


/**
 * /main(execute)之請求本體上限 opt.maxBytesMain
 *   - 真實 client(帶 Content-Length): 超限 → 'Payload Too Large', execute 事件不觸發; 未超限正常
 *   - chunked 無 Content-Length: hapi 之 maxBytes 不會預判(實測), 伺服器須自行計數 → 413
 *   - 預設值 100MB: 以宣稱 Content-Length 100MB+1 但不送本體之請求驗證(hapi 依標頭預判即 413), 不需真的配置 100MB
 */
describe('api-mainMaxBytes', function() {

    let port = 8198 //同時test故得要不同port
    let portDef = 8200 //預設值伺服器(8199 為 api-executeError 之「連線失敗」測試所用, 不可佔用)
    let LIMIT = 1024 * 1024 //測試用上限 1MB
    let wsv = null
    let wsvDef = null

    //nExec, execute 事件觸發次數
    let nExec = 0

    //mkBody, 與 client sendPkg 相同之封包
    let mkBody = (n) => {
        return Buffer.from(w.obj2u8arr({ func: 'echo', input: { u8a: new Uint8Array(n) } }))
    }

    //raw, 以 socket 自組 HTTP 請求, 回傳 {status, ms}; 標頭須以空行結束
    let raw = (p, extraHeaders, chunks) => {
        return new Promise((resolve) => {
            let t0 = Date.now()
            let buf = ''
            let done = false
            let fin = (r) => {
                if (!done) {
                    done = true
                    resolve(r)
                }
            }
            let sock = net.connect(p, '127.0.0.1', async() => {
                sock.write(`POST /api/main HTTP/1.1\r\nHost: 127.0.0.1\r\nAuthorization: Bearer t\r\nContent-Type: application/octet-stream\r\n${extraHeaders}\r\n\r\n`)
                for (let c of chunks) {
                    if (!sock.write(c)) {
                        await new Promise((resolve) => sock.once('drain', resolve))
                    }
                }
            })
            sock.on('data', (d) => {
                buf += d.toString('latin1')
                let m = /^HTTP\/1\.1 (\d+)/.exec(buf)
                if (m && buf.indexOf('\r\n\r\n') > 0) {
                    fin({ status: parseInt(m[1], 10), ms: Date.now() - t0 })
                    sock.destroy()
                }
            })
            sock.on('error', (e) => fin({ status: `ERR ${e.code}`, ms: Date.now() - t0 }))
            sock.on('close', () => fin({ status: 'CLOSED', ms: Date.now() - t0 }))
            setTimeout(() => {
                fin({ status: 'TIMEOUT', ms: Date.now() - t0 })
                sock.destroy()
            }, 30000)
        })
    }

    //toChunked, 轉為 HTTP chunked 編碼片段
    let toChunked = (b, size) => {
        let cs = []
        for (let i = 0; i < b.length; i += size) {
            let c = b.subarray(i, Math.min(i + size, b.length))
            cs.push(Buffer.concat([Buffer.from(`${c.length.toString(16)}\r\n`), c, Buffer.from('\r\n')]))
        }
        cs.push(Buffer.from('0\r\n\r\n'))
        return cs
    }

    before(async function() {
        let onExec = (func, input, pm) => {
            nExec += 1
            pm.resolve({ len: input.u8a ? input.u8a.length : 0 })
        }

        wsv = new WConverhpServer({ port, apiName: 'api', pathStaticFiles: '.', pathUploadTemp: './test/_tmp/uploadTemp-api-mainMaxBytes', maxBytesMain: LIMIT, verifyConn: async() => true })
        wsv.on('execute', onExec)
        wsv.on('error', () => {})

        wsvDef = new WConverhpServer({ port: portDef, apiName: 'api', pathStaticFiles: '.', pathUploadTemp: './test/_tmp/uploadTemp-api-mainMaxBytes-def', verifyConn: async() => true })
        wsvDef.on('execute', onExec)
        wsvDef.on('error', () => {})

        await w.delay(1000)
    })

    after(function() {
        wsv.stop()
        wsvDef.stop()
    })

    //mkClient
    let mkClient = (p) => {
        let wo = new WConverhpClient({ url: `http://127.0.0.1:${p}`, apiName: 'api', getToken: () => 't', retryMain: 0 })
        wo.on('error', () => {})
        return wo
    }

    it('未超限(500KB)之 execute 須正常', async function() {
        nExec = 0
        let r = await mkClient(port).execute('echo', { u8a: new Uint8Array(500 * 1024) }, () => {})
        assert.strict.deepEqual(r, { len: 500 * 1024 })
        assert.strict.deepEqual(nExec, 1)
    })

    it('超限(2MB)之 execute 須被拒絕為 Payload Too Large, 且 execute 事件不觸發', async function() {
        nExec = 0
        let msg = null
        try {
            await mkClient(port).execute('echo', { u8a: new Uint8Array(2 * 1024 * 1024) }, () => {})
        }
        catch (err) {
            msg = err
        }
        assert.strict.deepEqual(msg, 'Payload Too Large')
        assert.strict.deepEqual(nExec, 0)
    })

    it('chunked 無 Content-Length 之超限本體亦須回 413(hapi 不預判, 伺服器須自行計數)', async function() {
        this.timeout(20000)
        nExec = 0
        let r = await raw(port, 'Transfer-Encoding: chunked', toChunked(mkBody(2 * 1024 * 1024), 64 * 1024))
        assert.strict.deepEqual(r.status, 413, JSON.stringify(r))
        assert.strict.deepEqual(nExec, 0)
    })

    it('chunked 無 Content-Length 之未超限本體須正常', async function() {
        this.timeout(20000)
        nExec = 0
        let r = await raw(port, 'Transfer-Encoding: chunked', toChunked(mkBody(500 * 1024), 64 * 1024))
        assert.strict.deepEqual(r.status, 200, JSON.stringify(r))
        assert.strict.deepEqual(nExec, 1)
    })

    //預設值(100MB)之驗證走 chunked 無 Content-Length: 此路徑不經 hapi 標頭預判, 只由本套件之計數決定, 結果確定
    //(只送標頭不送本體之請求, hapi 不會立即預判, 不可用來驗證)

    it('未設定時預設上限須為 100MB: 50MB 之本體須被接受(不得 413)', async function() {
        this.timeout(60000)
        nExec = 0
        let r = await raw(portDef, 'Transfer-Encoding: chunked', toChunked(mkBody(50 * 1024 * 1024), 256 * 1024))
        assert.strict.deepEqual(r.status, 200, JSON.stringify(r))
        assert.strict.deepEqual(nExec, 1)
    })

    it('未設定時預設上限須為 100MB: 100MB u8a 之本體(封包必大於 100MB)須 413 且不觸發 execute', async function() {
        this.timeout(60000)
        nExec = 0
        let r = await raw(portDef, 'Transfer-Encoding: chunked', toChunked(mkBody(100 * 1024 * 1024), 256 * 1024))
        assert.strict.deepEqual(r.status, 413, JSON.stringify(r))
        assert.strict.deepEqual(nExec, 0)
    })

})
