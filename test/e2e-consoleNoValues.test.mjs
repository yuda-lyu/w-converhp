import assert from 'assert'
import fs from 'fs'
import path from 'path'
import setup from './tools/e2e-setup.mjs'
import wPorts from './tools/ports.mjs'
import wFakeApi from './tools/fakeApi.mjs'

let { portOf, reserved } = wPorts
let { HOST, projRoot, launchBrowser, buildClientBundle, writePage, startServer, collectConsole } = setup
let { startFakeApi } = wFakeApi


/**
 * e2e: 瀏覽器端(打包後之 UMD)之 console 輸出不得含資料值(帳本 R33; 規格〈診斷輸出與遮罩〉D1、D2)
 *
 * 定位(同其他 e2e 檔; 見 test/tools/e2e-setup.mjs 檔頭與帳本〈e2e 落地映射〉): 本套件瀏覽器端無 UI, 「使用者」即應用程式碼,
 * act 為頁內呼叫公開 API(wo.execute), assert 為使用者在 DevTools 實際看到之 console 與 promise 結局; 無標準圖(契約 C6–C9、C13 不適用)。
 *
 * 真實 user path(每案相同骨架):
 *   ①開啟載入 w-converhp client 之頁面(由 startServer 供應, 與 API 不同源)
 *   ②於頁面以選項建構 client 並呼叫 wo.execute(後端為假後端, 依案回形狀不合之封包、或指向無人監聽之埠)
 *   ③觀察 promise 結局(reject 值與以往相同)
 *   ④觀察瀏覽器 console 實際收到之訊息(collectConsole: type、text、各引數之 jsonValue)
 *   ⑤後端副作用: 無(診斷輸出不改變請求與結果)
 *
 * why 需要真瀏覽器: console 之輸出面在瀏覽器為 DevTools(物件引數被展開顯示其內容), 且 getDiag 等共用實作須於瀏覽器環境載入執行(依賴閉包不含 Node 內建模組);
 * api-consoleNoValues 之 Node 側測試證明邏輯, 本檔證明打包產物在瀏覽器之實際輸出。
 * 斷言一律依引數之 jsonValue(物件引數有哪些鍵與值), 不依 msg.text() 對物件之展開寫法(隨 Playwright／Chromium 版本而異)。
 */
describe('e2e-consoleNoValues', function() {

    let port = portOf('e2e-consoleNoValues', 0)
    let portApi = portOf('e2e-consoleNoValues', 1)
    let pathUploadTemp = path.resolve(projRoot, 'test', '_tmp', 'e2e-consoleNoValues')
    let baseUrl = `http://${HOST}:${port}`
    let urlApi = `http://${HOST}:${portApi}`
    let wsv = null
    let fake = null
    let browser = null
    let urlPage = ''

    //objBadOutput, 假後端預設回應: 回應物件含使用者資料而無 output 鍵 → client 判為 invalid msg.output
    let objBadOutput = { success: { func: 'f', note: 'CANARY-RESP-NOTE', token: 'CANARY-RESP-TOKEN' } }

    before(async function() {
        this.timeout(180000) //首次須打包 bundle

        await buildClientBundle()

        //頁內之測試動作, 皆為應用程式碼會寫之呼叫方式; 後端網址由測試傳入(實際埠, 不寫死)
        urlPage = writePage('e2e-consoleNoValues.html', `
let mk = (o) => new WConverhpClient({
    apiName: 'api',
    getToken: () => 'token-for-test',
    retryMain: 0,
    timeout: 8000,
    ...o,
})

//cat, 把 resolve 與 reject 都收斂成可回傳的結構
let cat = async (fn) => {
    try {
        return { state: 'resolve', msg: await fn() }
    }
    catch (e) {
        return { state: 'reject', msg: String(e) }
    }
}

//tCall, 以給定選項呼叫 execute
window.tCall = async (o) => {
    let wo = mk(o)
    wo.on('error', () => {})
    return await cat(() => wo.execute('f', { a: 1 }))
}

//tThrowListener, error 監聽器自身拋錯(後端回業務錯誤封包 → 一則 error 事件 → 監聽器拋錯 → wsemi 之通報)
window.tThrowListener = async (o) => {
    let wo = mk(o)
    wo.on('error', () => {
        throw new Error('listener secret token=CANARY-EVL')
    })
    return await cat(() => wo.execute('f', { a: 1 }))
}

//tThrowListenerFun, 同 tThrowListener 而給 funLog: 回傳 funLog 收到之紀錄(wsemi 之通報應改交 funLog)
window.tThrowListenerFun = async (u) => {
    let got = []
    let wo = mk({ url: u, funLog: (label, safe) => got.push({ label, safe }) })
    wo.on('error', () => {
        throw new Error('listener secret token=CANARY-EVL')
    })
    let r = await cat(() => wo.execute('f', { a: 1 }))
    return { r, got }
}

//tFunLog, 以 funLog 轉接: 回傳其收到之紀錄(含兩種診斷: 回應形狀不合與重試提示)
window.tFunLog = async (urlOk, urlClosed) => {
    let got = []
    let funLog = (label, safe, detail) => {
        got.push({ label, safe, detail })
    }
    let r1 = await cat(() => mk({ url: urlOk, funLog }).execute('f', { a: 1 }))
    let r2 = await cat(() => mk({ url: urlClosed, retryMain: 1, funLog }).execute('f', { a: 1 }))
    return { r1, r2, got }
}
`)

        //供應頁面與 bundle 之伺服器(共用層 startServer: 以其 ready 為同步點); 後端 API 為跨來源之假後端
        wsv = await startServer({
            port,
            apiName: 'api',
            pathUploadTemp,
        })
        wsv.on('error', () => {})
        fake = await startFakeApi({ port: portApi, host: HOST, obj: objBadOutput, cors: true })
    })

    after(async function() {
        if (fake) {
            await fake.close()
        }
        if (wsv) {
            await wsv.stop()
        }
        fs.rmSync(pathUploadTemp, { recursive: true, force: true })
    })

    //每 case fresh browser(技能 §6); 假後端回應於每案開頭設定
    beforeEach(async function() {
        browser = await launchBrowser()
        fake.setObj(objBadOutput)
    })

    afterEach(async function() {
        if (browser) {
            await browser.close()
            browser = null
        }
    })

    //openPage, 回傳 { page, con }: con.settle() 取全部 console 訊息; page.on 須於 goto 之前掛
    let openPage = async() => {
        let page = await browser.newPage()
        let con = collectConsole(page)
        await page.goto(`${baseUrl}${urlPage}`, { waitUntil: 'load' })
        return { page, con }
    }

    //logsOf, 只取以 console.log 輸出者(瀏覽器自身對失敗請求另輸出 type 為 error 之 Failed to load resource, 不屬本套件)
    let logsOf = (cons) => cons.filter((v) => v.type === 'log')

    //noLeak, 全部訊息(text 與各引數)皆不得含指定之資料值
    let noLeak = (cons, canaries) => {
        for (let c of cons) {
            let s = `${c.text} ${JSON.stringify(c.args)}`
            for (let k of canaries) {
                assert.strict.deepEqual(s.includes(k), false, `console 含資料值[${k}]: ${s}`)
            }
        }
    }

    it('E2E-CNV-001 後端回應缺 output(回應物件含使用者資料): 瀏覽器 console 只收到固定詞彙與鍵名形狀, 不含回應物件之值; 呼叫端之拒絕值不變', async function() {
        //對應 R33 規則 2(第二引數只可為安全摘要)與規則 5(呼叫端之 reject 值不變); 修正前引數 2 為整個回應物件
        let { page, con } = await openPage()
        let r = await page.evaluate((u) => window.tCall({ url: u }), urlApi)
        let cons = await con.settle()

        assert.strict.deepEqual(r, { state: 'reject', msg: 'invalid msg.output' })
        let logs = logsOf(cons)
        assert.strict.deepEqual(logs.length, 1, JSON.stringify(cons))
        assert.strict.deepEqual(logs[0].args, ['invalid msg.output', { msgShape: '(keys: func,note,token)' }])
        noLeak(cons, ['CANARY-RESP-NOTE', 'CANARY-RESP-TOKEN'])
    })

    it('E2E-CNV-002 後端回應非有效物件(數字): 瀏覽器 console 只收到型別形狀, 不含值', async function() {
        //對應 R33 規則 2; 與 CNV-001 為同一出口之另一站點(F3)
        fake.setObj({ success: 424242 })
        let { page, con } = await openPage()
        let r = await page.evaluate((u) => window.tCall({ url: u }), urlApi)
        let cons = await con.settle()

        assert.strict.deepEqual(r, { state: 'reject', msg: 'msg is not an effective object' })
        let logs = logsOf(cons)
        assert.strict.deepEqual(logs.length, 1, JSON.stringify(cons))
        assert.strict.deepEqual(logs[0].args, ['msg is not an effective object', { msgShape: '(number)' }])
        noLeak(cons, ['424242'])
    })

    it('E2E-CNV-003 連線失敗而重試: 重試提示之字樣與以往相同(單一字串引數, 不夾帶網址與權杖)', async function() {
        //對應 R33 規則 5(重試提示字樣不變); 失敗路徑之造法: 後端網址指向無人監聽之埠(只影響目標請求, 不攔截頁面其他請求)
        let { page, con } = await openPage()
        let urlClosed = `http://${HOST}:${reserved.closed}`
        let r = await page.evaluate((u) => window.tCall({ url: u, retryMain: 1, getToken: () => 'CANARY-TOKEN-RETRY' }), urlClosed)
        let cons = await con.settle()

        assert.strict.deepEqual(r.state, 'reject')
        let logs = logsOf(cons)
        assert.strict.deepEqual(logs.length, 2, JSON.stringify(cons))
        assert.strict.deepEqual(logs.map((v) => v.args.length), [1, 1], JSON.stringify(cons))
        assert.strict.deepEqual(/^wait \d+\.\d\(second\) to retry\.\.\.$/.test(logs[0].args[0]), true, logs[0].args[0])
        assert.strict.deepEqual(logs[1].args, ['retry n=1...'])
        noLeak(cons, ['CANARY-TOKEN-RETRY', String(reserved.closed)])
    })

    it('E2E-CNV-004 opt.logDetail 為 true: 瀏覽器 console 之第二引數改為遮罩後之細節(憑證鍵名之值為遮罩值, 其餘照列)', async function() {
        //對應 R33 規則 3(logDetail); 遮罩由 wsemi 之 maskDiagCopy 於瀏覽器環境執行
        let { page, con } = await openPage()
        let r = await page.evaluate((u) => window.tCall({ url: u, logDetail: true }), urlApi)
        let cons = await con.settle()

        assert.strict.deepEqual(r, { state: 'reject', msg: 'invalid msg.output' })
        let logs = logsOf(cons)
        assert.strict.deepEqual(logs.length, 1, JSON.stringify(cons))
        assert.strict.deepEqual(logs[0].args[0], 'invalid msg.output')
        assert.strict.deepEqual(logs[0].args[1].func, 'f')
        assert.strict.deepEqual(logs[0].args[1].note, 'CANARY-RESP-NOTE') //使用端自選還原之細節
        assert.strict.deepEqual(logs[0].args[1].token === 'CANARY-RESP-TOKEN', false, `憑證鍵名之值須遮罩: ${JSON.stringify(logs[0].args)}`)
        noLeak(cons, ['CANARY-RESP-TOKEN'])
    })

    it('E2E-CNV-005 使用端以 funLog 轉接: 瀏覽器 console 不再有本套件之輸出, 紀錄由 funLog 收到(關閉 console 之正式作法)', async function() {
        //對應 R33 規則 3(funLog)
        let { page, con } = await openPage()
        let urlClosed = `http://${HOST}:${reserved.closed}`
        let r = await page.evaluate(([u, c]) => window.tFunLog(u, c), [urlApi, urlClosed])
        let cons = await con.settle()

        assert.strict.deepEqual(r.r1, { state: 'reject', msg: 'invalid msg.output' })
        assert.strict.deepEqual(r.r2.state, 'reject')

        //console 零輸出(本套件部分)
        assert.strict.deepEqual(logsOf(cons).length, 0, JSON.stringify(cons))

        //funLog 收到: 形狀不合之診斷(含 safe 與遮罩後之細節)、重試提示兩則
        let labels = r.got.map((v) => v.label)
        assert.strict.deepEqual(labels.filter((v) => v === 'invalid msg.output').length, 1, JSON.stringify(labels))
        assert.strict.deepEqual(labels.filter((v) => /^wait \d+\.\d\(second\) to retry\.\.\.$/.test(v)).length, 1, JSON.stringify(labels))
        assert.strict.deepEqual(labels.filter((v) => v === 'retry n=1...').length, 1, JSON.stringify(labels))
        let g = r.got.find((v) => v.label === 'invalid msg.output')
        assert.strict.deepEqual(g.safe, { msgShape: '(keys: func,note,token)' })
        assert.strict.deepEqual(g.detail.note, 'CANARY-RESP-NOTE') //細節交給使用端自行收取
        assert.strict.deepEqual(g.detail.token === 'CANARY-RESP-TOKEN', false, `憑證鍵名之值須遮罩: ${JSON.stringify(g.detail)}`)
    })

    it('E2E-CNV-006 error 監聽器自身拋錯: 瀏覽器 console 只收到固定詞彙與 { errType }, 不含拋出值之訊息(wsemi 之通報, 與本套件之診斷同受 logDetail／funLog 控制)', async function() {
        //對應 R33 規則 3(optDiag 併入 wsemi 之 evEmit); 後端回業務錯誤封包 → 一則 error 事件 → 監聽器拋錯
        fake.setObj({ error: 'CANARY-SERVER-ERR' })
        let { page, con } = await openPage()
        let r = await page.evaluate((u) => window.tThrowListener({ url: u }), urlApi)
        let cons = await con.settle()

        assert.strict.deepEqual(r, { state: 'reject', msg: 'CANARY-SERVER-ERR' }) //呼叫端仍收到伺服器之原值(R17 之依設計)
        let es = cons.filter((v) => Array.isArray(v.args) && v.args[0] === '[wsemi w-converhp-client] listener threw')
        assert.strict.deepEqual(es.length, 1, JSON.stringify(cons))
        assert.strict.deepEqual(es[0].type, 'error')
        assert.strict.deepEqual(es[0].args, ['[wsemi w-converhp-client] listener threw', { errType: 'Error' }])
        noLeak(es, ['CANARY-EVL'])
    })

    it('E2E-CNV-007 error 監聽器自身拋錯且給 funLog: wsemi 之通報改交 funLog, 瀏覽器 console 零輸出', async function() {
        //對應 R33 規則 3(optDiag 併入 wsemi 之 evEmit; 使用端之 funLog 對 wsemi 之通報亦有效)
        fake.setObj({ error: 'CANARY-SERVER-ERR' })
        let { page, con } = await openPage()
        let r = await page.evaluate((u) => window.tThrowListenerFun(u), urlApi)
        let cons = await con.settle()

        assert.strict.deepEqual(r.r, { state: 'reject', msg: 'CANARY-SERVER-ERR' })
        assert.strict.deepEqual(r.got, [{ label: '[wsemi w-converhp-client] listener threw', safe: { errType: 'Error' } }])
        //本套件與 wsemi 之輸出(console.log 與 wsemi 之 console.error)皆為 0; 瀏覽器自身之 type 為 error 之訊息(失敗請求等)不計
        let own = cons.filter((v) => v.type === 'log' || (Array.isArray(v.args) && typeof v.args[0] === 'string' && v.args[0].startsWith('[wsemi')))
        assert.strict.deepEqual(own.length, 0, JSON.stringify(cons))
    })

})
