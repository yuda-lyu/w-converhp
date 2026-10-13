import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { pathToFileURL } from 'url'
import wPorts from './tools/ports.mjs'


let { portOf } = wPorts


/**
 * api: 伺服器之完整生命週期不得改變宿主行程(對應 w-serv-hapi 之建議書第 1 項; run01 全盤 M1 之 K1、K6)
 *
 * 規格:
 *   K1 引用 → 建構啟動 → upload(三支 worker 皆經過: check-total-hash、merge、以及已存切片之 check-slices-hash)→ execute → download → stop,
 *      各階段之後宿主 process 之任何事件之監聽數皆與引用前相同
 *   K6 stop 後無殘留資源: process.getActiveResourcesInfo() 回到引用前之基準; 行程於 stop 後自然結束(不需 process.exit)
 *
 * 以子行程量測(與 unit-hostSideEffects 同法), 入口分 src(開發時)與 dist(package.json 之 main, 下游實際引用者)。
 * check-slices-hash 之經過: 以前端中止(opt.signal)於第一片完成後中止, 使伺服器留有切片, 再傳同一內容即先驗已存切片。
 */
describe('api-hostLifecycle', function() {
    this.timeout(60000)

    let port = portOf('api-hostLifecycle')
    let fdRoot = path.resolve('./test/_tmp/api-hostLifecycle')
    let urlClient = pathToFileURL(path.resolve('./src/WConverhpClient.mjs')).href

    let code = `
import fs from 'fs'
import path from 'path'
import stream from 'stream'
let { default: WConverhpClient } = await import(${JSON.stringify(urlClient)})
console.log = () => {}
let ev = () => {
    let o = {}
    for (let n of process.eventNames()) {
        o[String(n)] = process.listenerCount(n)
    }
    return o
}
//res, 資源快照: 排除 stdio(PipeWrap、TTYWrap)與 Timeout —— 快照本身於 setTimeout 之回呼內取得(該計時器在列),
//且 Node 內部之 Date 標頭快取計時器(node:internal/http 之 utcDate, setUnrefTimeout)亦在列而不阻止行程結束(run02 以 async_hooks 實測);
//計時器之洩漏改由「stop 後行程自然結束之延遲」判定(洩漏之 setInterval 或未清之退避計時器使行程不結束)
let res = () => process.getActiveResourcesInfo().filter((x) => x !== 'PipeWrap' && x !== 'TTYWrap' && x !== 'Timeout').sort()
let out = { stages: [], res0: res(), resEnd: null, tStopped: null }
let mark = (name) => {
    out.stages.push({ name, ev: ev() })
    process.stderr.write('STAGE ' + name + '\\n') //失敗時之定位
}
process.on('exit', () => {
    out.tExit = Date.now()
    fs.writeSync(1, 'RESULT:' + JSON.stringify(out) + '\\n')
})
mark('before-import')
let { default: WConverhpServer } = await import(process.env.W_ENTRY_URL)
mark('import')
let fd = process.env.W_FD
fs.mkdirSync(fd, { recursive: true })
let ws = new WConverhpServer({ port: Number(process.env.W_PORT), apiName: 'api', useInert: false, pathUploadTemp: path.join(fd, 'up'), sizeSlice: 65536, delayForSlice: 0 })
ws.on('error', () => {})
ws.on('execute', (func, input, pm) => pm.resolve({ v: func }))
ws.on('upload', (input, pm) => pm.resolve({ got: input.filenameSafe }))
ws.on('download', (input, pm) => pm.resolve({ streamRead: stream.Readable.from([Buffer.alloc(3000, 2)], { objectMode: false }), filename: 'f.bin', fileSize: 3000, fileType: 'application/octet-stream' }))
let wo = new WConverhpClient({ url: 'http://127.0.0.1:' + process.env.W_PORT, apiName: 'api', sizeSlice: 65536 })
wo.on('error', () => {})
let t0 = Date.now()
while (true) {
    let ok = await wo.execute('ping', {}, null, { signal: AbortSignal.timeout(1000) }).then(() => true, () => false)
    if (ok || Date.now() - t0 > 10000) {
        break
    }
    await new Promise((r) => setTimeout(r, 100))
}
mark('start')
let a = Buffer.alloc(65536 * 3 + 9, 3)
out.uploadA = await wo.upload('a.bin', a, null).then((v) => v, (e) => 'rejected:' + String(e))
mark('upload(check-total-hash, merge)')
let b = Buffer.alloc(65536 * 3 + 11, 4)
let ac = new AbortController()
out.uploadB1 = await wo.upload('b.bin', b, (m) => {
    if (m.prog > 0 && !ac.signal.aborted) {
        ac.abort('stop-after-first-slice')
    }
}, { signal: ac.signal }).then(() => 'resolved', (e) => String(e))
out.uploadB2 = await wo.upload('b.bin', b, null).then((v) => v, (e) => 'rejected:' + String(e))
mark('upload(check-slices-hash)')
out.execute = await wo.execute('e', {}).then((v) => v, (e) => 'rejected:' + String(e))
mark('execute')
out.download = await wo.download('x', null, { fdDownload: path.join(fd, 'dl') }).then((v) => fs.statSync(v).size, (e) => 'rejected:' + String(e))
mark('download')
await ws.stop()
out.tStopped = Date.now()
mark('stop')
setTimeout(() => {
    out.resEnd = res()
}, 300)
`

    //fpChild, 子行程碼寫成檔案執行, 不用 -e: worker thread 繼承 execArgv(含 --input-type=module 與 -e 之碼), 產物之 worker 會以 require is not defined 失敗(見 unit-hostSideEffects)
    let fpChild = path.join(fdRoot, 'child.mjs')
    let runChild = (entry, i) => new Promise((resolve) => {
        let env = { ...process.env, W_ENTRY_URL: pathToFileURL(path.resolve(entry)).href, W_PORT: String(port), W_FD: path.join(fdRoot, `t${i}`) }
        let cp = spawn(process.execPath, [fpChild], { env, stdio: ['ignore', 'pipe', 'pipe'] })
        let o = ''
        let e = ''
        cp.stdout.on('data', (b) => {
            o += b
        })
        cp.stderr.on('data', (b) => {
            e += b
        })
        let killer = setTimeout(() => cp.kill(), 40000)
        cp.on('close', (exitCode) => {
            clearTimeout(killer)
            let line = o.split(/\r?\n/).find((l) => l.startsWith('RESULT:'))
            resolve({ exitCode, res: line ? JSON.parse(line.slice(7)) : null, stderr: e.slice(0, 600) })
        })
    })

    let diffEv = (a, b) => {
        let out = {}
        for (let n of new Set([...Object.keys(a), ...Object.keys(b)])) {
            let d = (b[n] || 0) - (a[n] || 0)
            if (d !== 0) {
                out[n] = d
            }
        }
        return out
    }

    before(function() {
        fs.rmSync(fdRoot, { recursive: true, force: true })
        fs.mkdirSync(fdRoot, { recursive: true })
        fs.writeFileSync(fpChild, code, 'utf8')
    })

    after(function() {
        fs.rmSync(fdRoot, { recursive: true, force: true })
    })

    let entries = ['src/WConverhpServer.mjs', 'dist/w-converhp-server.umd.js']
    entries.forEach((entry, i) => {

        it(`${entry}: 引用 → 啟動 → upload(三支 worker)→ execute → download → stop, 各階段宿主之監聽數差為 0; stop 後資源回到基準且行程自然結束`, async function() {
            let r = await runChild(entry, i)
            assert.strict.deepEqual(r.res !== null, true, `子行程未輸出結果(未結束而被終止?): ${r.stderr}`)
            let o = r.res
            assert.strict.deepEqual(r.exitCode, 0, r.stderr)

            //流程本身成功(否則各階段沒有真的經過 worker)
            assert.strict.deepEqual(o.uploadA, { got: 'a.bin' })
            assert.strict.deepEqual(o.uploadB1, 'stop-after-first-slice')
            assert.strict.deepEqual(o.uploadB2, { got: 'b.bin' })
            assert.strict.deepEqual(o.execute, { v: 'e' })
            assert.strict.deepEqual(o.download, 3000)

            //K1: 各階段之監聽數差(相對於引用前)皆為空
            let base = o.stages[0].ev
            let diffs = o.stages.map((s) => ({ name: s.name, diff: diffEv(base, s.ev) }))
            assert.strict.deepEqual(diffs, o.stages.map((s) => ({ name: s.name, diff: {} })))

            //K6: stop 後資源回到基準(伺服器 socket、檔案操作皆已釋放); 行程自然結束(含快照之 300ms 計時器)
            assert.strict.deepEqual(o.resEnd, o.res0)
            let lag = o.tExit - o.tStopped
            assert.strict.deepEqual(lag < 1500, true, `stop 後至行程結束 ${lag}ms`)
        })

    })

})
