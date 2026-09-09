import assert from 'assert'
import fs from 'fs'
import path from 'path'
import stream from 'stream'
import w from 'wsemi'
import u8arr2obj from 'wsemi/src/u8arr2obj.mjs'
import WConverhpServer from '../src/WConverhpServer.mjs'
import WConverhpClient from '../src/WConverhpClient.mjs'


/**
 * api: 伺服器須保證下載實送位元組數與應用端宣告之 fileSize(即 Content-Length)一致
 *
 * 修正前伺服器原樣採信 fileSize 寫 Content-Length, 與實送不符時 hapi 與 node 皆不會替套件擋:
 *   - 宣告小於實送(串流正常結束於較少位元組): 回 HTTP 200, nodejs client download() resolve 成功並存下被截斷之檔案 —— 靜默資料毀損
 *   - 宣告大於實送: 本體永不完成, 連線懸置至前端閒置逾時
 *   伺服器皆不發 error 事件
 * 修正後: 真串流以計數串流包住, 超量立即以錯誤終止, 正常結束但不足則於 flush 產生錯誤 —— 皆令 hapi 中止回應使前端失敗而非把壞檔當成功, 並發一則 error 事件;
 * 可事前具體化者(Buffer 等)於送標頭前比對, 不符即回 fileSize mismatch 錯誤封包; 來源自身出錯者沿用其錯誤不另報長度不符(test/api-downloadAbort 之情境不得被誤傷);
 * 計數串流以 pipeline 接於來源之後, 前端中斷時 hapi 銷毀計數串流須連帶銷毀來源(維持原有收尾, 不得使來源懸置)
 */
describe('api-downloadLength', function() {

    let port = 8215 //同時test故得要不同port
    let pathUploadTemp = './test/_tmp/uploadTemp-api-downloadLength'
    let fdDownload = './test/_tmp/download-api-downloadLength'
    let fpSrc = path.resolve('test/1mb.7z')
    let sizeSrc = fs.statSync(fpSrc).size
    let wsv = null

    //errs, 伺服器 error 事件
    let errs = []

    //tracked, 應用端交出之串流(依 fileId)
    let tracked = {}

    //mkSource, 以 30ms 間隔推 3 段各 64KB(共 196608 bytes), 再依 mode 結束: end(正常結束) 或 fail(以錯誤銷毀)
    let mkSource = (mode) => {
        let s = new stream.PassThrough()
        let n = 0
        let t = setInterval(() => {
            n += 1
            s.write(Buffer.alloc(64 * 1024, 1))
            if (n >= 3) {
                clearInterval(t)
                setTimeout(() => {
                    if (mode === 'fail') {
                        s.destroy(new Error('source failed'))
                    }
                    else {
                        s.end()
                    }
                }, 100)
            }
        }, 30)
        return s
    }

    before(async function() {

        wsv = new WConverhpServer({
            port,
            apiName: 'api',
            useInert: false,
            pathUploadTemp,
            verifyConn: async({ authorization }) => {
                return w.isestr(w.strdelleft(authorization, 7))
            },
        })
        wsv.on('download', (input, pm) => {
            let id = input.fileId
            let base = { filename: `${id}.bin`, fileType: 'application/octet-stream' }
            if (id === 'short') { //宣告 10MB 只送 196608 後正常結束
                let s = mkSource('end')
                tracked[id] = s
                pm.resolve({ ...base, streamRead: s, fileSize: 10 * 1024 * 1024 })
            }
            else if (id === 'overrun') { //宣告 100000 卻送 196608
                let s = mkSource('end')
                tracked[id] = s
                pm.resolve({ ...base, streamRead: s, fileSize: 100000 })
            }
            else if (id === 'exact') {
                let s = mkSource('end')
                tracked[id] = s
                pm.resolve({ ...base, streamRead: s, fileSize: 196608 })
            }
            else if (id === 'srcfail') { //宣告 10MB, 送 196608 後來源自身以錯誤終止(同 api-downloadAbort 之情境)
                let s = mkSource('fail')
                tracked[id] = s
                pm.resolve({ ...base, streamRead: s, fileSize: 10 * 1024 * 1024 })
            }
            else if (id === 'buffer-short') {
                pm.resolve({ ...base, streamRead: Buffer.from('buffer-body'), fileSize: 12, fileType: 'text/plain' })
            }
            else if (id === 'ok') {
                let s = fs.createReadStream(fpSrc)
                tracked[id] = s
                pm.resolve({ ...base, streamRead: s, fileSize: sizeSrc, fileType: 'application/x-7z-compressed' })
            }
            else {
                pm.reject('invalid fileId')
            }
        })
        wsv.on('error', (e) => errs.push(String(e)))
        wsv.on('handler', () => {})

        await w.delay(1000) //待伺服器啟動

    })

    after(function() {
        wsv.stop()
        for (let fd of [fdDownload, pathUploadTemp]) {
            try {
                fs.rmSync(fd, { recursive: true, force: true })
            }
            catch (err) {}
        }
    })

    //mkClient
    let mkClient = () => {
        let wo = new WConverhpClient({ url: `http://127.0.0.1:${port}`, apiName: 'api', getToken: () => 'token-for-test', retryDownload: 0, timeout: 20000 })
        wo.on('error', () => {})
        return wo
    }

    //settleOf, 於限時內取得 settle 結果, 逾時回 'pending'(修正前宣告大於實送者永不完成, 不得讓測試整個卡到 mocha 逾時)
    let settleOf = async(pm, ms) => {
        let r = await Promise.race([
            pm.then((msg) => ({ state: 'resolve', msg })).catch((msg) => ({ state: 'reject', msg })),
            w.delay(ms).then(() => ({ state: 'pending' })),
        ])
        return r
    }

    //fpOf
    let fpOf = (id) => path.resolve(fdDownload, `${id}.bin`)

    it('串流正常結束但少於宣告時, nodejs download() 須 reject 而非 resolve 壞檔, 不留不完整檔, 伺服器發一則含實際與宣告位元組數之 error 事件(修正前 200 + resolve 截斷檔且無事件)', async function() {
        this.timeout(30000)
        errs = []
        let r = await settleOf(mkClient().download('short', () => {}, { fdDownload }), 15000)
        assert.strict.deepEqual(r.state, 'reject', JSON.stringify(r))
        await w.delay(300)
        assert.strict.deepEqual(fs.existsSync(fpOf('short')), false)
        assert.strict.deepEqual(errs.length, 1, JSON.stringify(errs))
        assert.strict.deepEqual(errs[0].includes('download fileId[short] stream error'), true, errs[0])
        assert.strict.deepEqual(errs[0].includes('ended at 196608 bytes but fileSize is 10485760'), true, errs[0])
        assert.strict.deepEqual(tracked.short.destroyed, true)
    })

    it('串流多於宣告時須立即中止, download() reject, 伺服器發一則 error 事件', async function() {
        this.timeout(30000)
        errs = []
        let r = await settleOf(mkClient().download('overrun', () => {}, { fdDownload }), 15000)
        assert.strict.deepEqual(r.state, 'reject', JSON.stringify(r))
        await w.delay(300)
        assert.strict.deepEqual(fs.existsSync(fpOf('overrun')), false)
        assert.strict.deepEqual(errs.length, 1, JSON.stringify(errs))
        assert.strict.deepEqual(errs[0].includes('sent more than fileSize[100000]'), true, errs[0])
        assert.strict.deepEqual(tracked.overrun.destroyed, true) //超量後來源亦須被 pipeline 銷毀, 不得繼續讀取
    })

    it('Buffer 長度與宣告不符時須於送標頭前回 fileSize mismatch 錯誤封包', async function() {
        this.timeout(20000)
        errs = []
        let r = await fetch(`http://127.0.0.1:${port}/api/dw`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer t', 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileId: 'buffer-short' }),
            signal: AbortSignal.timeout(3000),
        })
        assert.strict.deepEqual(r.status, 200)
        assert.strict.deepEqual(r.headers.get('return-type'), 'error')
        assert.strict.deepEqual(r.headers.get('return-retryable'), null)
        let o = u8arr2obj(new Uint8Array(await r.arrayBuffer()))
        assert.strict.deepEqual(o.error, 'fileSize mismatch')
        await w.delay(100)
        assert.strict.deepEqual(errs.length, 1, JSON.stringify(errs))
        assert.strict.deepEqual(errs[0].includes('has 11 bytes but fileSize is 12'), true, errs[0])
    })

    it('對照組: 宣告相符須 resolve 且落地大小一致, 不發 error 事件', async function() {
        this.timeout(30000)
        errs = []
        let r = await settleOf(mkClient().download('exact', () => {}, { fdDownload }), 15000)
        assert.strict.deepEqual(r.state, 'resolve', JSON.stringify(r))
        assert.strict.deepEqual(fs.statSync(r.msg).size, 196608)
        await w.delay(300)
        assert.strict.deepEqual(errs, [])
    })

    it('來源自身出錯者沿用其錯誤: download() reject, 但不得另報長度不符之 error 事件(api-downloadAbort 之情境不得被誤傷)', async function() {
        this.timeout(30000)
        errs = []
        let r = await settleOf(mkClient().download('srcfail', () => {}, { fdDownload }), 15000)
        assert.strict.deepEqual(r.state, 'reject', JSON.stringify(r))
        await w.delay(300)
        assert.strict.deepEqual(fs.existsSync(fpOf('srcfail')), false)
        assert.strict.deepEqual(errs.filter((e) => e.includes('stream error')), [])
    })

    it('前端中途中斷時, 應用端交出之串流須被銷毀(計數串流之接線不得使來源懸置)', async function() {
        this.timeout(20000)
        let ac = new AbortController()
        let r = await fetch(`http://127.0.0.1:${port}/api/dw`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer t', 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileId: 'ok' }),
            signal: ac.signal,
        })
        assert.strict.deepEqual(r.status, 200)
        let reader = r.body.getReader()
        await reader.read() //收到第一段即中斷
        ac.abort()
        let t0 = Date.now()
        while (!tracked.ok.destroyed && Date.now() - t0 < 3000) {
            await w.delay(50)
        }
        assert.strict.deepEqual(tracked.ok.destroyed, true, `fd=${tracked.ok.fd} destroyed=${tracked.ok.destroyed}`)
    })

})
