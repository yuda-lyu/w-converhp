/**
 * 測試用 port 之集中配發(作業系統配發版)
 *
 * **不再有任何固定的監聽埠。** 每個測試檔需要幾個 port,於 `alloc` 登記「個數」(不登記號碼);
 * 首次 `portOf(檔名, i)` 時,由 `test/tools/portsAlloc.mjs` 向作業系統要該檔所需之全部埠(`listen(0)`,同時持有以保證互異,
 * 並到跨行程「認領登錄」認領以免 `--parallel` 之別的 worker 取得同一號碼),取得後快取於本行程;之後同一檔之 `portOf` 回同一組。
 *
 * why 改為作業系統配發(ch309,規格 `dspec/e2e埠與多套件同跑.md` E8):
 *   舊版自 8300 起固定配發(一檔一段,共 93 個)。固定段只保證「本套件內不互撞」,不保證不撞他人:
 *   - 與 w-highcharts-vue 之 8301~8305 重疊,測試閘為此對兩套件加互斥(`portGroups` 8301)而不能同跑
 *   - 他套件(或任何程式)占著 8300~8392 任一埠時,本套件之測試要麼 `EADDRINUSE`,要麼**把請求打到別人的服務**:
 *     Windows 允許占用者綁 `127.0.0.1`(或 `0.0.0.0`、`::`、`::1`)與我們並存綁定,不報錯,測試卻連到對方(vd309 實測)
 *   - 要避開就得有「偵測占用 → 換埠」機制,而作業系統配發從根本上不需要它
 *
 * `portOf` 維持**同步**: 測試檔多在 describe 本體以 `let port = portOf(...)` 同步取用,而 `listen(0)` 是 async,
 * 故以同步子行程呼叫 `portsAlloc.mjs`(單次約 0.1~0.2 秒,每個測試檔只呼叫一次;Windows 11 實測)。
 * 取得之埠在回傳前已釋放,測試隨即在同一行程內綁定。配發到綁定之間的空窗內,本套件其他 worker 取得同一號碼由認領登錄擋下
 * (見 `portsAlloc.mjs` 檔頭; 獨立審查實測無登錄時 `--parallel` 併發配發約每 2000 次綁定出現 1 次 EADDRINUSE);
 * 認領持有者為本行程, 行程結束後於下次配發時回收。
 *
 * 保留值(`reserved`)**不是監聽埠**,而是測試用的「值」:
 *   - `packageDefault` 套件 port 預設值 8080。**僅作期望值**(api-optionsRange 斷言「port 非法時取預設」),任何測試不得在其上監聽
 *   - `closedLow`(1)、`invalid`(70000): 前者為必然無人監聽之特權埠(連線失敗指向),後者超出 TCP 值域(非法輸入),皆不可綁定
 *   - `closed` 連線失敗用之埠: 向作業系統要一個後**立即釋放且從不綁定**(原固定 8199; 固定值一旦被他人占用,
 *     「連線失敗」之測試會連到別人的服務)
 *
 * 新增測試檔: 於 `alloc` 加一行並填需要幾個 port。
 * 沒登記、索引越界、以及測試檔內自行手寫 port 字面值,皆由 `test/unit-ports.test.mjs` 擋住。
 */
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'


//fpAlloc, 向作業系統要埠之腳本(須用 fileURLToPath: new URL(...).pathname 會把中文路徑 percent-encoding)
let fpAlloc = path.join(path.dirname(fileURLToPath(import.meta.url)), 'portsAlloc.mjs')

//used, 本行程已取得過之埠(跨檔名、跨 closed): 同一行程內保證互異, 不依賴作業系統之配發策略
let used = new Set()

//syncAlloc, 同步向作業系統要 count 個互異之空閒埠
let syncAlloc = (count) => {
    for (let k = 0; k < 5; k++) {
        //env 清空 NODE_OPTIONS: 父行程若帶 --inspect-brk 會讓子行程卡住至逾時, 帶 --import 預載(如負載試驗之 loadPreload)則每個子行程多寫探針檔
        let out = execFileSync(process.execPath, [fpAlloc, String(count)], { encoding: 'utf8', windowsHide: true, timeout: 30000, env: { ...process.env, NODE_OPTIONS: '' } })
        if (out.trim() === '') {
            throw new Error('syncAlloc: portsAlloc.mjs 沒有輸出任何結果(離開碼 0 但 stdout 為空)')
        }
        let ports = JSON.parse(out)
        let ok = Array.isArray(ports) && ports.length === count && ports.every((p) => Number.isInteger(p) && p > 0 && p < 65536) && new Set(ports).size === count
        if (!ok) {
            throw new Error(`syncAlloc: 作業系統配發結果不合規格: ${out}`)
        }
        if (ports.some((p) => used.has(p))) {
            continue //作業系統把本行程先前取得之埠又發了一次(隨機配發之系統): 重新要一批
        }
        for (let p of ports) {
            used.add(p)
        }
        return ports
    }
    throw new Error('syncAlloc: 連續 5 次取得之埠都與本行程先前取得者重複')
}

//closedPort, 連線失敗用之埠: 向作業系統要一個後釋放, 從不綁定(每個行程取一次)
let closedPort = null

//reserved, 保留值: 非監聽埠(見檔頭)
let reserved = {
    packageDefault: 8080, //套件之 port 預設值; 僅作期望值, 不得監聽
    closedLow: 1, //必然無人監聽之特權埠; 供連線失敗指向
    invalid: 70000, //超出 TCP 值域之非法值; 供「port 非法時須取預設」之測試輸入
    get closed() {
        if (closedPort === null) {
            closedPort = syncAlloc(1)[0]
        }
        return closedPort
    },
}

//alloc, 登記表: [測試檔名(不含副檔名), 需要幾個 port, 用途]; 只登記個數, 不登記號碼
let alloc = [
    ['api-characterization', 2, '主伺服器 + 外部 serverHapi 對照組'],
    ['api-clientAttemptEvents', 3, '主伺服器 + 500 伺服器 + 懸置伺服器'],
    ['api-clientErrorEvents', 3, '應用端拒絕 + permission denied + 不重試'],
    ['api-clientToken', 1, ''],
    ['api-cors', 2, '主伺服器 + 限定來源之對照組'],
    ['api-downloadAbort', 1, ''],
    ['api-downloadEvents', 1, ''],
    ['api-downloadFraming', 1, ''],
    ['api-downloadLength', 1, ''],
    ['api-downloadShape', 1, ''],
    ['api-downloadVariants', 1, ''],
    ['api-envelopeIntegrity', 1, ''],
    ['api-envelopeShape', 1, ''],
    ['api-errorEventOnce', 2, '有監聽器 + 無應用端監聽器'],
    ['api-executeError', 1, ''],
    ['api-executeProgress', 1, ''],
    ['api-failureNotSuccess', 1, ''],
    ['api-hostileErrorValues', 1, ''],
    ['api-hostileRequestJson', 1, ''],
    ['api-mainMaxBytes', 2, '主伺服器 + 預設值伺服器'],
    ['api-noListener', 3, '每次 mkServer 起一台, 共三台'],
    ['api-noRetry', 1, ''],
    ['api-optionsNumericString', 1, ''],
    ['api-optionsRange', 2, '主伺服器 + 超出安全整數之選項伺服器'],
    ['api-pathTraversal', 2, '主伺服器 + 檔名穿越之對照組'],
    ['api-payloadParseFail', 1, ''],
    ['api-processSafety', 1, ''],
    ['api-sliceAbort', 1, ''],
    ['api-sliceDurable', 1, ''],
    ['api-sourceTraps', 1, ''],
    ['api-startupErrors', 3, '暫存夾為檔案 + 暫存夾消失 + 埠被占用之對照組(同一 port 起兩台)'],
    ['api-storedResult', 1, ''],
    ['api-uploadFilenameSanitize', 1, ''],
    ['api-uploadInputTypes', 1, ''],
    ['api-uploadMergeError', 1, ''],
    ['api-uploadMergeFail', 1, ''],
    ['api-uploadMergeIntegrity', 1, ''],
    ['api-uploadMergeReentry', 1, ''],
    ['api-uploadMergeStates', 1, ''],
    ['api-uploadPollSerial', 1, ''],
    ['api-uploadResultShape', 1, ''],
    ['api-uploadResumeLastSlice', 1, ''],
    ['api-uploadVariants', 1, ''],
    ['api-verifyConnError', 1, ''],
    ['api-executeWithU8a', 1, ''],
    ['api-executeWithFile', 1, ''],
    ['api-uploadLargeFile', 1, ''],
    ['api-downloadLargeFile', 1, ''],
    ['e2e-execute', 1, ''],
    ['e2e-upload', 1, ''],
    ['e2e-download', 1, ''],
    ['api-uploadNoListener', 3, '無 upload 接聽者 + 有接聽者(對照組、S2、S3、once 在途) + 第二實例(在途消費之跨實例隔離)'],
    ['api-optionsFailClosed', 13, 'verifyConn:false + verifyConn:null 對照組 + corsOrigins(無效 3、明示停用 3、合法寬鬆 2)+ useInert 無效 + pathStaticFiles 無效 + 靜態檔對照組'],
    ['api-abortDuringAdmit', 1, ''],
    ['api-clientAbort', 3, '主伺服器 + sizeSlice 不一致之伺服器(回應已到時中止) + 大切片伺服器(切片本體傳送中中止)'],
    ['api-hostLifecycle', 1, '子行程內之伺服器生命週期'],
    ['e2e-abort', 1, ''],
    ['api-clientOutcomeShapes', 2, '主伺服器 + 非本套件之 2xx 回應之 http 伺服器(網址誤指 SPA 主機)'],
    ['api-serverReady', 3, '就緒伺服器 + 埠被占用之兩台(同一 port 起兩台) + stop 搶先之伺服器'],
    ['api-clientTrace', 1, 'stub 伺服器(依本套件協定回應 merge-slices-get; 退避事件之連線失敗用 reserved.closed)'],
]

//slots, 各檔之配額與(首次取用時才取得之)埠: name -> { count, ports }
let slots = {}
for (let [name, count] of alloc) {
    slots[name] = { count, ports: null }
}

//portOf, 取某測試檔之第 i 個 port(i 自 0 起算); 首次取用時向作業系統要該檔所需之全部埠
//名稱打錯或索引越界一律拋錯, 不靜默回一個可用但錯誤之號碼
let portOf = (name, i = 0) => {
    let s = slots[name]
    if (!s) {
        throw new Error(`portOf: 測試檔[${name}]未登記於 test/tools/ports.mjs 之 alloc`)
    }
    if (!Number.isInteger(i) || i < 0 || i >= s.count) {
        throw new Error(`portOf: 測試檔[${name}]只配發 ${s.count} 個 port, 取不到第 ${i} 個(自 0 起算)`)
    }
    if (s.ports === null) {
        s.ports = syncAlloc(s.count)
    }
    return s.ports[i]
}


let r = {
    reserved,
    alloc,
    portOf,
}


export default r
