import assert from 'assert'
import fs from 'fs'
import path from 'path'
import w from 'wsemi'
import WConverhpServer from '../src/WConverhpServer.mjs'
import WConverhpClient from '../src/WConverhpClient.mjs'


/**
 * checkMerging 之輪詢須序列化: 同一時間只允許一條 merge-slices-get(含其 retryUpload 重試鏈)在途
 *   - 應用端 upload 監聽器 reject 屬狀態不穩, 依重試原則須持續重試, 直到應用端接受為止(重試次數與間隔由引用方之 retryUpload 決定)
 *   - 但 setInterval 固定每 2 秒觸發, 若前一條 send 仍在退避重試中即再開一條, 多條重試鏈疊加會同時打伺服器並重複觸發應用端, 屬重試資源之多重濫用
 *   - 本測試以「應用端延遲 1.5 秒後 reject, 前 3 次拒絕、第 4 次接受」構造重疊: 未序列化時 2 秒 tick 必在前一條在途時再發(同時在途 ≥ 2); 序列化後同時在途恆為 1, 且最終仍須成功
 */
describe('api-uploadPollSerial', function() {

    let port = 8203 //同時test故得要不同port
    let pathUploadTemp = path.resolve('./test/_tmp/uploadTemp-api-uploadPollSerial')
    let sizeSlice = 64 * 1024
    let wsv = null

    //nUpload, 應用端 upload 監聽器觸發次數; nInFlight, 同時在途數; maxInFlight, 同時在途峰值
    let nUpload = 0
    let nInFlight = 0
    let maxInFlight = 0

    before(async function() {

        fs.rmSync(pathUploadTemp, { recursive: true, force: true })
        fs.mkdirSync(pathUploadTemp, { recursive: true })

        wsv = new WConverhpServer({ port, apiName: 'api', pathStaticFiles: '.', pathUploadTemp, sizeSlice, verifyConn: async() => true })
        wsv.on('upload', (input, pm) => {
            nUpload += 1
            nInFlight += 1
            maxInFlight = Math.max(maxInFlight, nInFlight)
            let n = nUpload
            setTimeout(() => {
                nInFlight -= 1
                if (n <= 3) {
                    pm.reject(`not yet (${n})`) //前 3 次拒絕, 模擬狀態尚未就緒
                }
                else {
                    pm.resolve('accepted')
                }
            }, 1500)
        })
        wsv.on('error', () => {})

        await w.delay(1000) //待伺服器啟動

    })

    after(function() {
        wsv.stop()
        fs.rmSync(pathUploadTemp, { recursive: true, force: true })
    })

    it('應用端 upload 監聽器連續 reject 時須持續重試直到接受, 且同一時間在途之查詢恆為 1 條', async function() {
        this.timeout(40000)
        let wo = new WConverhpClient({ url: `http://127.0.0.1:${port}`, apiName: 'api', getToken: () => 't', sizeSlice, retryUpload: 1 }) //每條 send 重試 1 次(共 2 次), 鏈長約 1.5+1+1.5 秒 > 2 秒 tick, 未序列化必重疊
        wo.on('error', () => {})
        let t0 = Date.now()
        let r = await wo.upload('serial.bin', new Uint8Array(150 * 1024).fill(9), () => {})
        let ms = Date.now() - t0
        assert.strict.deepEqual(r, 'accepted') //重試仍須觸發, 直到應用端接受
        assert.strict.deepEqual(nUpload, 4, `nUpload[${nUpload}]`) //3 次拒絕 + 1 次接受, 沒有多餘的重複觸發
        assert.strict.deepEqual(maxInFlight, 1, `maxInFlight[${maxInFlight}]`) //同時在途恆為 1
        assert.strict.deepEqual(ms < 30000, true, `ms[${ms}]`)
    })

})
