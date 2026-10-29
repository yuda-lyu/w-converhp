import assert from 'assert'
import fs from 'fs'
import WConverhpServer from '../src/WConverhpServer.mjs'
import WConverhpClient from '../src/WConverhpClient.mjs'
import wPorts from './tools/ports.mjs'

let { portOf } = wPorts


/**
 * api: client 之 getToken —— 每次嘗試重取; 未取得 token 時不得送出字面之 undefined / null
 *
 * 缺陷(第十輪 Q2 與 B 卷 tmp/r10B_token.mjs):
 *   一、getToken 原於重試迴圈外只取一次, 重試沿用同一個 token。權限屬非同步系統、permission denied 須重試(專案重試原則),
 *       而「token 已過期、應用端之 getToken 已換發新 token」或一次性 token 之情形, 帶舊 token 之重試永遠無效。
 *       業界作法同: token 更新後以新 token 重送原請求(axios-auth-refresh)
 *   二、getToken 回 undefined / null 時, Authorization 為樣板求值之字面 `Bearer undefined`, 伺服器與應用端收到一個看似有效之 token 字串
 */
describe('api-clientToken', function() {
    this.timeout(60000)

    let port = portOf('api-clientToken')
    let wsv = null
    let auths = []
    let used = new Set()

    before(async function() {
        wsv = new WConverhpServer({
            port,
            useInert: false,
            pathUploadTemp: './test/_tmp/uploadTemp-api-clientToken',
            verifyConn: ({ authorization }) => {
                auths.push(authorization)
                return true
            },
        })
        wsv.on('error', () => {})
        wsv.on('execute', (func, input, pm) => {

            //一次性 token: 同一 token 第二次出現即拒絕
            let tk = auths[auths.length - 1]
            if (used.has(tk)) {
                pm.reject('token already used')
                return
            }
            used.add(tk)

            //fail-first: 首次為暫時性失敗(應用端拒絕), 依重試原則由 client 重送
            if (func === 'fail-first' && used.size === 1) {
                pm.reject('temporary')
                return
            }

            pm.resolve('ok')
        })
        await wsv.ready //待伺服器就緒(ready)
    })

    after(async function() {
        if (wsv) {
            await wsv.stop()
        }
        //清除本檔之暫存夾(測試中介資料測完即刪, 不留殘留)
        fs.rmSync('./test/_tmp/uploadTemp-api-clientToken', { recursive: true, force: true })
    })

    it('重試時須重取 getToken: 一次性 token 下, 首次暫時失敗後之重試須帶新 token 而成功(修正前沿用舊 token 而被拒)', async function() {
        let n = 0
        let wc = new WConverhpClient({
            url: `http://127.0.0.1:${port}`,
            retryMain: 1,
            getToken: () => {
                n += 1
                return `tk${n}`
            },
        })
        wc.on('error', () => {})
        auths.length = 0
        used.clear()
        let r = await wc.execute('fail-first', {}).then((v) => v, (e) => `reject:${e}`)
        assert.strict.deepEqual(r, 'ok')
        assert.strict.deepEqual(n, 2, 'getToken 須於每次嘗試各取一次')
        assert.strict.deepEqual(auths, ['Bearer tk1', 'Bearer tk2'])
    })

    it('getToken 回 undefined 或 null(含 thenable 解出者)時, 送出之 Authorization 不得含字面 undefined / null', async function() {
        //thenable 兩員(2026-10-14): 修正前 fetchToken 以 wsemi 之 ispm 判斷是否 await, 一般物件之 thenable 不被認出而由 async 函數之回傳採納,
        //跳過 undefined/null 之正規化 → 送出字面 `Bearer undefined`; 修正後一律 await(帳本 R13 #4a 之更正)
        let cases = {
            'undefined': () => undefined,
            'null': () => null,
            'thenable 解出 undefined': () => ({ then: (resolve) => resolve(undefined) }),
            'thenable 解出 null': () => ({ then: (resolve) => resolve(null) }),
        }
        for (let k of Object.keys(cases)) {
            let wc = new WConverhpClient({ url: `http://127.0.0.1:${port}`, retryMain: 0, getToken: cases[k] })
            wc.on('error', () => {})
            auths.length = 0
            used.clear()
            await wc.execute('f', {}).then(() => {}, () => {})
            assert.strict.deepEqual(auths.length, 1, `getToken 回 ${k}: 前提為請求有送達`)
            assert.strict.deepEqual(/undefined|null/.test(auths[0]), false, `getToken 回 ${k}: 實得 Authorization=${JSON.stringify(auths[0])}`)
        }
    })

})
