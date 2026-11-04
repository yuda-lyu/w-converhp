import assert from 'assert'
import fs from 'fs'
import net from 'net'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'
import wPorts from './tools/ports.mjs'
import wAlloc from './tools/portsAlloc.mjs'

let { reserved, alloc, portOf } = wPorts
let { allocFree } = wAlloc


/**
 * unit: 測試用 port 之配發(對應 test/tools/ports.mjs、test/tools/portsAlloc.mjs)
 *
 * 守護的是「不再有固定的監聽埠」(ch309,規格 dspec/e2e埠與多套件同跑.md E8):
 * 舊版自 8300 起固定配發(一檔一段, 共 93 個), 與他套件之固定埠重疊, 也可能被任何程式占用 ——
 * Windows 允許占用者綁 127.0.0.1 / 0.0.0.0 / :: / ::1 與我們並存綁定, 不報錯, 測試全綠卻把請求打到別人的服務。
 * 現改由作業系統配發(listen(0)), 從根本上不會撞。
 *
 * 本檔的斷言**不依賴環境**: 不斷言「埠落在某範圍」(各作業系統之暫時埠範圍不同), 也不斷言「基準埠空閒」;
 * 「埠由作業系統配發」改以行為證明 —— 前一個模組實例手上的埠仍被占用時, 後一個模組實例取得之埠必不與之重疊(固定編號做不到)。
 */
describe('unit-ports', function() {

    //fdTest, 測試目錄之絕對路徑(不依賴 process.cwd)
    let fdTest = path.dirname(fileURLToPath(import.meta.url)) //須用 fileURLToPath: new URL(...).pathname 會把中文路徑 percent-encoding 而 ENOENT(全域規範 §11.2)

    //mjsOf, 取某目錄下之 .mjs; 非測試之共用檔(軸、設定、port 表)一律置於 test/tools, 故兩處都要掃 ——
    //只掃 test 根目錄會讓「有人在 fixture 裡寫死 port」整個掉出視野
    let mjsOf = (sub) => {
        let fd = sub === '' ? fdTest : path.join(fdTest, sub)
        if (!fs.existsSync(fd)) {
            return []
        }
        return fs.readdirSync(fd)
            .filter((v) => v.endsWith('.mjs'))
            .map((v) => ({ fn: sub === '' ? v : `${sub}/${v}`, fp: path.join(fd, v) }))
    }

    //allFiles, 測試檔 + tools 之共用檔
    let allFiles = [...mjsOf(''), ...mjsOf('tools')]

    //readCode, 讀測試檔並剝除區塊註解與整行註解(說明文字內之號碼不算站點)
    let readCode = (fp) => {
        return fs.readFileSync(fp, 'utf8')
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .split('\n')
            .filter((line) => !/^\s*\/\//.test(line))
            .join('\n')
    }

    //inst, 載入 ports.mjs 之另一個模組實例(查詢字串使 ESM 視為不同模組, 各有自己的快取與已取得集合)
    let inst = async(tag) => {
        let m = await import(new URL(`./tools/ports.mjs?inst=${tag}`, import.meta.url).href)
        return m.default
    }

    //hold, 在 port 上開一個監聽器(模擬「別人正占著這個埠」); 回傳可關閉者。綁不到(已被占用)則拋錯
    let hold = (port) => new Promise((resolve, reject) => {
        let s = net.createServer()
        s.once('error', (err) => {
            if (err.code === 'EAFNOSUPPORT' || err.code === 'EADDRNOTAVAIL') {
                //無 IPv6 之環境退綁 IPv4(同 portsAlloc)
                let s4 = net.createServer()
                s4.once('error', reject)
                s4.listen(port, '0.0.0.0', () => resolve(s4))
                return
            }
            reject(err)
        })
        s.listen(port, '::', () => resolve(s))
    })
    let release = (s) => new Promise((resolve) => s.close(() => resolve()))

    //nobodyAnswers, 連線至 host:port 是否沒有任何人接聽(連得上才算有人接聽; 無該位址族之環境亦視為無人接聽)
    let nobodyAnswers = (host, port) => new Promise((resolve) => {
        let s = net.connect({ host, port })
        s.once('connect', () => {
            s.destroy()
            resolve(false)
        })
        s.once('error', () => {
            resolve(true)
        })
    })

    it('alloc 之登記表: 名稱不重複、個數為正整數、每個登記名稱都有對應的測試檔', function() {
        let names = alloc.map((v) => v[0])
        assert.strict.deepEqual(new Set(names).size, names.length, '登記名稱重複')
        for (let [name, count] of alloc) {
            assert.strict.deepEqual(Number.isInteger(count) && count >= 1, true, `${name} 之個數須為正整數, 實得 ${count}`)
            assert.strict.deepEqual(fs.existsSync(path.join(fdTest, `${name}.test.mjs`)), true, `${name} 已登記但 test/${name}.test.mjs 不存在(殘留登記)`)
        }
    })

    it('portOf 對未登記之名稱與越界之索引須拋錯, 不得靜默回一個錯誤號碼', function() {
        assert.throws(() => portOf('api-不存在'), /未登記/)
        assert.throws(() => portOf('api-clientToken', 1), /只配發 1 個/)
        assert.throws(() => portOf('api-clientToken', -1), /取不到第 -1 個/)
    })

    it('portOf: 同一行程內, 不同檔、不同索引之埠皆互異; 同一檔同一索引每次回同一個', async function() {
        this.timeout(30000)
        //用獨立模組實例: 不佔用本 worker 對真實測試檔名(api-cors 等)的快取, 以免與同一 worker 後續載入之該檔互相影響
        let p = await inst('distinct')
        let got = [
            p.portOf('api-cors', 0), p.portOf('api-cors', 1),
            p.portOf('api-clientAbort', 0), p.portOf('api-clientAbort', 1), p.portOf('api-clientAbort', 2),
            p.portOf('e2e-execute'), p.portOf('api-hostLifecycle'), p.portOf('api-serverReady', 2),
        ]
        assert.strict.deepEqual(new Set(got).size, got.length, `埠有重複: ${got.join(',')}`)
        assert.strict.deepEqual(p.portOf('api-cors', 0), got[0], '同一檔同一索引須回同一個')
        assert.strict.deepEqual(p.portOf('api-clientAbort', 2), got[4], '同一檔同一索引須回同一個')
    })

    it('portOf 之埠由作業系統配發: 前一個模組實例的埠仍被占用時, 後一個模組實例取得之埠不與之重疊, 且皆可綁定(固定編號做不到)', async function() {
        this.timeout(60000)
        //why 以行為證明而非斷言「落在某範圍」: 各作業系統之暫時埠範圍不同, 範圍斷言隨環境而變;
        //固定編號(如舊版 8300 起)對同名稱、同索引在任何實例都回同一個號碼 —— 該號碼被占用時, 後一實例就拿到被占用者
        let a = await inst('a')
        let b = await inst('b')
        let portsA = [a.portOf('api-cors', 0), a.portOf('api-cors', 1), a.portOf('api-clientAbort', 0)]
        let held = []
        try {
            for (let p of portsA) {
                held.push(await hold(p)) //前一實例之埠仍被占用中(綁得到, 代表它確實是空閒時取得的)
            }
            let portsB = [b.portOf('api-cors', 0), b.portOf('api-cors', 1), b.portOf('api-clientAbort', 0)]
            for (let p of portsB) {
                assert.strict.deepEqual(portsA.includes(p), false, `後一實例取得了前一實例仍在占用的埠 ${p}`)
                let s = await hold(p) //可綁定
                await release(s)
            }
        }
        finally {
            await Promise.all(held.map(release))
        }
    })

    it('reserved.closed(連線失敗用): 無人監聽、同一行程每次相同、與 portOf 之埠不同; 且另一模組實例於其被占用時取得不同者', async function() {
        this.timeout(60000)
        let p = await inst('closed')
        let c = p.reserved.closed
        assert.strict.deepEqual(p.reserved.closed, c, '同一行程須每次回同一個')
        assert.strict.deepEqual(await nobodyAnswers('127.0.0.1', c), true, 'closed 埠須無人監聽(IPv4)')
        assert.strict.deepEqual(await nobodyAnswers('::1', c), true, 'closed 埠須無人監聽(IPv6)')
        for (let [name, count] of alloc.slice(0, 5)) {
            for (let i = 0; i < count; i++) {
                assert.strict.deepEqual(p.portOf(name, i) === c, false, `closed 與 ${name}[${i}] 相同`)
            }
        }
        //固定值(如舊版 8199)在任何實例都相同, 於其被占用時後一實例仍拿到它
        let s = await hold(c)
        try {
            let other = await inst('closed2')
            assert.strict.deepEqual(other.reserved.closed === c, false, '另一模組實例取得了仍被占用的 closed 埠')
            assert.strict.deepEqual(await nobodyAnswers('127.0.0.1', other.reserved.closed), true)
        }
        finally {
            await release(s)
        }
    })

    it('allocFree: 回傳 count 個互異且可綁定之埠; count 非法須拋錯', async function() {
        this.timeout(30000)
        let ports = await allocFree(40)
        assert.strict.deepEqual(ports.length, 40)
        assert.strict.deepEqual(new Set(ports).size, 40, '須互異')
        for (let p of ports.slice(0, 5)) {
            await release(await hold(p))
        }
        for (let bad of [0, -1, 1.5, NaN, '3', undefined]) {
            await assert.rejects(() => allocFree(bad), /count 須為正整數/)
        }
    })

    it('allocFree 之認領登錄: 已被存活行程認領之埠不得再發; 持有者已結束之認領可回收; 腳本模式之持有者為父行程', async function() {
        this.timeout(60000)
        //why: 配發 → 釋放 → 測試綁定之間有空窗, mocha --parallel 之 worker 併發配發時, 釋放後之埠可能被另一個 worker 取得(獨立審查實測);
        //認領登錄使「本套件測試彼此之間」不會拿到同一號碼。以注入 pick 模擬「作業系統把已認領之號碼又發出來」, 結果與作業系統策略無關
        let fdClaim = path.join(fdTest, '_tmp', `ports-claims-unit-${process.pid}`)
        fs.rmSync(fdClaim, { recursive: true, force: true })
        let fake = (port) => ({ address: () => ({ port }), close: (cb) => cb() }) //不真的綁定之假監聽器
        let real = () => new Promise((resolve, reject) => {
            let s = net.createServer()
            s.once('error', reject)
            s.listen(0, () => resolve(s))
        })
        try {
            //①已被存活行程(本行程)認領之埠, 作業系統又發出來時須被擋下並重新要一個
            let [P] = await allocFree(1, { fdClaim })
            let calls = 0
            let ports = await allocFree(2, {
                fdClaim,
                pick: async() => {
                    calls += 1
                    return calls === 1 ? fake(P) : await real()
                },
            })
            assert.strict.deepEqual(ports.includes(P), false, '已被存活行程認領之埠被再次發出')
            assert.strict.deepEqual(ports.length, 2)
            assert.strict.deepEqual(calls >= 3, true, `被擋下的那次之後須再要(共 ${calls} 次 pick)`)

            //②持有者已結束之認領可回收: 認領人為一個不存在之 pid
            //why 不用「剛結束之子行程 pid」: Windows 會很快重用 pid, 該 pid 可能又屬於另一個存活行程而使本案假紅; 取一個遠超實際 pid 範圍之值並驗證它不存在
            let deadPid = 2100000000
            assert.throws(() => process.kill(deadPid, 0), '前提: deadPid 須不存在')
            let Q = 1 //任一號碼; 這裡不綁定, 只驗登錄的回收邏輯
            fs.mkdirSync(path.join(fdClaim, String(Q)), { recursive: true })
            fs.writeFileSync(path.join(fdClaim, String(Q), 'owner'), String(deadPid))
            let got = await allocFree(1, { fdClaim, pick: async() => fake(Q) })
            assert.strict.deepEqual(got, [Q], '持有者已結束之認領須可回收重認')
            assert.strict.deepEqual(fs.readFileSync(path.join(fdClaim, String(Q), 'owner'), 'utf8'), String(process.pid), '回收後持有者須為本行程')

            //③腳本模式(ports.mjs 以子行程呼叫): 認領之持有者須為父行程(本行程), 不是隨即結束之子行程 —— 否則認領下次配發即被回收而形同無
            let out = JSON.parse(execFileSync(process.execPath, [path.join(fdTest, 'tools', 'portsAlloc.mjs'), '2'], { encoding: 'utf8', windowsHide: true }))
            assert.strict.deepEqual(out.length, 2)
            for (let p of out) {
                let owner = fs.readFileSync(path.join(fdTest, '_tmp', 'ports-claims', String(p), 'owner'), 'utf8')
                assert.strict.deepEqual(owner, String(process.pid), `埠 ${p} 之認領持有者須為父行程`)
            }
        }
        finally {
            fs.rmSync(fdClaim, { recursive: true, force: true })
        }
    })

    it('每個會啟動伺服器之測試檔都須登記於 alloc', function() {
        let names = new Set(alloc.map((v) => v[0]))
        let miss = []
        for (let { fn, fp } of allFiles) {
            if (!/\.test\.mjs$/.test(fn)) {
                continue
            }
            let code = readCode(fp)

            //起伺服器之判準: 建構 WConverhpServer 或以 startServer 起(e2e)
            if (!/new WConverhpServer\(|startServer\(/.test(code)) {
                continue
            }
            let key = fn.replace(/\.test\.mjs$/, '')
            if (!names.has(key)) {
                miss.push(key)
            }
        }
        assert.strict.deepEqual(miss, [], `下列測試檔會啟動伺服器卻未登記於 test/tools/ports.mjs 之 alloc`)
    })

    it('測試檔不得手寫 port 字面值(不可綁定之保留值除外), 一律經 portOf / reserved 取得; 且不得在套件預設埠上監聽', function() {
        //why: 本條才防止有人繞過配發 —— 繞過配發正是改為作業系統配發前之現況。
        //允許者只有 reserved 中不可綁定之值: closedLow(1, 特權埠)、invalid(70000, 超出 TCP 值域);
        //另 `.listen(0` 是「請作業系統配發」,即本機制本身, 故 listen 之第一引數允許 0 —— 但 `port: 0` 不允許(本套件把 0 視為無效而取預設 8080, 會悄悄綁到 8080)
        let allow = new Set([String(reserved.closedLow), String(reserved.invalid)])
        let bad = []
        for (let { fn, fp } of allFiles) {
            if (fn === 'tools/ports.mjs' || fn === 'unit-ports.test.mjs') {
                continue
            }
            let code = readCode(fp)
            //re, 只認 port 之語法位置: 名稱含 port 之變數/鍵的賦值(不分大小寫與前後綴, 值可帶引號: mainPort = 8080、W_PORT: '8080')、
            //URL 內之主機後綴(//任意主機:、localhost:、127.0.0.1:、0.0.0.0:、[::1]:)、listen/connect 之第一引數
            //why 不掃所有 8xxx/9xxx: timeout: 8000、pollUntilSettled(q, 8000, h) 等非 port 之數值會誤報, 使本條變成雜訊
            let re = /(?:[A-Za-z0-9_$]*port[A-Za-z0-9_$]*\s*[:=]\s*['"`]?|\/\/[^\s'"`/]*:|localhost:|127\.0\.0\.1:|0\.0\.0\.0:|\[::1\]:|(\.listen|\.connect|\.createConnection)\(\s*['"`]?)(\d{1,5})\b/gi
            for (let m of (code.matchAll(re) || [])) {
                let isListen = m[1] === '.listen'
                if (!allow.has(m[2]) && !(isListen && m[2] === '0')) {
                    bad.push(`${fn}: ${m[2]}`)
                }
            }
            //套件預設埠只作期望值: 不得出現在 URL 主機後綴或 listen 引數
            if (/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):\$\{\s*reserved\.packageDefault|\.listen\([^)]*packageDefault/.test(code)) {
                bad.push(`${fn}: 在套件預設埠(reserved.packageDefault)上連線或監聽`)
            }
        }
        assert.strict.deepEqual(bad, [], '下列處仍自行手寫 port 字面值, 須改以 portOf / reserved 取得')
    })

    it('ports.mjs 自身不得有可作為監聽埠之數字字面值(僅 reserved 中之 8080 套件預設期望值、70000 非法值)', function() {
        let code = readCode(path.join(fdTest, 'tools', 'ports.mjs'))
        let nums = [...code.matchAll(/\b(\d{4,6})\b/g)].map((m) => m[1]).filter((v) => !['8080', '70000'].includes(v))
        // 30000 為 execFileSync 之逾時毫秒, 65536 為埠值域上限(皆非埠號), 其餘四位數以上一律不允許
        let rest = nums.filter((v) => !['30000', '65536'].includes(v))
        assert.strict.deepEqual(rest, [], `ports.mjs 出現疑似固定埠之字面值: ${rest.join(',')}`)
    })

    it('test 根目錄只得放測試檔, 非測試之共用 mjs 一律置於 test/tools(帳本 R25)', function() {
        //why: 軸(api-axes)、e2e 設定(e2e-setup)、port 配發表(ports)與測試檔混在同一層時,
        //「這個檔是不是一組測試」要逐檔打開才知道; runner 之白名單(package.json 之 test script)也只是碰巧沒抓到它們
        let bad = mjsOf('').filter((v) => !/\.test\.mjs$/.test(v.fn)).map((v) => v.fn)
        assert.strict.deepEqual(bad, [], 'test 根目錄出現非測試檔, 應移至 test/tools')
    })

    it('測試檔一律以 api- / unit- / e2e- 前綴標明層級(全域規範 §15.3)', function() {
        //why: 前綴使「這是哪一層的測試」不必打開檔案就知道, 也讓執行者能以樣式選取某一層。
        //第十一輪改正四個舊命名檔(executeWithU8a / executeWithFile / uploadLargeFile / downloadLargeFile):
        //四者皆起真伺服器並走真 HTTP、不經瀏覽器, 屬 api 層, 已加上 api- 前綴
        let bad = mjsOf('')
            .filter((v) => /\.test\.mjs$/.test(v.fn) && !/^(api|unit|e2e)-/.test(v.fn))
            .map((v) => v.fn)
        assert.strict.deepEqual(bad, [], '下列測試檔缺少層級前綴, 須依其層級改名為 api- / unit- / e2e- 開頭')
    })

})
