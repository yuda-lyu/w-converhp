import assert from 'assert'
import fs from 'fs'
import path from 'path'
import stream from 'stream'
import w from 'wsemi'
import WConverhpServer from '../src/WConverhpServer.mjs'
import WConverhpClient from '../src/WConverhpClient.mjs'
import { downloadRouteKeysByBody, fetchDownload } from './api-axes.mjs'


/**
 * api: 伺服器對應用端 download 事件回傳物件之形狀檢核(/dw 與 /dwgf 須對稱)
 *
 * 修正前伺服器只以 lodash isNumber 檢核 fileSize、isestr 檢核 fileType, 且完全不檢核 streamRead:
 *   - streamRead 缺或為 null: hapi 送出 Content-Length 卻無本體, 連線懸置至前端閒置逾時(預設 5 分鐘, 再乘 retryDownload)
 *   - fileSize 為 NaN/Infinity/負數/小數: 通過 isNumber, node 寫標頭時拋錯, hapi 只能直接斷線, 前端連回應標頭都收不到(fetch failed)
 *   - fileType 含 CR/LF: 通過 isestr, hapi 設定標頭時拋錯而回裸 HTTP 500
 *   - stream-like(有 pipe 但非 Readable)、objectMode 串流: hapi 拒收回裸 500, 且應用端交出之串流未被銷毀
 *   - 已 destroy 之串流(瀏覽器兩階段下載重用同一串流): 懸置
 *   以上伺服器皆不發 error 事件, 應用端無從得知是自己給錯值
 * 修正後一律於送出標頭前收斂為套件既有錯誤封包(HTTP 200 + Return-Type error; 屬應用端狀態, 依重試原則不標示 retryable), 發一則 error 事件並銷毀來源;
 * Buffer、字串、可 JSON 化物件為 hapi 現已接受且可正常下載之本體型別, 須維持相容(不得以 instanceof Readable 白名單擋掉)
 */
describe('api-downloadShape', function() {

    let port = 8214 //同時test故得要不同port
    let pathUploadTemp = './test/_tmp/uploadTemp-api-downloadShape'
    let fdDownload = './test/_tmp/download-api-downloadShape'
    let fpSrc = path.resolve('test/1mb.7z')
    let sizeSrc = fs.statSync(fpSrc).size
    let wsv = null

    //errs, 伺服器 error 事件
    let errs = []

    //tracked, 應用端交出之串流(依 fileId, 供斷言已被銷毀)
    let tracked = {}

    //flags
    let flags = {}

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
            let base = { filename: 'x.bin', fileSize: sizeSrc, fileType: 'application/octet-stream' }
            let rs = () => {
                let s = fs.createReadStream(fpSrc)
                tracked[id] = s
                return s
            }
            if (id === 'ok') {
                pm.resolve({ ...base, streamRead: rs() })
            }
            else if (id === 'no-stream') {
                pm.resolve({ ...base })
            }
            else if (id === 'null-stream') {
                pm.resolve({ ...base, streamRead: null })
            }
            else if (id === 'stream-like') {
                let sl = {
                    pipe() {},
                    destroy() {
                        flags.streamLikeDestroyed = true
                    },
                }
                pm.resolve({ ...base, streamRead: sl, fileSize: 3 })
            }
            else if (id === 'object-mode') {
                let s = stream.Readable.from(['abc'])
                tracked[id] = s
                pm.resolve({ ...base, streamRead: s, fileSize: 3 })
            }
            else if (id === 'destroyed-stream') {
                let s = rs()
                s.destroy()
                pm.resolve({ ...base, streamRead: s })
            }
            else if (id === 'size-nan') {
                pm.resolve({ ...base, streamRead: rs(), fileSize: NaN })
            }
            else if (id === 'size-infinity') {
                pm.resolve({ ...base, streamRead: rs(), fileSize: Infinity })
            }
            else if (id === 'size-negative') {
                pm.resolve({ ...base, streamRead: rs(), fileSize: -1 })
            }
            else if (id === 'size-fractional') {
                pm.resolve({ ...base, streamRead: rs(), fileSize: 1.5 })
            }
            else if (id === 'size-string') {
                pm.resolve({ ...base, streamRead: rs(), fileSize: String(sizeSrc) })
            }
            else if (id === 'type-crlf') {
                pm.resolve({ ...base, streamRead: rs(), fileType: 'text/plain\r\nX-Probe: injected' })
            }
            else if (id === 'buffer') {
                pm.resolve({ ...base, streamRead: Buffer.from('buffer-body'), fileSize: 11, fileType: 'text/plain' })
            }
            else if (id === 'string') {
                pm.resolve({ ...base, streamRead: 'abc', fileSize: 3, fileType: 'text/plain' })
            }
            else if (id === 'plain-object') {
                pm.resolve({ ...base, streamRead: { x: 1 }, fileSize: 7, fileType: 'application/json' })
            }
            else if (id === 'number') {
                pm.resolve({ ...base, streamRead: 42, fileSize: 2, fileType: 'text/plain' })
            }
            else if (id === 'boolean') {
                pm.resolve({ ...base, streamRead: true, fileSize: 4, fileType: 'text/plain' })
            }
            else if (id === 'getter-throw') {
                //pipe 為會拋錯之 getter: 修正前 duck-typing 之屬性讀取在 try 之外, 例外逸出而回裸 HTTP 500
                let o = {}
                Object.defineProperty(o, 'pipe', {
                    get() {
                        throw new Error('getter boom')
                    },
                })
                pm.resolve({ ...base, streamRead: o, fileSize: 3 })
            }
            else if (id === 'size-unsafe') {
                pm.resolve({ ...base, streamRead: rs(), fileSize: Number.MAX_SAFE_INTEGER + 1 })
            }
            else if (id === 'size-exp') {
                pm.resolve({ ...base, streamRead: rs(), fileSize: 1e21 })
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

    //call, 直接打路由並解析封包; 以 3 秒為限, 逾時即視為懸置(修正前 streamRead 缺失之徵狀)
    //call, 請求形狀取自路由軸(test/api-axes.mjs); timeoutMs 使「懸置」成為可斷言之觀察值而非測試逾時
    let call = async(route, fileId) => {
        return fetchDownload(port, route, fileId, { timeoutMs: 3000 })
    }

    //routes, 本檔驗「交付檔案本體」之契約(fileSize/fileType/Content-Length/逐位元組正確),
    //故取本體形式為 stream 之成員 —— /dwgfn 只回檔名封包、不讀 fileSize/fileType, 取得檔名後即銷毀來源,
    //其形狀檢核由 api-downloadEvents(事件與訊息)與 api-sourceTraps(欄位階段)覆蓋
    let routes = downloadRouteKeysByBody('stream')

    //expectShapeError, 各路由皆須: 不懸置、HTTP 200、Return-Type error、指定錯誤訊息、不標示 retryable、恰一則含 fileId 之 error 事件
    let expectShapeError = async(fileId, msg) => {
        for (let route of routes) {
            errs = []
            let r = await call(route, fileId)
            let tag = `${route}/${fileId}: ${JSON.stringify(r)}`
            assert.strict.deepEqual(r.hang, undefined, tag)
            assert.strict.deepEqual(r.status, 200, tag)
            assert.strict.deepEqual(r.returnType, 'error', tag)
            assert.strict.deepEqual(r.retryable, null, tag) //應用端狀態, 依重試原則不得標示不重試
            assert.strict.deepEqual(r.error, msg, tag)
            await w.delay(100) //eeEmit 為 setTimeout 發送
            assert.strict.deepEqual(errs.length, 1, `${tag} errs=${JSON.stringify(errs)}`)
            assert.strict.deepEqual(errs[0].includes(`download fileId[${fileId}]`), true, errs[0])
        }
    }

    it('streamRead 缺或為 null 時, 兩路由皆須回 invalid streamRead 錯誤封包並發 error 事件(修正前連線懸置至前端逾時且無事件)', async function() {
        this.timeout(20000)
        await expectShapeError('no-stream', 'invalid streamRead')
        await expectShapeError('null-stream', 'invalid streamRead')
    })

    it('streamRead 為 stream-like、objectMode 或已 destroy 者須回 invalid streamRead, 且來源須被銷毀(修正前 hapi 回裸 500 且來源未銷毀 / 已 destroy 者懸置)', async function() {
        this.timeout(20000)
        flags.streamLikeDestroyed = false
        await expectShapeError('stream-like', 'invalid streamRead')
        assert.strict.deepEqual(flags.streamLikeDestroyed, true)
        await expectShapeError('object-mode', 'invalid streamRead')
        assert.strict.deepEqual(tracked['object-mode'].destroyed, true)
        await expectShapeError('destroyed-stream', 'invalid streamRead')
    })

    it('fileSize 為 NaN/Infinity/負數/小數時須回 invalid fileSize 並銷毀來源(修正前前二者通過 isNumber, 連線直接斷且無回應標頭)', async function() {
        this.timeout(30000)
        for (let id of ['size-nan', 'size-infinity', 'size-negative', 'size-fractional']) {
            await expectShapeError(id, 'invalid fileSize')
            assert.strict.deepEqual(tracked[id].destroyed, true, id)
        }
    })

    it('fileSize 為數字字串時須被接受並正常下載(isValidFileSize 採 wsemi 之 isp0int, 呼叫端以 cint 正規化後才寫標頭與比對長度)', async function() {
        this.timeout(20000)
        //此為使用者裁示之契約: 檢核用 isp0int(接受數字字串)+ cint 正規化成對。
        //正規化不可省 —— fileSize 會以 === 與實際位元組數比較, 字串會使長度正確之下載反被判為 fileSize mismatch
        for (let route of routes) {
            errs = []
            let r = await call(route, 'size-string')
            let tag = `${route}: ${JSON.stringify({ status: r.status, returnType: r.returnType, bytes: r.bytes })}`
            assert.strict.deepEqual(r.status, 200, tag)
            assert.strict.deepEqual(r.returnType, null, tag)
            assert.strict.deepEqual(r.bytes, sizeSrc, tag)
            await w.delay(100)
            assert.strict.deepEqual(errs, [])
        }
    })

    it('fileSize 超出安全整數範圍時須回 invalid fileSize(修正前通過 Number.isInteger, 其字串形式帶指數記號而不合 Content-Length 語法, 連線懸置且無回應標頭)', async function() {
        this.timeout(30000)
        for (let id of ['size-unsafe', 'size-exp']) {
            await expectShapeError(id, 'invalid fileSize')
            assert.strict.deepEqual(tracked[id].destroyed, true, id)
        }
    })

    it('streamRead 之 pipe 為會拋錯之 getter 時須回 invalid streamRead(修正前屬性讀取在 try 之外, 例外逸出而回裸 HTTP 500 且無 error 事件)', async function() {
        this.timeout(20000)
        await expectShapeError('getter-throw', 'invalid streamRead')
    })

    it('相容: number 與 boolean 為 hapi 原生即接受之本體型別, 須維持可下載(前一輪之修正誤將其擋成 invalid streamRead)', async function() {
        this.timeout(20000)
        let cases = [
            { id: 'number', text: '42' },
            { id: 'boolean', text: 'true' },
        ]
        for (let route of routes) {
            for (let c of cases) {
                errs = []
                let r = await call(route, c.id)
                let tag = `${route}/${c.id}: ${JSON.stringify(r)}`
                assert.strict.deepEqual(r.status, 200, tag)
                assert.strict.deepEqual(r.returnType, null, tag)
                assert.strict.deepEqual(r.text, c.text, tag)
                await w.delay(100)
                assert.strict.deepEqual(errs, [])
            }
        }
    })

    it('fileType 含 CR/LF 時須回 invalid fileType 並銷毀來源(修正前 hapi 設定標頭拋錯而回裸 HTTP 500)', async function() {
        this.timeout(20000)
        await expectShapeError('type-crlf', 'invalid fileType')
        assert.strict.deepEqual(tracked['type-crlf'].destroyed, true)
    })

    it('相容: Buffer、字串、可 JSON 化物件當 streamRead 且 fileSize 相符時, 兩路由皆須正常下載且本體逐位元組正確', async function() {
        this.timeout(20000)
        let cases = [
            { id: 'buffer', text: 'buffer-body' },
            { id: 'string', text: 'abc' },
            { id: 'plain-object', text: '{"x":1}' },
        ]
        for (let route of routes) {
            for (let c of cases) {
                errs = []
                let r = await call(route, c.id)
                let tag = `${route}/${c.id}: ${JSON.stringify(r)}`
                assert.strict.deepEqual(r.status, 200, tag)
                assert.strict.deepEqual(r.returnType, null, tag)
                assert.strict.deepEqual(r.text, c.text, tag)
                await w.delay(100)
                assert.strict.deepEqual(errs, [])
            }
        }
    })

    it('對照組: 正常串流須 200 且長度與來源一致, 不發 error 事件', async function() {
        this.timeout(20000)
        for (let route of routes) {
            errs = []
            let r = await call(route, 'ok')
            assert.strict.deepEqual(r.status, 200, JSON.stringify(r))
            assert.strict.deepEqual(r.bytes, sizeSrc)
            await w.delay(100)
            assert.strict.deepEqual(errs, [])
        }
    })

    it('nodejs client 對形狀錯誤須即時以該錯誤 reject, 而非等到閒置逾時', async function() {
        this.timeout(20000)
        let wo = new WConverhpClient({ url: `http://127.0.0.1:${port}`, apiName: 'api', getToken: () => 'token-for-test', retryDownload: 0, timeout: 15000 })
        wo.on('error', () => {})
        let t0 = Date.now()
        let r = await Promise.race([
            wo.download('no-stream', () => {}, { fdDownload }).then((msg) => ({ state: 'resolve', msg })).catch((msg) => ({ state: 'reject', msg })),
            w.delay(5000).then(() => ({ state: 'pending' })),
        ])
        assert.strict.deepEqual(r, { state: 'reject', msg: 'invalid streamRead' })
        assert.strict.deepEqual(Date.now() - t0 < 3000, true, `${Date.now() - t0}ms`)
    })

})
