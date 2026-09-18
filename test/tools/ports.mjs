/**
 * 測試用 port 之集中配發
 *
 * why 集中:mocha 以 `--parallel` 同時跑 `test/unit-*` 與 `test/api-*` 等 61 個檔(見 package.json 之 test script),
 * 同一次執行內 port 必須互斥。改為集中配發前之現況:
 *   - 47 檔各自手寫固定值(散在 8184-8628),新增測試檔須自行 grep 找空號,靠註解「同時test故得要不同port」提醒
 *   - 2 檔以 `Math.random` 產生(9200+300、9600+300)—— 撞到即 EADDRINUSE 而下次跑又過,是最難查之 flake
 *   - 3 處以 `port + 1` / `port + 2` 衍生,未納入任何盤點
 *   - 4 處直接內嵌於字串
 *
 * **已存在之實際撞號**(非理論風險):`api-clientErrorEvents` 之 `port + 1`、`port + 2` 為 8497、8498,
 * 而 `api-startupErrors` 直接寫死 8497、8498 —— 兩檔皆在 `--parallel` 範圍內,僅靠時序僥倖未撞上。
 *
 * **另一實害**:`api-optionsRange` 之「port 非法時須取預設 8080」因 8080 被 `api-executeWithU8a` 佔用,
 * 只能放寬為「建構不拋錯」而無法真正斷言取到預設值。集中配發後 8080 空出,該斷言得以恢復。
 *
 * 配發規則:
 *   - `8080` 套件預設值。**任何測試不得佔用** —— 保留給「port 非法時取預設」之斷言
 *   - `8199` 與 `port 1` 保留:供「連線失敗」測試指向,任何測試不得於此啟動伺服器
 *   - `8300` 起依 `alloc` 之順序連續配發,一檔一段
 *
 * 新增測試檔:於 `alloc` **表末**加一行並填需要幾個 port,不必自行找空號。
 * 重複、遺漏、以及測試檔內自行手寫 port 字面值,皆由 `test/unit-ports.test.mjs` 擋住。
 */

//base, 配發起點
let base = 8300

//reserved, 保留區: 不得配發, 亦不得於其上啟動伺服器
let reserved = {
    packageDefault: 8080, //套件之 port 預設值; 空出以供「port 非法時取預設」之斷言
    closed: 8199, //刻意無人監聽: 供 client 連線失敗之測試指向
    closedLow: 1, //同上, 另一個必然無人監聽者
    invalid: 70000, //超出 TCP 值域之非法值: 供「port 非法時須取預設」之測試輸入, 非可用之 port
}

//alloc, 配發表: [測試檔名(不含副檔名), 需要幾個 port, 用途]
//順序即配發順序; **新增一律加在表末**, 使既有配發不位移
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
    ['api-failureNotSuccess', 1, '原為 Math.random'],
    ['api-hostileErrorValues', 1, ''],
    ['api-hostileRequestJson', 1, ''],
    ['api-mainMaxBytes', 2, '主伺服器 + 預設值伺服器'],
    ['api-noListener', 3, '每次 mkServer 起一台, 共三台(原以 Math.random 每次取新號)'],
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
    ['api-executeWithU8a', 1, '原用 8080, 已讓出'],
    ['api-executeWithFile', 1, ''],
    ['api-uploadLargeFile', 1, ''],
    ['api-downloadLargeFile', 1, ''],
    ['e2e-execute', 1, 'e2e 不在 --parallel 範圍, 仍納管以免與 api 撞'],
    ['e2e-upload', 1, ''],
    ['e2e-download', 1, ''],
]

//segs, 依 alloc 之順序自 base 起連續配發
let segs = {}
let cur = base
for (let [name, count] of alloc) {
    segs[name] = { from: cur, count }
    cur += count
}

//portOf, 取某測試檔之第 i 個 port(i 自 0 起算)
//名稱打錯或索引越界一律拋錯, 不靜默回一個可用但錯誤之號碼
let portOf = (name, i = 0) => {
    let s = segs[name]
    if (!s) {
        throw new Error(`portOf: 測試檔[${name}]未登記於 test/tools/ports.mjs 之 alloc`)
    }
    if (!Number.isInteger(i) || i < 0 || i >= s.count) {
        throw new Error(`portOf: 測試檔[${name}]只配發 ${s.count} 個 port, 取不到第 ${i} 個(自 0 起算)`)
    }
    return s.from + i
}


let r = {
    base,
    reserved,
    alloc,
    segs,
    portOf,
}


export default r
