import assert from 'assert'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import w from 'wsemi'
import setup from './tools/e2e-setup.mjs'
import wPorts from './tools/ports.mjs'

let { portOf } = wPorts

let { HOST, projRoot, launchBrowser, buildClientBundle, writePage, startServer } = setup


/**
 * e2e: 瀏覽器端 execute
 *
 * 真實 user path (技能 §2.3; 本套件瀏覽器端無 UI, 使用者的動作即為呼叫 JS API):
 *   ①開啟載入 w-converhp client 之頁面
 *   ②於頁面呼叫 wo.execute(func, input, cbProgress)
 *   ③觀察 promise resolve 之回傳值 / reject 之錯誤訊息
 *   ④觀察 cbProgress 收到的進度序列
 *   ⑤觀察 wo.on('error') 收到的事件
 *   ⑥後端副作用: 伺服器 execute 事件收到的 input
 */
describe('e2e-execute', function() {

    let port = portOf('e2e-execute')

    //pathUploadTemp, 本檔之上傳暫存夾, 測完即刪(after)
    //why 不用伺服器之預設值(./uploadTemp): 預設值落在 repo 根, 本檔雖不上傳, 建構伺服器即於該處建立資料夾(帳本 R28)
    let pathUploadTemp = path.resolve(projRoot, 'test', '_tmp', 'e2e-execute')
    let baseUrl = `http://${HOST}:${port}`
    let wsv = null
    let browser = null
    let urlPage = ''

    //rsv, 記錄伺服器端收到的 input, 供驗證後端副作用
    let rsv = []

    //md5
    let md5 = (u8a) => {
        return crypto.createHash('md5').update(Buffer.from(u8a)).digest('hex')
    }

    before(async function() {
        this.timeout(180000) //首次須打包 bundle

        await buildClientBundle()

        //頁面內之測試動作, 皆為使用者實際會寫的呼叫方式
        urlPage = writePage('e2e-execute.html', `
let mk = (o) => new WConverhpClient({
    url: location.origin,
    apiName: 'api',
    getToken: () => 'token-for-test',
    ...o,
})

//cat, 把 resolve 與 reject 都收斂成可回傳的結構
let cat = async (fn) => {
    try {
        return { state: 'resolve', msg: await fn() }
    }
    catch (e) {
        return { state: 'reject', msg: e }
    }
}

//回傳值須可序列化, u8a 於序列化後為物件, 故改回傳其 Array 形式
let u8a2arr = (v) => Array.from(new Uint8Array(Object.values(v)))

window.tEcho = async (nbytes, seed) => {
    let wo = mk()
    wo.on('error', () => {})
    let u8a = new Uint8Array(nbytes)
    for (let i = 0; i < nbytes; i++) {
        u8a[i] = (i + seed) % 251
    }
    let r = await cat(() => wo.execute('echo', { u8a, txt: '測試中文字串' }, () => {}))
    if (r.state === 'resolve') {
        return { state: r.state, txt: r.msg.txt, arr: u8a2arr(r.msg.u8a) }
    }
    return { state: r.state, msg: String(r.msg) }
}

window.tProgress = async (nbytes) => {
    let wo = mk()
    wo.on('error', () => {})
    let evs = []
    let u8a = new Uint8Array(nbytes)
    let r = await cat(() => wo.execute('echo', { u8a, txt: 'x' }, (m) => evs.push({ prog: Math.floor(m.prog), p: m.p, m: m.m })))
    return { state: r.state, evs }
}

window.tBadFunc = async () => {
    let wo = mk({ retryMain: 0 })
    let errs = []
    wo.on('error', (e) => errs.push(e))
    let r = await cat(() => wo.execute('nofunc', {}, () => {}))
    await new Promise((res) => setTimeout(res, 300)) //evEmit 為同步派發(事件於回應前即已發出), 此為 settle 窗, 僅供否定觀察(防多餘第二則)
    return { state: r.state, msg: r.msg, errs }
}

//tRejCancelled, 應用端以 wsemi 取消家族之形狀拒絕(帳本 R29): 打包產物之結局判定須與 nodejs 同(原值、每次嘗試一則、重試)
window.tRejCancelled = async () => {
    let wo = mk({ retryMain: 1 })
    let errs = []
    wo.on('error', (e) => errs.push(e))
    let r = await cat(() => wo.execute('rejCancelled', {}, () => {}))
    return { state: r.state, msg: r.msg, errs }
}

//tGetTokenCancelled, getToken 以取消形狀拒絕: 該次嘗試之失敗, 照常重試且每次一則, 最終以原值拒絕
window.tGetTokenCancelled = async () => {
    let nGt = 0
    let wo = mk({ retryMain: 1, getToken: () => {
        nGt += 1
        return Promise.reject({ reason: 'cancelled', code: 8 })
    } })
    let errs = []
    wo.on('error', (e) => errs.push(e))
    let r = await cat(() => wo.execute('echo', { u8a: new Uint8Array(1), txt: 'x' }, () => {}))
    return { state: r.state, msg: r.msg, errs, nGt }
}

window.tNoToken = async () => {
    let wo = mk({ retryMain: 0, getToken: () => '' })
    wo.on('error', () => {})
    let r = await cat(() => wo.execute('echo', { u8a: new Uint8Array(1), txt: 'x' }, () => {}))
    return { state: r.state, msg: r.msg }
}
`)

        wsv = await startServer({
            port,
            apiName: 'api',
            pathUploadTemp,
            verifyConn: async({ authorization }) => {
                let token = w.strdelleft(authorization, 7) //刪除 Bearer
                return w.isestr(token)
            },
        })

        wsv.on('execute', (func, input, pm) => {
            rsv.push({ func, len: input.u8a ? Object.keys(input.u8a).length : 0, txt: input.txt })
            if (func === 'echo') {
                pm.resolve({ u8a: input.u8a, txt: input.txt })
            }
            else if (func === 'rejCancelled') {
                pm.reject({ reason: 'cancelled', code: 7 })
            }
            else {
                pm.reject('invalid func')
            }
        })
        wsv.on('error', () => {})

    })

    after(async function() {
        if (wsv) {
            await wsv.stop()
        }
        //清除本檔之上傳暫存夾(測試中介資料測完即刪, 不留殘留)
        fs.rmSync(pathUploadTemp, { recursive: true, force: true })
    })

    //每 case fresh browser (技能 §6)
    beforeEach(async function() {
        browser = await launchBrowser()
    })

    afterEach(async function() {
        if (browser) {
            await browser.close()
            browser = null
        }
    })

    //openPage
    let openPage = async() => {
        let page = await browser.newPage()
        await page.goto(`${baseUrl}${urlPage}`, { waitUntil: 'load' })
        return page
    }

    it('二進位與中文字串往返後內容須完全一致', async function() {
        let page = await openPage()

        let n = 512 * 1024
        let seed = 7
        let r = await page.evaluate(({ n, seed }) => window.tEcho(n, seed), { n, seed })

        //使用者觀察: promise resolve 且拿回原資料
        assert.strict.deepEqual(r.state, 'resolve')
        assert.strict.deepEqual(r.txt, '測試中文字串')

        //內容須與送出者一致
        let u8aSend = new Uint8Array(n)
        for (let i = 0; i < n; i++) {
            u8aSend[i] = (i + seed) % 251
        }
        assert.strict.deepEqual(r.arr.length, n)
        assert.strict.deepEqual(md5(new Uint8Array(r.arr)), md5(u8aSend))

        //後端副作用: 伺服器確實收到該筆
        let last = rsv[rsv.length - 1]
        assert.strict.deepEqual(last.func, 'echo')
        assert.strict.deepEqual(last.len, n)
        assert.strict.deepEqual(last.txt, '測試中文字串')
    })

    it('進度回呼須含上傳與下載兩階段且單調遞增至100', async function() {
        let page = await openPage()

        let r = await page.evaluate(() => window.tProgress(512 * 1024))
        assert.strict.deepEqual(r.state, 'resolve')

        let ups = r.evs.filter((v) => v.m === 'upload')
        let dws = r.evs.filter((v) => v.m === 'download')

        //兩階段皆須有事件
        assert.strict.deepEqual(ups.length > 0, true)
        assert.strict.deepEqual(dws.length > 0, true)

        //m 僅允許 upload 與 download
        assert.strict.deepEqual([...new Set(r.evs.map((v) => v.m))].sort(), ['download', 'upload'])

        //單調遞增
        let mono = (arr) => {
            for (let i = 1; i < arr.length; i++) {
                if (arr[i].prog < arr[i - 1].prog) {
                    return false
                }
            }
            return true
        }
        assert.strict.deepEqual(mono(ups), true)
        assert.strict.deepEqual(mono(dws), true)

        //末值須為100
        assert.strict.deepEqual(ups[ups.length - 1].prog, 100)
        assert.strict.deepEqual(dws[dws.length - 1].prog, 100)

        //p 須為數值
        assert.strict.deepEqual(r.evs.every((v) => typeof v.p === 'number'), true)
    })

    it('伺服器業務錯誤時, 瀏覽器端須收到伺服器給的錯誤訊息', async function() {
        let page = await openPage()

        let r = await page.evaluate(() => window.tBadFunc())

        //使用者觀察: reject 且訊息為伺服器所給, 不得為誤導性的無法連線訊息
        assert.strict.deepEqual(r.state, 'reject')
        assert.strict.deepEqual(r.msg, 'invalid func')

        //error 事件須收到同一則訊息, 且每次嘗試僅 emit 一次
        assert.strict.deepEqual(r.errs, ['invalid func'])
    })

    it('應用端以取消形狀({ reason: cancelled })拒絕時, 瀏覽器端(打包產物)須收到同一值、每次嘗試一則、伺服端被呼叫 1+retryMain 次(帳本 R29; 修正前為空字串、0 則、1 次)', async function() {
        let page = await openPage()
        let n0 = rsv.filter((v) => v.func === 'rejCancelled').length

        let r = await page.evaluate(() => window.tRejCancelled())
        let v = { reason: 'cancelled', code: 7 }

        //使用者觀察: reject 且為應用端之原值(非 Error 者原樣交出)
        assert.strict.deepEqual(r.state, 'reject')
        assert.strict.deepEqual(r.msg, v)

        //每次嘗試失敗恰一則事件, 值同拒絕值
        assert.strict.deepEqual(r.errs, [v, v])

        //後端副作用: 凡失敗皆重試, 伺服端被呼叫 1+retryMain 次
        assert.strict.deepEqual(rsv.filter((x) => x.func === 'rejCancelled').length - n0, 2)
    })

    it('getToken 以取消形狀拒絕時, 瀏覽器端(打包產物)須以原值拒絕、每次嘗試一則、getToken 1+retryMain 次(帳本 R13 #4a、R29; 修正前為空字串、0 則、1 次)', async function() {
        let page = await openPage()

        let r = await page.evaluate(() => window.tGetTokenCancelled())
        let v = { reason: 'cancelled', code: 8 }
        assert.strict.deepEqual(r.state, 'reject')
        assert.strict.deepEqual(r.msg, v)
        assert.strict.deepEqual(r.errs, [v, v])
        assert.strict.deepEqual(r.nGt, 2)
    })

    it('權限驗證失敗時, 瀏覽器端須收到permission denied', async function() {
        let page = await openPage()

        let r = await page.evaluate(() => window.tNoToken())
        assert.strict.deepEqual(r.state, 'reject')
        assert.strict.deepEqual(r.msg, 'permission denied')
    })

})
