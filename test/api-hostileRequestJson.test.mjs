import assert from 'assert'
import fs from 'fs'
import w from 'wsemi'
import WConverhpServer from '../src/WConverhpServer.mjs'


/**
 * api: 請求端 JSON 之任一欄位為惡意形狀時, 伺服器不得回裸 HTTP 500、不得懸置、不得把內部例外字面回給前端
 *
 * 缺陷(第十輪 D3/D4, tmp/probe_r10_json.mjs):
 *   D3 樣板字面量對物件求值時, 自有屬性 toString 為非函數值即拋 Cannot convert object to primitive value ——
 *      不需 getter, JSON.parse 產物即可做到。/ulctr 之 mode → HTTP 500 + 0 則事件; queueId → 錯誤封包內容為內部 TypeError。
 *      帳本 R10 原記「JSON.parse 產物結構上不可能帶拋錯 getter, 列刻意不套」為假。
 *   D4 check-slices-hash 以 fileSliceHashs.length 為迴圈上界而未確認其為陣列 → {"length":1e9} 使請求懸置、worker 空轉。
 *
 * **軸之成員自原始碼掃出**(src/WConverhpServer.mjs 內全部 get(req, 'payload.X'), 遵帳本 R8 與經驗 E1「軸取自契約」):
 * 新增 payload 欄位即自動入軸, 不會因手寫清單而漏。
 */

let fieldsFromSource = () => {
    let c = fs.readFileSync('./src/WConverhpServer.mjs', 'utf8')
    let names = [...c.matchAll(/get\(req, 'payload\.([A-Za-z0-9_]+)'/g)].map((m) => m[1])
    return [...new Set(names)]
}

describe('api-hostileRequestJson', function() {
    this.timeout(120000)

    let port = 8494
    let wsv = null
    let evs = []

    before(async function() {
        wsv = new WConverhpServer({ port, useInert: false, pathUploadTemp: './test/_tmp/uploadTemp-api-hostileRequestJson' })
        wsv.on('error', (e) => evs.push(String(e)))
        wsv.on('upload', (i, pm) => pm.resolve(1))
        wsv.on('download', (i, pm) => pm.reject('no'))
        wsv.on('execute', (func, input, pm) => pm.resolve({ big: 1n })) //輸出無法序列化, 使 /main 走到含 func 之樣板
        await w.delay(600)
    })

    after(async function() {
        if (wsv) {
            await wsv.stop()
        }
    })

    let call = async(p, body, contentType, ms = 5000) => {
        let ac = new AbortController()
        let tm = setTimeout(() => ac.abort(), ms)
        try {
            let r = await fetch(`http://127.0.0.1:${port}/api/${p}`, {
                method: 'POST',
                headers: { 'Content-Type': contentType, 'Authorization': 'Bearer t' },
                body,
                signal: ac.signal,
            })
            let buf = Buffer.from(await r.arrayBuffer())
            let rd = w.u8arr2obj(new Uint8Array(buf), { returnWithStateAndMsg: true })
            return { status: r.status, returnType: r.headers.get('return-type'), body: rd.state === 'success' ? rd.msg : null }
        }
        catch (err) {
            return { hang: true }
        }
        finally {
            clearTimeout(tm)
        }
    }

    it('軸自身: 自原始碼須掃得 payload 欄位(防正規式失效而使本檔空轉)', function() {
        let fs0 = fieldsFromSource()
        for (let k of ['mode', 'fileHash', 'chunkTotal', 'filename', 'fileSize', 'fileSliceHashs', 'queueId', 'fileId']) {
            assert.strict.deepEqual(fs0.includes(k), true, `掃描結果缺 ${k}: ${JSON.stringify(fs0)}`)
        }
    })

    it('JSON 路由 × 全部 payload 欄位 × 惡意形狀: 皆須 HTTP 200 回套件封包、限時內回應、不回內部例外字面', async function() {
        let fields = fieldsFromSource()
        let shapes = [['{toString:1}', { toString: 1 }], ['{length:1e9}', { length: 1e9 }]]
        let baseHash = 'aabbccdd11223344'
        let bases = [
            ['ulctr', { mode: 'check-total-hash', fileHash: baseHash, filename: 'x', fileSize: 3 }],
            ['ulctr', { mode: 'check-slices-hash', fileHash: baseHash, fileSliceHashs: [{ i: 0, h: 'x' }] }],
            ['ulctr', { mode: 'merge-slices-push', fileHash: baseHash, chunkTotal: 1 }],
            ['ulctr', { mode: 'merge-slices-get', fileHash: baseHash, filename: 'x', queueId: `20260911000000|abcdef|${baseHash}` }],
            ['dwgfn', { fileId: 'x' }],
            ['dw', { fileId: 'x' }],
        ]
        let bad = []
        for (let [p, b] of bases) {
            for (let k of fields) {
                for (let [sl, sv] of shapes) {
                    let body = { ...b, [k]: sv }
                    let r = await call(p, JSON.stringify(body), 'application/json')
                    let tag = `/${p} ${b.mode || ''} ${k}=${sl}`
                    if (r.hang) {
                        bad.push(`${tag}: 5000ms 未回應`)
                        continue
                    }
                    if (r.status !== 200) {
                        bad.push(`${tag}: HTTP ${r.status}`)
                        continue
                    }
                    let txt = JSON.stringify(r.body)
                    if (txt.includes('Cannot convert object to primitive value') || txt.includes('TypeError')) {
                        bad.push(`${tag}: 回前端之內容含內部例外字面 ${txt.slice(0, 120)}`)
                    }
                }
            }
        }
        assert.strict.deepEqual(bad, [], `\n${bad.join('\n')}`)
    })

    it('/main 之 func 為惡意形狀且應用端輸出無法序列化時, 須回錯誤封包並恰發一則 error 事件, 不得回裸 500', async function() {
        evs.length = 0
        let u8a = w.obj2u8arr({ func: { toString: 1 }, input: null })
        let r = await call('main', Buffer.from(u8a), 'application/octet-stream')
        await w.delay(150)
        assert.strict.deepEqual(r.hang, undefined, '不得懸置')
        assert.strict.deepEqual(r.status, 200, `不得回裸 500, 實得 HTTP ${r.status}`)
        assert.strict.deepEqual(r.returnType, 'error')
        assert.strict.deepEqual(evs.length, 1, `須恰一則 error 事件, 實得 ${JSON.stringify(evs)}`)
    })

})
