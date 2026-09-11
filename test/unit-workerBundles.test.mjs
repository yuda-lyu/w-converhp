import assert from 'assert'
import fs from 'fs'
import path from 'path'
import w from 'wsemi'
import mergeSlicesSrc from '../src/mergeSlices.mjs'
import mergeSlicesBundle from '../src/mergeSlices.wk.umd.js'
import checkSlicesHashSrc from '../src/checkSlicesHash.mjs'
import checkSlicesHashBundle from '../src/checkSlicesHash.wk.umd.js'
import checkTotalHashSrc from '../src/checkTotalHash.mjs'
import checkTotalHashBundle from '../src/checkTotalHash.wk.umd.js'


/**
 * unit: worker 之建置輸入(.mjs)須與實際被 import 執行之產物(.wk.umd.js)一致(規則帳本 R14 之機械化保護)
 *
 * why: 伺服器實際 import 的是 src/{checkTotalHash,checkSlicesHash,mergeSlices}.wk.umd.js, 對應之 .mjs 被零個模組 import。
 * 改了 .mjs 而未跑 node toolg/gDistRollup.mjs 時「行為零變更、全部測試全綠、eslint 全過、git diff 看得到改動」——
 * 四項訊號皆顯示已修正, 實際執行的是舊碼。帳本 R14 自第九輪即記「機械化保護(待建)」。
 *
 * 兩層:
 *   一、字面值子集: .wk.umd.js 以 base64 內嵌 worker 原始碼(識別字已改名、註解已去除)而**字串內容保留**,
 *       故 .mjs 之樣板靜態段與單引號字串須全數出現於解碼內容內。便宜, 但**只抓得到新增或改動字面值者** ——
 *       第十輪兩份外部複審以同一演算法實測: 刪一個敘述、只改邏輯者皆抓不到(分辨力 2/8)。
 *   二、差分行為: 同一組 fixture 各以 .mjs 與 .wk.umd.js 執行(各自一個全新暫存夾), 比對回傳值(路徑正規化)與執行後之磁碟內容。
 *       刪敘述、改邏輯只要影響 fixture 之結果即紅。fixture 須涵蓋各 worker 之每一條回傳分支。
 */

let workers = ['checkTotalHash', 'checkSlicesHash', 'mergeSlices']

let stripComments = (s) => {
    return s
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split(/\r?\n/)
        .map((line) => line.replace(/^\s*\/\/.*$/, '').replace(/\s\/\/.*$/, ''))
        .join('\n')
}

let literalsOf = (src) => {
    let lines = stripComments(src).split('\n').filter((l) => !/^\s*import\s/.test(l))
    let body = lines.join('\n')
    let out = []
    for (let m of body.matchAll(/`([^`]*)`/g)) {
        for (let seg of m[1].split(/\$\{[^}]*\}/)) {
            if (seg.length >= 6) {
                out.push(seg)
            }
        }
    }
    for (let l of lines) {
        for (let m of l.matchAll(/'([^'\\]{6,})'/g)) {
            out.push(m[1])
        }
    }
    return [...new Set(out)]
}

let decodedOf = (bundle) => {
    let segs = bundle.match(/[A-Za-z0-9+/=]{500,}/g) || []
    return segs.map((s) => Buffer.from(s, 'base64').toString('utf8')).join('\n')
}

//差分行為之共用
let fdRoot = path.resolve('./test/_tmp/unit-workerBundles')
let nRun = 0
let freshDir = () => {
    nRun += 1
    let fd = path.join(fdRoot, `run${nRun}`)
    fs.rmSync(fd, { recursive: true, force: true })
    fs.mkdirSync(fd, { recursive: true })
    return fd
}
let snapshot = (fd) => {
    return fs.readdirSync(fd).sort().map((n) => `${n}:${fs.statSync(path.join(fd, n)).size}`)
}
let normalize = (v, fd) => {
    let s = JSON.stringify(v === undefined ? '<undefined>' : v)
    return s.split(JSON.stringify(fd).slice(1, -1)).join('<fd>').split(fd).join('<fd>')
}
let runOn = async(fn, setup, call) => {
    let fd = freshDir()
    let ctx = await setup(fd)
    let ret = null
    try {
        ret = { ok: await call(fn, fd, ctx) }
    }
    catch (err) {
        ret = { err: w.getErrorMessage(err).replace(/^Error: /, '') }
    }
    return { ret: normalize(ret, fd), files: snapshot(fd) }
}
let hashOf = (b) => w.getFileXxHash(new Blob([b]))

//fixtures: [名稱, setup(fd) => ctx, call(fn, fd, ctx) => 回傳值]
let fixtures = {
    mergeSlices: [
        ['兩片完整', async(fd) => {
            let parts = [Buffer.alloc(3000, 1), Buffer.alloc(1000, 2)]
            let h = await hashOf(Buffer.concat(parts))
            parts.forEach((b, i) => fs.writeFileSync(path.join(fd, `${h}_${i}`), b))
            return { h }
        }, (fn, fd, { h }) => fn(h, 2, fd, path.join(fd, `${h}.merging`))],
        ['缺片', async(fd) => {
            fs.writeFileSync(path.join(fd, 'abc_0'), Buffer.alloc(10, 1))
            return {}
        }, (fn, fd) => fn('abc', 2, fd, path.join(fd, 'abc.merging'))],
    ],
    checkSlicesHash: [
        ['一般: 相符、不符、重複、不存在、字串索引、非法索引', async(fd) => {
            let b0 = Buffer.alloc(500, 7)
            let b1 = Buffer.alloc(500, 8)
            fs.writeFileSync(path.join(fd, 'aa11_0'), b0)
            fs.writeFileSync(path.join(fd, 'aa11_1'), b1)
            return { h0: await hashOf(b0) }
        }, (fn, fd, { h0 }) => fn([{ i: 0, h: h0 }, { i: 1, h: 'x' }, { i: 0, h: h0 }, { i: 9, h: h0 }, { i: '0', h: h0 }, { i: -1, h: h0 }, { i: '../x', h: h0 }], 'aa11', fd)],
        ['非陣列', async() => ({}), (fn, fd) => fn({ length: 3 }, 'aa11', fd)],
        ['空陣列', async() => ({}), (fn, fd) => fn([], 'aa11', fd)],
        ['非法 fileHash', async() => ({}), (fn, fd) => fn([{ i: 0, h: 'x' }], '../x', fd)],
    ],
    checkTotalHash: [
        ['整檔存在且相符', async(fd) => {
            let b = Buffer.alloc(2048, 5)
            let h = await hashOf(b)
            fs.writeFileSync(path.join(fd, h), b)
            return { h }
        }, (fn, fd, { h }) => fn(2048, 1024, h, fd)],
        ['切片: 大小相符者計入、不符者略過、前綴不符者略過、索引不可解析者略過', async(fd) => {
            fs.writeFileSync(path.join(fd, 'bb22_0'), Buffer.alloc(1024, 1))
            fs.writeFileSync(path.join(fd, 'bb22_1'), Buffer.alloc(10, 1))
            fs.writeFileSync(path.join(fd, 'xbb22_2'), Buffer.alloc(1024, 1))
            fs.writeFileSync(path.join(fd, 'bb22_x'), Buffer.alloc(1024, 1))
            return {}
        }, (fn, fd) => fn('3000', 1024, 'bb22', fd)],
        ['fileSize 非法', async() => ({}), (fn, fd) => fn(-1, 1024, 'bb22', fd)],
    ],
}

let impls = {
    mergeSlices: [mergeSlicesSrc, mergeSlicesBundle],
    checkSlicesHash: [checkSlicesHashSrc, checkSlicesHashBundle],
    checkTotalHash: [checkTotalHashSrc, checkTotalHashBundle],
}

describe('unit-workerBundles', function() {
    this.timeout(60000)

    before(function() {
        fs.rmSync(fdRoot, { recursive: true, force: true })
    })

    after(function() {
        fs.rmSync(fdRoot, { recursive: true, force: true })
    })

    for (let n of workers) {
        it(`${n}: 一、.mjs 之字串字面值須全數出現於 ${n}.wk.umd.js 之內嵌原始碼`, function() {
            let src = fs.readFileSync(`./src/${n}.mjs`, 'utf8')
            let bundle = fs.readFileSync(`./src/${n}.wk.umd.js`, 'utf8')
            let lits = literalsOf(src)
            let dec = decodedOf(bundle)
            assert.strict.deepEqual(dec.length > 1000, true, `${n}.wk.umd.js 解不出內嵌原始碼(建置格式改變?), 本檢查失效`)
            assert.strict.deepEqual(lits.length >= 1, true, `${n}.mjs 取不到任何字面值, 本檢查空轉`)
            let miss = lits.filter((s) => !dec.includes(s))
            assert.strict.deepEqual(miss, [], `${n}.mjs 有 ${miss.length} 個字面值不在產物內 —— 改了 .mjs 未跑 node toolg/gDistRollup.mjs: ${JSON.stringify(miss)}`)
        })

        it(`${n}: 二、同一組 fixture 以 .mjs 與 ${n}.wk.umd.js 執行, 回傳值與磁碟結果須相同`, async function() {
            let [fSrc, fBundle] = impls[n]
            let diffs = []
            for (let [label, setup, call] of fixtures[n]) {
                let a = await runOn(fSrc, setup, call)
                let b = await runOn(fBundle, setup, call)
                if (JSON.stringify(a) !== JSON.stringify(b)) {
                    diffs.push(`[${label}]\n  .mjs       ${JSON.stringify(a)}\n  .wk.umd.js ${JSON.stringify(b)}`)
                }
            }
            assert.strict.deepEqual(diffs, [], `${n}: .mjs 與產物行為不同 —— 改了 .mjs 未跑 node toolg/gDistRollup.mjs:\n${diffs.join('\n')}`)
        })
    }

})
