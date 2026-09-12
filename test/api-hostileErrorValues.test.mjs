import assert from 'assert'
import fs from 'fs'
import w from 'wsemi'
import WConverhpServer from '../src/WConverhpServer.mjs'
import axes from './api-axes.mjs'

let { downloadRouteKeys, downloadErrorStatus, fetchDownload } = axes


/**
 * api: 應用端拋出之惡意錯誤值不得使保護層自身失效
 *
 * 應用端 throw / reject 的可以是任意值, 不限於 Error。其 message 可為會拋錯之 getter、toString 可拋錯、
 * 本身可為已撤銷之 Proxy —— 這些值一旦被拿去「組錯誤訊息」, 組訊息那一行就在 catch 內再拋。
 *
 * 修正前之兩個實測後果:
 *   verifyConn 拋惡意值   → 例外逸出 checkConn 而上拋至 hapi, **裸 HTTP 500 且 0 則 error 事件**
 *                          (而 checkConn 存在之理由正是「六路由對同一種失敗一律回 permission denied」)
 *   監聽器拋惡意值        → funGetListenerError 內組訊息先拋錯, 其後之 pm.reject 不執行,
 *                          且 wsemi 之 report 以 try catch 吞掉 → **請求永久懸置**(路由層已關閉 server/socket 逾時)
 *                          (而該自訂函數存在之理由正是「一併 reject 使前端收到回應而非永久懸置」)
 *
 * 修正為兩層:
 *   結構層 —— 唯一「非做不可」之事(pm.reject / m=false)移到最前面, 使失效在結構上不可能, 而非倚賴後面每行都不拋錯
 *   取值層 —— 取因一律經 wsemi 之 getErrorMessage(契約為任何輸入皆不拋錯且回傳必為字串)
 *
 * 本檔之軸為「惡意形狀 × 注入點」, 而非只測當初被投訴的那一種形狀 ——
 * 既有 test/api-verifyConnError.test.mjs 丟的是 new Error, api-downloadEvents 丟的是 new Error('listener boom'),
 * 兩者都是「當初那個缺陷的形狀」, 故修正前全綠。
 */
describe('api-hostileErrorValues', function() {

    let port = 8227 //同時test故得要不同port
    let pathUploadTemp = './test/_tmp/uploadTemp-api-hostileErrorValues'
    let fpSrc = 'test/1mb.7z'
    let wsv = null
    let errs = []

    //shapes, 惡意形狀之全集(軸之一維)
    let shapes = {
        'message為拋錯getter': () => {
            let o = {}
            Object.defineProperty(o, 'message', {
                get() {
                    throw new Error('message getter boom')
                }
            })
            return o
        },
        'message與toString皆拋錯': () => {
            let o = {}
            Object.defineProperty(o, 'message', {
                get() {
                    throw new Error('message getter boom')
                }
            })
            o.toString = () => {
                throw new Error('toString boom')
            }
            return o
        },
        'toString拋錯': () => {
            return {
                toString() {
                    throw new Error('toString boom')
                }
            }
        },
        'toJSON拋錯': () => {
            return {
                toJSON() {
                    throw new Error('toJSON boom')
                }
            }
        },
        '已撤銷之Proxy': () => {
            let rv = Proxy.revocable({}, {})
            rv.revoke()
            return rv.proxy
        },
        'get陷阱全拋之Proxy': () => {
            return new Proxy({}, {
                get() {
                    throw new Error('get trap boom')
                }
            })
        },
        '循環參照物件': () => {
            let o = { a: 1 }
            o.self = o
            return o
        },
        '含BigInt之物件': () => {
            return { v: 10n }
        },
        'null': () => null,
        'undefined': () => undefined,
        'Symbol': () => Symbol('s'),
        '對照組-一般Error': () => new Error('normal boom'),
    }
    let shapeKeys = Object.keys(shapes)

    //mode, 由各測試設定: '' 為不注入, 其餘為 shapes 之鍵
    let modeVerify = ''
    let modeListener = ''

    before(async function() {
        this.timeout(20000)

        wsv = new WConverhpServer({
            port,
            apiName: 'api',
            useInert: false,
            pathUploadTemp,
            verifyConn: async() => {
                if (modeVerify !== '') {
                    throw shapes[modeVerify]()
                }
                return true
            },
        })
        wsv.on('download', (input, pm) => {
            if (modeListener !== '') {
                throw shapes[modeListener]()
            }
            pm.resolve({
                filename: 'x.bin',
                fileSize: fs.statSync(fpSrc).size,
                fileType: 'application/octet-stream',
                streamRead: fs.createReadStream(fpSrc),
            })
        })
        wsv.on('execute', (func, input, pm) => {
            if (modeListener !== '') {
                throw shapes[modeListener]()
            }
            pm.resolve({ ok: 1 })
        })
        wsv.on('error', (e) => errs.push(String(e)))
        wsv.on('handler', () => {})

        await w.delay(1200) //待伺服器啟動

    })

    after(function() {
        wsv.stop()
        try {
            fs.rmSync(pathUploadTemp, { recursive: true, force: true })
        }
        catch (err) {}
    })

    //call, timeoutMs 使「懸置」成為可斷言之觀察值而非測試逾時
    let call = async(route, fileId) => {
        errs = []
        let r = await fetchDownload(port, route, fileId, { timeoutMs: 4000, settleMs: 250 })
        return { ...r, nErrs: errs.length, errs: [...errs] }
    }

    it('verifyConn 拋出各種惡意形狀時, 三路由皆須回 permission denied 錯誤封包, 狀態碼依路由軸(修正前為裸 HTTP 500)', async function() {
        this.timeout(120000)
        for (let k of shapeKeys) {
            modeVerify = k
            for (let route of downloadRouteKeys()) {
                let r = await call(route, 'any')
                let tag = `${k} / ${route}: ${JSON.stringify(r)}`
                assert.strict.deepEqual(r.hang, undefined, `${tag} —— 不得懸置`)
                assert.strict.deepEqual(r.status, downloadErrorStatus(route, 'permission'), tag)
                assert.strict.deepEqual(r.returnType, 'error', tag)
                assert.strict.deepEqual(r.error, 'permission denied', tag)
            }
        }
        modeVerify = ''
    })

    it('verifyConn 拋出各種惡意形狀時, 皆須發恰好一則 error 事件(修正前為 0 則, 應用端無從得知)', async function() {
        this.timeout(120000)
        for (let k of shapeKeys) {
            modeVerify = k
            let r = await call('dw', 'any')
            let tag = `${k}: ${JSON.stringify(r.errs)}`
            assert.strict.deepEqual(r.nErrs, 1, tag)
            assert.strict.deepEqual(r.errs[0].includes('verifyConn error for apiType['), true, tag)
        }
        modeVerify = ''
    })

    it('download 監聽器拋出各種惡意形狀時, 三路由皆須回錯誤封包而不得懸置(修正前請求永久懸置)', async function() {
        this.timeout(120000)
        for (let k of shapeKeys) {
            modeListener = k
            for (let route of downloadRouteKeys()) {
                let r = await call(route, 'any')
                let tag = `${k} / ${route}: ${JSON.stringify(r)}`
                assert.strict.deepEqual(r.hang, undefined, `${tag} —— 不得懸置`)
                assert.strict.deepEqual(r.status, downloadErrorStatus(route, 'app'), tag)
                assert.strict.deepEqual(r.returnType, 'error', tag)
                assert.strict.deepEqual(r.error, 'can not get file from fileId', tag)
            }
        }
        modeListener = ''
    })

    it('download 監聽器拋出各種惡意形狀時, 皆須發恰好一則 error 事件, 不得為 0 則亦不得為兩則', async function() {
        this.timeout(120000)
        for (let k of shapeKeys) {
            modeListener = k
            let r = await call('dw', 'any')
            let tag = `${k}: ${JSON.stringify(r.errs)}`
            assert.strict.deepEqual(r.nErrs, 1, tag)
            assert.strict.deepEqual(r.errs[0].includes('listener of event[download] error'), true, tag)
        }
        modeListener = ''
    })

    it('error 事件之訊息一律為非空字串, 不得為 undefined 或含 [object Object] 以外之無用值', async function() {
        this.timeout(120000)
        for (let k of shapeKeys) {
            modeVerify = k
            let r = await call('dw', 'any')
            let m = r.errs[0]
            assert.strict.deepEqual(typeof m === 'string' && m.length > 0, true, `${k}: ${JSON.stringify(m)}`)
        }
        modeVerify = ''
    })

    it('經歷全部惡意形狀後伺服器仍須存活且行為正常(對照組)', async function() {
        this.timeout(30000)
        modeVerify = ''
        modeListener = ''
        let r = await call('dw', 'ok')
        assert.strict.deepEqual(r.status, 200, JSON.stringify(r))
        assert.strict.deepEqual(r.returnType, null, JSON.stringify(r))
        assert.strict.deepEqual(r.bytes, fs.statSync(fpSrc).size, JSON.stringify(r))
        assert.strict.deepEqual(r.nErrs, 0, JSON.stringify(r.errs))
    })

})
