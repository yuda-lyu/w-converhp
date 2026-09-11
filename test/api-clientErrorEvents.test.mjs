import assert from 'assert'
import path from 'path'
import w from 'wsemi'
import WConverhpServer from '../src/WConverhpServer.mjs'
import WConverhpClient from '../src/WConverhpClient.mjs'


/**
 * api: 用戶端之 error 事件 —— 「伺服器回業務錯誤」這一個事實, 於各公開方法發出之則數須一致, 不得依傳輸協定(封包 / 標頭)而異
 *
 * 缺陷(第十輪 D6, tmp/probe_r10_clientev.mjs): callApiCore(封包協定)每次嘗試發一則; downloadStream(標頭協定, nodejs 之 download 與瀏覽器 blob 模式)0 則。
 * 實測應用端拒絕與 permission denied 兩種: execute 各 1 則, download 各 0 則。
 * 兩個解碼者另各自手寫一份「不重試」包裝 —— 同一規則兩份手寫。
 * 對標: socket.io-client 之 connect_error 不論 polling 或 websocket 傳輸皆同樣發出。
 */
describe('api-clientErrorEvents', function() {
    this.timeout(60000)

    let port = 8496
    let fd = path.resolve('./test/_tmp/api-clientErrorEvents')
    let servers = []

    let mkServer = async(p, opt = {}) => {
        let s = new WConverhpServer({ port: p, useInert: false, pathUploadTemp: path.join(fd, `up${p}`), ...opt })
        s.on('error', () => {})
        s.on('execute', (f, i, pm) => pm.reject('app says no'))
        s.on('download', (i, pm) => pm.reject('app says no'))
        servers.push(s)
        await w.delay(600)
        return s
    }

    after(async function() {
        for (let s of servers) {
            await s.stop()
        }
    })

    let countEvents = async(p, fn) => {
        let evs = []
        let wc = new WConverhpClient({ url: `http://127.0.0.1:${p}`, retryMain: 0, retryDownload: 0 })
        wc.on('error', (e) => evs.push(e))
        await fn(wc).then(() => {}, () => {})
        return evs
    }

    for (let [label, opt, p] of [['應用端拒絕', {}, port], ['permission denied', { verifyConn: () => false }, port + 1]]) {
        it(`${label}: execute 與 download(nodejs) 須各恰發一則 error 事件(修正前 download 為 0)`, async function() {
            await mkServer(p, opt)
            let e1 = await countEvents(p, (wc) => wc.execute('f', {}))
            let e2 = await countEvents(p, (wc) => wc.download('x', () => {}, { fdDownload: path.join(fd, 'dl') }))
            assert.strict.deepEqual(e1.length, 1, `execute: ${JSON.stringify(e1)}`)
            assert.strict.deepEqual(e2.length, 1, `download: ${JSON.stringify(e2)}`)
        })
    }

    it('重試時每次嘗試各一則, 且 download 之不重試標示(Return-Retryable)仍須生效: 參數錯誤不重試故恰一則', async function() {
        let p = port + 2
        await mkServer(p)
        let evs = []
        let wc = new WConverhpClient({ url: `http://127.0.0.1:${p}`, retryDownload: 1 })
        wc.on('error', (e) => evs.push(e))
        let t0 = Date.now()
        let r = await wc.download('', () => {}, { fdDownload: path.join(fd, 'dl') }).then(() => 'ok', (e) => e) //fileId 空字串 → invalid fileId in payload(retryable:false)
        assert.strict.deepEqual(r, 'invalid fileId in payload')
        assert.strict.deepEqual(evs.length, 1, `不重試者須恰一則: ${JSON.stringify(evs)}`)
        assert.strict.deepEqual(Date.now() - t0 < 900, true, '不得進入退避重試')
    })

})
