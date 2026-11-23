import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { Readable } from 'stream'
import w from 'wsemi'
import pickDiagOpt from '../src/diagOpt.mjs'
import checkTotalHash from '../src/checkTotalHash.mjs'
import mmg from '../src/managerMergeSlices.mjs'
import wCapture from './tools/consoleCapture.mjs'

let { capture, textOf } = wCapture


/**
 * unit: 診斷輸出之單元(帳本 R33; 規格〈診斷輸出與遮罩〉D1、D2、D4)
 *   - pickDiagOpt: 使用端診斷設定之唯一讀取點, 不可讀之選項物件不得使建構子拋錯(D4)
 *   - checkTotalHash(worker 之原始碼, 於主執行緒直接呼叫): 不寫 console, 診斷以 r.diag 記錄回傳(label 為固定詞彙, 路徑與檔名只在 detail)
 *   - managerMergeSlices 之預設診斷出口(模組單獨使用, 無 opt.diag): 只輸出固定詞彙, 不輸出路徑、錯誤原文與請求值
 * 伺服器經由 internal 取出並輸出 worker 記錄之整合行為見 api-consoleNoValues
 */
describe('unit-consoleDiag', function() {

    let fd = path.resolve('./test/_tmp/unit-consoleDiag')

    before(function() {
        fs.rmSync(fd, { recursive: true, force: true })
        fs.mkdirSync(fd, { recursive: true })
    })

    after(function() {
        fs.rmSync(fd, { recursive: true, force: true })
    })

    //patchFs, 暫時取代 fs 之方法, 只對(目標路徑 + 直接呼叫者為指定檔名者)套用, 其餘原樣轉呼叫; 回傳還原函數
    //直接呼叫者 = 堆疊第 3 列(第 1 列為 Error、第 2 列為本函數): 不可用「堆疊內任一列含檔名」, 否則 wsemi 之內部呼叫(其上游即被測檔)亦被套用
    let patchFs = (name, target, fnameInStack, replacement) => {
        let orig = fs[name]
        fs[name] = function(p, ...a) {
            if (String(p) === target && String(new Error().stack.split('\n')[2]).includes(fnameInStack)) {
                return replacement(p, ...a)
            }
            return orig.call(this, p, ...a)
        }
        return () => {
            fs[name] = orig
        }
    }

    describe('pickDiagOpt(診斷設定之唯一讀取點)', function() {

        it('只取 logDetail 與 funLog 兩鍵; 值原樣(同一個函數參照)', function() {
            let f = () => {}
            assert.strict.deepEqual(pickDiagOpt({ logDetail: true, funLog: f, other: 1 }), { logDetail: true, funLog: f })
            assert.strict.deepEqual(pickDiagOpt({ funLog: f }).funLog === f, true)
            assert.strict.deepEqual(pickDiagOpt({}), { logDetail: undefined, funLog: undefined })
        })

        it('D4 選項物件不可讀(undefined、null、已撤銷之 Proxy、拋錯之 getter)一律視為未給, 不拋錯', function() {
            let pr = Proxy.revocable({}, {})
            pr.revoke()
            let g = {}
            let getBoom = () => {
                throw new Error('boom')
            }
            Object.defineProperty(g, 'logDetail', { get: getBoom, enumerable: true })
            Object.defineProperty(g, 'funLog', { get: getBoom, enumerable: true })
            for (let o of [undefined, null, pr.proxy, g, 5, 'abc']) {
                assert.strict.deepEqual(pickDiagOpt(o), { logDetail: undefined, funLog: undefined })
            }
        })

    })

    describe('checkTotalHash 之診斷記錄(worker 不寫 console)', function() {

        let fileHash = 'c1b2c3d4e5f60718'

        it('無異常時結果不帶 diag 鍵(形狀與以往逐位相同)', async function() {
            let cp = capture()
            let r
            try {
                r = await checkTotalHash(100, 1024, fileHash, fd)
            }
            finally {
                cp.stop()
            }
            assert.strict.deepEqual(Object.keys(r).sort(), ['bAllExist', 'bAllHash', 'bAllSize', 'bSls', 'path', 'slks'])
            assert.strict.deepEqual(cp.recs.length, 0, textOf(cp.recs))
        })

        it('整檔大小讀取失敗(statSync): 記錄 label 為固定詞彙, err 帶 message 與 code, 路徑只在 detail; console 零輸出', async function() {
            let target = path.resolve(fd, fileHash)
            fs.writeFileSync(target, 'x')
            let restore = patchFs('statSync', target, 'checkTotalHash.mjs', () => {
                throw Object.assign(new Error(`EPERM: operation not permitted, stat '${target}'`), { code: 'EPERM' })
            })
            let cp = capture()
            let r
            try {
                r = await checkTotalHash(1, 1024, fileHash, fd)
            }
            finally {
                cp.stop()
                restore()
                fs.rmSync(target, { force: true })
            }
            assert.strict.deepEqual(cp.recs.length, 0, textOf(cp.recs))
            //暫存夾掃描時整檔亦被逐檔讀大小(同一路徑再失敗一次), 故兩則: 整檔大小 1 + 逐檔大小 1
            assert.strict.deepEqual(r.diag.map((v) => v.label).sort(), ['check each file size: statSync error', 'check total file size: statSync error'], JSON.stringify(r))
            let a = r.diag.find((v) => v.label === 'check total file size: statSync error')
            assert.strict.deepEqual(a.err.code, 'EPERM')
            assert.strict.deepEqual(a.err.message.includes('EPERM'), true)
            assert.strict.deepEqual(a.detail, { path: target })
            for (let v of r.diag) {
                assert.strict.deepEqual(v.label.includes(fd), false) //label 不含路徑
            }
            assert.strict.deepEqual(r.bAllSize, false) //診斷不改變判定
        })

        it('整檔雜湊計算失敗: 記錄 label 為固定詞彙, 路徑與是否為檔案只在 detail; console 零輸出', async function() {
            let target = path.resolve(fd, fileHash)
            fs.writeFileSync(target, 'x')
            let restore = patchFs('createReadStream', target, 'fsGetFileXxHashCore', () => {
                return new Readable({
                    read() {
                        this.destroy(Object.assign(new Error('EIO: i/o error, read'), { code: 'EIO' }))
                    },
                })
            })
            let cp = capture()
            let r
            try {
                r = await checkTotalHash(1, 1024, fileHash, fd)
            }
            finally {
                cp.stop()
                restore()
                fs.rmSync(target, { force: true })
            }
            assert.strict.deepEqual(cp.recs.length, 0, textOf(cp.recs))
            assert.strict.deepEqual(r.diag.length, 1, JSON.stringify(r))
            assert.strict.deepEqual(r.diag[0].label, 'check total file hash error')
            assert.strict.deepEqual(r.diag[0].detail, { path: target, isFile: true })
            assert.strict.deepEqual(r.bAllHash, false)
        })

        it('暫存夾內切片檔大小讀取失敗與非本套件之檔名: 記錄之 label 為固定詞彙, 檔名與路徑只在 detail', async function() {
            let f1 = path.resolve(fd, `${fileHash}_1`)
            let f2 = path.resolve(fd, `${fileHash}_canaryname`)
            fs.writeFileSync(f1, 'x')
            fs.writeFileSync(f2, 'x')
            let restore = patchFs('statSync', f1, 'checkTotalHash.mjs', () => {
                throw Object.assign(new Error('EPERM: each file'), { code: 'EPERM' })
            })
            let cp = capture()
            let r
            try {
                r = await checkTotalHash(100, 1024, fileHash, fd)
            }
            finally {
                cp.stop()
                restore()
                fs.rmSync(f1, { force: true })
                fs.rmSync(f2, { force: true })
            }
            assert.strict.deepEqual(cp.recs.length, 0, textOf(cp.recs))
            let labels = r.diag.map((v) => v.label).sort()
            assert.strict.deepEqual(labels, ['check each file size: statSync error', 'skip file: can not parse chunk index'])
            let a = r.diag.find((v) => v.label === 'check each file size: statSync error')
            assert.strict.deepEqual(a.detail, { path: f1 })
            assert.strict.deepEqual(a.err.code, 'EPERM')
            let b = r.diag.find((v) => v.label === 'skip file: can not parse chunk index')
            assert.strict.deepEqual(b.detail, { name: `${fileHash}_canaryname` })
            assert.strict.deepEqual(b.err, undefined)
            for (let v of r.diag) {
                assert.strict.deepEqual(v.label.includes('canaryname') || v.label.includes(fd), false)
            }
        })

    })

    describe('managerMergeSlices 之預設診斷出口(無 opt.diag)', function() {

        let fileHash = 'd1b2c3d4e5f60718'

        it('無效 queueId: 只輸出固定詞彙, 不輸出請求值; 回傳之 reason 照舊', async function() {
            let cp = capture()
            let r
            try {
                r = await mmg.get('CANARY-QUEUEID', fd)
            }
            finally {
                cp.stop()
            }
            assert.strict.deepEqual(cp.recs.map((v) => v.args), [['invalid queueId']], textOf(cp.recs))
            assert.strict.deepEqual(r.state, 'error')
            assert.strict.deepEqual(r.msg, 'invalid queueId')
            assert.strict.deepEqual(r.reason, 'invalid queueId[CANARY-QUEUEID]') //reason 供伺服器以 error 事件通知應用端, 不變
        })

        it('儲存結果損毀(非致命事件, 未給 opt.funLog): 只輸出固定詞彙, 不含路徑與錯誤原文; 細節隨 opt.diag 之 funLog 交出', async function() {
            let id = `seg0aaa|seg1bbb|${fileHash}`
            let fpr = path.resolve(fd, `${fileHash}.qseg0aaaseg1bbb.ro`)
            fs.writeFileSync(fpr, Buffer.from([1, 2, 3, 4, 5]))

            //預設出口
            let cp = capture()
            try {
                await mmg.get(id, fd)
            }
            finally {
                cp.stop()
            }
            assert.strict.deepEqual(cp.recs.map((v) => v.args), [['merge queue: non-fatal error (detail by opt.funLog)']], textOf(cp.recs))

            //opt.diag 給函數: 診斷全交它, 細節為記錄函數之訊息字串(含路徑, 由使用端自行收取)
            let got = []
            let cp2 = capture()
            try {
                await mmg.get(id, fd, { diag: (label, safe, getDetail) => got.push({ label, safe, detail: getDetail() }) })
            }
            finally {
                cp2.stop()
                fs.rmSync(fpr, { force: true })
            }
            assert.strict.deepEqual(cp2.recs.length, 0, textOf(cp2.recs))
            assert.strict.deepEqual(got.length, 1, JSON.stringify(got))
            assert.strict.deepEqual(got[0].label, 'merge queue: non-fatal error (detail by opt.funLog)')
            assert.strict.deepEqual(got[0].detail.includes(fpr), true, got[0].detail)
        })

        it('寫 .error 檔失敗(驗證不符與合併失敗兩處): 只輸出固定詞彙與 { errType, errCode }, 路徑不入預設輸出', async function() {
            let h = 'a2b2c3d4e5f60718'
            let fp = path.resolve(fd, h)
            let fpe = path.resolve(fd, `${h}.error`)
            fs.writeFileSync(fp, 'x') //合併檔存在而雜湊不符 → verifyMerged 之 mismatch 路徑寫 .error; 其後重新合併因缺片失敗 → qPush 之 catch 再寫 .error
            let orig = fs.writeFileSync
            fs.writeFileSync = function(p, ...a) {
                if (String(p) === fpe) {
                    throw Object.assign(new Error(`EPERM: operation not permitted, open '${fpe}'`), { code: 'EPERM' })
                }
                return orig.call(this, p, ...a)
            }
            let cp = capture()
            try {
                await mmg.push(h, 2, fd)
                await w.waitFun(() => cp.recs.filter((v) => v.args[0] === 'can not write .error file').length >= 2, { timeInterval: 10, attemptNum: 3000 })
            }
            finally {
                cp.stop()
                fs.writeFileSync = orig
                fs.rmSync(fp, { force: true })
            }
            let ks = cp.recs.filter((v) => v.args[0] === 'can not write .error file')
            assert.strict.deepEqual(ks.map((v) => v.args), [
                ['can not write .error file', { errType: 'Error', errCode: 'EPERM' }],
                ['can not write .error file', { errType: 'Error', errCode: 'EPERM' }],
            ], textOf(cp.recs))
            assert.strict.deepEqual(textOf(cp.recs).includes(fd), false, textOf(cp.recs))
        })

        it('合併失敗(缺片): 預設出口只輸出固定詞彙與 { errType }; .error 檔照常寫入', async function() {
            let h = 'e1b2c3d4e5f60718'
            let cp = capture()
            try {
                await mmg.push(h, 2, fd)
                await w.waitFun(() => fs.existsSync(path.resolve(fd, `${h}.error`)), { timeInterval: 10, attemptNum: 3000 })
                await w.waitFun(() => cp.recs.length >= 1, { timeInterval: 10, attemptNum: 3000 })
            }
            finally {
                cp.stop()
            }
            assert.strict.deepEqual(cp.recs.length, 1, textOf(cp.recs))
            assert.strict.deepEqual(cp.recs[0].args[0], 'merge slices error')
            assert.strict.deepEqual(Object.keys(cp.recs[0].args[1]).every((k) => ['errType', 'errCode'].includes(k)), true, textOf(cp.recs))
            assert.strict.deepEqual(textOf(cp.recs).includes(fd), false, textOf(cp.recs))
        })

    })

})
