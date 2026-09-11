import assert from 'assert'
import fs from 'fs'
import path from 'path'
import w from 'wsemi'
import WConverhpServer from '../src/WConverhpServer.mjs'
import WConverhpClient from '../src/WConverhpClient.mjs'


/**
 * api: upload 之輸入型別軸 —— 應用端收到之檔案須與輸入之位元組完全相同; 不支援之輸入須於入口以明確訊息拒絕並發一則 error 事件
 *
 * 缺陷(第十輪 D2, tmp/probe_r10_ab.mjs、probe_r10_ab2.mjs): sendDataSlice 之大小、切片、雜湊三者對同一輸入各自解讀 ——
 * 大小以 bb.size / bb.length 猜、切片以 bb.slice、雜湊以 new Blob([inp])。實測:
 *   ArrayBuffer → size 與 length 皆 undefined 而 n=1, 雜湊卻以整個 ArrayBuffer 計 → **success, 應用端收到 1 byte**(靜默毀損)
 *   DataView → TypeError: bb.slice is not a function
 *   Uint16Array → .length 為元素數, 切出之位元組為 2 倍 → Payload Too Large
 *   null → TypeError: Cannot read properties of null, 且 0 則 error 事件
 * 而同檔之 sendDataSlice 註解寫「for ArrayBuffer」—— 承諾支援而未兌現。
 * 軸之成員取自 fetch/axios 之 BodyInit(Blob、ArrayBuffer、所有 ArrayBufferView), 非取自缺陷。
 */
describe('api-uploadInputTypes', function() {
    this.timeout(90000)

    let port = 8493
    let pathUploadTemp = path.resolve('./test/_tmp/uploadTemp-api-uploadInputTypes')
    let wsv = null
    let wc = null
    let evs = []

    before(async function() {
        fs.rmSync(pathUploadTemp, { recursive: true, force: true })
        wsv = new WConverhpServer({ port, useInert: false, pathUploadTemp, sizeSlice: 256 * 1024 }) //兩端 sizeSlice 須一致
        wsv.on('error', () => {})
        wsv.on('upload', (input, pm) => {
            let b = fs.readFileSync(input.path)
            pm.resolve({ size: b.length, hex: b.subarray(0, 8).toString('hex') + b.subarray(-8).toString('hex') })
        })
        await w.delay(600)
        wc = new WConverhpClient({ url: `http://127.0.0.1:${port}`, retryUpload: 0, sizeSlice: 256 * 1024 })
        wc.on('error', (e) => evs.push(e))
    })

    after(async function() {
        if (wsv) {
            await wsv.stop()
        }
    })

    //bytesOf, 取得輸入之位元組(期望值)
    let bytesOf = (v) => {
        if (v instanceof ArrayBuffer) {
            return Buffer.from(v)
        }
        return Buffer.from(v.buffer, v.byteOffset, v.byteLength)
    }
    let src = (n, seed) => {
        let u = new Uint8Array(n)
        for (let i = 0; i < n; i++) {
            u[i] = (i * seed + 5) % 251
        }
        return u
    }

    let n = 600 * 1024 //跨越多片(sizeSlice 256kb)
    let binaryAxis = () => [
        ['Buffer', Buffer.from(src(n, 3))],
        ['Uint8Array', src(n, 5)],
        ['Buffer 子視圖(非零 byteOffset)', Buffer.from(src(n + 64, 7).buffer, 32, n)],
        ['ArrayBuffer', src(n, 11).buffer],
        ['DataView', new DataView(src(n, 13).buffer)],
        ['Uint16Array', new Uint16Array(src(n, 17).buffer)],
        ['Float64Array', new Float64Array(src(n, 19).buffer)],
    ]

    it('位元組型輸入(ArrayBuffer 與所有 ArrayBufferView): 應用端收到之檔案須與輸入位元組完全相同', async function() {
        let bad = []
        for (let [label, inp] of binaryAxis()) {
            let exp = bytesOf(inp)
            let r = await wc.upload(`${label}.bin`, inp, () => {}).then((v) => v, (e) => ({ err: String(e) }))
            let expHex = exp.subarray(0, 8).toString('hex') + exp.subarray(-8).toString('hex')
            if (!(w.iseobj(r) && r.size === exp.length && r.hex === expHex)) {
                bad.push(`${label}: 期望 ${exp.length} bytes, 實得 ${JSON.stringify(r)}`)
            }
        }
        assert.strict.deepEqual(bad, [], bad.join('\n'))
    })

    it('Blob: 應用端收到之檔案須與輸入位元組完全相同(對照組)', async function() {
        let u = src(n, 23)
        let r = await wc.upload('blob.bin', new Blob([u]), () => {})
        assert.strict.deepEqual(r.size, n)
    })

    it('不支援之輸入須於入口以明確訊息拒絕, 且恰發一則 error 事件, 不得送出任何請求', async function() {
        for (let [label, inp] of [['null', null], ['undefined', undefined], ['數值', 123], ['plain object', { a: 1 }]]) {
            evs.length = 0
            let t0 = Date.now()
            let r = await wc.upload('x.bin', inp, () => {}).then((v) => ({ ok: v }), (e) => ({ err: e }))
            assert.strict.deepEqual(w.isestr(r.err), true, `${label}: 須 reject 字串訊息, 實得 ${JSON.stringify(r)}`)
            assert.strict.deepEqual(r.err.includes('input'), true, `${label}: 訊息須指出是輸入之問題, 實得 ${r.err}`)
            assert.strict.deepEqual(evs.length, 1, `${label}: 須恰一則 error 事件, 實得 ${evs.length}`)
            assert.strict.deepEqual(Date.now() - t0 < 1000, true, `${label}: 須於入口拒絕而非進入重試鏈`)
        }
    })

})
