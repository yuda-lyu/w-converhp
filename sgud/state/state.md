# 現況(state)

本檔記**當前已開發功能之最新狀態**(各功能做到哪裡、對應之規則帳本條目與測試檔、已知缺口與待辦、最近一次驗證或發布之版本);**只記現況、不寫過程**(過程寫入 `sgud/exp/experience.md`)。接續工作先讀本檔。

最近更新:2026-11-24(tcv1 輪:排程第 605 項 w-converhp 部分,診斷輸出〔console〕改依跨套件規格〈診斷輸出與遮罩〉不印資料值,帳本 R33;取代 R16)。套件版本 2.1.42(`package.json`,本輪未改;未發布、未提交)。相依 **wsemi `^1.9.72`**(不變)、w-package-tools `^1.1.29`、devDependencies `w-playwright ^1.0.3`(不變)。**產品碼有改動**(`src/` 新增 `diagOpt.mjs`,改 `WConverhpClient`/`WConverhpServer`/`managerMergeSlices`/`checkTotalHash` 四檔;`checkTotalHash.wk.umd.js` 依 `script.txt` 之 `toolg/gDistRollupWorkerFuncs.mjs` 重建,另兩個 worker 產物逐位元組不變);`dist/`、`docs/` 未重建(發布時自動產製);前端 UMD 打包後 +177 位元組(170663 → 170840;`getDiag` 本已隨 wsemi 之 `evEmit` 入包)。

## 功能現況

| 功能 | 狀態 | 規則帳本 | 主要測試檔 |
|---|---|---|---|
| 伺服端(`WConverhpServer`):execute / upload(切片、合併佇列、去重、續傳) / download / handler / error 事件,verifyConn,曝露與存取控制選項,建構期失敗以 error 事件通知 | 完成 | R1–R29 | `api-*`(見 `test/`) |
| **伺服端就緒 `wsv.ready`**(Promise,恆 resolve:true 已監聽且建構期事件已派發、false 啟動/路由註冊失敗) | 完成(2026-10-29 新增,對外 API 擴充,未傳參數之既有行為不變) | R30 | `api-serverReady` |
| 前端(`WConverhpClient`):execute / upload / download,重試(retryMain/Upload/Download),中止(`opt.signal`) | 完成 | R27、R29 | `api-clientAbort`、`api-clientOutcomeShapes`… |
| **前端觀察回調 `opt.onTrace`**(重試退避 `retry-wait`/`retry`、合併輪詢 `poll-tick`/`poll-result`/`poll-stop`) | 完成(2026-10-29 新增;未傳時行為與效能不變;單一擁有者 `wsemi/src/getTrace.mjs`) | R30 | `api-clientTrace` |
| 測試以事件/可觀察條件同步(非等待毫秒) | 完成(本輪範圍:鉤子 45 檔 + 輔助 3 + 直接 C 20 案 + (d) 6 案);A 類否定窗與 B 輪詢上限刻意不動 | R30 | 見 R30 站點表 |
| **發布與建置腳本**(`toolg/`,依 dspec〈自有套件之發布與建置腳本〉) | 完成(2026-11-02 改回標準寫法):`addVersion`/`modifyReadme`/`cleanFolder` 一行呼叫 w-package-tools;`gDistRollupWorkerFuncs.mjs`(`rollupWorkerCore` 產 `src/{checkTotalHash,checkSlicesHash,mergeSlices}.wk.umd.js`)→ `gDistRollup.mjs`(`rollupFile` 產 `dist/w-converhp-{server,client}.umd.js`),列序見 `script.txt`(使用者所有)。套件無自創建置規則 | R14 | `unit-toolgBuild`(副本+指定 cwd 執行)、`unit-workerBundles` |
| **測試埠配發**(`test/tools/ports.mjs`、`test/tools/portsAlloc.mjs`) | 完成(2026-11-05 ch309,規格 `dspec/e2e埠與多套件同跑.md` E8):**不再有任何固定的監聽埠**,`alloc` 只登記每檔個數,`portOf` 首次取用時以同步子行程向作業系統要埠(`listen(0)`)並到跨行程認領登錄認領;`reserved.closed` 改為「向作業系統要一個後釋放、從不綁定」;「port 非法取預設 8080」一案改以攔截 `listen` 引數判斷、實際綁埠 0。產品碼未動 | R24 | `unit-ports`(12 案)、`api-optionsRange`、`api-executeError` |
| **測試啟動瀏覽器一律經 w-playwright**(`test/tools/e2e-setup.mjs` 之 `launchBrowser` → `wpw.launchChromium({ headless: true })`) | 完成(2026-11-13 pm-cvh,排程第 442 項遷移輪):啟動點全集 1 處,4 個 e2e 檔(共 43 案,每案一個 fresh browser)皆經它;無頭、不指定通道,即 Playwright 受管之 headless shell(不觸發 Chromium 之 LogonUser);`playwright` 自 `package.json` 移除。受管瀏覽器取得 `await wpw.ensureChromium()`(README〈Testing〉);`autoInstall` 刻意不開。產品碼未動 | R31 | `unit-pwWiring`(6 案,不啟動瀏覽器)、`e2e-abort`、`e2e-download`、`e2e-execute`、`e2e-upload` |
| **不可讀值之探針**(`src/probeReadable.mjs` 探針、`src/encodeStrict.mjs` 序列化唯一入口) | 完成(2026-11-19 cvh492i 輪,帳本 R32;**對外 API 無改動**,可讀之值行為不變,不可讀之值走原失敗通道):序列化三站點(伺服端 `encodeOut`、`managerMergeSlices` 之 `consume`、前端 `sendPkg`)經 `encodeStrict`〔深探〕;下載欄位(`validDownloadField`)、串流辨識(`hasPipe`、具體化階段)經淺探 | R32、R3(站點收斂) | `unit-probeReadable`(22 案)、`api-hostileValueProbe`(行為表,201 案)、`api-hostileErrorValues`(原 2 紅案) |
| **診斷輸出(console)不印資料值**(前後端皆經單一出口 `diag`〔wsemi `getDiag`〕;`src/diagOpt.mjs` 之 `pickDiagOpt` 為 `logDetail`/`funLog` 單一讀取點;worker 不寫 console,診斷以 `r.diag` 回傳) | 完成(2026-11-24 tcv1 輪,帳本 R33):預設只輸出固定詞彙與安全摘要(`{ errType, errCode }`、`{ msgShape }`、`chunkNo/chunkTotal`),不輸出回應物件、錯誤原文、堆疊、請求值、路徑;**新增公開選項 `opt.logDetail`、`opt.funLog`**(前後端建構子;未給則行為即為上述預設,不需使用端改碼;`funLog` 給函數時全部診斷改交它,`() => {}` 即關閉 console);重試提示與啟動訊息字樣不變;error 事件與回前端訊息不變 | R33(取代 R16)、R27(console 出口) | `api-consoleNoValues`(24 案)、`unit-consoleDiag`(10 案)、`e2e-consoleNoValues`(7 案,真 Chromium;2026-11-24 tcv1b 輪依 e2e 技能重寫,見下)、`unit-ruleSites` R33 |
| **差分探測工具**(`test/tools/probeDiff.mjs`) | 完成(2026-11-19):同一組「不可讀形狀 × 注入點」585 格,對「舊版 wsemi + 改動前 src」「新版 + 改動前 src」「新版 + 改動後 src」取結果比對;用法見檔頭與 `sgud/exp/experience.md` E54 | R32(如何找到站點) | 無(工具,非測試) |

## 最近一次驗證(2026-11-24,tcv1b 輪:`e2e-consoleNoValues` 依 e2e 技能補比對)

tcv1 新增 `e2e-consoleNoValues` 時未調用 `role-coder-for-test-e2e` 技能(責在我:全域設定 §11 之觸發條件「凡接觸 e2e 測試檔」明載,我把派工所列兩技能當作完整清單,新增 e2e 檔當下未重掃觸發條件);本輪補做並逐項比對,結果見 `agent-out/tcv1b-修正報告.md`。改動:
- **`test/e2e-consoleNoValues.test.mjs` 重寫**(3 → 7 案):①伺服器改經共用層 `startServer`(原自寫 http 伺服器兼供靜態檔,屬第二份近似實作),後端 API 為跨來源之假後端;②console 收集改以各引數之 `jsonValue()` 判定(`collectConsole`,共用層),不依 `msg.text()` 對物件之展開寫法;③補變體案:非有效物件、`logDetail`、error 監聽器拋錯(預設與 `funLog`)——共 7 案(CNV-001 缺 output、002 非有效物件、003 重試字樣、004 logDetail、005 funLog、006 監聽器拋錯之 wsemi 通報、007 監聽器拋錯且給 funLog);④每案註解載 6 步 user path 與對應之帳本條文。
- **共用層**:`test/tools/e2e-setup.mjs` 之 `startServer` 原以固定 `delay(1200)` 等就緒,改 `await wsv.ready`(帳本 R30;4 個既有 e2e 檔皆經它,全套綠),新增 `collectConsole`;新增 `test/tools/fakeApi.mjs`(假後端,`api-consoleNoValues` 與 e2e 共用,原 api 測試內之區域實作移除);`test/tools/ports.mjs` 登記 `e2e-consoleNoValues` 2 埠。
- **修前紅／修後綠**(修前為 HEAD 之 src + 現行測試與輔助之鏡像根):7 案 5 紅 2 綠(CNV-003 重試字樣、CNV-006 預設通報為對照);修後 7 綠(連跑 5 次)。e2e 專項變異 8／8 擊殺(`tmp/tcv1b/mutate-e2e.mjs`)。
- **順帶修正之測試脆弱處**:`api-consoleNoValues` 之 `P2 logDetail 伺服器` 原以 `util.inspect` 之文字判定,同一行程先跑 e2e(載入 Playwright 後 `Error.prepareStackTrace` 被改)時 inspect 只印 `[[Stack unavailable]]` 而不含訊息、案時紅時綠(`mocha --parallel` 之 worker 可能先後跑兩類檔),改為斷言引數之 `message` 欄位。
- `test/_tmp/ports-claims`(埠認領登錄,測試執行之殘留)已清除。README 版號字樣改為「since 2.1.43」。
- **全套**(`node C:/opensrcOper/tools/quiet-run.mjs --lock --name tcv1b-full -- npm test`,凍結碼,連跑 2 次):**816 passing／0 failing／0 pending**(tcv1 之 812 + e2e 3 → 7 案之 4)。eslint:變更之 13 檔 0 問題。

## 前次驗證(2026-11-24,tcv1 輪:診斷輸出〔console〕不印資料值)

- **現況實測**(修前;`tmp/tcv1/probe-current.mjs`,假 http 後端回固定封包):前端 `invalid msg.output { func: 'f', secret: …, token: … }` 與 `msg is not an effective object 424242` 把整個回應值寫入 console;`wait 1.0(second) to retry...`、`retry n=1...` 為固定詞彙;傳 `silent`/`quiet`/`verbose`/`debug`/`log`/`logDetail`/`funLog` 任何選項皆無法關閉。伺服端 `console.log(label, err)` 原樣傾印錯誤(訊息原文、堆疊、`node_modules` 與專案路徑)、`invalid queueId[CANARY-QUEUEID]`、`pathFile`、packageId、切片檔名。
- **站點盤點**:前端 `ctx.log` 4 呼叫(2 固定詞彙留、2 印回應值改形狀);伺服端 `WConverhpServer` 12、`managerMergeSlices` 5、worker `checkTotalHash` 4(原 console 5 行)全改經 `diag`;其餘 `src/*.mjs` 0 個 console 呼叫(`unit-ruleSites` R33 逐檔鎖)。
- **修前紅**(HEAD 之 src + 新測試,鏡像根 `tmp/tcv1/pre/`;日誌 `tmp/quiet-run/*tcv1-pre-*`):`api-consoleNoValues` 24 案 4 綠(對照)20 紅;`e2e-consoleNoValues`(真 Chromium)3 案 1 綠 2 紅,瀏覽器 console 實見 `invalid msg.output {func: f, note: CANARY-RESP-NOTE, token: CANARY-RESP-TOKEN}`;`unit-ruleSites` 2 紅(R27、R33);`unit-consoleDiag` 缺 `src/diagOpt.mjs` 載入失敗。
- **修後綠**:新測試 `api-consoleNoValues` 24、`unit-consoleDiag` 10、`e2e-consoleNoValues` 3、`unit-ruleSites` 全綠;連跑 api＋unit 10 次、e2e 5 次全綠。**全套**(`node C:/opensrcOper/tools/quiet-run.mjs --lock --name tcv1-full2 -- npm test`,凍結碼):**812 passing / 0 failing / 0 pending**(前次 774 + 新增 38:api 24、unit-consoleDiag 10、e2e 3、unit-ruleSites R33 1)。eslint:變更之 11 檔新增 error／warning 0。
- **變異**:37／37 擊殺(前端 8、伺服端 19、合併佇列 6、worker 4;各以「行為測試」與「站點鎖」各跑一次);首輪存活 3 項〔C3 `ctx.log` 之中止守門被迴圈檢查遮住、C8 選項為拋錯 getter、S18 worker 記錄之 `code` 傳遞〕皆為測試缺口(非等價),補 3 案後擊殺;僅站點鎖擊殺者 1 項(`responseU8aStreamWithError` 之不可達退路);每項以 sha256 回驗已還原。腳本與結果見報告證據(`tcv1-evidence/`)。
- **未做**:§9.3 之「全套連跑 5 次」與「發布包解開目錄之另一配置全套」(派工規定全套於凍結碼跑一次);`dist/`、`docs/` 未重建(發布時自動產製)。

## 前次驗證(2026-11-19,cvh492i 輪:wsemi 1.9.69 之判斷函數回布林,不可讀值之探針)

- **升版後基準(改動前,wsemi 1.9.69)**:全套 549 passing / **2 failing**(`api-hostileErrorValues` 之 execute 拒絕案與 upload 合併消費案,皆為拋錯之 `Symbol.toStringTag`:`output can not be serialized` 變為 `{}`)。
- **差分探測 585 格**:舊版(1.9.68)對新版(1.9.69),改動前 src 有 **169 格差異**;依「防線是否因此失效」歸類——須修 5 處(序列化三站點、下載欄位、串流辨識;共 49 格)、設計通道 107 格(選項與呼叫參數為不可讀值,舊版建構子/入口意外拋出,現取預設或入口拒絕〔R11、R26、dspec K3〕)、W-20 9 格、只壞 `has` 陷阱 4 格。修後剩餘差異 **120 格 = 107(設計通道)+ 9(W-20)+ 4(has 陷阱)**,其餘 49 格逐格與舊版相同(事件文字之取因前綴不計)。
- **修前紅**(改動前 src + wsemi 1.9.69 跑新測試):`api-hostileValueProbe` 58 紅(A1 4、A2 2、A3 12、A4 28、A5 12)、`api-hostileErrorValues` 2 紅。**修後綠**:全套(`node C:/opensrcOper/tools/quiet-run.mjs --lock --name cvh492i-full-final2 -- npm test`,凍結碼)**774 passing / 0 failing / 0 pending**(基準 551 + 新增 223:`unit-probeReadable` 22、`api-hostileValueProbe` 201)。
- **以 wsemi 1.9.68 跑現碼**(新測試):探針相關之 A1–A5 與 `unit-probeReadable` 全綠(探針於舊版下行為不變);W-20 11 案與「建構選項/呼叫參數為不可讀值」67 案紅——即這兩類測試鎖的是 1.9.69 起之語意。
- **變異**:16／16 擊殺(探針不先探、探針不深探、三個站點各自不探針、三個序列化站點各自繞過 `encodeStrict`、`hasPipe` 回 `false`、探針展開二進位、探針呼叫 accessor、探針加讀 `has`、探針不排除有 `toJSON` 者／Error／類別原型上之 `toJSON`、原因可為空字串),每項以 sha256 回驗已還原。
- **獨立複審**(sonnet 子代理,唯讀,只給契約與新舊碼):找到 3 項假陽性(有 `toJSON` 者、`Date`、`Error` 之子圖被探針展開而序列化器不會走到)——已修(探針不展開此三類)並補差分測試;1 項已知限制(accessor/`toJSON` 回傳之拋錯 `Symbol.toStringTag` 物件,L4);陣列索引 accessor 被多讀一次(已知偏差,見 R32 規則 5);站點盤點未找到遺漏。
- `private-guard`:CLEAN。包裝物件舊字面盤點(`Object('`、`new String(`、`new Number(`、`new Boolean(`、`包裝物件`):`src/`、`test/` 改動前皆 0 命中。
- **未驗**:e2e(4 檔 43 案)含於全套且全綠;`dist/` 未重建故未跑 dist 冒煙(產品碼之新模組只依賴 wsemi,瀏覽器端打包由 `toolg/gDistRollup.mjs` 自 `src` 取,發布時產製)。

## 前次驗證(2026-11-13,pm-cvh 輪:測試改經 w-playwright 啟動瀏覽器)

- **全套**(`node C:/opensrcOper/tools/quiet-run.mjs --lock --name pm-cvh-full2 -- npm test`,凍結碼,log 在 `tmp/quiet-run/`):**551 passing / 0 failing / 0 pending**(前次 545,差額為新增 `unit-pwWiring` 6 案);4 個 e2e 檔 43 案全過(`e2e-execute` 6、`e2e-download` 19、`e2e-upload` 4、`e2e-abort` 14)。
- **修前紅**:`unit-pwWiring` 於修前碼(舊寫法直接用 `playwright`)跑 4／6 紅,以空的 `PLAYWRIGHT_BROWSERS_PATH` 使舊寫法無法啟動任何瀏覽器;修後 6／6 綠。**變異**:8／8 擊殺,皆以雜湊回驗還原(見 R31)。
- **錯誤次數**(Windows 帳號之 `BadPasswordAttempts`):跑全套與接線測試前後皆 0(本套件 e2e 只起 headless shell,設計上不增)。
- `R-PW-ONLY` 盤點:`src`／`test`／`toolg`／根層 0 命中,`package.json` 0 宣告;啟動點全集 1 處。標準圖:本套件無 pixel baseline,0 張。`toolg/` 未改(`src` 不匯入 playwright／w-playwright,`gDistRollup.mjs` 之 external／globals 無須同步)。

## 前次驗證(2026-11-05,ch309 輪:測試埠改作業系統配發)

證據在 `C:\opensrcOper\dnow\20261105000800\agent-out\ch309-evidence\`。

- **全套**(`node C:/opensrcOper/tools/quiet-run.mjs --lock --name ch309-final-full2 -- npm test`,凍結碼):**545 passing / 0 failing**(前次 540,差額為 `unit-ports` 由 7 案改為 12 案)。
- **修前紅**(改碼前,自建真實占用者占滿原固定段 8300~8392 跑全套):占 `127.0.0.1` → 218 passing／307 failing,被測碼打到占用者 713 次;占 `0.0.0.0` → 234／306,打到 720 次,另 89 次新連線被測試自己綁 `127.0.0.1` 之伺服器搶走。
- **修後綠**(最末碼,占用者分別綁 `127.0.0.1`、`0.0.0.0`、`::`、`::1` 占滿 8300~8392):四組皆 **545 passing / 0 failing**;占用者 PID 不變、仍回應、被測碼打到 **0 次**;執行期間對各被占埠發新連線 19344／26040／27156／25389 次,全由占用者接、被搶 0。
- **兩套件同跑**(與 w-highcharts-vue 之 8301～8305,以 `OPSRC_TEST_RESOURCE` 指向移除 `portGroups` 8301 之副本模擬主控交件後移除互斥):重疊約 98 秒,兩者皆全綠(本套件 545、對方 156)。
- **變異**(對配發機制、認領登錄、`api-executeError`/`api-optionsRange` 之修正處與產品預設埠共 14 項):**14／14 擊殺**,每項以雜湊回驗已還原。
- **獨立審查**(sonnet 子代理,唯讀):無確定性缺陷;採納其 10 項建議(含跨行程認領登錄、主模組判斷、`NODE_OPTIONS`、`listen` 攔截之還原路徑、字面值掃描盲區、單元測試用獨立模組實例)。
- **不穩定紀錄**:改碼後共約 13 次全套中,有 1 次(認領登錄版之首次全套,恰在我以工具中止自己的背景鏈之後)`api-envelopeShape` 2 案紅(`[#34b]` toJSON 實得 0、`[#33]` 等不到 poll-result);其後 6 次全套全綠、該檔單跑 16 次全綠。與埠無關(該檔 1 個埠由作業系統配發),成因未查明,見 ch309 報告。

## 前次驗證(2026-11-02,chp267 輪:建置腳本改回標準寫法)

- **全套**(`npm test`,`--lock` 取鎖,quiet-run 名 `chp267-full`):**540 passing / 0 failing**(前次 529,差額為新增 `unit-toolgBuild` 11 案)。
- **建置實跑**(`script.txt` 列序:`cleanFolder` → `jsdoc` → `gDistRollupWorkerFuncs` → `gDistRollup`,不含 addVersion/modifyReadme/git/deploy):離開碼皆 0;`src/*.wk.umd.js` 內嵌 worker 本體(base64 段)與改前逐位元組相同,外層少一層 UMD 包裝(每檔 −246 位元組);`dist/w-converhp-client.umd.js` 位元組不變;`dist/w-converhp-server.umd.js` −279 位元組;`docs/` 僅產生時間戳記一行不同。
- **dist 冒煙**(重建後之 `dist/w-converhp-server.umd.js` 起伺服器,src 之 client 做 execute 與 1mb.7z 切片上傳):execute 回 7、上傳 1058915 位元組且 sha256 與原檔相同。
- **變異**(`unit-toolgBuild` 對 toolg 關鍵行 11 項):殺 10;存活 1(伺服端 `runin` 改 `browser`:產物僅 +528 位元組、UMD 依賴清單與匯出皆同,屬行為近似等價,不以位元組比對硬殺)。

## 更早一次驗證(2026-10-29,tm-converhp 輪)

- **全套**(`mocha --parallel "test/*.test.mjs" --timeout 180000`,含 4 個 e2e 檔):**529 passing / 0 failing**,97 秒(第一把獨佔鎖內,quiet-run 名 `tm-converhp-final1`)。
- **負載試驗**(獨占鎖;24 檔代表批次 136 案;8 壓力行程 / lag 400:1000 / lag 1500:3000 各 5 次;改造前取動工前快照):C 類案失敗改造前 1 次(abortDuringAdmit「/main」於 lag 下 1/5)→改造後 0;(d)、B、鉤子失敗前後皆 0。舊測試於三種負載下幾乎不紅(測試與被測伺服器同在一個事件迴圈,計時器與 I/O 同被延遲而互抵),故以延遲啟動對照與變異為主證。
- **延遲啟動對照實驗**(`server.start()` 前插 1500ms):8 個鉤子代表檔新版全綠(等 `ready`)、舊版全紅(固定等待 600～1200ms)。
- **變異**:一般變異 40 項有效(另 1 項對照組單獨執行即紅而無效),新版擊殺 32(第一輪);存活 8 項為變異強度不足(多層冗餘防護、`ready` 提前 resolve 但啟動快),補強重做結果見本輪報告;新測試優於舊測試 2 項(`M-CA-466`、`M-uploadInputTypes-1`)。
- 詳見 `sgud/rule/rulebook.md` R30 之「分辨力」與本輪報告。

## 已知缺口與待辦

- 無功能缺口。
- 待主控裁示(tcv1 輪):①公開選項 `opt.logDetail`、`opt.funLog`(前後端建構子)為 API 增項,建議保留(同 wsemi 家族之 `getDiag` 慣例,預設行為即不印資料值);②伺服端預設不再於 console 印錯誤堆疊與原文(細節仍由 error 事件取得),營運端若要還原須設 `logDetail: true` 或 `funLog`;③使用端若包裝本套件之建構選項,須自行把 `funLog` 透傳才能關閉本套件之 console 輸出(本套件不替使用端決定)。
- 全新機器(含 `.github/workflows/ci-test.yml` 之 `npm install` → `npm test`)沒有受管瀏覽器時,4 個 e2e 檔於 `launchBrowser` 以 `E_BROWSER_MISSING` 失敗;工作流程內無安裝步驟(遷移前後相同,遷移前為 Playwright 之 `Executable doesn't exist`)。要自動取得時,於 `launchBrowser` 給 `autoInstall: true`(會在測試中下載瀏覽器,屬行為變更,待使用者裁示;帳本 R31 規則 4)。
- 待主控(本套件外,不在本輪範圍):測試閘 `tools/test-resource.json` 之 `portGroups["8301"] = ["w-converhp", "w-highcharts-vue"]` 已無依據(本套件測試不再監聽 8300 段,任何固定埠皆無),可移除;本套件亦不需加入 `portGroups["8080"]`(`api-optionsRange` 不再綁 8080)。
- 測試埠配發之限制:`portOf` 取號到伺服器綁定之間有空窗,以跨行程認領登錄(`test/_tmp/ports-claims`)擋掉**本套件測試彼此**取得同號;與他套件之同號由作業系統保證不發出仍被綁定之埠,但釋放後之空窗內被他套件的 `listen(0)` 取走在理論上存在(獨立審查曾實測 8 行程併發配發有跨行程重複,本輪重跑 0/1920 未重現);被撞上時為明確 `EADDRINUSE`,不會靜默連到別人的服務。
- `api-envelopeShape` 曾有 1 次無法重現之 2 案紅(見上「不穩定紀錄」),成因未查明;再現時先查 `test/_tmp/uploadTemp-api-envelopeShape` 有無前一輪被中斷所留之殘留。
- 刻意不動(非本輪範圍,見 R30 站點表「刻意不動」):A 類否定觀察窗;B 輪詢上限(`waitFor`/`pollUntilSettled`/`waitFile`/`api-hostLifecycle` 子行程輪詢);`unit-abortScope` 兩案(B 牆鐘:`delay` 立即拒絕);`WConverhpServer` 之 `evEmitDelay`(依主控裁定 ⑥ 不加 onTrace)、`managerMergeSlices` 之 `setTimeout` 脫勾與 `abortScope.delayAbortable`(測試以檔案狀態/退避事件觀察,不需另加 onTrace)。
- `dist/` 為發佈時自動產製(`package.json` 之 main 指向 `dist/`;e2e 自 `src/` 即時打包,不依賴 `dist/`)。2026-11-02 chp267 輪依 `script.txt` 實跑建置:`src/*.wk.umd.js` 與 `dist/w-converhp-server.umd.js(.map)` 位元組已隨 `rollupWorkerCore` 改變(內嵌 worker 本體逐位元組不變),`dist/w-converhp-client.umd.js` 不變,`docs/` 僅 jsdoc 產生時間戳記一行(13 檔)不同。

## 重跑指引

- 建置(套件根執行,依 `script.txt` 列序):`node toolg/cleanFolder.mjs` → `./node_modules/.bin/jsdoc -c .jsdoc` → `node toolg/gDistRollupWorkerFuncs.mjs` → `node toolg/gDistRollup.mjs`。改了 `src/{checkTotalHash,checkSlicesHash,mergeSlices}.mjs` 必須重建(R14)。建置腳本之測試:`test/unit-toolgBuild.test.mjs`(副本+指定 cwd)。

- 全套:`node C:/opensrcOper/tools/quiet-run.mjs --lock --name <名> -- npm test`(`mocha --parallel "test/*.test.mjs" --timeout 180000`)。
- 負載試驗執行器:`test/tools/loadTrial.mjs`、`test/tools/loadPreload.mjs`(複製自 wsemi,不跨套件引用);用法見檔頭;獨占鎖 `quiet-run --lock-exclusive`。
