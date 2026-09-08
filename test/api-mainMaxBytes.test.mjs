import assert from 'assert'
import fs from 'fs'
import path from 'path'
import net from 'net'
import w from 'wsemi'
import WConverhpServer from '../src/WConverhpServer.mjs'
import WConverhpClient from '../src/WConverhpClient.mjs'


/**
 * 單次請求本體上限
 *   - /main(execute): opt.sizeMsg
 *     - 真實 client(帶 Content-Length): 超限 → 'Payload Too Large', execute 事件不觸發; 未超限正常
 *     - chunked 無 Content-Length: hapi 之 maxBytes 不會預判(實測), 伺服器須自行計數 → 413
 *     - 預設值 100MB: 以 chunked 50MB 接受 / 100MB u8a 拒絕驗證
 *   - /ulctr、/dwgfn、/dw(控制用 JSON, parse:true 整包進記憶體): 與 /main 共用 opt.sizeMsg
 *     - 帶 Content-Length: 超限 → 413
 *     - chunked 無 Content-Length: hapi 於讀取時計數, 超限即中斷連線(前端得 ECONNRESET 而非 413), 不會整包讀入記憶體; 本套件 client 送 JSON 一律帶 Content-Length, 不受影響
 *   - /slc(切片): 上限為 opt.sizeSlice, 等於 sizeSlice 接受; 超過 → 413 且不得留下切片檔(帶 Content-Length 由 hapi 預判, chunked 由伺服器自行計數)
 *     - 前後端 sizeSlice 不一致: upload 須於 check-total-hash 階段以明確訊息(sizeSlice mismatch)終止, 不得走到 /slc 才被 413
 *     - 切片寫入失敗(pathUploadTemp 被清): 須回錯誤而非讓伺服器行程崩潰, 伺服器後續請求須仍可服務
 */
describe('api-mainMaxBytes', function() {

    let port = 8198 //同時test故得要不同port
    let portDef = 8200 //預設值伺服器(8199 為 api-executeError 之「連線失敗」測試所用, 不可佔用)
    let LIMIT = 1024 * 1024 //測試用上限 1MB
    let SLICE = 64 * 1024 //測試用切片大小 64KB
    let pathUploadTemp = './test/_tmp/uploadTemp-api-mainMaxBytes'
    let wsv = null
    let wsvDef = null

    //nExec, execute 事件觸發次數
    let nExec = 0

    //nUpload, upload 事件觸發次數
    let nUpload = 0

    //errs, 伺服器 error 事件訊息
    let errs = []

    //mkBody, 與 client sendPkg 相同之封包
    let mkBody = (n) => {
        return Buffer.from(w.obj2u8arr({ func: 'echo', input: { u8a: new Uint8Array(n) } }))
    }

    //raw, 以 socket 自組 HTTP 請求, 回傳 {status, ms, sent}; 標頭須以空行結束; sent 為連線結束前已寫入 socket 之本體位元組數
    let raw = (p, urlPath, ct, extraHeaders, chunks) => {
        return new Promise((resolve) => {
            let t0 = Date.now()
            let buf = ''
            let done = false
            let sent = 0
            let fin = (r) => {
                if (!done) {
                    done = true
                    resolve({ ...r, sent })
                }
            }
            let sock = net.connect(p, '127.0.0.1', async() => {
                sock.write(`POST ${urlPath} HTTP/1.1\r\nHost: 127.0.0.1\r\nAuthorization: Bearer t\r\nContent-Type: ${ct}\r\n${extraHeaders}\r\n\r\n`)
                for (let c of chunks) {
                    if (done) {
                        break
                    }
                    sent += c.length
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

        wsv = new WConverhpServer({ port, apiName: 'api', pathStaticFiles: '.', pathUploadTemp, sizeMsg: LIMIT, sizeSlice: SLICE, verifyConn: async() => true })
        wsv.on('execute', onExec)
        wsv.on('upload', (input, pm) => {
            nUpload += 1
            pm.resolve('ok')
        })
        wsv.on('error', (err) => {
            errs.push(err)
        })

        wsvDef = new WConverhpServer({ port: portDef, apiName: 'api', pathStaticFiles: '.', pathUploadTemp: './test/_tmp/uploadTemp-api-mainMaxBytes-def', verifyConn: async() => true })
        wsvDef.on('execute', onExec)
        wsvDef.on('error', () => {})

        await w.delay(1000)
    })

    after(function() {
        wsv.stop()
        wsvDef.stop()
        try {
            fs.rmSync(pathUploadTemp, { recursive: true, force: true }) //清除本測試之切片暫存資料夾
            fs.rmSync(`${pathUploadTemp}-def`, { recursive: true, force: true })
        }
        catch (err) {}
    })

    //mkClient
    let mkClient = (p, opt = {}) => {
        let wo = new WConverhpClient({ url: `http://127.0.0.1:${p}`, apiName: 'api', getToken: () => 't', retryMain: 0, retryUpload: 0, ...opt })
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
        let r = await raw(port, '/api/main', 'application/octet-stream', 'Transfer-Encoding: chunked', toChunked(mkBody(2 * 1024 * 1024), 64 * 1024))
        assert.strict.deepEqual(r.status, 413, JSON.stringify(r))
        assert.strict.deepEqual(nExec, 0)
    })

    it('chunked 無 Content-Length 之未超限本體須正常', async function() {
        this.timeout(20000)
        nExec = 0
        let r = await raw(port, '/api/main', 'application/octet-stream', 'Transfer-Encoding: chunked', toChunked(mkBody(500 * 1024), 64 * 1024))
        assert.strict.deepEqual(r.status, 200, JSON.stringify(r))
        assert.strict.deepEqual(nExec, 1)
    })

    //預設值(100MB)之驗證走 chunked 無 Content-Length: 此路徑不經 hapi 標頭預判, 只由本套件之計數決定, 結果確定
    //(只送標頭不送本體之請求, hapi 不會立即預判, 不可用來驗證)

    it('未設定時預設上限須為 100MB: 50MB 之本體須被接受(不得 413)', async function() {
        this.timeout(60000)
        nExec = 0
        let r = await raw(portDef, '/api/main', 'application/octet-stream', 'Transfer-Encoding: chunked', toChunked(mkBody(50 * 1024 * 1024), 256 * 1024))
        assert.strict.deepEqual(r.status, 200, JSON.stringify(r))
        assert.strict.deepEqual(nExec, 1)
    })

    it('未設定時預設上限須為 100MB: 100MB u8a 之本體(封包必大於 100MB)須 413 且不觸發 execute', async function() {
        this.timeout(60000)
        nExec = 0
        let r = await raw(portDef, '/api/main', 'application/octet-stream', 'Transfer-Encoding: chunked', toChunked(mkBody(100 * 1024 * 1024), 256 * 1024))
        assert.strict.deepEqual(r.status, 413, JSON.stringify(r))
        assert.strict.deepEqual(nExec, 0)
    })

    //mkJson, 帶 Content-Length 之 JSON 本體, 以 pad 撐到指定大小
    let mkJson = (obj, n) => {
        let s = JSON.stringify(obj)
        let pad = 'x'.repeat(Math.max(n - s.length - 12, 0))
        let b = Buffer.from(JSON.stringify({ ...obj, pad }))
        return { hd: `Content-Length: ${b.length}`, chunks: [b] }
    }

    it('/dw 之 JSON 本體超過 sizeMsg 須 413', async function() {
        let { hd, chunks } = mkJson({ fileId: 'a' }, 2 * 1024 * 1024)
        let r = await raw(port, '/api/dw', 'application/json', hd, chunks)
        assert.strict.deepEqual(r.status, 413, JSON.stringify(r))
    })

    it('/dwgfn 之 JSON 本體超過 sizeMsg 須 413', async function() {
        let { hd, chunks } = mkJson({ fileId: 'a' }, 2 * 1024 * 1024)
        let r = await raw(port, '/api/dwgfn', 'application/json', hd, chunks)
        assert.strict.deepEqual(r.status, 413, JSON.stringify(r))
    })

    it('/ulctr 之 JSON 本體超過 sizeMsg 須 413; 未超限(500KB 之切片雜湊清單)須被接受', async function() {
        let fileSliceHashs = []
        for (let i = 0; i < 15000; i++) { //每筆約34byte, 15000筆約500KB
            fileSliceHashs.push({ i, h: '0123456789abcdef' })
        }
        let body = Buffer.from(JSON.stringify({ mode: 'check-slices-hash', fileHash: 'a1b2c3d4e5f60718', fileSliceHashs }))
        assert.strict.deepEqual(body.length > 400 * 1024 && body.length < LIMIT, true, `body.length[${body.length}]`)
        let r1 = await raw(port, '/api/ulctr', 'application/json', `Content-Length: ${body.length}`, [body])
        assert.strict.deepEqual(r1.status, 200, JSON.stringify(r1))

        let { hd, chunks } = mkJson({ mode: 'check-total-hash', fileHash: 'a1b2c3d4e5f60718' }, 2 * 1024 * 1024)
        let r2 = await raw(port, '/api/ulctr', 'application/json', hd, chunks)
        assert.strict.deepEqual(r2.status, 413, JSON.stringify(r2))
    })

    it('/ulctr chunked 無 Content-Length 之超限本體須被拒絕(hapi 讀取時計數超限即中斷連線, 前端得 ECONNRESET 而非 413), 且不得整包讀入', async function() {
        this.timeout(20000)
        let body = Buffer.from(JSON.stringify({ mode: 'check-total-hash', fileHash: 'a1b2c3d4e5f60718', pad: 'x'.repeat(8 * 1024 * 1024) }))
        let r = await raw(port, '/api/ulctr', 'application/json', 'Transfer-Encoding: chunked', toChunked(body, 64 * 1024))
        assert.strict.deepEqual(r.status !== 200 && r.status !== 'TIMEOUT', true, JSON.stringify(r))
        assert.strict.deepEqual(r.sent < body.length, true, `sent[${r.sent}] should be less than body[${body.length}]: ${JSON.stringify(r)}`)
    })

    it('前後端 sizeSlice 一致(64KB)時 300KB 之 upload 須成功並觸發 upload 事件', async function() {
        this.timeout(20000)
        nUpload = 0
        let r = await mkClient(port, { sizeSlice: SLICE }).upload('same.bin', new Uint8Array(300 * 1024), () => {})
        assert.strict.deepEqual(r, 'ok')
        assert.strict.deepEqual(nUpload, 1)
    })

    it('前後端 sizeSlice 不一致(前端 256KB, 伺服器 64KB)時 upload 須以 sizeSlice mismatch 訊息終止, 且不觸發 upload 事件', async function() {
        this.timeout(20000)
        nUpload = 0
        let msg = null
        try {
            await mkClient(port, { sizeSlice: 4 * SLICE }).upload('diff.bin', new Uint8Array(300 * 1024).fill(1), () => {}) //內容須異於上一測試, 否則雜湊相同, 伺服器已有合併完成之檔案會直接視為已上傳
        }
        catch (err) {
            msg = err
        }
        assert.strict.deepEqual(msg, `sizeSlice mismatch: client[${4 * SLICE}] and server[${SLICE}] must be equal`)
        assert.strict.deepEqual(nUpload, 0)
    })

    //slcHeaders, 切片路由所需標頭
    let slcHeaders = (pkg, extra) => {
        return `chunk-index: 0\r\nchunk-total: 1\r\npackage-id: ${pkg}\r\n${extra}`
    }

    it('/slc 切片等於 sizeSlice 須被接受並落地', async function() {
        let pkg = 'slcok'
        let fp = path.resolve(pathUploadTemp, `${pkg}_0`)
        let b = Buffer.alloc(SLICE, 7)
        let r = await raw(port, '/api/slc', 'application/octet-stream', slcHeaders(pkg, `Content-Length: ${b.length}`), [b])
        assert.strict.deepEqual(r.status, 200, JSON.stringify(r))
        await w.delay(300)
        assert.strict.deepEqual(fs.existsSync(fp), true)
        assert.strict.deepEqual(fs.statSync(fp).size, SLICE)
    })

    it('/slc 帶 Content-Length 之切片超過 sizeSlice 須 413 且不得留下切片檔', async function() {
        let pkg = 'slccl'
        let fp = path.resolve(pathUploadTemp, `${pkg}_0`)
        let b = Buffer.alloc(SLICE + 1, 7)
        let r = await raw(port, '/api/slc', 'application/octet-stream', slcHeaders(pkg, `Content-Length: ${b.length}`), [b])
        assert.strict.deepEqual(r.status, 413, JSON.stringify(r))
        await w.delay(300)
        assert.strict.deepEqual(fs.existsSync(fp), false)
    })

    it('/slc chunked 無 Content-Length 之切片超過 sizeSlice 亦須 413 且不得留下切片檔(伺服器須自行計數)', async function() {
        let pkg = 'slcch'
        let fp = path.resolve(pathUploadTemp, `${pkg}_0`)
        let b = Buffer.alloc(SLICE * 4, 7)
        let r = await raw(port, '/api/slc', 'application/octet-stream', slcHeaders(pkg, 'Transfer-Encoding: chunked'), toChunked(b, 16 * 1024))
        assert.strict.deepEqual(r.status, 413, JSON.stringify(r))
        await w.delay(300)
        assert.strict.deepEqual(fs.existsSync(fp), false)
    })

    //須為本檔最後一個測試: 會移除 pathUploadTemp, 結束時再重建
    it('/slc 切片寫入失敗(pathUploadTemp 被清)時須回應且發出 error 事件, 伺服器行程不得崩潰, 後續 execute 須仍可服務', async function() {
        this.timeout(20000)
        errs = []
        nExec = 0
        fs.rmSync(pathUploadTemp, { recursive: true, force: true })
        let b = Buffer.alloc(1024, 7)
        let r = await raw(port, '/api/slc', 'application/octet-stream', slcHeaders('slcwe', `Content-Length: ${b.length}`), [b])
        assert.strict.deepEqual(r.status, 200, JSON.stringify(r)) //錯誤以本套件之 error 封包回傳, HTTP 狀態仍為 200
        await w.delay(300)
        let ks = errs.filter((v) => typeof v === 'string' && v.indexOf('write chunk[1/1] of packageId[slcwe] error') === 0)
        assert.strict.deepEqual(ks.length, 1, JSON.stringify(errs)) //恰一則: 於 streamWrite error 中 emit(含 err.message); 修正前 handler 之 catch 再 emit 一則不含細節者, 同一失敗兩則
        assert.strict.deepEqual(ks[0].indexOf('error: ') > 0, true, ks[0]) //保留的是含底層訊息那則
        let re = await mkClient(port).execute('echo', { u8a: new Uint8Array(1024) }, () => {})
        assert.strict.deepEqual(re, { len: 1024 })
        assert.strict.deepEqual(nExec, 1)
        fs.mkdirSync(pathUploadTemp, { recursive: true })
    })

})
