import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { pathToFileURL } from 'url'


/**
 * unit: 引用本套件(含執行 worker)不得改變宿主行程(對應 w-serv-hapi 之建議書第 1 項; run01 全盤 M1 之 K1、K2、K5)
 *
 * 規格(函式庫對宿主之義務, 對標 Node 核心模組、axios、hapi: 引用即註冊行程層級監聽者為副作用, 宿主之例外由宿主處置):
 *   K1 引用、執行 worker 之後, 宿主 process 之任何事件之監聽數皆與引用前相同
 *   K5 宿主自己之未捕捉例外不被本套件重印(亦不被吞掉: 行程照常以未捕捉例外結束)
 *   K2 不新增字串鍵之全域; 新增之 Symbol 鍵只容許 Node 內建 undici 之全域分派器符號(Node 於載入 http 或 axios 時自行建立, 非本套件註冊, 無監聽、不佔資源)
 *   內建原型(Object、Array、Function、String、Promise 等)之自有鍵不變
 *
 * why: worker 產物(src/*.wk.umd.js)與 dist 由 w-package-tools 之 rollupWorker 樣板產生, 1.1.16 之樣板於產物最外層
 * `process.on('uncaughtExceptionMonitor', (e) => console.log('outer:uncaughtExceptionMonitor', e))` —— 每支產物於**引用時**即在宿主註冊一個監聽,
 * 伺服器 import 三支即 +3, 且宿主自己之未捕捉例外被重印到 stdout。1.1.17 已移除, 以 node toolg/gDistRollup.mjs 重建即消除(run02)。
 * 產物重建與否, 改了樣板而未重建時 git diff 看不出來, 故以行為鎖住。
 *
 * 作法: 每個目標於一個全新子行程內量測(引用前、引用後、執行 worker 後三個快照), 子行程最後自己拋出一個帶唯一標記之未捕捉例外, 觀察其 stdout 與 stderr。
 * 子行程碼寫成檔案執行, 不用 `node --input-type=module -e`: worker thread 繼承父執行緒之 execArgv(含 --input-type=module 與 -e 之碼),
 * 產物之 worker 碼(CommonJS)即以「require is not defined in ES module scope」失敗(run02 實測) —— 「執行 worker 一次」會變成沒有執行, 故另斷言 worker 之回傳值。
 */
describe('unit-hostSideEffects', function() {
    this.timeout(60000)

    let fdRoot = path.resolve('./test/_tmp/unit-hostSideEffects')

    //targets: [模組, 引用後執行之 worker(無則只引用)]
    let targets = [
        ['src/WConverhpServer.mjs', ''],
        ['src/WConverhpClient.mjs', ''],
        ['src/checkTotalHash.wk.umd.js', 'checkTotalHash'],
        ['src/checkSlicesHash.wk.umd.js', 'checkSlicesHash'],
        ['src/mergeSlices.wk.umd.js', 'mergeSlices'],
        ['dist/w-converhp-server.umd.js', ''], //package.json 之 main
        ['dist/w-converhp-client.umd.js', ''],
    ]

    //code, 子行程: snap 取宿主之 process 事件監聽數、全域鍵、內建原型之自有鍵
    let urlHash = pathToFileURL(path.resolve('./node_modules/wsemi/src/getFileXxHash.mjs')).href
    let code = `
import fs from 'fs'
import path from 'path'
import getFileXxHash from ${JSON.stringify(urlHash)}
let snap = () => {
    let ev = {}
    for (let n of process.eventNames()) {
        ev[String(n)] = process.listenerCount(n)
    }
    let protos = {}
    let os = { Object: Object.prototype, Array: Array.prototype, Function: Function.prototype, String: String.prototype, Number: Number.prototype, Boolean: Boolean.prototype, Promise: Promise.prototype, Error: Error.prototype, Map: Map.prototype, Set: Set.prototype, RegExp: RegExp.prototype, Date: Date.prototype, Uint8Array: Uint8Array.prototype, ArrayBuffer: ArrayBuffer.prototype, Buffer: Buffer.prototype, JSON, Math, Reflect }
    for (let k of Object.keys(os)) {
        protos[k] = Reflect.ownKeys(os[k]).map(String).sort()
    }
    return { ev, gStr: Object.getOwnPropertyNames(globalThis).sort(), gSym: Object.getOwnPropertySymbols(globalThis).map(String).sort(), protos }
}
let s0 = snap()
let mod = await import(process.env.W_TARGET_URL)
let s1 = snap()
let ran = null
let fd = process.env.W_FD
if (process.env.W_RUN) {
    fs.mkdirSync(fd, { recursive: true })
    let fn = mod.default
    let parts = [Buffer.alloc(3000, 1), Buffer.alloc(1000, 2)]
    let h = await getFileXxHash(new Blob([Buffer.concat(parts)]))
    let run = {
        checkTotalHash: () => fn(3000, 1024, 'bb22', fd),
        checkSlicesHash: () => fn([], 'aa11', fd),
        mergeSlices: () => {
            parts.forEach((b, i) => fs.writeFileSync(path.join(fd, h + '_' + i), b))
            return fn(h, 2, fd, path.join(fd, h + '.merging'))
        },
    }[process.env.W_RUN]
    ran = await run().then((v) => ({ ok: true, v, h }), (e) => ({ ok: false, e: String(e) }))
}
let s2 = snap()
fs.writeSync(1, 'RESULT:' + JSON.stringify({ s0, s1, s2, ran }) + '\\n')
setTimeout(() => {
    throw new Error(process.env.W_MARKER)
}, 10)
`

    let fpChild = path.join(fdRoot, 'child.mjs')
    let runChild = (target, run, i) => new Promise((resolve) => {
        let marker = `HOST-OWN-UNCAUGHT-${process.pid}-${i}-${Date.now()}`
        let env = { ...process.env, W_TARGET_URL: pathToFileURL(path.resolve(target)).href, W_RUN: run, W_FD: path.join(fdRoot, `t${i}`), W_MARKER: marker }
        let cp = spawn(process.execPath, [fpChild], { env, stdio: ['ignore', 'pipe', 'pipe'] })
        let o = ''
        let e = ''
        cp.stdout.on('data', (b) => {
            o += b
        })
        cp.stderr.on('data', (b) => {
            e += b
        })
        let killer = setTimeout(() => cp.kill(), 30000)
        cp.on('close', (exitCode) => {
            clearTimeout(killer)
            let line = o.split(/\r?\n/).find((l) => l.startsWith('RESULT:'))
            let res = line ? JSON.parse(line.slice(7)) : null
            let count = (s) => s.split(marker).length - 1
            resolve({ exitCode, res, markerInStdout: count(o.split(/\r?\n/).filter((l) => !l.startsWith('RESULT:')).join('\n')), markerInStderr: count(e), stderr: e.slice(0, 600) })
        })
    })

    //diffEv, 兩快照間各事件之監聽數差(只列有差者)
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
    let added = (a, b) => b.filter((x) => !a.includes(x))
    let removed = (a, b) => a.filter((x) => !b.includes(x))
    let isAllowedSym = (s) => /^Symbol\(undici\.globalDispatcher\.\d+\)$/.test(s)

    before(function() {
        fs.rmSync(fdRoot, { recursive: true, force: true })
        fs.mkdirSync(fdRoot, { recursive: true })
        fs.writeFileSync(fpChild, code, 'utf8')
    })

    //expectRan, 各 worker 之 fixture 之應得回傳(與 src 之 .mjs 同一結果; 證明 worker 真的執行了, 而非以啟動失敗拒絕)
    let expectRan = {
        checkTotalHash: (r) => r.ok === true && r.v.bAllExist === false && r.v.bSls === false,
        checkSlicesHash: (r) => r.ok === true && r.v.error === 'no fileSliceHashs',
        mergeSlices: (r) => r.ok === true && r.v.hash === r.h && r.v.filename === `${r.h}.merging`,
    }

    after(function() {
        fs.rmSync(fdRoot, { recursive: true, force: true })
    })

    targets.forEach(([target, run], i) => {

        it(`${target}${run ? ' (引用並執行 worker 一次)' : ''}: 宿主 process 之監聽數不變、宿主之未捕捉例外不被重印亦不被吞、不新增全域、內建原型不變`, async function() {
            let r = await runChild(target, run, i)
            assert.strict.deepEqual(r.res !== null, true, `子行程未輸出結果: ${r.stderr}`)
            let { s0, s1, s2, ran } = r.res
            if (run) {
                assert.strict.deepEqual(expectRan[run](ran), true, `worker 未真正執行: ${JSON.stringify(ran)}`)
            }

            //K1: 引用後、執行 worker 後之監聽數差皆為空
            assert.strict.deepEqual({ afterImport: diffEv(s0.ev, s1.ev), afterRun: diffEv(s0.ev, s2.ev) }, { afterImport: {}, afterRun: {} })

            //K5: 宿主之未捕捉例外只由 Node 自己印一次(stderr), 本套件不重印(stdout 0 次)、不吞(行程以未捕捉例外結束, 結束碼 1)
            assert.strict.deepEqual({ stdout: r.markerInStdout, stderr: r.markerInStderr > 0, exitCode: r.exitCode }, { stdout: 0, stderr: true, exitCode: 1 }, r.stderr)

            //K2: 不新增字串鍵之全域; Symbol 鍵只容許 undici 之全域分派器符號
            assert.strict.deepEqual({ addedStr: added(s0.gStr, s2.gStr), removedStr: removed(s0.gStr, s2.gStr) }, { addedStr: [], removedStr: [] })
            assert.strict.deepEqual(added(s0.gSym, s2.gSym).filter((s) => !isAllowedSym(s)), [])

            //內建原型之自有鍵不變
            assert.strict.deepEqual(s2.protos, s0.protos)
        })

    })

})
