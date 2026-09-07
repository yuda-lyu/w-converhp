import assert from 'assert'
import http from 'http'
import w from 'wsemi'
import WConverhpClient from '../src/WConverhpClient.mjs'


describe('api-uploadMergeError', function() {

    let port = 8189 //同時test故得要不同port
    let url = `http://localhost:${port}`
    let sizeSlice = 64 * 1024
    let srv = null

    //nGet, 記錄merge-slices-get被輪詢次數, 用於驗證確定性失敗時不再重複輪詢
    let nGet = 0

    //resSuccess, 以本套件之協定回應(body為obj2u8arr({success:...})之octet-stream)
    let resSuccess = (res, out) => {
        let u8a = w.obj2u8arr({ success: out })
        let b = Buffer.from(u8a)
        res.writeHead(200, {
            'Content-Type': 'application/octet-stream',
            'Content-Length': b.length,
            'Return-Type': 'success',
            'Return-Msg': 'need to parse',
        })
        res.end(b)
    }

    //readBody
    let readBody = (req) => {
        return new Promise((resolve) => {
            let bs = []
            req.on('data', (c) => bs.push(c))
            req.on('end', () => resolve(Buffer.concat(bs)))
        })
    }

    before(async function() {

        //stub伺服器, 依本套件切片上傳協定回應, 並在merge-slices-get階段回報state為'error',
        //此分支無法由真實WConverhpServer穩定觸發(其僅於queueId解析失敗時才回error), 故以stub精確重現
        srv = http.createServer(async(req, res) => {

            let body = await readBody(req)

            if (req.url.indexOf('/api/ulctr') === 0) {

                let pl = {}
                try {
                    pl = JSON.parse(body.toString('utf8'))
                }
                catch (err) {}

                if (pl.mode === 'check-total-hash') {
                    //回報伺服器上尚無任何切片, 使前端完整上傳
                    resSuccess(res, {
                        path: '/stub',
                        bAllExist: false,
                        bAllSize: false,
                        bAllHash: false,
                        bSls: false,
                        slks: [],
                    })
                    return
                }

                if (pl.mode === 'merge-slices-push') {
                    resSuccess(res, { queueId: 'stub-queue-id' })
                    return
                }

                if (pl.mode === 'merge-slices-get') {
                    nGet += 1
                    //回報合併失敗
                    resSuccess(res, {
                        state: 'error',
                        msg: 'merge slices failed',
                        queueId: pl.queueId,
                        filename: pl.filename,
                        path: '',
                    })
                    return
                }

            }

            if (req.url.indexOf('/api/slc') === 0) {
                //切片接收, 回報成功
                resSuccess(res, { ok: true })
                return
            }

            res.writeHead(404)
            res.end()

        })
        srv.listen(port)

        await w.delay(500) //待伺服器啟動

    })

    after(function() {
        srv.close()
    })

    it('伺服器回報合併失敗時, upload須以錯誤訊息拒絕且停止輪詢', async function() {
        nGet = 0

        let wo = new WConverhpClient({
            url,
            apiName: 'api',
            sizeSlice,
            getToken: () => 'token-for-test',
            retryUpload: 0,
        })
        wo.on('error', () => {})

        let u8a = new Uint8Array(sizeSlice * 2)

        let state = ''
        let msg = null
        try {
            msg = await wo.upload('merge-fail.bin', u8a, () => {})
            state = 'resolve'
        }
        catch (err) {
            state = 'reject'
            msg = err
        }

        //須為reject而非resolve, 否則呼叫端會把錯誤訊息當成上傳成功之結果
        assert.strict.deepEqual(state, 'reject')
        assert.strict.deepEqual(msg, 'merge slices failed')

        //確定性失敗須停止輪詢
        let n0 = nGet
        await w.delay(3000) //輪詢間隔為2秒, 等待足夠時間確認未再輪詢
        assert.strict.deepEqual(nGet, n0)
    })

})
