import assert from 'assert'
import w from 'wsemi'
import WConverhpServer from '../src/WConverhpServer.mjs'
import WConverhpClient from '../src/WConverhpClient.mjs'


describe('api-executeError', function() {

    let port = 8184 //同時test故得要不同port
    let url = `http://localhost:${port}`
    let wsv = null

    //nExec, 記錄execute被呼叫次數, 供retry測試使用
    let nExec = 0

    before(async function() {

        let opt = {
            port,
            apiName: 'api',
            pathStaticFiles: '.',
            verifyConn: async({ authorization }) => {
                let token = w.strdelleft(authorization, 7) //刪除Bearer
                return w.isestr(token)
            },
        }

        //new
        wsv = new WConverhpServer(opt)

        wsv.on('execute', (func, input, pm) => {

            if (func === 'add') {
                pm.resolve({ _add: input.p.a + input.p.b })
            }
            else if (func === 'failTwice') {
                //前2次失敗, 第3次成功, 供測試retry
                nExec += 1
                if (nExec <= 2) {
                    pm.reject('temporary error')
                }
                else {
                    pm.resolve({ _n: nExec })
                }
            }
            else if (func === 'objError') {
                //以物件形式回報錯誤, 測試非字串之錯誤內容亦須能原樣傳到呼叫端
                pm.reject({ code: 'E42', detail: '錯誤詳情' })
            }
            else if (func === 'shapeError') {
                //以呼叫端指定之任意值reject, 測試各種形狀皆須原樣傳回
                pm.reject(input.v)
            }
            else {
                pm.reject('invalid func')
            }

        })
        wsv.on('error', () => {})
        wsv.on('handler', () => {})

        await w.delay(1000) //待伺服器啟動

    })

    after(function() {
        wsv.stop()
    })

    //mkClient
    let mkClient = (o = {}) => {
        let wo = new WConverhpClient({
            url,
            apiName: 'api',
            getToken: () => 'token-for-test',
            retryMain: 0, //錯誤測試不重試, 避免指數退避拉長測試時間
            ...o,
        })
        return wo
    }

    //catchOf, 取得reject值
    let catchOf = async(fn) => {
        try {
            let r = await fn()
            return { state: 'resolve', msg: r }
        }
        catch (err) {
            return { state: 'reject', msg: err }
        }
    }

    it('伺服器execute拒絕時, 呼叫端須收到伺服器給的錯誤訊息', async function() {
        let wo = mkClient()
        wo.on('error', () => {})
        let r = await catchOf(() => wo.execute('nofunc', {}, () => {}))
        assert.strict.deepEqual(r.state, 'reject')
        assert.strict.deepEqual(r.msg, 'invalid func')
    })

    it('伺服器以物件形式拒絕時, 呼叫端須收到同一物件', async function() {
        let wo = mkClient()
        wo.on('error', () => {})
        let r = await catchOf(() => wo.execute('objError', {}, () => {}))
        assert.strict.deepEqual(r.state, 'reject')
        assert.strict.deepEqual(r.msg, { code: 'E42', detail: '錯誤詳情' })
    })

    it('伺服器以任意形狀拒絕(數字/0/false/空字串/null/陣列/物件/字串)時, 呼叫端皆須收到同一值', async function() {
        //外部應用端的拒絕值形狀列不完, 不得以形狀白名單判定; 本地傳輸層失敗一律為Error實例, 非Error者即為伺服器回傳值
        let shapes = [404, 0, false, '', null, ['a', 'b'], { code: 1, msg: '中文' }, 'plain string']
        for (let v of shapes) {
            let wo = mkClient()
            wo.on('error', () => {})
            let r = await catchOf(() => wo.execute('shapeError', { v }, () => {}))
            assert.strict.deepEqual(r.state, 'reject', JSON.stringify(v))
            assert.strict.deepEqual(r.msg, v, `shape ${JSON.stringify(v)} -> ${JSON.stringify(r.msg)}`)
        }
    })

    it('權限驗證失敗時, 呼叫端須收到permission denied', async function() {
        let wo = mkClient({ getToken: () => '' })
        wo.on('error', () => {})
        let r = await catchOf(() => wo.execute('add', { p: { a: 1, b: 2 } }, () => {}))
        assert.strict.deepEqual(r.state, 'reject')
        assert.strict.deepEqual(r.msg, 'permission denied')
    })

    it('伺服器業務錯誤時, error事件須收到同一則訊息且每次嘗試僅emit一次', async function() {
        let wo = mkClient()
        let evs = []
        wo.on('error', (err) => {
            evs.push(err)
        })
        let r = await catchOf(() => wo.execute('nofunc', {}, () => {}))
        await w.delay(200) //eeEmit為setTimeout發送, 須待其送出
        assert.strict.deepEqual(r.msg, 'invalid func')
        assert.strict.deepEqual(evs, ['invalid func'])
    })

    it('連線失敗時, 呼叫端須收到非空的錯誤訊息', async function() {
        let wo = mkClient({ url: 'http://localhost:8199', timeout: 3000 })
        wo.on('error', () => {})
        let r = await catchOf(() => wo.execute('add', { p: { a: 1, b: 2 } }, () => {}))
        assert.strict.deepEqual(r.state, 'reject')
        assert.strict.deepEqual(!!r.msg, true) //須有錯誤內容, 不得為空
    })

    it('retryMain設定次數內, 前幾次失敗仍須最終成功', async function() {
        nExec = 0
        let wo = mkClient({ retryMain: 3 })
        wo.on('error', () => {})
        let r = await catchOf(() => wo.execute('failTwice', { p: {} }, () => {}))
        assert.strict.deepEqual(r.state, 'resolve')
        assert.strict.deepEqual(r.msg, { _n: 3 })
    })

    it('retryMain次數不足時, 須以伺服器錯誤訊息拒絕', async function() {
        nExec = 0
        let wo = mkClient({ retryMain: 1 }) //僅重試1次, 共2次, 皆失敗
        wo.on('error', () => {})
        let r = await catchOf(() => wo.execute('failTwice', { p: {} }, () => {}))
        assert.strict.deepEqual(r.state, 'reject')
        assert.strict.deepEqual(r.msg, 'temporary error')
    })

})
