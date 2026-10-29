import assert from 'assert'
import fs from 'fs'
import path from 'path'
import w from 'wsemi'
import WConverhpServer from '../src/WConverhpServer.mjs'
import WConverhpClient from '../src/WConverhpClient.mjs'
import wPorts from './tools/ports.mjs'

let { portOf } = wPorts


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

    let port = portOf('api-uploadInputTypes')
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
        await wsv.ready //待伺服器就緒(ready)
        wc = new WConverhpClient({ url: `http://127.0.0.1:${port}`, retryUpload: 0, sizeSlice: 256 * 1024 })
        wc.on('error', (e) => evs.push(e))
    })

    after(async function() {
        if (wsv) {
            await wsv.stop()
        }
        //清除本檔之暫存夾(測試中介資料測完即刪, 不留殘留)
        fs.rmSync(pathUploadTemp, { recursive: true, force: true })
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
        //R-D(不以牆鐘斷言「於入口拒絕」): 改以持有(hold)之 getToken 為邏輯證據。client 唯一之請求呼叫點(axios)之前必先取 token(fetchToken),
        //故若入口檢核失效而走入網路路徑, 將懸置於永不 settle 之 getToken 而本案必定失敗(與機器快慢無關);
        //正確實作於取 token 之前即 reject, 拒絕當下 getToken 之呼叫數須為 0(即尚無任何請求送出)。入口檢核不涉及網路, 此邏輯證據與原「<1000ms」等價
        let holds = []
        let nToken = 0
        let wd = new WConverhpClient({
            url: `http://127.0.0.1:${port}`,
            retryUpload: 0,
            sizeSlice: 256 * 1024,
            getToken: () => {
                nToken += 1
                let pm = w.genPm() //持有: 不 resolve, 案結束時於 finally 釋放
                holds.push(pm)
                return pm
            },
        })
        let evsD = []
        wd.on('error', (e) => evsD.push(e))
        try {
            for (let [label, inp] of [['null', null], ['undefined', undefined], ['數值', 123], ['plain object', { a: 1 }]]) {
                evsD.length = 0
                let tm = null
                let pmWatch = new Promise((resolve) => {
                    tm = setTimeout(() => resolve({ hang: true }), 30000) //看門狗: 僅防懸置, 非同步點(正確實作時永不觸發)
                })
                let r = null
                try {
                    r = await Promise.race([wd.upload('x.bin', inp, () => {}).then((v) => ({ ok: v }), (e) => ({ err: e })), pmWatch])
                }
                finally {
                    clearTimeout(tm)
                }
                assert.strict.deepEqual(r.hang === true, false, `${label}: 入口檢核失效, 上傳走入網路路徑而懸置於 getToken`)
                assert.strict.deepEqual(nToken, 0, `${label}: 拒絕當下 getToken 須 0 次(尚未送出任何請求), 實得 ${nToken}`)
                assert.strict.deepEqual(w.isestr(r.err), true, `${label}: 須 reject 字串訊息, 實得 ${JSON.stringify(r)}`)
                assert.strict.deepEqual(r.err.includes('input'), true, `${label}: 訊息須指出是輸入之問題, 實得 ${r.err}`)
                assert.strict.deepEqual(evsD.length, 1, `${label}: 須恰一則 error 事件, 實得 ${evsD.length}`)
            }
        }
        finally {
            for (let pm of holds) {
                pm.reject('release hold') //釋放持有(僅缺陷路徑才有), 使懸置之上傳結束而不殘留
            }
        }
    })

})
