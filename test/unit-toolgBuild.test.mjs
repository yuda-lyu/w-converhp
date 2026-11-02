import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { createRequire } from 'module'
import w from 'wsemi'


/**
 * unit: 發布列之建置腳本(toolg/gDistRollupWorkerFuncs.mjs、toolg/gDistRollup.mjs)須能於套件根(cwd)獨立執行並產出可用之產物
 *
 * 規格出處: C:\opensrcOper\dspec\自有套件之發布與建置腳本.md
 *   規則 4「測試要驗 dist 者, 以副本並指定 cwd 執行 toolg 腳本; 不為測試改寫 toolg」
 *   規則 5 之 1「先產進 src 之 worker: toolg/gDistRollupWorkerFuncs.mjs, 以 rollupWorkerCore 產 src/**\/*.wk.umd.js, 排在其他建置之前」
 * 與規則帳本 R14(伺服器實際 import 之 src/*.wk.umd.js 為建置產物)。
 *
 * 做法: 把 package.json、babel.config.js、src 之 .mjs(不含 .wk.umd.js)、兩支 toolg 腳本複製至 test/_tmp/unit-toolgBuild/build/,
 * 以 spawn 指定 cwd 為該副本執行腳本(同發布列於套件根執行); 依賴由副本之祖先目錄(本 repo 之 node_modules)解析, 不建連結。
 * 另備一份 src/mergeSlices.mjs 語法錯誤之副本, 驗失敗以非 0 離開碼結束(發布列以離開碼判定成敗)。
 */

let fdRoot = path.resolve('./test/_tmp/unit-toolgBuild')
let fdBuild = path.join(fdRoot, 'build')
let fdFail = path.join(fdRoot, 'fail')
let workers = ['checkTotalHash', 'checkSlicesHash', 'mergeSlices']
let requireFn = createRequire(import.meta.url)

let copyBase = (fd) => {
    fs.mkdirSync(path.join(fd, 'src'), { recursive: true })
    fs.mkdirSync(path.join(fd, 'toolg'), { recursive: true })
    for (let n of ['package.json', 'babel.config.js']) {
        fs.copyFileSync(path.resolve(n), path.join(fd, n))
    }
    for (let n of fs.readdirSync(path.resolve('./src'))) {
        if (n.endsWith('.mjs')) { //.wk.umd.js 不複製, 由腳本產出
            fs.copyFileSync(path.resolve('./src', n), path.join(fd, 'src', n))
        }
    }
    for (let n of ['gDistRollupWorkerFuncs.mjs', 'gDistRollup.mjs']) {
        fs.copyFileSync(path.resolve('./toolg', n), path.join(fd, 'toolg', n))
    }
}

let runNode = (cwd, script) => {
    return new Promise((resolve) => {
        let out = ''
        let err = ''
        let cp = spawn(process.execPath, [script], { cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
        cp.stdout.on('data', (d) => {
            out += d
        })
        cp.stderr.on('data', (d) => {
            err += d
        })
        cp.on('close', (code) => {
            resolve({ code, out, err })
        })
    })
}

let lsSorted = (fd) => {
    return fs.existsSync(fd) ? fs.readdirSync(fd).sort() : []
}

let hdr = (fp, n = 1600) => {
    return fs.readFileSync(fp, 'utf8').slice(0, n)
}

//UMD 表頭之 require("x") 清單(依出現順序)
let hdrRequires = (fp) => {
    return [...hdr(fp).matchAll(/require\("([^"]+)"\)/g)].map((m) => m[1])
}

//內嵌 inner(base64 段)解碼後之 require 清單
let innerRequires = (fp) => {
    let segs = fs.readFileSync(fp, 'utf8').match(/[A-Za-z0-9+/=]{500,}/g) || []
    let inner = segs.map((s) => Buffer.from(s, 'base64').toString('utf8')).join('\n')
    return [...new Set([...inner.matchAll(/require\(["']([^"']+)["']\)/g)].map((m) => m[1]))]
}

let hashOf = (b) => w.getFileXxHash(new Blob([b]))

describe('unit-toolgBuild', function() {
    this.timeout(300000)

    let pre = {}
    let rWk = null
    let rDist = null
    let rFail = null
    let srcBeforeDist = []

    before(async function() {
        fs.rmSync(fdRoot, { recursive: true, force: true })
        copyBase(fdBuild)
        pre.src = lsSorted(path.join(fdBuild, 'src'))
        pre.root = lsSorted(fdBuild)

        //發布列順序: gDistRollupWorkerFuncs → gDistRollup, 皆於副本根(cwd)執行
        rWk = await runNode(fdBuild, 'toolg/gDistRollupWorkerFuncs.mjs')
        srcBeforeDist = lsSorted(path.join(fdBuild, 'src'))
        rDist = await runNode(fdBuild, 'toolg/gDistRollup.mjs')

        //失敗副本: mergeSlices.mjs 語法錯誤
        copyBase(fdFail)
        fs.appendFileSync(path.join(fdFail, 'src', 'mergeSlices.mjs'), '\nlet = = 1 (\n', 'utf8')
        rFail = await runNode(fdFail, 'toolg/gDistRollupWorkerFuncs.mjs')
    })

    after(function() {
        fs.rmSync(fdRoot, { recursive: true, force: true })
    })

    it('gDistRollupWorkerFuncs: 於副本根執行成功(離開碼 0), 且只在 src 新增 3 個 .wk.umd.js', function() {
        //對應規格: 規則 5 之 1(先產進 src 之 worker 由 gDistRollupWorkerFuncs 產出); 規則 4(指定 cwd 執行)
        assert.strict.deepEqual(rWk.code, 0, `離開碼 ${rWk.code}\nstdout: ${rWk.out}\nstderr: ${rWk.err}`)
        let added = srcBeforeDist.filter((n) => !pre.src.includes(n))
        assert.strict.deepEqual(added, workers.map((n) => `${n}.wk.umd.js`).sort())
        //副本根無遺留之暫存檔(如 temp-*.js), 腳本只動 src
        assert.strict.deepEqual(lsSorted(fdBuild).filter((n) => !pre.root.includes(n) && n !== 'dist'), [])
    })

    for (let n of workers) {
        it(`${n}.wk.umd.js: UMD 外層只依賴 worker_threads, 內嵌 worker 本體以 external 引用 path 與 fs`, function() {
            //對應規格: 規則 5 之 1(供 worker_threads 執行之 UMD, runin: nodejs); gDistRollupWorkerFuncs 之 globals/external 設定
            let fp = path.join(fdBuild, 'src', `${n}.wk.umd.js`)
            assert.strict.deepEqual(hdrRequires(fp), ['worker_threads'])
            assert.strict.deepEqual(hdr(fp).includes(`.${n}=`), true, `UMD 全域名應為 ${n}`)
            let reqs = innerRequires(fp)
            assert.strict.deepEqual(reqs.includes('path') && reqs.includes('fs'), true, `inner 應以 require 引用 path 與 fs: ${JSON.stringify(reqs)}`)
            //與 repo 內被 import 執行之產物(src/${n}.wk.umd.js)同樣依賴: 副本產物與已提交產物之外部引用相同
            let fpRepo = path.resolve('./src', `${n}.wk.umd.js`)
            assert.strict.deepEqual(hdrRequires(fp), hdrRequires(fpRepo))
            assert.strict.deepEqual(reqs.slice().sort(), innerRequires(fpRepo).slice().sort())
        })
    }

    it('mergeSlices.wk.umd.js(副本產物)可載入並執行: 切片依序合併、回傳合併檔雜湊', async function() {
        //對應規格: 規則 5 之 1(產物須可被 import 使用); 原始碼 mergeSlices「把切片依序合併至 fpOut 並回傳合併檔之雜湊」
        let fn = requireFn(path.join(fdBuild, 'src', 'mergeSlices.wk.umd.js'))
        assert.strict.deepEqual(typeof fn, 'function')
        let fd = path.join(fdRoot, 'run-merge')
        fs.mkdirSync(fd, { recursive: true })
        let parts = [Buffer.alloc(3000, 1), Buffer.alloc(1000, 2)]
        let all = Buffer.concat(parts)
        let h = await hashOf(all)
        parts.forEach((b, i) => fs.writeFileSync(path.join(fd, `${h}_${i}`), b))
        let fpOut = path.join(fd, `${h}.merging`)
        let r = await fn(h, 2, fd, fpOut)
        assert.strict.deepEqual(r.hash, h)
        assert.strict.deepEqual(fs.readFileSync(fpOut).equals(all), true)
    })

    it('checkSlicesHash.wk.umd.js(副本產物)可載入並執行: 只確認雜湊相符之切片, 非安全 fileHash 拒絕', async function() {
        //對應規格: 規則 5 之 1; 原始碼 checkSlicesHash「已確定 hash 值一致的切片」「fileHash 須為安全識別字」
        let fn = requireFn(path.join(fdBuild, 'src', 'checkSlicesHash.wk.umd.js'))
        assert.strict.deepEqual(typeof fn, 'function')
        let fd = path.join(fdRoot, 'run-slices')
        fs.mkdirSync(fd, { recursive: true })
        let b0 = Buffer.alloc(500, 7)
        let b1 = Buffer.alloc(500, 8)
        fs.writeFileSync(path.join(fd, 'aa11_0'), b0)
        fs.writeFileSync(path.join(fd, 'aa11_1'), b1)
        let h0 = await hashOf(b0)
        assert.strict.deepEqual(await fn([{ i: 0, h: h0 }, { i: 1, h: 'x' }], 'aa11', fd), { slks: [0] })
        assert.strict.deepEqual(await fn([{ i: 0, h: h0 }], '../x', fd), { error: 'invalid fileHash' })
    })

    it('checkTotalHash.wk.umd.js(副本產物)可載入並執行: 整檔存在時大小與雜湊皆相符, 非法 fileSize 拒絕', async function() {
        //對應規格: 規則 5 之 1; 原始碼 checkTotalHash「確認完整檔是否存在 / 大小是否一致 / hash 是否一致」「fileSize 須為安全整數」
        let fn = requireFn(path.join(fdBuild, 'src', 'checkTotalHash.wk.umd.js'))
        assert.strict.deepEqual(typeof fn, 'function')
        let fd = path.join(fdRoot, 'run-total')
        fs.mkdirSync(fd, { recursive: true })
        let b = Buffer.alloc(2048, 5)
        let h = await hashOf(b)
        fs.writeFileSync(path.join(fd, h), b)
        let r = await fn(2048, 1024, h, fd)
        assert.strict.deepEqual([r.bAllExist, r.bAllSize, r.bAllHash], [true, true, true])
        assert.strict.deepEqual(await fn(-1, 1024, h, fd), { error: 'invalid fileSize in payload' })
    })

    it('gDistRollup: 於副本根執行成功(離開碼 0), 只在 dist 產出 server 與 client 之 umd 及 map, 不動 src', function() {
        //對應規格: 規則 4(gDistRollup 以 ./src、./dist 相對 cwd, 產 dist); 規則 5 之 1(gDistRollup 不再產 src 內之 worker)
        assert.strict.deepEqual(rDist.code, 0, `離開碼 ${rDist.code}\nstdout: ${rDist.out}\nstderr: ${rDist.err}`)
        assert.strict.deepEqual(lsSorted(path.join(fdBuild, 'dist')), [
            'w-converhp-client.umd.js',
            'w-converhp-client.umd.js.map',
            'w-converhp-server.umd.js',
            'w-converhp-server.umd.js.map',
        ])
        assert.strict.deepEqual(lsSorted(path.join(fdBuild, 'src')), srcBeforeDist)
        assert.strict.deepEqual(lsSorted(fdBuild).filter((n) => !pre.root.includes(n) && n !== 'dist'), [])
    })

    it('dist/w-converhp-server.umd.js: nodejs 解析, 依賴 path/fs/stream/http/@hapi/hapi/@hapi/inert/worker_threads 且匯出為函數', function() {
        //對應規格: 規則 4(選項寫於 gDistRollup: server 走 nodejs 解析、external 清單); 本檔 package.json main 指向此檔
        let fp = path.join(fdBuild, 'dist', 'w-converhp-server.umd.js')
        assert.strict.deepEqual(hdrRequires(fp), ['path', 'fs', 'stream', 'http', '@hapi/hapi', '@hapi/inert', 'worker_threads'])
        assert.strict.deepEqual(typeof requireFn(fp), 'function')
        //worker 產物已被併入(不以 require 外部引用 *.wk.umd.js)
        assert.strict.deepEqual(fs.readFileSync(fp, 'utf8').includes('.wk.umd'), false)
    })

    it('dist/w-converhp-client.umd.js: browser 解析, UMD 外層不依賴任何 Node 模組且匯出為函數', function() {
        //對應規格: 規則 4(client 走 browser 解析, 不可打入 node 取向依賴; gDistRollup 檔內註解)
        let fp = path.join(fdBuild, 'dist', 'w-converhp-client.umd.js')
        assert.strict.deepEqual(hdrRequires(fp), [])
        assert.strict.deepEqual(typeof requireFn(fp), 'function')
        //未把 Node 取向之依賴變體打入(帳本註: bundle 爆增): 與已提交之 client 產物同量級(±30%)
        let sz = fs.statSync(fp).size
        let szRepo = fs.statSync(path.resolve('./dist/w-converhp-client.umd.js')).size
        assert.strict.deepEqual(sz > szRepo * 0.7 && sz < szRepo * 1.3, true, `client 產物大小 ${sz} 與已提交 ${szRepo} 差距過大`)
    })

    it('gDistRollupWorkerFuncs: 原始碼建置失敗時以非 0 離開碼結束, 且不產出該 worker', function() {
        //對應規格: 規則 4 之合規寫法「失敗時 process.exitCode = 1」(發布列以離開碼判定成敗)
        assert.strict.deepEqual(rFail.code === 0, false, `應為非 0, 實際 ${rFail.code}\nstdout: ${rFail.out}`)
        assert.strict.deepEqual(rFail.err.length > 0, true, '失敗時應輸出錯誤訊息於 stderr')
        assert.strict.deepEqual(fs.existsSync(path.join(fdFail, 'src', 'mergeSlices.wk.umd.js')), false)
    })

})
