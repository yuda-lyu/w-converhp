/* eslint-disable no-new-wrappers */ //W-20 之案刻意以 new String / new Number / new Boolean 建構包裝物件
import assert from 'assert'
import fs from 'fs'
import w from 'wsemi'
import WConverhpServer from '../src/WConverhpServer.mjs'
import WConverhpClient from '../src/WConverhpClient.mjs'
import axes from './tools/api-axes.mjs'
import wPorts from './tools/ports.mjs'

let { portOf } = wPorts

let { downloadRoutes, downloadRouteKeys, downloadRouteKeysByStage, downloadErrorStatus, fetchDownload } = axes


/**
 * api: 應用端與呼叫端交出之不可讀值(已撤銷之 Proxy、拋錯之 Symbol.toStringTag、get 陷阱拋錯之 Proxy)須走原失敗通道(帳本 R32)
 *
 * 起因: wsemi 1.9.69 起判斷函數(isobj、isfun、isestr 等)對不可讀之值回 false 而不拋錯(判斷函數回布林), 並只收原始值(包裝物件為 false, W-20)。
 * 本套件原有數個防線借判斷函數之拋錯而成立; 判定不再拋錯後, 不可讀之值被當成「一般之無效值」或「無特徵之物件」續行:
 *   站點 A1 伺服端 encodeOut(回應封包之序列化)          —— 序列化器不再因判斷函數拋錯而回 error, 拋錯之 Symbol.toStringTag 被序列化為可見之鍵
 *   站點 A2 managerMergeSlices 之 consume(合併消費結果落地)—— 同上, 且失真之結果被落地成已儲存之結果
 *   站點 A3 前端 sendPkg(execute 之請求封包)              —— 同上, 伺服器收到失真之 input
 *   站點 A4 伺服端 validDownloadField(下載欄位之判定)      —— 選用之 filename 為不可讀值時被當成「未給」而靜默略過(必要欄位之事件失去原因)
 *   站點 A5 伺服端 buildDownloadSource / hasPipe(串流之辨識)—— 不可讀之 streamRead 或其 pipe 被當成「無特徵之物件」走 JSON 具體化
 * 本檔之軸為「不可讀形狀 × 注入點」, 對每一格斷言: 走原失敗通道(錯誤封包、恰一則事件、不懸置), 不被當成成功。
 * 另鎖 W-20(包裝物件視同非該型別之值)與「建構選項為不可讀值時不拋錯」。
 *
 * 既有 test/api-hostileErrorValues.test.mjs 鎖 verifyConn 與監聽器之拋出、頂層拒絕值(其 2 案為本輪之觸發); 本檔補其餘注入點與巢狀。
 */
describe('api-hostileValueProbe', function() {

    let port = portOf('api-hostileValueProbe', 0)
    let portOpt = portOf('api-hostileValueProbe', 1) //依序起停之選項伺服器(await stop 後同埠重用)
    let pathUploadTemp = './test/_tmp/uploadTemp-api-hostileValueProbe'
    let pathUploadTempOpt = './test/_tmp/uploadTemp-api-hostileValueProbe-opt'
    let url = `http://127.0.0.1:${port}`
    let wsv = null
    let errs = []
    let nExec = 0
    let st = { dw: null, exec: null, up: null }

    //shapes, 不可讀之形狀(每次新建); 皆於讀其型別標籤時即拋錯
    let shapes = {
        '已撤銷之 Proxy': () => {
            let r = Proxy.revocable({}, {})
            r.revoke()
            return r.proxy
        },
        '已撤銷之函數 Proxy': () => {
            let r = Proxy.revocable(function() {}, {})
            r.revoke()
            return r.proxy
        },
        '拋錯之 Symbol.toStringTag': () => {
            let o = { a: 1 }
            Object.defineProperty(o, Symbol.toStringTag, {
                get() {
                    throw new Error('toStringTag boom')
                },
            })
            return o
        },
        'get 陷阱拋錯之 Proxy': () => new Proxy({}, {
            get() {
                throw new Error('get boom')
            },
        }),
    }
    let shapeKeys = Object.keys(shapes)

    let goodOut = () => ({ streamRead: Buffer.from('hello'), filename: 'a.txt', fileSize: 5, fileType: 'text/plain' })

    before(async function() {
        this.timeout(20000)

        wsv = new WConverhpServer({
            port,
            apiName: 'api',
            useInert: false,
            pathUploadTemp,
        })
        wsv.on('execute', (func, input, pm) => {
            nExec += 1
            st.exec(func, input, pm)
        })
        wsv.on('upload', (input, pm) => {
            st.up(input, pm)
        })
        wsv.on('download', (input, pm) => {
            st.dw(input, pm)
        })
        wsv.on('error', (e) => errs.push(String(e)))
        wsv.on('handler', () => {})

        await wsv.ready //待伺服器就緒(ready)

    })

    after(async function() {
        await wsv.stop()
        for (let fd of [pathUploadTemp, pathUploadTempOpt]) {
            try {
                fs.rmSync(fd, { recursive: true, force: true })
            }
            catch (err) {}
        }
    })

    beforeEach(function() {
        errs = []
        st.exec = (func, input, pm) => pm.resolve({ ok: 1 })
        st.dw = (input, pm) => pm.resolve(goodOut())
        st.up = (input, pm) => pm.resolve({ got: input.from })
    })

    //dl, 打下載路由並收事件(事件於回應前同步派發, settleMs 僅供否定觀察)
    let dl = async(route) => {
        errs = []
        let r = await fetchDownload(port, route, 'f1', { timeoutMs: 4000, settleMs: 80 })
        return { ...r, nErrs: errs.length, errs: [...errs] }
    }

    //postMain, 以本套件之封包直打 /main(不經 client), 取回 HTTP 狀態、Return-Type 與解析後之本體
    let postMain = async() => {
        errs = []
        let r = await fetch(`${url}/api/main`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer t', 'Content-Type': 'application/octet-stream' },
            body: Buffer.from(w.obj2u8arr({ func: 'hostile', input: {} })),
        })
        let status = r.status
        let returnType = r.headers.get('return-type')
        let u8a = new Uint8Array(Buffer.from(await r.arrayBuffer()))
        let data = w.u8arr2obj(u8a, { returnWithStateAndMsg: true })
        await w.delay(80)
        return { status, returnType, data, nErrs: errs.length, errs: [...errs] }
    }

    let mkClient = (opt = {}) => {
        let evs = []
        let wo = new WConverhpClient({ url, apiName: 'api', getToken: () => 't', retryMain: 0, retryUpload: 0, retryDownload: 0, ...opt })
        wo.on('error', (e) => evs.push(e))
        return { wo, evs }
    }

    describe('A4 下載欄位(filename、fileSize、fileType)為不可讀值: 一律錯誤封包 + 恰一則事件且帶原因, 含選用之 filename(修正前 /dwgf 之 filename 被當成未給而回成功)', function() {

        for (let route of downloadRouteKeys()) {
            let fields = downloadRoutes[route].fields.filter((f) => f !== 'streamRead')
            for (let field of fields) {
                for (let sk of shapeKeys) {
                    it(`${route} / ${field}(${downloadRoutes[route].requiredFields.includes(field) ? '必要' : '選用'}) / ${sk}`, async function() {
                        this.timeout(20000)
                        st.dw = (input, pm) => {
                            let o = goodOut()
                            o[field] = shapes[sk]()
                            pm.resolve(o)
                        }
                        let r = await dl(route)
                        let tag = JSON.stringify({ route, field, sk, r })
                        assert.strict.deepEqual(r.hang, undefined, `${tag} —— 不得懸置`)
                        assert.strict.deepEqual(r.status, downloadErrorStatus(route, 'output'), tag)
                        assert.strict.deepEqual(r.returnType, 'error', tag) //不得被當成成功(含選用欄位)
                        assert.strict.deepEqual(r.error, `invalid ${field}`, tag)
                        assert.strict.deepEqual(r.nErrs, 1, tag) //帳本 R5: 一次失敗恰一則
                        assert.strict.deepEqual(new RegExp(`output error: invalid ${field}(\\[[^\\]]*\\])?: \\S+`).test(r.errs[0]), true, `事件須帶原因(判定時拋錯者): ${tag}`)
                    })
                }
            }
        }

    })

    describe('A5 streamRead 為不可讀值或其 pipe 為不可讀值: 錯誤封包 invalid streamRead + 恰一則事件, 不得走 JSON 具體化(修正前 Symbol.toStringTag 拋錯者被序列化為其可見之鍵)', function() {

        for (let route of downloadRouteKeysByStage('materialize')) {
            for (let sk of shapeKeys) {
                it(`${route} / streamRead 本身 / ${sk}`, async function() {
                    this.timeout(20000)
                    st.dw = (input, pm) => {
                        let o = goodOut()
                        o.streamRead = shapes[sk]()
                        pm.resolve(o)
                    }
                    let r = await dl(route)
                    let tag = JSON.stringify({ route, sk, r })
                    assert.strict.deepEqual(r.hang, undefined, tag)
                    assert.strict.deepEqual(r.status, downloadErrorStatus(route, 'output'), tag)
                    assert.strict.deepEqual(r.returnType, 'error', tag)
                    assert.strict.deepEqual(r.error, 'invalid streamRead', tag)
                    assert.strict.deepEqual(r.nErrs, 1, tag)
                    //已撤銷之 Proxy 於辨識階段(instanceof 觸發 getPrototypeOf 陷阱)即失敗, 其餘於具體化階段(帳本 R32 之探針)失敗
                    assert.strict.deepEqual(/(identify|materialize) streamRead failed: \S+/.test(r.errs[0]), true, tag)
                })

                it(`${route} / streamRead.pipe 為 ${sk}(判定失敗, 不得當成「確定不像串流」而具體化)`, async function() {
                    this.timeout(20000)
                    st.dw = (input, pm) => {
                        let o = goodOut()
                        o.streamRead = { pipe: shapes[sk]() }
                        pm.resolve(o)
                    }
                    let r = await dl(route)
                    let tag = JSON.stringify({ route, sk, r })
                    assert.strict.deepEqual(r.hang, undefined, tag)
                    assert.strict.deepEqual(r.status, downloadErrorStatus(route, 'output'), tag)
                    assert.strict.deepEqual(r.returnType, 'error', tag)
                    assert.strict.deepEqual(r.error, 'invalid streamRead', tag)
                    assert.strict.deepEqual(r.nErrs, 1, tag)
                    assert.strict.deepEqual(r.errs[0].includes('streamRead must be a readable stream'), true, tag)
                })
            }
        }

    })

    describe('A1 伺服端回應封包: 應用端以不可讀值 resolve 或 reject(頂層與巢狀)須為 output can not be serialized + 恰一則事件', function() {

        let mkOwnKeys = () => new Proxy({ a: 1 }, {
            ownKeys() {
                throw new Error('ownKeys boom')
            },
        })
        let all = { ...shapes, 'ownKeys 陷阱拋錯之 Proxy': mkOwnKeys }

        //頂層之兩種先於序列化即定案之既有語意(與 wsemi 版本無關; 差分探測舊版 1.9.68 與現版逐格相同, 非本規則之範圍, 於此明列以免誤判為缺口):
        //  resolve 頂層 + 讀 then 即拋錯者(已撤銷之 Proxy、get 陷阱拋錯之 Proxy): Promise 之 resolve 程序自身讀 then 而以該 TypeError 拒絕 → 錯誤封包(內容為該錯誤之文字), 不經序列化
        //  reject 頂層 + 函數型別者(含已撤銷之函數 Proxy, typeof 為 function): canonProtocolValue 正規化為 null(帳本 R6 之協定鍵正規化)
        let nativeReject = ['已撤銷之 Proxy', '已撤銷之函數 Proxy', 'get 陷阱拋錯之 Proxy']

        for (let [sk, f] of Object.entries(all)) {
            for (let mode of ['resolve', 'reject']) {
                for (let nest of [false, true]) {
                    let bNative = mode === 'resolve' && !nest && nativeReject.includes(sk)
                    let bFunNull = mode === 'reject' && !nest && sk === '已撤銷之函數 Proxy'
                    let title = bNative ? '(既有語意: Promise 之 resolve 程序讀 then 即拋錯 → 錯誤封包, 不經序列化)' : (bFunNull ? '(既有語意: 函數型別之拒絕值正規化為 null)' : '')
                    it(`${mode} / ${nest ? '巢狀於物件內' : '頂層'} / ${sk}${title}`, async function() {
                        this.timeout(20000)
                        st.exec = (func, input, pm) => {
                            let v = nest ? { x: 1, list: [{ n: f() }] } : f()
                            if (mode === 'resolve') {
                                pm.resolve(v)
                            }
                            else {
                                pm.reject(v)
                            }
                        }
                        let r = await postMain()
                        let tag = JSON.stringify({ status: r.status, returnType: r.returnType, msg: r.data.msg, errs: r.errs })
                        assert.strict.deepEqual(r.status, 200, tag)
                        assert.strict.deepEqual(r.returnType, 'error', tag) //不得宣稱成功
                        if (bNative) {
                            assert.strict.deepEqual(typeof r.data.msg.error === 'string' && r.data.msg.error.length > 0, true, tag)
                            return
                        }
                        if (bFunNull) {
                            assert.strict.deepEqual(r.data.msg.error, null, tag)
                            return
                        }
                        assert.strict.deepEqual(r.data.msg.error, 'output can not be serialized', tag)
                        assert.strict.deepEqual(r.nErrs, 1, tag)
                        assert.strict.deepEqual(r.errs[0].includes('output can not be serialized'), true, tag)
                    })
                }
            }
        }

        it('對照: 只壞 has 陷阱之 Proxy 為可讀, 照常序列化(帳本 R32 定義: 探針不讀 has; 舊版 wsemi 對此亦照常序列化)', async function() {
            this.timeout(20000)
            st.exec = (func, input, pm) => pm.resolve(new Proxy({ a: 1 }, {
                has() {
                    throw new Error('has boom')
                },
            }))
            let r = await postMain()
            assert.strict.deepEqual(r.returnType, 'success', JSON.stringify(r.data))
            assert.strict.deepEqual(r.data.msg.success.output, { a: 1 })
            assert.strict.deepEqual(r.nErrs, 0)
        })

        it('對照: 一般值(含巢狀陣列、物件、二進位)不受探針影響', async function() {
            this.timeout(20000)
            st.exec = (func, input, pm) => pm.resolve({ a: [1, { b: 'x' }], u: new Uint8Array([1, 2, 3]), d: null })
            let r = await postMain()
            assert.strict.deepEqual(r.returnType, 'success', JSON.stringify(r.data))
            assert.strict.deepEqual(r.data.msg.success.output.a, [1, { b: 'x' }])
            assert.strict.deepEqual(Array.from(r.data.msg.success.output.u), [1, 2, 3])
            assert.strict.deepEqual(r.nErrs, 0)
        })

    })

    describe('A2 上傳合併消費: 應用端以不可讀值 resolve(頂層與巢狀)時前端每次嘗試收到 output can not be serialized、伺服器每次一則、不落地失真之結果; 其後接受即完成', function() {

        for (let sk of shapeKeys) {
            for (let nest of [false, true]) {
                //頂層 resolve 且讀 then 即拋錯者(已撤銷之 Proxy、get 陷阱拋錯之 Proxy)為 Promise 之 resolve 程序自身之拒絕(既有語意, 見 A1), 該次嘗試之事件為原生錯誤之文字而非 output can not be serialized, 不屬本規則; 只測巢狀
                if (!nest && sk !== '拋錯之 Symbol.toStringTag') {
                    continue
                }
                it(`${nest ? '巢狀' : '頂層'} / ${sk}`, async function() {
                    this.timeout(60000)
                    let n = 0
                    st.up = (input, pm) => {
                        n += 1
                        if (n === 1) {
                            pm.resolve(nest ? { x: 1, n: shapes[sk]() } : shapes[sk]())
                            return
                        }
                        pm.resolve({ got: n })
                    }
                    let { wo, evs } = mkClient()
                    let b = Buffer.from(`hostile-upload-probe-${sk}-${nest}-${'x'.repeat(100)}`)
                    let r = await wo.upload(`probe-${shapeKeys.indexOf(sk)}-${nest}.bin`, b, undefined, { signal: AbortSignal.timeout(30000) }).then((v) => ({ ok: true, v }), (e) => ({ ok: false, e }))
                    let tag = `${sk}: ${JSON.stringify(r)} evs=${JSON.stringify(evs)} errs=${JSON.stringify(errs)}`
                    //第 1 次消費之結果不可序列化 → 該次嘗試失敗(一則), 且不落地; 輪詢重送 → 重新消費(S2)→ 第 2 次接受
                    assert.strict.deepEqual(r, { ok: true, v: { got: 2 } }, tag)
                    assert.strict.deepEqual(evs, ['output can not be serialized'], tag)
                    assert.strict.deepEqual(errs.filter((x) => x.includes('output can not be serialized')).length, 1, tag)
                    assert.strict.deepEqual(n, 2, tag)
                })
            }
        }

    })

    describe('A3 前端 execute: func 或 input(頂層、巢狀)含不可讀值時入口即拒絕(input can not be serialized: unreadable value)、一則 error 事件、不送出(伺服器之 execute 事件 0 次)', function() {

        let places = {
            'input 頂層': (f) => ['fn', f()],
            'input 巢狀': (f) => ['fn', { a: 1, list: [{ n: f() }] }],
            'func': (f) => [f(), { a: 1 }],
        }
        for (let sk of shapeKeys) {
            for (let [pk, pf] of Object.entries(places)) {
                it(`${pk} / ${sk}`, async function() {
                    this.timeout(20000)
                    let { wo, evs } = mkClient()
                    let n0 = nExec
                    let r = await wo.execute(...pf(shapes[sk])).then((v) => ({ ok: true, v }), (e) => ({ ok: false, e }))
                    await w.delay(60)
                    let tag = `${sk} @ ${pk}: ${JSON.stringify(r)} evs=${JSON.stringify(evs)}`
                    assert.strict.deepEqual(r.ok, false, tag)
                    assert.strict.deepEqual(typeof r.e === 'string' && r.e.startsWith('input can not be serialized: unreadable value: '), true, tag)
                    assert.strict.deepEqual(evs, [r.e], tag) //恰一則, 與拒絕值同字面
                    assert.strict.deepEqual(nExec - n0, 0, `${tag} —— 不得送出`)
                })
            }
        }

        it('對照: 一般 input 照常送出並取得結果', async function() {
            this.timeout(20000)
            let { wo, evs } = mkClient()
            let r = await wo.execute('fn', { a: [1, 2, { b: 3 }], u: new Uint8Array([1, 2]) })
            assert.strict.deepEqual(r, { ok: 1 })
            assert.strict.deepEqual(evs, [])
        })

    })

    describe('W-20 包裝物件(new String、new Number、new Boolean)視同非該型別之值(wsemi 1.9.69 之判斷函數只收原始值)', function() {

        //下載欄位: 必要者為 invalid; 選用之 /dwgf filename 視為未給(成功, 無 filename*)
        for (let route of downloadRouteKeys()) {
            let wraps = {
                filename: () => new String('a.txt'),
                fileType: () => new String('text/plain'),
                fileSize: () => new Number(5),
            }
            for (let [field, f] of Object.entries(wraps)) {
                if (!downloadRoutes[route].fields.includes(field)) {
                    continue
                }
                let bRequired = downloadRoutes[route].requiredFields.includes(field)
                it(`${route} / ${field} 為包裝物件 → ${bRequired ? 'invalid ' + field + '(必要欄位)' : '視為未給, 回成功且不帶 filename*(選用欄位)'}`, async function() {
                    this.timeout(20000)
                    st.dw = (input, pm) => {
                        let o = goodOut()
                        o[field] = f()
                        pm.resolve(o)
                    }
                    let r = await dl(route)
                    let tag = JSON.stringify({ route, field, r })
                    if (bRequired) {
                        assert.strict.deepEqual(r.returnType, 'error', tag)
                        assert.strict.deepEqual(r.error, `invalid ${field}`, tag)
                        assert.strict.deepEqual(r.nErrs, 1, tag)
                    }
                    else {
                        assert.strict.deepEqual(r.status, 200, tag)
                        assert.strict.deepEqual(r.returnType, null, tag)
                        assert.strict.deepEqual(r.contentDisposition, 'attachment', tag)
                        assert.strict.deepEqual(r.nErrs, 0, tag)
                    }
                })
            }
        }

        //streamRead 為 String 包裝物件: 不視為字串(不取其原始值), 依物件走 JSON 具體化 → '"abc"' 為 5 位元組, 與 fileSize 3 不符
        for (let route of downloadRouteKeysByStage('materialize')) {
            it(`${route} / streamRead 為 new String('abc') 且 fileSize 為 3 → fileSize mismatch(若被當成字串取原始值則為 3 位元組而成功)`, async function() {
                this.timeout(20000)
                st.dw = (input, pm) => {
                    let o = goodOut()
                    o.streamRead = new String('abc')
                    o.fileSize = 3
                    pm.resolve(o)
                }
                let r = await dl(route)
                let tag = JSON.stringify({ route, r })
                assert.strict.deepEqual(r.returnType, 'error', tag)
                assert.strict.deepEqual(r.error, 'fileSize mismatch', tag)
                assert.strict.deepEqual(r.nErrs, 1, tag)
            })
        }

        it('前端: apiName 為包裝物件時視為未給而用預設 api(其餘無效值之同一處置)', async function() {
            this.timeout(20000)
            let { wo, evs } = mkClient({ apiName: new String('zzz') })
            let r = await wo.execute('fn', { a: 1 })
            assert.strict.deepEqual(r, { ok: 1 })
            assert.strict.deepEqual(evs, [])
        })

        it('前端: download 之 opt.fdDownload 為包裝物件 → 入口拒絕 invalid fdDownload 並發一則事件(不進請求)', async function() {
            this.timeout(20000)
            let { wo, evs } = mkClient()
            let r = await wo.download('f1', undefined, { fdDownload: new String('./test/_tmp') }).then((v) => ({ ok: true, v }), (e) => ({ ok: false, e }))
            assert.strict.deepEqual(r, { ok: false, e: 'invalid fdDownload for download in nodejs' })
            assert.strict.deepEqual(evs, ['invalid fdDownload for download in nodejs'])
        })

    })

    describe('建構選項為不可讀值: 建構子不拋錯, 依「無效值」之既有契約處置(帳本 R11、R26; 修正前判斷函數拋錯使建構子拋出)', function() {

        let optShapes = {
            ...shapes,
            'has 陷阱拋錯之 Proxy': () => new Proxy({}, {
                has() {
                    throw new Error('has boom')
                }
            })
        }

        //前端: url 除外(無效即退預設 localhost:8080, 不可於測試中打到該埠), 其餘選項之預設皆可連到本檔之伺服器
        for (let name of ['apiName', 'getToken', 'tokenType', 'sizeSlice', 'timeout', 'retryMain', 'retryUpload', 'retryDownload', 'onTrace']) {
            for (let [sk, f] of Object.entries(optShapes)) {
                it(`前端 ${name} / ${sk}: 建構不拋錯且 execute 照常成功(無效值取預設)`, async function() {
                    this.timeout(20000)
                    let { wo, evs } = mkClient({ [name]: f() })
                    let r = await wo.execute('fn', { a: 1 })
                    assert.strict.deepEqual(r, { ok: 1 })
                    assert.strict.deepEqual(evs, [])
                })
            }
        }

        it('前端 url / 各形狀: 建構不拋錯(不發請求)', function() {
            for (let [sk, f] of Object.entries(optShapes)) {
                assert.doesNotThrow(() => new WConverhpClient({ url: f() }), sk)
            }
        })

        //前端公開方法之呼叫參數為不可讀值(R9: 選用之回呼補預設; R13; 修正前以原生 TypeError 拒絕且 0 則事件)
        for (let [sk, f] of Object.entries(shapes)) {
            it(`前端 execute 之 cbProgress 為 ${sk}: 視為未給(補預設), 照常成功且 0 則事件`, async function() {
                this.timeout(20000)
                let { wo, evs } = mkClient()
                let r = await wo.execute('fn', { a: 1 }, f())
                assert.strict.deepEqual(r, { ok: 1 })
                assert.strict.deepEqual(evs, [])
            })

            it(`前端 execute 之 opt.headers 為 ${sk}: 視為未給, 照常成功且 0 則事件`, async function() {
                this.timeout(20000)
                let { wo, evs } = mkClient()
                let r = await wo.execute('fn', { a: 1 }, undefined, { headers: f() })
                assert.strict.deepEqual(r, { ok: 1 })
                assert.strict.deepEqual(evs, [])
            })

            it(`前端 download 之 opt.fdDownload 為 ${sk}: 入口拒絕 invalid fdDownload 並發恰一則事件(不進請求)`, async function() {
                this.timeout(20000)
                let { wo, evs } = mkClient()
                let r = await wo.download('f1', undefined, { fdDownload: f() }).then((v) => ({ ok: true, v }), (e) => ({ ok: false, e }))
                assert.strict.deepEqual(r, { ok: false, e: 'invalid fdDownload for download in nodejs' })
                assert.strict.deepEqual(evs, ['invalid fdDownload for download in nodejs'])
            })

            it(`前端 upload 之 input 為 ${sk}: 入口拒絕 invalid input for upload 並發恰一則事件(不進請求)`, async function() {
                this.timeout(20000)
                let { wo, evs } = mkClient()
                let r = await wo.upload('x.bin', f(), undefined, { signal: AbortSignal.timeout(10000) }).then((v) => ({ ok: true, v }), (e) => ({ ok: false, e }))
                let msg = 'invalid input for upload: must be a Blob, File, ArrayBuffer, ArrayBufferView or string'
                assert.strict.deepEqual(r, { ok: false, e: msg })
                assert.strict.deepEqual(evs, [msg])
            })

            it(`前端 getToken 回傳 ${sk}: 該次嘗試失敗(恰一則事件)而不懸置、不拋出未處理之例外`, async function() {
                this.timeout(20000)
                let { wo, evs } = mkClient({ getToken: () => f() })
                let r = await wo.execute('fn', { a: 1 }).then((v) => ({ ok: true, v }), (e) => ({ ok: false, e }))
                assert.strict.deepEqual(r.ok, false, JSON.stringify(r))
                assert.strict.deepEqual(evs.length, 1, JSON.stringify(evs))
            })
        }

        //伺服端: 一個選項一個形狀起一台(同埠依序重用); port 與 pathUploadTemp 除外(無效即退預設 8080 或 repo 根之 uploadTemp)
        for (let name of ['apiName', 'useInert', 'tokenType', 'sizeSlice', 'sizeMsg', 'corsOrigins', 'delayForSlice', 'verifyConn']) {
            for (let [sk, f] of Object.entries(optShapes)) {
                it(`伺服端 ${name} / ${sk}: 建構不拋錯、ready 為 true、${name === 'verifyConn' ? '所有 API 一律拒絕(permission denied)並告知' : '服務照常'}`, async function() {
                    this.timeout(20000)
                    let evs = []
                    let wsv2 = null
                    try {
                        wsv2 = new WConverhpServer({ port: portOpt, apiName: 'api', useInert: false, pathUploadTemp: pathUploadTempOpt, [name]: f() })
                        wsv2.on('error', (e) => evs.push(String(e)))
                        wsv2.on('execute', (func, input, pm) => pm.resolve({ ok: 1 }))
                        wsv2.on('handler', () => {})
                        assert.strict.deepEqual(await wsv2.ready, true)
                        let res = await fetch(`http://127.0.0.1:${portOpt}/api/main`, {
                            method: 'POST',
                            headers: { 'Authorization': 'Bearer t', 'Content-Type': 'application/octet-stream', 'Origin': 'http://probe.test' },
                            body: Buffer.from(w.obj2u8arr({ func: 'x', input: {} })),
                        })
                        let u8a = new Uint8Array(Buffer.from(await res.arrayBuffer()))
                        let d = w.u8arr2obj(u8a, { returnWithStateAndMsg: true })
                        let tag = `${name} / ${sk}: ${JSON.stringify({ d, evs, acao: res.headers.get('access-control-allow-origin') })}`
                        if (name === 'verifyConn') {
                            //R26: 有給而無效 → 拒絕全部 API + 告知(fail-closed)
                            assert.strict.deepEqual(res.headers.get('return-type'), 'error', tag)
                            assert.strict.deepEqual(d.msg.error, 'permission denied', tag)
                            assert.strict.deepEqual(evs.some((e) => e.includes('invalid verifyConn')), true, tag)
                            return
                        }
                        assert.strict.deepEqual(res.headers.get('return-type'), 'success', tag)
                        if (name === 'corsOrigins') {
                            //R26: 有給而無效 → 停用 CORS(不回授權標頭)+ 告知, 不得退回預設之放行一切來源
                            assert.strict.deepEqual(res.headers.get('access-control-allow-origin'), null, tag)
                            assert.strict.deepEqual(evs.some((e) => e.includes('invalid corsOrigins')), true, tag)
                        }
                        else if (name === 'useInert') {
                            assert.strict.deepEqual(evs.some((e) => e.includes('invalid useInert')), true, tag)
                        }
                        else {
                            //其餘選項(apiName、tokenType、sizeSlice、sizeMsg、delayForSlice): 無效值取預設, 服務照常、不發事件(R4)
                            assert.strict.deepEqual(evs, [], tag)
                        }
                    }
                    finally {
                        if (wsv2) {
                            await wsv2.stop()
                        }
                    }
                })
            }
        }

    })

})
