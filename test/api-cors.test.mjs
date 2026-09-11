import assert from 'assert'
import { downloadErrorStatus } from './api-axes.mjs'
import fs from 'fs'
import http from 'http'
import path from 'path'
import w from 'wsemi'
import WConverhpServer from '../src/WConverhpServer.mjs'


/**
 * api: 跨來源瀏覽器所依賴之回應標頭
 *
 * 本套件之回應協定除本體外另靠自訂標頭 Return-Type / Return-Msg / Return-Retryable 與 Content-Disposition 傳成敗、可否重試與檔名。
 * 瀏覽器對跨來源回應只讓 JS 讀 Access-Control-Expose-Headers 列出的標頭(hapi 預設僅 WWW-Authenticate,Server-Authorization),
 * 故伺服器須把自己協定用的標頭列入; 另 <a download> 之檔名只在同源 URL 生效, /dwgf 須以 RFC 6266 之 filename* 自行給檔名。
 * 瀏覽器端實際行為由 e2e-download 之跨來源案例驗證, 此處驗伺服器回應本身。
 */
describe('api-cors', function() {

    let port = 8209 //同時test故得要不同port
    let port2 = 8210 //限定來源之對照組伺服器
    let fpSrc = path.resolve('test/1mb.7z')
    let wsv = null
    let wsv2 = null

    //filenameCht, 同時含中文、空白與 RFC 5987 attr-char 以外之 ' ( ) *
    let filenameCht = `中文 it's (v2)*.7z`

    before(async function() {

        wsv = new WConverhpServer({
            port,
            apiName: 'api',
            pathStaticFiles: '.',
            pathUploadTemp: './test/_tmp/uploadTemp-api-cors',
            verifyConn: async({ authorization }) => {
                let token = w.strdelleft(authorization, 7) //刪除Bearer
                return w.isestr(token)
            },
        })
        wsv.on('execute', (func, input, pm) => {
            pm.resolve({ ok: 1 })
        })
        wsv.on('download', (input, pm) => {
            if (input.fileId === 'not-exist') {
                pm.reject('file not found')
                return
            }
            let o = {
                streamRead: fs.createReadStream(fpSrc),
                fileSize: fs.statSync(fpSrc).size,
                fileType: 'application/x-7z-compressed',
            }
            if (input.fileId !== 'noname') {
                o.filename = filenameCht
            }
            pm.resolve(o)
        })
        wsv.on('error', () => {})
        wsv.on('handler', () => {})

        //wsv2, 限定來源之對照組: corsOrigins 給明確清單, 驗曝露標頭隨 hapi 之來源比對一起輸出/一起不輸出(未被無條件寫死)
        //註: corsOrigins 為 ['*'] 時 hapi 對任何請求(含無 Origin 者)皆輸出 CORS 標頭, 故對照組不能用「無 Origin」設計
        wsv2 = new WConverhpServer({
            port: port2,
            apiName: 'api',
            pathStaticFiles: '.',
            pathUploadTemp: './test/_tmp/uploadTemp-api-cors2',
            corsOrigins: ['http://allowed.example'],
            verifyConn: async() => true,
        })
        wsv2.on('execute', (func, input, pm) => {
            pm.resolve({ ok: 1 })
        })
        wsv2.on('error', () => {})
        wsv2.on('handler', () => {})

        await w.delay(1000) //待伺服器啟動

    })

    after(function() {
        wsv.stop()
        wsv2.stop()
        for (let fd of ['./test/_tmp/uploadTemp-api-cors', './test/_tmp/uploadTemp-api-cors2']) {
            try {
                fs.rmSync(fd, { recursive: true, force: true })
            }
            catch (err) {}
        }
    })

    //req, 以原始 http 發送, 回傳狀態與標頭(本體讀完丟棄, 使連線正常結束)
    let req = (method, p, body, headers = {}, portUse = port) => {
        return new Promise((resolve, reject) => {
            let bb = body === null ? null : Buffer.from(body)
            let r = http.request({
                host: '127.0.0.1',
                port: portUse,
                path: p,
                method,
                headers: {
                    Authorization: 'Bearer token-for-test',
                    ...(bb === null ? {} : { 'Content-Type': 'application/json', 'Content-Length': bb.length }),
                    ...headers,
                },
            }, (res) => {
                res.on('data', () => {})
                res.on('end', () => resolve({ status: res.statusCode, headers: res.headers }))
            })
            r.on('error', reject)
            r.end(bb)
        })
    }

    //exposed, 解析 Access-Control-Expose-Headers 為小寫名稱陣列
    let exposed = (headers) => {
        let s = headers['access-control-expose-headers'] || ''
        return s.split(',').map((v) => v.trim().toLowerCase()).filter((v) => v !== '')
    }

    //must, 本套件協定所需之四個標頭(小寫比對, 標頭名不分大小寫)
    let must = ['return-type', 'return-msg', 'return-retryable', 'content-disposition']

    let origin = 'http://other.example'

    it('帶 Origin 之 /main 回應, Access-Control-Expose-Headers 須含 Return-Type、Return-Msg、Return-Retryable、Content-Disposition, 且保留 hapi 預設之兩項', async function() {
        let body = Buffer.from(w.obj2u8arr({ func: 'add', input: {} }))
        let r = await req('POST', '/api/main', body, { 'Origin': origin, 'Content-Type': 'application/octet-stream' })
        assert.strict.deepEqual(r.status, 200)
        assert.strict.deepEqual(r.headers['access-control-allow-origin'], origin)
        let ex = exposed(r.headers)
        for (let k of [...must, 'www-authenticate', 'server-authorization']) {
            assert.strict.deepEqual(ex.includes(k), true, `缺 ${k}, 實際: ${JSON.stringify(ex)}`)
        }
    })

    it('帶 Origin 之 /dw 錯誤回應(應用端 reject, 帶 Return-Type=error)亦須曝露同一組標頭', async function() {
        let r = await req('POST', '/api/dw', JSON.stringify({ fileId: 'not-exist' }), { Origin: origin })
        assert.strict.deepEqual(r.status, 200)
        assert.strict.deepEqual(r.headers['return-type'], 'error')
        let ex = exposed(r.headers)
        for (let k of must) {
            assert.strict.deepEqual(ex.includes(k), true, `缺 ${k}, 實際: ${JSON.stringify(ex)}`)
        }
    })

    it('帶 Origin 之 /dwgf 成功回應亦須曝露同一組標頭', async function() {
        let r = await req('GET', `/api/dwgf?fileId=cht&token=token-for-test`, null, { Origin: origin })
        assert.strict.deepEqual(r.status, 200)
        let ex = exposed(r.headers)
        for (let k of must) {
            assert.strict.deepEqual(ex.includes(k), true, `缺 ${k}, 實際: ${JSON.stringify(ex)}`)
        }
    })

    it(`/dwgf 成功回應須帶 Content-Disposition: attachment; filename*=UTF-8''<RFC 5987 編碼>, 中文、空白與 ' ( ) * 皆 percent-encoding`, async function() {
        let r = await req('GET', `/api/dwgf?fileId=cht&token=token-for-test`, null)
        assert.strict.deepEqual(r.status, 200)
        assert.strict.deepEqual(r.headers['content-type'], 'application/x-7z-compressed')
        assert.strict.deepEqual(r.headers['content-length'], String(fs.statSync(fpSrc).size))
        assert.strict.deepEqual(r.headers['content-disposition'], `attachment; filename*=UTF-8''%E4%B8%AD%E6%96%87%20it%27s%20%28v2%29%2A.7z`)
    })

    it('/dwgf 應用端未給 filename 時仍為 attachment(無 filename*), 不因此拒絕(第十一輪 N6: 下載端點不得因未給檔名而讓瀏覽器依型別改為導頁; 原本不帶標頭)', async function() {
        let r = await req('GET', `/api/dwgf?fileId=noname&token=token-for-test`, null)
        assert.strict.deepEqual(r.status, 200)
        assert.strict.deepEqual(r.headers['content-type'], 'application/x-7z-compressed')
        assert.strict.deepEqual(r.headers['content-disposition'], 'attachment')
    })

    it('/dwgf 應用端 reject 時回錯誤封包(狀態碼為非 2xx, 使瀏覽器下載管理器顯示失敗), 不帶 Content-Disposition', async function() {
        let r = await req('GET', `/api/dwgf?fileId=not-exist&token=token-for-test`, null)
        assert.strict.deepEqual(r.status, downloadErrorStatus('dwgf', 'app'))
        assert.strict.deepEqual(r.headers['return-type'], 'error')
        assert.strict.deepEqual(r.headers['content-disposition'], undefined)
    })

    it('corsOrigins 限定清單時, 清單內之 Origin 須得到 Access-Control-Allow-Origin 回顯與同一組曝露標頭', async function() {
        let body = Buffer.from(w.obj2u8arr({ func: 'add', input: {} }))
        let r = await req('POST', '/api/main', body, { 'Origin': 'http://allowed.example', 'Content-Type': 'application/octet-stream' }, port2)
        assert.strict.deepEqual(r.status, 200)
        assert.strict.deepEqual(r.headers['access-control-allow-origin'], 'http://allowed.example')
        let ex = exposed(r.headers)
        for (let k of must) {
            assert.strict.deepEqual(ex.includes(k), true, `缺 ${k}, 實際: ${JSON.stringify(ex)}`)
        }
    })

    it('corsOrigins 限定清單時, 清單外之 Origin 不得到任何 CORS 標頭(對照組, 證明曝露標頭隨來源比對輸出, 未被無條件寫死; 請求本身仍服務)', async function() {
        let body = Buffer.from(w.obj2u8arr({ func: 'add', input: {} }))
        let r = await req('POST', '/api/main', body, { 'Origin': 'http://other.example', 'Content-Type': 'application/octet-stream' }, port2)
        assert.strict.deepEqual(r.status, 200)
        assert.strict.deepEqual(r.headers['access-control-allow-origin'], undefined)
        assert.strict.deepEqual(r.headers['access-control-expose-headers'], undefined)
    })

})
