# 現況(state)

本檔記**當前已開發功能之最新狀態**(各功能做到哪裡、對應之規則帳本條目與測試檔、已知缺口與待辦、最近一次驗證或發布之版本);**只記現況、不寫過程**(過程寫入 `sgud/exp/experience.md`)。接續工作先讀本檔。

最近更新:2026-11-13(pm-cvh 輪:測試改經 w-playwright 啟動瀏覽器)。套件版本 2.1.28(`package.json`,本輪未改;未發布)。相依 wsemi `^1.9.59`、w-package-tools `^1.1.28`;**devDependencies 本輪:移除 `playwright`、新增 `w-playwright ^1.0.1`**(`dependencies` 不變;產品碼與 `dist/` 無改動)。

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

## 最近一次驗證(2026-11-13,pm-cvh 輪:測試改經 w-playwright 啟動瀏覽器)

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
