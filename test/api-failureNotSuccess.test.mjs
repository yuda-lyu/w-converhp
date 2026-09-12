import assert from 'assert'
import stream from 'stream'
import w from 'wsemi'
import WConverhpServer from '../src/WConverhpServer.mjs'
import axes from './api-axes.mjs'

let { downloadRouteKeys, fetchDownload } = axes


/**
 * api: 失敗不得被宣稱為成功;失敗時已取得之資源須清理
 *
 * 兩組情境, 皆為第九輪外部複審指出、經實測復現者(tmp/probe_r9_rest.mjs 為修正前路徑、rest2.mjs 為端對端驗收):
 *
 * 一、worker 之 { error } 被當成 success(規則帳本 R6、R3)
 *   checkTotalHash 與 checkSlicesHash 以**回傳 { error }** 表達失敗而非拋錯。
 *   修正前伺服器未檢核, 該物件原樣進入 out.success 並以 Return-Type: success 回應;
 *   前端 sendDataSlice 之各項檢核(bAllHash / sizeSlice / bSls)皆因欄位為 undefined 而略過,
 *   於切片迴圈首次使用 resUpCkt.slks 時拋 TypeError: Cannot read properties of undefined (reading 'indexOf')。
 *   亦即「伺服器宣稱成功、前端崩在一個看不出原因的地方」。
 *
 * 二、下載欄位讀取失敗時, 已讀到之 streamRead 未被銷毀(規則帳本 R1)
 *   streamRead 一律排在 keys 之首, 故凡**後續**欄位之 getter 拋錯者, 該串流已在套件手上。
 *   修正前 readDownloadFields 只回 { ok:false, field, cause } 而不回已讀到之欄位, 路由層無從清理,
 *   應用端交出之串流(常為 fs.createReadStream)就此失去引用且 fd 持續開啟(實測四欄中後三欄皆 destroyed=false)。
 */

let genPort = () => 9600 + Math.floor(Math.random() * 300)

describe('api-failureNotSuccess', function() {
    this.timeout(60000)

    let port = genPort()
    let evs = []
    let streams = []
    let wsv = null

    before(async function() {
        wsv = new WConverhpServer({
            port,
            useInert: false,
            pathUploadTemp: `./test/_tmp/failureNotSuccess_${port}`,
        })
        wsv.on('error', (e) => {
            evs.push(String(e))
        })
        wsv.on('upload', (input, pm) => {
            pm.resolve({ ok: 1 })
        })
        wsv.on('download', (input, pm) => {

            //交出「streamRead 可讀, 但指定欄位之 getter 拋錯」之物件; fileId 為 'ok' 時交出正常且長度相符者
            let sm = new stream.PassThrough()
            streams.push(sm)
            let bad = w.cstr(input.fileId)
            let r = { streamRead: sm, filename: 'a.bin', fileSize: 3, fileType: 'text/plain' }
            if (bad === 'ok') {
                sm.end(Buffer.from('abc'))
            }
            else {
                Object.defineProperty(r, bad, {
                    get() {
                        throw new Error(`${bad} boom`)
                    },
                    enumerable: true,
                })
            }
            pm.resolve(r)
        })
        await w.delay(600)
    })

    after(async function() {
        if (wsv) {
            await wsv.stop()
        }
    })

    //post, 打 /ulctr 並取回應標頭
    let post = async(body) => {
        let ac = new AbortController()
        let tm = setTimeout(() => ac.abort(), 5000)
        try {
            let r = await fetch(`http://127.0.0.1:${port}/api/ulctr`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer t' },
                body: JSON.stringify(body),
                signal: ac.signal,
            })
            await r.arrayBuffer()
            return { status: r.status, returnType: r.headers.get('return-type') }
        }
        catch (err) {
            return { hang: true }
        }
        finally {
            clearTimeout(tm)
        }
    }

    it('check-total-hash 之 fileSize 非法時, 須回 Return-Type error 而不得宣稱 success', async function() {
        for (let fileSize of ['not-a-number', -1, 1.5, '1048576abc']) {
            let r = await post({ mode: 'check-total-hash', fileHash: 'aabbccdd11223344', filename: 'x', fileSize })
            assert.strict.deepEqual(r.hang, undefined, `fileSize[${fileSize}] —— 不得懸置`)
            assert.strict.deepEqual(r.status, 200, `fileSize[${fileSize}] —— 須為 HTTP 200`)
            assert.strict.deepEqual(r.returnType, 'error', `fileSize[${fileSize}] —— 須為 error, 宣稱 success 會使前端於 resUpCkt.slks 崩潰`)
        }
    })

    it('對照組: check-total-hash 之 fileSize 合法(含 0 與數字字串)時須為 success', async function() {
        for (let fileSize of [0, 1024, '1048576']) {
            let r = await post({ mode: 'check-total-hash', fileHash: 'aabbccdd11223344', filename: 'x', fileSize })
            assert.strict.deepEqual(r.returnType, 'success', `fileSize[${fileSize}] —— 合法值須放行(數字字串亦為既有契約, 見 R4b)`)
        }
    })

    it('check-slices-hash 之 fileSliceHashs 為空時, 須回 Return-Type error 而不得宣稱 success', async function() {
        let r = await post({ mode: 'check-slices-hash', fileHash: 'aabbccdd11223344', fileSliceHashs: [] })
        assert.strict.deepEqual(r.hang, undefined, '不得懸置')
        assert.strict.deepEqual(r.returnType, 'error', '須為 error')
    })

    it('下載欄位讀取失敗時, 已讀到之 streamRead 須被銷毀(修正前 destroyed=false 而 fd 持續開啟)', async function() {
        //三條下載路由之成員取自路由軸(遵 R8); /dwgfn 只讀 streamRead+filename, 故其可觸發之後續欄位僅 filename
        for (let route of downloadRouteKeys()) {
            for (let bad of ['fileSize', 'fileType', 'filename']) {
                streams.length = 0
                evs.length = 0
                let r = await fetchDownload(port, route, bad, { timeoutMs: 5000, settleMs: 200 })
                assert.strict.deepEqual(r.hang, undefined, `[${route}] 拋錯欄位[${bad}] —— 不得懸置`)

                //check, /dwgfn 不讀 fileSize/fileType, 該兩格對它為正常交付而非讀取失敗, 故只斷言「串流不得殘留未銷毀」
                let alive = streams.filter((s) => s.destroyed === false)
                assert.strict.deepEqual(alive.length, 0, `[${route}] 拋錯欄位[${bad}] —— 不得殘留未銷毀之串流(實得 ${alive.length} 個)`)
            }
        }
    })

    it('對照組: 欄位皆正常時須正常交付且串流仍被收尾', async function() {
        for (let route of downloadRouteKeys()) {
            streams.length = 0
            let r = await fetchDownload(port, route, 'ok', { timeoutMs: 5000, settleMs: 200 })
            assert.strict.deepEqual(r.hang, undefined, `[${route}] —— 不得懸置`)
            assert.strict.deepEqual(r.status, 200, `[${route}] —— 須為 HTTP 200`)
            let alive = streams.filter((s) => s.destroyed === false)
            assert.strict.deepEqual(alive.length, 0, `[${route}] —— 交付完成後不得殘留未銷毀之串流`)
        }
    })

})
