import assert from 'assert'
import fs from 'fs'
import path from 'path'
import wpw from 'w-playwright'
import setup from './tools/e2e-setup.mjs'


/**
 * unit: Chromium 系瀏覽器之啟動一律經 w-playwright (帳本 R31; w-playwright 帳本 R-PW-ONLY / R-PW-WIRING)
 *
 * 為何需要這個檔:
 * Windows 上 Chromium 153 起, 每啟動一個新的根行程即以錯誤密碼替目前使用者呼叫一次 LogonUser (10 分鐘內 10 次即鎖帳號);
 * 停用功能 AutofillAiWalletPrivatePasses 可避免, 而 Playwright 自帶一串 --disable-features 會使呼叫端另給的那串失效 ——
 * 守門參數由 w-playwright 於每次啟動合併為恰一串。本套件之 e2e 若繞過 w-playwright 直接用 playwright, 守門即無聲失效,
 * 而 e2e 全綠不會有任何訊號, 故以本檔鎖住「啟動點只有一個、且送出之選項含守門」。
 *
 * 本檔不啟動任何瀏覽器 (替身取代 BrowserType); 真啟動由 e2e-*.test.mjs 以 launchBrowser 走真路徑 (headless shell)。
 */
describe('unit-pwWiring', function() {

    //GUARD, 守門功能名 (w-playwright README〈Core〉; 停用後 Chromium 不再呼叫 LogonUser)
    let GUARD = 'AutofillAiWalletPrivatePasses'

    //fdRoot, 專案根 (setup.projRoot 以模組位置推導, 不依賴 cwd)
    let fdRoot = setup.projRoot

    //rel, 專案根相對路徑 (一律用 /)
    let rel = (fp) => path.relative(fdRoot, fp).split(path.sep).join('/')

    //walk, 列出目錄下全部檔案 (不進 node_modules / dist / docs / tmp / _tmp / .git)
    let skipDirs = new Set(['node_modules', 'dist', 'docs', 'tmp', '_tmp', '.git'])
    let walk = (fd) => {
        let rs = []
        if (!fs.existsSync(fd)) {
            return rs
        }
        for (let ent of fs.readdirSync(fd, { withFileTypes: true })) {
            let fp = path.resolve(fd, ent.name)
            if (ent.isDirectory()) {
                if (!skipDirs.has(ent.name)) {
                    rs = rs.concat(walk(fp))
                }
            }
            else if (ent.isFile()) {
                rs.push(fp)
            }
        }
        return rs
    }

    //filesJs, 盤點範圍: src, test, toolg 之 .mjs/.js 與專案根層之 .mjs/.js
    let filesJs = () => {
        let rs = []
        for (let name of ['src', 'test', 'toolg']) {
            rs = rs.concat(walk(path.resolve(fdRoot, name)))
        }
        for (let ent of fs.readdirSync(fdRoot, { withFileTypes: true })) {
            if (ent.isFile()) {
                rs.push(path.resolve(fdRoot, ent.name))
            }
        }
        return rs.filter((fp) => /\.(mjs|js)$/.test(fp))
    }

    //reImp, 靜態匯入, 動態匯入, require 引用 playwright / playwright-core (含其子路徑) 之盤點正則 (w-playwright 帳本 R-PW-ONLY)
    //w-playwright 不命中: 引號後須緊接 playwright, 而 'w-playwright' 之引號後是 w
    let reImp = /(from\s+|import\(\s*|require\(\s*)['"`]playwright(-core)?['"`/]/

    //q, 為字串加單引號 (使下方正例不以字面形式出現在本檔, 否則本檔會被自己的盤點命中)
    let q = (s) => `'${s}'`

    it('盤點正則之正例與反例 (防空集合: 正則本身須分辨得出直接匯入)', function() {
        let pos = [
            'import { chromium } from ' + q('playwright'),
            'import x from ' + q('playwright-core'),
            'const { chromium } = await import(' + q('playwright') + ')',
            'const x = require(' + q('playwright-core/lib/x') + ')',
            'import x from ' + '"' + 'playwright' + '"',
            'import(' + '`' + 'playwright-core' + '`' + ')',
        ]
        for (let s of pos) {
            assert.strict.deepEqual(reImp.test(s), true, `應命中: ${s}`)
        }
        let neg = [
            'import wpw from ' + q('w-playwright'),
            'import wpw from "w-playwright"',
            'const x = await import(' + q('w-playwright') + ')',
            'let s = "playwright"',
        ]
        for (let s of neg) {
            assert.strict.deepEqual(reImp.test(s), false, `不應命中: ${s}`)
        }
    })

    it('R-PW-ONLY: src / test / toolg / 根層 .mjs .js 皆不直接匯入 playwright 或 playwright-core (含動態 import 與 require)', function() {
        let fps = filesJs()

        //防空集合: 範圍須含本檔自身 (不自我豁免) 與 e2e 共用層, 且檔數不得過少
        let rels = fps.map(rel)
        assert.strict.deepEqual(rels.includes('test/unit-pwWiring.test.mjs'), true, '盤點範圍須含本檔自身')
        assert.strict.deepEqual(rels.includes('test/tools/e2e-setup.mjs'), true, '盤點範圍須含 e2e 共用層')
        assert.strict.deepEqual(rels.includes('src/WConverhpServer.mjs'), true, '盤點範圍須含 src')
        assert.strict.deepEqual(fps.length > 100, true, `盤點檔數過少(${fps.length}), 範圍可能壞掉`)

        let hits = []
        for (let fp of fps) {
            let lines = fs.readFileSync(fp, 'utf8').split(/\r?\n/)
            lines.forEach((line, i) => {
                if (reImp.test(line)) {
                    hits.push(`${rel(fp)}:${i + 1}: ${line.trim().slice(0, 120)}`)
                }
            })
        }
        assert.strict.deepEqual(hits, [], '下列檔案直接匯入 playwright / playwright-core, 須改經 w-playwright')
    })

    it('R-PW-ONLY: package.json 不宣告 playwright / playwright-core, 且以 w-playwright 取代', function() {
        let pkg = JSON.parse(fs.readFileSync(path.resolve(fdRoot, 'package.json'), 'utf8'))
        let kinds = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']
        let bad = []
        for (let k of kinds) {
            for (let name of ['playwright', 'playwright-core']) {
                if (pkg[k] && typeof pkg[k][name] === 'string') {
                    bad.push(`${k}.${name}`)
                }
            }
        }
        assert.strict.deepEqual(bad, [], '不得宣告 playwright / playwright-core (版本由 w-playwright 擁有)')

        //測試專用, 屬 devDependencies 而非 dependencies (本套件之產品碼不啟動瀏覽器)
        assert.strict.deepEqual(typeof (pkg.devDependencies || {})['w-playwright'], 'string', 'devDependencies 須有 w-playwright')
        assert.strict.deepEqual('w-playwright' in (pkg.dependencies || {}), false, 'w-playwright 不得列為 dependencies')
    })

    it('R-PW-VERSION: 依賴樹解析出之 playwright-core 與 w-playwright 內附預設清單之版本一致 (否則啟動會被 E_PW_VERSION 拒絕)', function() {
        let info = wpw.getPlaywrightInfo()
        assert.strict.deepEqual(info.tableMatch, true, `playwright-core ${info.coreVersion} 與內附表 ${info.tableVersion} 不符`)
    })

    it('R-PW-WIRING: 啟動點全集只有 test/tools/e2e-setup.mjs 之一處 wpw.launchChromium, 且無任何直接 .launch( 呼叫', function() {
        let sites = []
        let direct = []
        for (let fp of filesJs()) {
            //本檔自身 (含替身之 launch 鍵) 不計
            if (rel(fp) === 'test/unit-pwWiring.test.mjs') {
                continue
            }
            let lines = fs.readFileSync(fp, 'utf8').split(/\r?\n/)
            lines.forEach((line, i) => {
                if (/\blaunchChromium(Persistent)?\s*\(/.test(line) && !/^\s*(\/\/|\*)/.test(line)) {
                    sites.push(`${rel(fp)}:${i + 1}`)
                }
                if (/\.launch(Persistent(Context)?|Server)?\s*\(/.test(line) && !/^\s*(\/\/|\*)/.test(line)) {
                    direct.push(`${rel(fp)}:${i + 1}`)
                }
            })
        }
        assert.strict.deepEqual(direct, [], '不得直接呼叫 BrowserType 之 launch 系函數')
        assert.strict.deepEqual(sites.length, 1, `啟動點應恰一處, 實得: ${sites.join(', ')}`)
        assert.strict.deepEqual(sites[0].startsWith('test/tools/e2e-setup.mjs:'), true, `啟動點應在 e2e 共用層, 實得: ${sites[0]}`)

        //四個 e2e 檔皆自共用層取得瀏覽器 (launchBrowser), 不自行啟動
        let e2es = fs.readdirSync(path.resolve(fdRoot, 'test')).filter((v) => /^e2e-.*\.test\.mjs$/.test(v))
        assert.strict.deepEqual(e2es.length >= 4, true, `e2e 測試檔數(${e2es.length})過少, 範圍可能壞掉`)
        for (let fn of e2es) {
            let code = fs.readFileSync(path.resolve(fdRoot, 'test', fn), 'utf8')
            assert.strict.deepEqual(/\bawait launchBrowser\(\)/.test(code), true, `${fn} 須經共用層 launchBrowser 取得瀏覽器`)
        }
    })

    it('R-PW-WIRING: launchBrowser 經 w-playwright 啟動, 送出之選項含守門 (恰一串 --disable-features 居末且含 AutofillAiWalletPrivatePasses), 並為無頭 headless shell', async function() {
        let seen = []
        let stub = { name: 'stub-browser', close: async() => {} }
        let restore = wpw.setBrowserTypeForTest({
            launch: async(o) => {
                seen.push(o)
                return stub
            },
        })
        let browser = null
        try {
            browser = await setup.launchBrowser()
        }
        finally {
            restore()
        }

        //替身確被呼叫 (依賴樹有兩份 w-playwright 時替身只作用於一份, 未斷言即可能空過; 帳本 R-PW-WIRING)
        assert.strict.deepEqual(seen.length, 1, 'launchBrowser 應恰經 w-playwright 啟動一次 (替身應被呼叫一次)')
        assert.strict.deepEqual(browser, stub, 'launchBrowser 應回傳 w-playwright 啟動之 browser')

        let o = seen[0]
        let args = o.args
        assert.strict.deepEqual(Array.isArray(args), true)
        let dis = args.filter((v) => /^--disable-features(=|$)/i.test(v))
        assert.strict.deepEqual(dis.length, 1, '命令列應恰一個 --disable-features (Chromium 對多串只取最後一串)')
        assert.strict.deepEqual(args[args.length - 1], dis[0], '合併後之 --disable-features 應為 args 最後一個元素')
        assert.strict.deepEqual(dis[0].startsWith('--disable-features='), true)
        assert.strict.deepEqual(dis[0].slice('--disable-features='.length).split(',').includes(GUARD), true, `應含守門功能 ${GUARD}`)

        //無頭且未指定通道/執行檔 => Playwright 受管之 headless shell (不觸發 LogonUser; 本套件之 e2e 每 case 啟動一次, 共約 43 次)
        assert.strict.deepEqual(o.headless, true, 'e2e 應為無頭')
        assert.strict.deepEqual(o.channel, undefined, 'e2e 不得指定通道 (真 Chrome / Edge 會每次啟動各 +1 錯誤密碼次數)')
        assert.strict.deepEqual(o.executablePath, undefined, 'e2e 不得指定執行檔')
    })

})
