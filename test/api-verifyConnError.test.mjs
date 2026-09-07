import assert from 'assert'
import fs from 'fs'
import w from 'wsemi'
import WConverhpServer from '../src/WConverhpServer.mjs'


/**
 * verifyConn 拋錯或 reject 時, 六個路由皆須一致回 HTTP 200 + {error:'permission denied'}
 * (修正前: 僅 /main 有 try/catch, 其餘五路由回 HTTP 500 且 body 不可解析)
 *
 * 不經 client 直接打 HTTP, 因需對 GET /dwgf 與自訂 header 精準控制
 */
describe('api-verifyConnError', function() {

    let port = 8193 //同時test故得要不同port
    let base = `http://127.0.0.1:${port}/api`
    let wsv = null

    //handled, 記錄通過授權後之 handler 事件
    let handled = []

    //errs, 記錄伺服器 error 事件
    let errs = []

    //parse, 解析本套件之 octet-stream 回應
    let parse = async(r) => {
        let bb = Buffer.from(await r.arrayBuffer())
        try {
            return w.u8arr2obj(new Uint8Array(bb))
        }
        catch (err) {
            return { unparsable: true, text: bb.toString('utf8').slice(0, 80) }
        }
    }

    //routes, 六個路由之最小合法請求
    let routes = () => {
        return [
            { name: '/main', apiType: 'main', url: `${base}/main`, method: 'POST', ct: 'application/octet-stream', body: Buffer.from(w.obj2u8arr({ func: 'ok', input: {} })) },
            { name: '/ulctr', apiType: 'upload-controller', url: `${base}/ulctr`, method: 'POST', ct: 'application/json', body: JSON.stringify({ mode: 'check-total-hash', fileHash: 'a1b2c3d4e5f60718', filename: 'a', fileSize: 1 }) },
            { name: '/slc', apiType: 'upload-slice', url: `${base}/slc`, method: 'POST', ct: 'application/octet-stream', body: Buffer.from('x'), extra: { 'chunk-index': '0', 'chunk-total': '1', 'package-id': 'a1b2c3d4e5f60718' } },
            { name: '/dwgfn', apiType: 'download-get-filename', url: `${base}/dwgfn`, method: 'POST', ct: 'application/json', body: JSON.stringify({ fileId: 'a' }) },
            { name: '/dw', apiType: 'download', url: `${base}/dw`, method: 'POST', ct: 'application/json', body: JSON.stringify({ fileId: 'a' }) },
            { name: '/dwgf', apiType: 'download-get-file', url: `${base}/dwgf?fileId=a&token=t`, method: 'GET' },
        ]
    }

    //call
    let call = async(rt, mode) => {
        let headers = {
            'Authorization': 'Bearer t',
            'x-verify-mode': mode,
            ...(rt.ct ? { 'Content-Type': rt.ct } : {}),
            ...(rt.extra || {}),
        }
        let r = await fetch(rt.url, { method: rt.method, headers, body: rt.body })
        return { status: r.status, body: await parse(r) }
    }

    before(async function() {

        wsv = new WConverhpServer({
            port,
            apiName: 'api',
            pathStaticFiles: '.',
            pathUploadTemp: './test/_tmp/uploadTemp-api-verifyConnError',
            verifyConn: async({ headers }) => {
                let mode = (headers && headers['x-verify-mode']) || '' //不可用 w.get, wsemi 無此函式, 會讓 verifyConn 一律拋錯而使測試空過
                if (mode === 'throw') {
                    throw new Error('verifyConn threw')
                }
                if (mode === 'reject') {
                    return Promise.reject(new Error('verifyConn rejected'))
                }
                return true
            },
        })
        wsv.on('execute', (func, input, pm) => pm.resolve({ ok: true }))
        wsv.on('download', (input, pm) => {
            let fp = './test/1mb.7z'
            pm.resolve({ streamRead: fs.createReadStream(fp), filename: 'x.7z', fileSize: fs.statSync(fp).size, fileType: 'application/octet-stream' })
        })
        wsv.on('handler', (d) => handled.push(d.api)) //只有通過授權才會 emit, 供對照組證明「確實放行」而非「恰好沒回 denied」
        wsv.on('error', (e) => errs.push(e))

        await w.delay(1000) //待伺服器啟動

    })

    after(function() {
        wsv.stop()
    })

    for (let mode of ['throw', 'reject']) {
        for (let rt of routes()) {
            it(`verifyConn ${mode} 時, ${rt.name} 須回 HTTP 200 + permission denied, 並 emit 一則 error 事件`, async function() {
                errs = []
                let r = await call(rt, mode)
                assert.strict.deepEqual(r.status, 200)
                assert.strict.deepEqual(r.body, { error: 'permission denied' })

                //應用端須能透過 error 事件觀察到 verifyConn 失敗, 訊息須含 apiType 與原始錯誤
                await w.delay(100) //eeEmit 為 setTimeout 發送
                assert.strict.deepEqual(errs.length, 1, JSON.stringify(errs))
                assert.strict.deepEqual(errs[0].includes(`apiType[${rt.apiType}]`), true, errs[0])
                assert.strict.deepEqual(errs[0].includes(mode === 'throw' ? 'verifyConn threw' : 'verifyConn rejected'), true, errs[0])
            })
        }
    }

    it('verifyConn 正常回 true 時, 六個路由皆須放行(對照組, 防止上列案例因 verifyConn 一律拋錯而空過)', async function() {
        handled = []
        errs = []
        for (let rt of routes()) {
            let r = await call(rt, 'ok')
            assert.strict.deepEqual(r.status, 200, rt.name)
            assert.strict.notDeepEqual((r.body || {}).error, 'permission denied', rt.name)
        }
        await w.delay(100) //eeEmit 為 setTimeout 發送
        //六個路由都須真的走到授權之後(handler 事件僅於放行後 emit), 且不得有任何 error 事件
        assert.strict.deepEqual(handled.length, 6, JSON.stringify(handled))
        assert.strict.deepEqual(errs, [])
    })

})
