# 現況(state)

本檔記**當前已開發功能之最新狀態**(各功能做到哪裡、對應之規則帳本條目與測試檔、已知缺口與待辦、最近一次驗證或發布之版本);**只記現況、不寫過程**(過程寫入 `sgud/exp/experience.md`)。接續工作先讀本檔。

最近更新:2026-11-02(chp267 輪:建置腳本改回標準寫法)。套件版本 2.1.14(`package.json`,本輪未改;未發布)。相依 wsemi `^1.9.37`、w-package-tools `^1.1.21`。

## 功能現況

| 功能 | 狀態 | 規則帳本 | 主要測試檔 |
|---|---|---|---|
| 伺服端(`WConverhpServer`):execute / upload(切片、合併佇列、去重、續傳) / download / handler / error 事件,verifyConn,曝露與存取控制選項,建構期失敗以 error 事件通知 | 完成 | R1–R29 | `api-*`(見 `test/`) |
| **伺服端就緒 `wsv.ready`**(Promise,恆 resolve:true 已監聽且建構期事件已派發、false 啟動/路由註冊失敗) | 完成(2026-10-29 新增,對外 API 擴充,未傳參數之既有行為不變) | R30 | `api-serverReady` |
| 前端(`WConverhpClient`):execute / upload / download,重試(retryMain/Upload/Download),中止(`opt.signal`) | 完成 | R27、R29 | `api-clientAbort`、`api-clientOutcomeShapes`… |
| **前端觀察回調 `opt.onTrace`**(重試退避 `retry-wait`/`retry`、合併輪詢 `poll-tick`/`poll-result`/`poll-stop`) | 完成(2026-10-29 新增;未傳時行為與效能不變;單一擁有者 `wsemi/src/getTrace.mjs`) | R30 | `api-clientTrace` |
| 測試以事件/可觀察條件同步(非等待毫秒) | 完成(本輪範圍:鉤子 45 檔 + 輔助 3 + 直接 C 20 案 + (d) 6 案);A 類否定窗與 B 輪詢上限刻意不動 | R30 | 見 R30 站點表 |
| **發布與建置腳本**(`toolg/`,依 dspec〈自有套件之發布與建置腳本〉) | 完成(2026-11-02 改回標準寫法):`addVersion`/`modifyReadme`/`cleanFolder` 一行呼叫 w-package-tools;`gDistRollupWorkerFuncs.mjs`(`rollupWorkerCore` 產 `src/{checkTotalHash,checkSlicesHash,mergeSlices}.wk.umd.js`)→ `gDistRollup.mjs`(`rollupFile` 產 `dist/w-converhp-{server,client}.umd.js`),列序見 `script.txt`(使用者所有)。套件無自創建置規則 | R14 | `unit-toolgBuild`(副本+指定 cwd 執行)、`unit-workerBundles` |

## 最近一次驗證(2026-11-02,chp267 輪:建置腳本改回標準寫法)

- **全套**(`npm test`,`--lock` 取鎖,quiet-run 名 `chp267-full`):**540 passing / 0 failing**(前次 529,差額為新增 `unit-toolgBuild` 11 案)。
- **建置實跑**(`script.txt` 列序:`cleanFolder` → `jsdoc` → `gDistRollupWorkerFuncs` → `gDistRollup`,不含 addVersion/modifyReadme/git/deploy):離開碼皆 0;`src/*.wk.umd.js` 內嵌 worker 本體(base64 段)與改前逐位元組相同,外層少一層 UMD 包裝(每檔 −246 位元組);`dist/w-converhp-client.umd.js` 位元組不變;`dist/w-converhp-server.umd.js` −279 位元組;`docs/` 僅產生時間戳記一行不同。
- **dist 冒煙**(重建後之 `dist/w-converhp-server.umd.js` 起伺服器,src 之 client 做 execute 與 1mb.7z 切片上傳):execute 回 7、上傳 1058915 位元組且 sha256 與原檔相同。
- **變異**(`unit-toolgBuild` 對 toolg 關鍵行 11 項):殺 10;存活 1(伺服端 `runin` 改 `browser`:產物僅 +528 位元組、UMD 依賴清單與匯出皆同,屬行為近似等價,不以位元組比對硬殺)。

## 前次驗證(2026-10-29,tm-converhp 輪)

- **全套**(`mocha --parallel "test/*.test.mjs" --timeout 180000`,含 4 個 e2e 檔):**529 passing / 0 failing**,97 秒(第一把獨佔鎖內,quiet-run 名 `tm-converhp-final1`)。
- **負載試驗**(獨占鎖;24 檔代表批次 136 案;8 壓力行程 / lag 400:1000 / lag 1500:3000 各 5 次;改造前取動工前快照):C 類案失敗改造前 1 次(abortDuringAdmit「/main」於 lag 下 1/5)→改造後 0;(d)、B、鉤子失敗前後皆 0。舊測試於三種負載下幾乎不紅(測試與被測伺服器同在一個事件迴圈,計時器與 I/O 同被延遲而互抵),故以延遲啟動對照與變異為主證。
- **延遲啟動對照實驗**(`server.start()` 前插 1500ms):8 個鉤子代表檔新版全綠(等 `ready`)、舊版全紅(固定等待 600～1200ms)。
- **變異**:一般變異 40 項有效(另 1 項對照組單獨執行即紅而無效),新版擊殺 32(第一輪);存活 8 項為變異強度不足(多層冗餘防護、`ready` 提前 resolve 但啟動快),補強重做結果見本輪報告;新測試優於舊測試 2 項(`M-CA-466`、`M-uploadInputTypes-1`)。
- 詳見 `sgud/rule/rulebook.md` R30 之「分辨力」與本輪報告。

## 已知缺口與待辦

- 無功能缺口。
- 刻意不動(非本輪範圍,見 R30 站點表「刻意不動」):A 類否定觀察窗;B 輪詢上限(`waitFor`/`pollUntilSettled`/`waitFile`/`api-hostLifecycle` 子行程輪詢);`unit-abortScope` 兩案(B 牆鐘:`delay` 立即拒絕);`WConverhpServer` 之 `evEmitDelay`(依主控裁定 ⑥ 不加 onTrace)、`managerMergeSlices` 之 `setTimeout` 脫勾與 `abortScope.delayAbortable`(測試以檔案狀態/退避事件觀察,不需另加 onTrace)。
- `dist/` 為發佈時自動產製(`package.json` 之 main 指向 `dist/`;e2e 自 `src/` 即時打包,不依賴 `dist/`)。2026-11-02 chp267 輪依 `script.txt` 實跑建置:`src/*.wk.umd.js` 與 `dist/w-converhp-server.umd.js(.map)` 位元組已隨 `rollupWorkerCore` 改變(內嵌 worker 本體逐位元組不變),`dist/w-converhp-client.umd.js` 不變,`docs/` 僅 jsdoc 產生時間戳記一行(13 檔)不同。

## 重跑指引

- 建置(套件根執行,依 `script.txt` 列序):`node toolg/cleanFolder.mjs` → `./node_modules/.bin/jsdoc -c .jsdoc` → `node toolg/gDistRollupWorkerFuncs.mjs` → `node toolg/gDistRollup.mjs`。改了 `src/{checkTotalHash,checkSlicesHash,mergeSlices}.mjs` 必須重建(R14)。建置腳本之測試:`test/unit-toolgBuild.test.mjs`(副本+指定 cwd)。

- 全套:`node C:/opensrcOper/tools/quiet-run.mjs --lock --name <名> -- npm test`(`mocha --parallel "test/*.test.mjs" --timeout 180000`)。
- 負載試驗執行器:`test/tools/loadTrial.mjs`、`test/tools/loadPreload.mjs`(複製自 wsemi,不跨套件引用);用法見檔頭;獨占鎖 `quiet-run --lock-exclusive`。
