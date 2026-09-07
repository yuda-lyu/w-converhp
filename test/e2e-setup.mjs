/**
 * e2e 共用層 (不帶 .test. 中綴, 避免被 runner 當測試檔抓取)
 *
 * 本專案之 e2e 定位說明(技能[role-coder-for-test-e2e] §0 勘查結果):
 *   w-converhp 於瀏覽器端**沒有 UI**, 它是傳輸函式庫, 對外只有 execute / upload / download 三個 JS API。
 *   故技能中「標準圖 / 紅框 / pixel baseline / 操作手冊用圖」(§7)、「截圖穩定性 / 假時鐘 / 遮罩」(§8)、
 *   「真鍵盤滑鼠 act」(§4)、「多語覆蓋」(§2.1 第4維) 皆不適用, 只採通用原則:
 *   §2.1 第1/3/5/6 維、§5 assert 走使用者觀察、§6 每 case fresh browser、§9 lifecycle 對稱性、§9.3 端點常數。
 *   對應之條件式 adapter C4/C5/C6/C7/C8/C9/C10/C12/C13/C15 一律不適用。
 *
 * e2e 存在的理由: 「前端對後端」是本套件兩大模式之一, 而瀏覽器端走的是 rollup 打包後之 UMD,
 * 其相依解析(package.json browser 欄位)與 node 端不同, api-*.test.mjs 測不到該路徑。
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { chromium } from 'playwright'
import rollupFile from 'w-package-tools/src/rollupFile.mjs'
import delay from 'wsemi/src/delay.mjs'
import WConverhpServer from '../src/WConverhpServer.mjs'


//projRoot, 以模組所在位置推導專案根, 不依賴 cwd
//(輸出落在模組所在資料夾之情境, 須用 fileURLToPath, 不可用 new URL().pathname)
let projRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

//fdTmp, 測試中介資料一律落 test/_tmp/ (已 gitignore), 不可用專案 ./tmp/ (該處為代理暫存區, 隨時會被清除)
let fdTmp = path.resolve(projRoot, 'test', '_tmp')

//host, 一律用 127.0.0.1 不用 localhost
//(localhost 先試 IPv6 ::1, 而 server 常只綁 IPv4, 瀏覽器每次連線會多數百 ms)
let HOST = '127.0.0.1'

//nameBundle, 打包後之 UMD 檔名與其 window 全域名
let nameBundle = 'w-converhp-client-e2e'


/**
 * 唯一 chromium.launch 出口 (契約 C1)
 * 本專案無 pixel 比對, 故不需確定性渲染旗標組(技能 §8.4 之適用前提是像素比對)
 */
async function launchBrowser() {
    return await chromium.launch({ headless: true })
}


/**
 * 由現行 src 打包出瀏覽器可載入之 UMD (契約: 專案特化)
 *
 * why 打包而不用 dist/: dist 是另行產製之發佈產物, 與當前 src 可能不同步;
 * e2e 要驗的是「現在 src 在瀏覽器環境的行為」, 故每輪測試自 src 打包。
 * 以 module 層 promise 快取, 同一個 mocha 進程內多個 e2e 檔只打包一次。
 */
let pmBundle = null
function buildClientBundle() {

    //fpBundle
    let fpBundle = path.resolve(fdTmp, `${nameBundle}.umd.js`)

    //check, 已在打包或已打包完成則直接沿用
    //須同時確認產物仍存在, 否則若中介資料夾被清除, 沿用快取會讓頁面載入不到 bundle
    if (pmBundle !== null && fs.existsSync(fpBundle)) {
        return pmBundle
    }

    let core = async() => {

        //mkdir
        fs.mkdirSync(fdTmp, { recursive: true })

        //於 _tmp 產生 re-export 入口後打包, 不複製 src 檔案: 複製會使 client 內之相對 import(./isPathInside.mjs 等)於 _tmp 解析不到;
        //入口檔名決定 UMD 之全域名, 故沿用 nameBundle
        let fnTmp = `${nameBundle}.mjs`
        fs.writeFileSync(path.resolve(fdTmp, fnTmp), `export { default } from '../../src/WConverhpClient.mjs'\n`, 'utf8')

        //rollup, runin 須為 browser, 與 toolg/gDistRollup.mjs 之 client 設定一致
        await rollupFile({
            fn: fnTmp,
            fdSrc: fdTmp,
            fdTar: fdTmp,
            globals: { path: 'path', fs: 'fs', stream: 'stream' },
            external: ['worker_threads', 'path', 'fs', 'stream'],
            runin: 'browser',
            bLog: false,
        })

        //check
        if (!fs.existsSync(fpBundle)) {
            throw new Error(`打包失敗, 找不到 ${fpBundle}`)
        }

        return fpBundle
    }

    pmBundle = core()

    return pmBundle
}


/**
 * 產生測試頁面, 內含已載入之 client bundle
 * 頁面由伺服器之靜態路由供應, 與 API 同源, 故無 CORS 與 <a download> 之限制
 */
function writePage(fnPage, scriptBody) {

    //mkdir
    fs.mkdirSync(fdTmp, { recursive: true })

    let html = `<!DOCTYPE html>
<html lang="zh-tw">
<head>
<meta charset="utf-8">
<title>${fnPage}</title>
<script src="/test/_tmp/${nameBundle}.umd.js"></script>
</head>
<body>
<script>
let WConverhpClient = window['${nameBundle}']
${scriptBody}
</script>
</body>
</html>
`
    let fp = path.resolve(fdTmp, fnPage)
    fs.writeFileSync(fp, html, 'utf8')

    return `/test/_tmp/${fnPage}`
}


/**
 * 啟動測試用伺服器 (契約 C2)
 * 每個 e2e 檔各自起停自己的 server 與 port, 不共用, 故不需 reuse 偵測
 */
async function startServer(opt = {}) {

    //new
    let wsv = new WConverhpServer({
        pathStaticFiles: '.', //須供應 test/_tmp 下之頁面與 bundle
        ...opt,
    })

    //待伺服器啟動
    await delay(1200)

    return wsv
}


/**
 * 清除本輪測試之中介資料
 * 只刪本模組建立者, 不動 fixture (test/1mb.7z 等)
 *
 * 註冊於 root after, 全部 e2e 檔跑完才執行一次。
 * 不可放在各檔自己的 after: 多檔共用同一份已打包之 bundle,
 * 先跑完的檔若清掉整個中介資料夾, 後續檔會載入不到 bundle。
 */
function cleanup() {
    try {
        fs.rmSync(fdTmp, { recursive: true, force: true })
    }
    catch (err) {}
}

//以 root after 註冊, 由框架於全部測試結束後觸發
if (typeof globalThis.after === 'function') {
    globalThis.after(function() {
        cleanup()
    })
}


export {
    HOST,
    projRoot,
    launchBrowser,
    buildClientBundle,
    writePage,
    startServer,
    cleanup
}
