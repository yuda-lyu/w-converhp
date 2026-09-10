import assert from 'assert'
import fs from 'fs'
import path from 'path'
import w from 'wsemi'
import WConverhpServer from '../src/WConverhpServer.mjs'
import { downloadRoutes, downloadRouteKeys, downloadRouteKeysByStage, fetchDownload } from './api-axes.mjs'


/**
 * api: 應用端可控值之屬性讀取一律收斂(#32)
 *
 * 應用端可用會拋錯之 getter 或 Proxy 包裝其交給套件之值(觀測、記錄之常見手法)。修正前下列六種形狀皆逸出成裸 HTTP 500 且 0 則 error 事件:
 *   辨識階段   instanceof 觸發 Proxy 之 getPrototypeOf trap
 *   狀態階段   readableObjectMode / destroyed / readableEnded 為拋錯之 getter
 *   pipeline   stream.pipeline 建立時讀來源之 pipe
 *   具體化階段 Buffer / Uint8Array 之 Proxy 於 buf.length 拋 Method get TypedArray.prototype.length called on incompatible receiver
 *   欄位擷取   回傳物件之 streamRead / filename / fileSize / fileType 為拋錯之 getter
 *
 * 修正後全部經 attempt 收斂: 回套件錯誤封包 + 一則帶**真因**之 error 事件(公開訊息維持穩定, 真因只進事件供診斷)
 */
describe('api-sourceTraps', function() {

    let port = 8225 //同時test故得要不同port
    let pathUploadTemp = './test/_tmp/uploadTemp-api-sourceTraps'
    let fpSrc = path.resolve('test/1mb.7z')
    let sizeSrc = fs.statSync(fpSrc).size
    let wsv = null
    let errs = []

    before(async function() {
        this.timeout(20000)

        wsv = new WConverhpServer({
            port,
            apiName: 'api',
            useInert: false,
            pathUploadTemp,
            verifyConn: async() => true,
        })
        wsv.on('handler', () => {})
        wsv.on('error', (e) => errs.push(String(e)))
        wsv.on('download', (input, pm) => {
            let id = input.fileId
            let base = { filename: 'x.bin', fileSize: sizeSrc, fileType: 'application/octet-stream' }

            //throwGetter, 於指定物件之指定屬性掛一個會拋錯之 getter
            let throwGetter = (o, k, msg) => {
                Object.defineProperty(o, k, {
                    get() {
                        throw new Error(msg)
                    },
                    enumerable: true,
                    configurable: true,
                })
                return o
            }

            if (id === 'ok') {
                pm.resolve({ ...base, streamRead: fs.createReadStream(fpSrc) })
            }
            else if (id === 'state-objmode') {
                pm.resolve({ ...base, streamRead: throwGetter(fs.createReadStream(fpSrc), 'readableObjectMode', 'objmode boom') })
            }
            else if (id === 'state-destroyed') {
                pm.resolve({ ...base, streamRead: throwGetter(fs.createReadStream(fpSrc), 'destroyed', 'destroyed boom') })
            }
            else if (id === 'state-ended') {
                pm.resolve({ ...base, streamRead: throwGetter(fs.createReadStream(fpSrc), 'readableEnded', 'ended boom') })
            }
            else if (id === 'identify-proto') {
                //Proxy 之 getPrototypeOf trap: instanceof 於此拋錯
                let s = fs.createReadStream(fpSrc)
                pm.resolve({
                    ...base,
                    streamRead: new Proxy(s, {
                        getPrototypeOf() {
                            throw new Error('proto boom')
                        },
                    })
                })
            }
            else if (id === 'pipeline-pipe') {
                //instanceof 與三個狀態屬性皆正常, 但 pipeline 建立時讀 pipe 拋錯
                let s = fs.createReadStream(fpSrc)
                pm.resolve({
                    ...base,
                    streamRead: new Proxy(s, {
                        get(t, k) {
                            if (k === 'pipe') {
                                throw new Error('pipe boom')
                            }
                            let v = t[k]
                            return typeof v === 'function' ? v.bind(t) : v
                        },
                    })
                })
            }
            else if (id === 'materialize-u8a') {
                //Uint8Array 之 Proxy: 具體化時讀 length 拋 incompatible receiver
                let u = new Uint8Array([1, 2, 3])
                pm.resolve({ ...base, fileSize: 3, streamRead: new Proxy(u, {}) })
            }
            else if (id.startsWith('field-')) {
                let o = { ...base, streamRead: fs.createReadStream(fpSrc) }
                pm.resolve(throwGetter(o, id.slice(6), `${id.slice(6)} boom`))
            }
            else {
                pm.reject('invalid fileId')
            }
        })

        await w.delay(1200) //待伺服器啟動
    })

    after(function() {
        wsv.stop()
        try {
            fs.rmSync(pathUploadTemp, { recursive: true, force: true })
        }
        catch (err) {}
    })

    //call, 請求形狀取自路由軸(test/api-axes.mjs), 不在本檔另寫一份
    let call = async(route, fileId) => {
        errs = []
        let r = await fetchDownload(port, route, fileId, { settleMs: 180 }) //eeEmit 為 setTimeout 派發
        return { ...r, errs: [...errs] }
    }

    //expectTrapped, 須為套件錯誤封包 + 恰一則帶真因之事件, 不得為裸 500
    let expectTrapped = async(route, fileId, cause) => {
        let r = await call(route, fileId)
        let tag = `${route}/${fileId}: ${JSON.stringify(r)}`
        assert.strict.deepEqual(r.status, 200, `${tag} —— 不得為裸 HTTP 500`)
        assert.strict.deepEqual(r.returnType, 'error', tag)
        assert.strict.deepEqual(r.error, 'invalid streamRead', tag)
        assert.strict.deepEqual(r.errs.length, 1, `須恰一則事件: ${tag}`)
        assert.strict.deepEqual(r.errs[0].includes(cause), true, `事件須帶真因[${cause}], 實得: ${r.errs[0]}`)
    }

    it('狀態讀取階段: readableObjectMode / destroyed / readableEnded 為拋錯 getter 時須收斂', async function() {
        this.timeout(30000)
        for (let route of downloadRouteKeysByStage('state')) {
            await expectTrapped(route, 'state-objmode', 'objmode boom')
            await expectTrapped(route, 'state-destroyed', 'destroyed boom')
            await expectTrapped(route, 'state-ended', 'ended boom')
        }
    })

    it('辨識階段: Proxy 之 getPrototypeOf trap 使 instanceof 拋錯時須收斂', async function() {
        this.timeout(20000)
        for (let route of downloadRouteKeysByStage('identify')) {
            await expectTrapped(route, 'identify-proto', 'proto boom')
        }
    })

    it('pipeline 建立階段: 讀 pipe 拋錯時須收斂', async function() {
        this.timeout(20000)
        for (let route of downloadRouteKeysByStage('pipeline')) {
            await expectTrapped(route, 'pipeline-pipe', 'pipe boom')
        }
    })

    it('具體化階段: Uint8Array 之 Proxy 於讀 length 拋 incompatible receiver 時須收斂', async function() {
        this.timeout(20000)
        for (let route of downloadRouteKeysByStage('materialize')) {
            await expectTrapped(route, 'materialize-u8a', 'incompatible receiver')
        }
    })

    it('欄位擷取階段: 回傳物件之四個欄位為拋錯 getter 時須收斂', async function() {
        this.timeout(40000)
        //各路由讀哪幾欄取自路由軸之 fields —— /dwgfn 只讀 streamRead 與 filename 兩欄,
        //原本以一段獨立的迴圈特例處理, 現由資料決定, 新增欄位或新增路由時不會漏
        for (let route of downloadRouteKeysByStage('field')) {
            for (let f of downloadRoutes[route].fields) {
                await expectTrapped(route, `field-${f}`, `${f} boom`)
            }
        }
    })

    it('對照組: 正常來源須維持 200 且長度正確、不發事件', async function() {
        this.timeout(20000)
        for (let route of downloadRouteKeys({ dwgfn: '本組驗正常來源之串流本體; /dwgfn 回 JSON 檔名封包而非本體, 其正常路徑由 api-downloadEvents 與 api-characterization 覆蓋' })) {
            let r = await call(route, 'ok')
            assert.strict.deepEqual(r.status, 200, JSON.stringify(r))
            assert.strict.deepEqual(r.returnType, null, JSON.stringify(r))
            assert.strict.deepEqual(r.errs, [])
        }
    })

})
