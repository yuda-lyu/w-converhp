import assert from 'assert'
import w from 'wsemi'
import WConverhpServer from '../src/WConverhpServer.mjs'


/**
 * api: parse:true 之路由(/ulctr、/dwgfn、/dw)本體解析失敗須回套件錯誤封包 + 一則事件, 與 /main 一致; 413 契約不變
 *
 * 缺陷(第十一輪 A1, A 卷實測 tmp/r11A_3_out.txt §D/§E): JSON 語法錯誤(截斷、中間層改寫)由 hapi 於路由前置階段回裸 400,
 * handler 從未執行 —— 前端收到無法解析之本體、兩端 0 則事件、client 照常重試。JSDoc 承諾「錯誤回應一律為 HTTP 200 + 錯誤封包(唯 /dwgf 例外)」未兌現;
 * /main 早於第四輪即以 parse:false 自行解碼並回 invalid request packet + 一則事件(#26), 三條 parse:true 路由為同一規則之未套站點(帳本 R6)
 */
describe('api-payloadParseFail', function() {
    this.timeout(30000)

    let port = 8623
    let wsv = null
    let errs = []

    before(async function() {
        wsv = new WConverhpServer({ port, useInert: false, pathUploadTemp: './test/_tmp/uploadTemp-api-payloadParseFail', sizeMsg: 2048 })
        wsv.on('error', (e) => errs.push(String(e)))
        wsv.on('execute', (f, i, pm) => pm.resolve(1))
        wsv.on('download', (i, pm) => pm.reject('no'))
        await w.delay(800)
    })

    after(async function() {
        await wsv.stop()
    })

    let post = async(route, body, ct = 'application/json') => {
        errs.length = 0
        let r = await fetch(`http://127.0.0.1:${port}/api/${route}`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer t', 'Content-Type': ct },
            body,
        })
        let buf = Buffer.from(await r.arrayBuffer())
        await w.delay(150)
        let o = r.headers.get('return-type') ? w.u8arr2obj(new Uint8Array(buf)) : null
        return { status: r.status, returnType: r.headers.get('return-type'), retryable: r.headers.get('return-retryable'), o, nErrs: errs.length, errs: [...errs], text: buf.toString('utf8').slice(0, 120) }
    }

    for (let route of ['ulctr', 'dwgfn', 'dw']) {
        it(`/${route} 收到截斷之 JSON 本體: 須 200 + Return-Type error + invalid request packet + 恰一則事件(修正前 hapi 裸 400、0 則)`, async function() {
            let r = await post(route, '{"mode":"check-total-hash","fileId":')
            assert.strict.deepEqual(r.status, 200, JSON.stringify(r))
            assert.strict.deepEqual(r.returnType, 'error', JSON.stringify(r))
            assert.strict.deepEqual(r.o, { error: 'invalid request packet' }, JSON.stringify(r)) //傳輸不穩, 不標示 retryable
            assert.strict.deepEqual(r.retryable, null, JSON.stringify(r))
            assert.strict.deepEqual(r.nErrs, 1, JSON.stringify(r))
            assert.strict.deepEqual(r.errs[0].startsWith('invalid request packet for '), true, r.errs[0])
        })
    }

    it('對照組: 本體超過 sizeMsg 仍須為 HTTP 413(client 據以判定不重試), 不得被解析失敗之處置改寫', async function() {
        let r = await post('ulctr', JSON.stringify({ mode: 'check-total-hash', pad: 'x'.repeat(4000) }))
        assert.strict.deepEqual(r.status, 413, JSON.stringify(r))
        assert.strict.deepEqual(r.returnType, null)
        assert.strict.deepEqual(r.nErrs, 0)
    })

    it('對照組: 合法 JSON 照常進 handler(/ulctr 之 invalid mode 為參數錯誤, 0 則事件)', async function() {
        let r = await post('ulctr', JSON.stringify({ mode: 'nope' }))
        assert.strict.deepEqual(r.status, 200)
        assert.strict.deepEqual(r.o, { error: 'invalid mode[nope] in payload', retryable: false })
        assert.strict.deepEqual(r.nErrs, 0)
    })

})
