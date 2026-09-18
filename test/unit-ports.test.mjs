import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import wPorts from './tools/ports.mjs'

let { base, reserved, alloc, segs, portOf } = wPorts


/**
 * unit: 測試用 port 之配發(對應 test/tools/ports.mjs)
 *
 * 為何需要這個檔:
 * mocha 以 --parallel 同時跑 61 個檔,port 撞號即 EADDRINUSE,而錯誤訊息看不出是「誰跟誰撞」,
 * 下一次跑又可能因時序而過 —— 這是最難查的 flake。改為集中配發前,**已經存在一組真實撞號**:
 * api-clientErrorEvents 之 port+1、port+2 為 8497、8498,而 api-startupErrors 直接寫死同樣的號碼。
 *
 * 本檔鎖三件事:配發不重疊、每個起伺服器的測試檔都有登記、沒有人再自行手寫 port 字面值。
 * 第三條是關鍵 —— 前兩條只證明「表是對的」,第三條才防止有人繞過表。
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

    it('配發之區段不得重疊, 且須自 base 起連續', function() {
        let used = new Set()
        let expect = base
        for (let [name, count] of alloc) {
            let s = segs[name]
            assert.strict.deepEqual(s.from, expect, `${name} 之起點須接續前一段`)
            for (let i = 0; i < count; i++) {
                let p = s.from + i
                assert.strict.deepEqual(used.has(p), false, `port ${p} 被重複配發(${name})`)
                used.add(p)
            }
            expect += count
        }
    })

    it('配發區不得涵蓋保留區(套件預設 8080、連線失敗用之 8199 與 1)', function() {
        for (let [k, p] of Object.entries(reserved)) {
            for (let [name, count] of alloc) {
                let s = segs[name]
                let hit = p >= s.from && p < s.from + count
                assert.strict.deepEqual(hit, false, `保留區 ${k}(${p})被配發給 ${name}`)
            }
        }
    })

    it('portOf 對未登記之名稱與越界之索引須拋錯, 不得靜默回一個錯誤號碼', function() {
        assert.throws(() => portOf('api-不存在'), /未登記/)
        assert.throws(() => portOf('api-clientToken', 1), /只配發 1 個/)
        assert.strict.deepEqual(portOf('api-cors'), segs['api-cors'].from)
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

    it('測試檔不得再自行手寫 port 字面值(保留區除外), 一律經 portOf 取得', function() {
        //why: 前兩條只證明「表是對的」, 本條才防止有人繞過表 —— 而繞過表正是改為集中配發前之現況
        let allow = new Set(Object.values(reserved).map((v) => String(v)))
        let bad = []
        for (let { fn, fp } of allFiles) {
            if (fn === 'tools/ports.mjs' || fn === 'unit-ports.test.mjs') {
                continue
            }
            let code = readCode(fp)
            //re, 只認 port 之語法位置: port 變數之賦值、物件之 port 鍵、URL 內之主機後綴
            //why 不掃所有 8xxx/9xxx: timeout: 8000、pollUntilSettled(q, 8000, h) 等非 port 之數值會誤報, 使本條變成雜訊
            let re = /(?:\bport[A-Za-z0-9]*\s*[:=]\s*|localhost:|127\.0\.0\.1:)(\d{2,5})/g
            for (let m of (code.matchAll(re) || [])) {
                if (!allow.has(m[1])) {
                    bad.push(`${fn}: ${m[1]}`)
                }
            }
        }
        assert.strict.deepEqual(bad, [], '下列處仍自行手寫 port 字面值, 須改以 portOf 取得')
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
