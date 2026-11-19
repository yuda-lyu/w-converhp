/**
 * 差分探測工具(帳本 R32 之「如何找到站點」; 經驗 E54)
 *
 * 用途: 上游相依(如 wsemi)改變某類函數之失敗語意(拋錯 ↔ 回值)時, 找出本套件「借其拋錯而成立」之防線。
 * 作法: 同一組「不可讀形狀(已撤銷之 Proxy、拋錯之 Symbol.toStringTag、get / has / ownKeys 陷阱拋錯之 Proxy、String / Number / Boolean 包裝物件)
 * × 注入點(verifyConn 回傳、execute / upload / download 之 resolve 與 reject 及各欄位、前端三個公開方法之全部參數、前後端全部建構選項、getToken 之回傳)」之矩陣,
 * 對「舊版相依 + 改動前 src」「新版相依 + 改動前 src」「新版相依 + 改動後 src」各跑一次, 兩兩比對; 前兩者不同之格即候選站點, 再依「防線是否因此失效」歸類。
 *
 * 用法(套件根為 cwd; 全部落 ./tmp/<名>/):
 *   1. 舊版相依: ./tmp/<名>/old/package.json(dependencies 給舊版 wsemi 之精確版本; **不得帶 "type": "module"**, 否則 *.wk.umd.js 被當 ESM), 然後 npm --prefix ./tmp/<名>/old install
 *   2. 改動前之 src 複製兩份: ./tmp/<名>/old/src(其上層之 node_modules 為舊版)、./tmp/<名>/pre/src(解析到 repo 之現版)
 *   3. node test/tools/probeDiff.mjs run ./tmp/<名>/old/src ./tmp/<名>/res-old.json
 *      node test/tools/probeDiff.mjs run ./tmp/<名>/pre/src ./tmp/<名>/res-pre.json
 *      node test/tools/probeDiff.mjs run ./src ./tmp/<名>/res-fix.json
 *   4. node test/tools/probeDiff.mjs compare ./tmp/<名>/res-old.json ./tmp/<名>/res-pre.json --group     # 依注入點分組計數
 *      node test/tools/probeDiff.mjs compare ./tmp/<名>/res-old.json ./tmp/<名>/res-fix.json --loose     # 修後對舊版之剩餘差異(事件文字之取因前綴不計)
 *   run 會起真伺服器(埠由作業系統配發)與真前端, 須以測試鎖執行: node C:/opensrcOper/tools/quiet-run.mjs --lock --name <短名> -- node test/tools/probeDiff.mjs run ...
 *   run 之工作目錄為 <outJson 同夾>/work-<outJson 名>(伺服器之暫存夾落在其中, 不在 repo 根), 約 110 秒。
 *
 * 不是測試(不帶 .test. 中綴, 不被 mocha 抓取); 不匯出任何成員(同 loadTrial.mjs)。
 */
import fs from 'fs'
import net from 'net'
import path from 'path'
import { pathToFileURL } from 'url'
import w from 'wsemi'

/* eslint-disable no-new-wrappers */ //形狀矩陣刻意含 new String / new Number / new Boolean 之包裝物件(W-20)

let mode = process.argv[2]

//=== compare =====================================================================================
if (mode === 'compare') {
    let [fa, fb] = process.argv.slice(3, 5)
    let bGroup = process.argv.includes('--group')
    let bLoose = process.argv.includes('--loose')
    let a = JSON.parse(fs.readFileSync(fa, 'utf8'))
    let b = JSON.parse(fs.readFileSync(fb, 'utf8'))

    //norm, 去除與本機路徑無關之雜訊; --loose 另將事件文字中之「取因」前綴與原生訊息之措辭(來源函數名、被撤銷 Proxy 之操作名)抹平, 只比較結構、狀態、事件數與其餘文字
    let norm = (v) => {
        let s = JSON.stringify(v, null, 0)
            .replace(/[A-Za-z]:[\\/][^"]*?([\\/])/g, '<path>$1')
            .replace(/\\\\/g, '/')
        if (bLoose) {
            s = s.replace(/obj2stru8arr: (?:Type)?Error: /g, '<C>')
                .replace(/unreadable value: /g, '<C>')
                .replace(/Cannot perform '[^']*' on a proxy that has been revoked/g, '<revoked>')
                .replace(/(?:Type)?Error: /g, '')
        }
        return s
    }

    let keys = Object.keys(a.results)
    let diffs = []
    for (let k of keys) {
        let x = norm(a.results[k])
        let y = norm(b.results[k])
        if (x !== y) {
            diffs.push({ k, x, y })
        }
    }
    console.log(`A=${a.wsemiVer} ${a.srcDir}`)
    console.log(`B=${b.wsemiVer} ${b.srcDir}`)
    console.log(`cells=${keys.length} same=${keys.length - diffs.length} diff=${diffs.length}`)
    if (bGroup) {
        let g = {}
        for (let d of diffs) {
            let p = d.k.split('|')[0]
            g[p] = (g[p] || 0) + 1
        }
        for (let [p, n] of Object.entries(g)) {
            console.log(`  ${p}: ${n}`)
        }
    }
    else {
        for (let d of diffs) {
            console.log(`\n## ${d.k}\n  A: ${d.x.slice(0, 400)}\n  B: ${d.y.slice(0, 400)}`)
        }
    }
    process.exit(0)
}

//=== run =========================================================================================
if (mode !== 'run') {
    console.log('usage: node probeDiff.mjs run <srcDir> <outJson> | compare <a.json> <b.json> [--group] [--loose]')
    process.exit(2)
}

let srcDir = path.resolve(process.argv[3])
let outFile = path.resolve(process.argv[4])
let workDir = path.resolve(path.dirname(outFile), 'work-' + path.basename(outFile, '.json'))
fs.rmSync(workDir, { recursive: true, force: true })
fs.mkdirSync(workDir, { recursive: true })
process.chdir(workDir)

let { default: WConverhpServer } = await import(pathToFileURL(path.join(srcDir, 'WConverhpServer.mjs')).href)
let { default: WConverhpClient } = await import(pathToFileURL(path.join(srcDir, 'WConverhpClient.mjs')).href)

//wsemiVer, 取 srcDir 往上第一個 node_modules/wsemi 之版本(即該 src 實際解析到者)
let wsemiVer = (() => {
    let d = srcDir
    for (let i = 0; i < 12; i++) {
        let f = path.join(d, 'node_modules', 'wsemi', 'package.json')
        if (fs.existsSync(f)) {
            return JSON.parse(fs.readFileSync(f, 'utf8')).version
        }
        d = path.dirname(d)
    }
    return 'unknown'
})()

let log0 = console.log
console.log = () => {}
console.error = () => {}

//mk, 不可讀形狀(每次新建)
let mk = {
    revoked: () => {
        let r = Proxy.revocable({}, {}); r.revoke(); return r.proxy
    },
    revokedFn: () => {
        let r = Proxy.revocable(function() {}, {}); r.revoke(); return r.proxy
    },
    tagThrow: () => {
        let o = { a: 1 }; Object.defineProperty(o, Symbol.toStringTag, {
            get() {
                throw new Error('tag boom')
            }
        }); return o
    },
    getTrap: () => new Proxy({}, {
        get() {
            throw new Error('get boom')
        }
    }),
    hasTrap: () => new Proxy({ a: 1 }, {
        has() {
            throw new Error('has boom')
        }
    }),
    ownKeysTrap: () => new Proxy({ a: 1 }, {
        ownKeys() {
            throw new Error('ownKeys boom')
        }
    }),
    strWrap: () => new String('abc'),
    numWrap: () => new Number(5),
    bolWrap: () => new Boolean(true),
}
let shapeKeys = Object.keys(mk)

let sum = (v) => {
    try {
        let s = JSON.stringify(v)
        return s === undefined ? 'undefined' : s.slice(0, 200)
    }
    catch (err) {
        return '<unjsonable>'
    }
}
let errText = (e) => {
    try {
        if (typeof e === 'string') {
            return e.slice(0, 200)
        }
        return 'obj:' + sum(e)
    }
    catch (err) {
        return '<err>'
    }
}
let sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
let freePort = () => new Promise((resolve) => {
    let s = net.createServer()
    s.listen(0, '127.0.0.1', () => {
        let p = s.address().port
        s.close(() => resolve(p))
    })
})
let withTimeout = (pm, ms) => Promise.race([pm, new Promise((resolve) => setTimeout(() => resolve({ hang: true }), ms))])

let results = {}
let put = (k, v) => {
    results[k] = v
}

//live server, 行為由 st 注入
let st = {}
let errs = []
let port = await freePort()
let wsv = new WConverhpServer({
    port,
    apiName: 'api',
    useInert: false,
    pathUploadTemp: './up',
    verifyConn: (inp) => st.verify(inp),
})
wsv.on('execute', (func, input, pm) => st.exec(func, input, pm))
wsv.on('upload', (input, pm) => st.up(input, pm))
wsv.on('download', (input, pm) => st.dw(input, pm))
wsv.on('error', (e) => errs.push(errText(e)))
wsv.on('handler', () => {})
await wsv.ready

let okVerify = () => true
let base = `http://127.0.0.1:${port}`

let rawMain = async(func) => {
    errs = []
    let r = await withTimeout(fetch(`${base}/api/main`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer t', 'Content-Type': 'application/octet-stream' },
        body: Buffer.from(w.obj2u8arr({ func, input: {} })),
    }).then(async(res) => {
        let u8a = new Uint8Array(Buffer.from(await res.arrayBuffer()))
        let d = w.u8arr2obj(u8a, { returnWithStateAndMsg: true })
        return { status: res.status, rt: res.headers.get('return-type'), state: d.state, msg: sum(d.msg) }
    }), 3000)
    await sleep(60)
    return { ...r, errs: [...errs] }
}

let rawDl = async(route) => {
    errs = []
    let url = `${base}/api/${route}`
    let init = { method: 'POST', headers: { 'Authorization': 'Bearer t', 'Content-Type': 'application/json' }, body: JSON.stringify({ fileId: 'f1' }) }
    if (route === 'dwgf') {
        url = `${base}/api/dwgf?fileId=f1&token=t`
        init = { method: 'GET' }
    }
    let r = await withTimeout(fetch(url, init).then(async(res) => {
        let b = Buffer.from(await res.arrayBuffer())
        return {
            status: res.status,
            rt: res.headers.get('return-type'),
            rm: res.headers.get('return-msg'),
            cd: res.headers.get('content-disposition'),
            ct: res.headers.get('content-type'),
            cl: res.headers.get('content-length'),
            body: b.length > 200 ? `len${b.length}` : b.toString('utf8'),
        }
    }), 3000)
    await sleep(60)
    return { ...r, errs: [...errs] }
}

let goodOut = () => ({ streamRead: Buffer.from('hello'), filename: 'a.txt', fileSize: 5, fileType: 'text/plain' })

//S1 verifyConn 回傳值為不可讀形狀(同步回傳)
for (let k of shapeKeys) {
    st.verify = () => mk[k]()
    st.exec = (f, i, pm) => pm.resolve({ ok: 1 })
    st.dw = (i, pm) => pm.resolve(goodOut())
    put(`S1 verifyConn回傳|${k}|main`, await rawMain('x'))
    put(`S1 verifyConn回傳|${k}|dw`, await rawDl('dw'))
}
st.verify = okVerify

//S2 execute 以不可讀形狀 resolve / reject(頂層與巢狀)
for (let k of shapeKeys) {
    for (let nest of [false, true]) {
        let tag = nest ? `巢狀:${k}` : k
        st.exec = (f, i, pm) => pm.resolve(nest ? { x: 1, n: mk[k]() } : mk[k]())
        put(`S2 execute resolve|${tag}`, await rawMain('x'))
        st.exec = (f, i, pm) => pm.reject(nest ? { x: 1, n: mk[k]() } : mk[k]())
        put(`S2 execute reject|${tag}`, await rawMain('x'))
    }
}

//S3 download 應用端 resolve 之各欄為不可讀形狀
let dlFields = ['streamRead', 'filename', 'fileSize', 'fileType']
for (let route of ['dw', 'dwgf', 'dwgfn']) {
    for (let fld of dlFields) {
        for (let k of shapeKeys) {
            st.dw = (i, pm) => {
                let o = goodOut()
                o[fld] = mk[k]()
                pm.resolve(o)
            }
            put(`S3 download欄位|${route}|${fld}|${k}`, await rawDl(route))
        }
    }
    for (let k of shapeKeys) {
        st.dw = (i, pm) => {
            let o = goodOut()
            o.streamRead = { pipe: mk[k]() }
            pm.resolve(o)
        }
        put(`S3 download streamRead.pipe|${route}|${k}`, await rawDl(route))
    }
    for (let k of shapeKeys) {
        st.dw = (i, pm) => pm.resolve(mk[k]())
        put(`S3 download整體|${route}|${k}`, await rawDl(route))
    }
}

//S4 upload 之合併消費結果(ro)為不可讀形狀(第一次消費 resolve / reject 該值, 其後接受)
let mkClient = (opt = {}) => {
    let evs = []
    let wo = new WConverhpClient({ url: base, apiName: 'api', getToken: () => 't', retryMain: 0, retryUpload: 0, retryDownload: 0, ...opt })
    wo.on('error', (e) => evs.push(errText(e)))
    return { wo, evs }
}
let settle = async(pm, ms = 6000) => {
    return await withTimeout(Promise.resolve(pm).then((v) => ({ ok: true, v: sum(v) }), (e) => ({ ok: false, e: errText(e) })), ms)
}
for (let k of shapeKeys) {
    for (let mode2 of ['resolve', 'reject']) {
        let n = 0
        st.up = (input, pm) => {
            n += 1
            if (n === 1) {
                if (mode2 === 'resolve') {
                    pm.resolve(mk[k]())
                }
                else {
                    pm.reject(mk[k]())
                }
                return
            }
            pm.resolve({ got: n })
        }
        errs = []
        let { wo, evs } = mkClient()
        let r = await settle(wo.upload(`u-${k}.bin`, Buffer.from(`hello-upload-${k}-${mode2}`), undefined, { signal: AbortSignal.timeout(5000) }))
        await sleep(60)
        put(`S4 upload ${mode2}|${k}`, { r, evs, errs: [...errs], calls: n })
    }
}

//C2 execute(func, input, cbProgress, opt) 為不可讀形狀
st.exec = (f, i, pm) => pm.resolve({ f: typeof f === 'string' ? f : 'non-string', i: sum(i) })
for (let k of shapeKeys) {
    for (let [name, a1, a2] of [['func', mk[k], () => ({ a: 1 })], ['input', () => 'f', mk[k]], ['input巢狀', () => 'f', () => ({ a: 1, n: mk[k]() })]]) {
        errs = []
        let { wo, evs } = mkClient()
        let r = await settle(wo.execute(a1(), a2()))
        await sleep(60)
        put(`C2 execute ${name}|${k}`, { r, evs, errs: [...errs] })
    }
}
for (let k of shapeKeys) {
    for (let name of ['cbProgress', 'opt', 'opt.headers', 'opt.signal']) {
        errs = []
        let { wo, evs } = mkClient()
        let args = ['f', { a: 1 }]
        if (name === 'cbProgress') {
            args.push(mk[k]())
        }
        else if (name === 'opt') {
            args.push(undefined, mk[k]())
        }
        else if (name === 'opt.headers') {
            args.push(undefined, { headers: mk[k]() })
        }
        else {
            args.push(undefined, { signal: mk[k]() })
        }
        let r = await settle(wo.execute(...args))
        await sleep(60)
        put(`C2 execute ${name}|${k}`, { r, evs, errs: [...errs] })
    }
}

//C3 upload(filename, input, cbProgress, opt) 為不可讀形狀
st.up = (input, pm) => {
    pm.resolve({ fn: sum(input.filename), fs: sum(input.filenameSafe) })
}
for (let k of shapeKeys) {
    for (let name of ['filename', 'input', 'cbProgress', 'opt.signal']) {
        errs = []
        let { wo, evs } = mkClient()
        let a = [`up-${k}.bin`, Buffer.from('hello-upload-c3'), undefined, { signal: AbortSignal.timeout(5000) }]
        if (name === 'filename') {
            a[0] = mk[k]()
        }
        else if (name === 'input') {
            a[1] = mk[k]()
        }
        else if (name === 'cbProgress') {
            a[2] = mk[k]()
        }
        else {
            a[3] = { signal: mk[k]() }
        }
        let r = await settle(wo.upload(...a))
        await sleep(60)
        put(`C3 upload ${name}|${k}`, { r, evs, errs: [...errs] })
    }
}

//C4 download(fileId, cbProgress, opt) 為不可讀形狀
st.dw = (input, pm) => pm.resolve({ streamRead: Buffer.from('hello'), filename: 'a.txt', fileSize: 5, fileType: 'text/plain' })
for (let k of shapeKeys) {
    for (let name of ['fileId', 'cbProgress', 'opt.fdDownload', 'opt.headers', 'opt.signal', 'opt']) {
        errs = []
        let { wo, evs } = mkClient()
        let fd = path.resolve(workDir, 'dl')
        let a = ['f1', undefined, { fdDownload: fd, signal: AbortSignal.timeout(5000) }]
        if (name === 'fileId') {
            a[0] = mk[k]()
        }
        else if (name === 'cbProgress') {
            a[1] = mk[k]()
        }
        else if (name === 'opt.fdDownload') {
            a[2] = { fdDownload: mk[k]() }
        }
        else if (name === 'opt.headers') {
            a[2] = { fdDownload: fd, headers: mk[k]() }
        }
        else if (name === 'opt.signal') {
            a[2] = { fdDownload: fd, signal: mk[k]() }
        }
        else {
            a[2] = mk[k]()
        }
        let r = await settle(wo.download(...a))
        await sleep(60)
        put(`C4 download ${name}|${k}`, { r: { ...r, v: r.v ? r.v.replace(/[A-Za-z]:[^"]*[\\/]/g, '<dir>/') : undefined }, evs, errs: [...errs] })
    }
}

//C5 getToken 回傳不可讀形狀 / 以之 reject
st.exec = (f, i, pm) => pm.resolve({ ok: 1 })
for (let k of shapeKeys) {
    for (let mode2 of ['return', 'reject']) {
        errs = []
        let { wo, evs } = mkClient({ getToken: () => (mode2 === 'return' ? mk[k]() : Promise.reject(mk[k]())) })
        let r = await settle(wo.execute('f', { a: 1 }))
        await sleep(60)
        put(`C5 getToken ${mode2}|${k}`, { r, evs, errs: [...errs] })
    }
}

//C1 前端建構選項為不可讀形狀(url 除外: 預設會連到 localhost:8080, 不可打到他人服務; url 只看建構是否拋錯)
let cOpts = ['apiName', 'getToken', 'tokenType', 'sizeSlice', 'timeout', 'retryMain', 'retryUpload', 'retryDownload', 'onTrace']
for (let name of cOpts) {
    for (let k of shapeKeys) {
        errs = []
        let evs = []
        let r
        try {
            let wo = new WConverhpClient({ url: base, apiName: 'api', getToken: () => 't', retryMain: 0, retryUpload: 0, retryDownload: 0, [name]: mk[k]() })
            wo.on('error', (e) => evs.push(errText(e)))
            st.exec = (f, i, pm) => pm.resolve({ ok: 1 })
            r = await settle(wo.execute('f', { a: 1 }), 5000)
        }
        catch (err) {
            r = { threw: errText(String(err && err.message)) }
        }
        await sleep(40)
        put(`C1 client選項 ${name}|${k}`, { r, evs, errs: [...errs] })
    }
}
for (let k of shapeKeys) {
    let r
    try {
        new WConverhpClient({ url: mk[k]() })
        r = 'constructed'
    }
    catch (err) {
        r = { threw: errText(String(err && err.message)) }
    }
    put(`C1 client選項 url(僅建構)|${k}`, r)
}

//S5 伺服端建構選項為不可讀形狀(port 除外: 預設 8080 不可綁)
let sOpts = ['apiName', 'useInert', 'pathStaticFiles', 'pathUploadTemp', 'tokenType', 'sizeSlice', 'sizeMsg', 'corsOrigins', 'delayForSlice', 'verifyConn']
for (let name of sOpts) {
    for (let k of shapeKeys) {
        let p = await freePort()
        let evs = []
        let r
        let wsv2 = null
        try {
            wsv2 = new WConverhpServer({ port: p, apiName: 'api', useInert: false, pathUploadTemp: './up2', [name]: mk[k]() })
            wsv2.on('error', (e) => evs.push(errText(e)))
            wsv2.on('execute', (f, i, pm) => pm.resolve({ ok: 1 }))
            wsv2.on('handler', () => {})
            let ready = await withTimeout(wsv2.ready, 3000)
            r = { ready: sum(ready) }
            if (ready === true) {
                r.res = await withTimeout(fetch(`http://127.0.0.1:${p}/api/main`, {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer t', 'Content-Type': 'application/octet-stream' },
                    body: Buffer.from(w.obj2u8arr({ func: 'x', input: {} })),
                }).then(async(rr) => {
                    let u8a = new Uint8Array(Buffer.from(await rr.arrayBuffer()))
                    let d = w.u8arr2obj(u8a, { returnWithStateAndMsg: true })
                    return { status: rr.status, state: d.state, msg: sum(d.msg) }
                }), 3000)
            }
        }
        catch (err) {
            r = { threw: errText(String(err && err.message)) }
        }
        await sleep(40)
        try {
            wsv2 && await wsv2.stop()
        }
        catch (err) {}
        put(`S5 server選項 ${name}|${k}`, { r, evs })
    }
}

await wsv.stop()
fs.writeFileSync(outFile, JSON.stringify({ srcDir, wsemiVer, results }, null, 1))
log0(`done: ${Object.keys(results).length} cells, wsemi ${wsemiVer} -> ${outFile}`)
process.exit(0)
