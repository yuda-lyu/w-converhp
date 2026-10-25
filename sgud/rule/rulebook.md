# 規則帳本

本檔為特有之規則帳本,為要求程式碼須長成什麼樣,包含軸、單一擁有者、已知限制、破壞性變更紀錄,由agent自行編列、擴充與維護.

> **這一節存在的理由**:五輪審計裡,#26/#34/#35 是同一條規則的三個站點,卻被編成三個缺陷編號、分兩輪「發現」;#29/#30/#32 則是修正範圍取自被點名的站點而非規則所屬的類別。
> 缺陷帳本以**站點**為單位,規則不進帳本 —— 於是下一次仍然只修被點名的那一處。本節以**規則**為單位,每條附**可重跑的盤點指令**與**站點全集**。
>
> **用法**:①修改涉及某條規則時,先跑該條的盤點指令,對照本表確認站點數一致(不一致代表有新站點未登記);②修完後再跑一次,把新站點標記完成;③新增站點時同步更新本表。
> **判準**:`已套` / `未套`(缺口,附缺陷編號)/ `刻意不套`(必附理由,理由須可被挑戰)。
>
> **編號為識別碼而非序號**:`R4b`/`R4c` 之子編號表示「與 R4 同一規則家族之延伸」,不補齊為連續。編號一經指派即不再變動 —— 它們被 `src/`、`test/` 之註解與歷輪報告引用共約 90 處,重編會失去跨輪之可追溯性。新規則一律取下一個未用之整數。

## 目錄

| 編號 | 規則 | 盤點方式 | 站點 | 缺口 |
|---|---|---|---|---|
| [R1](#r1-應用端可控值之屬性讀取一律在-try-內) | 應用端可控值之屬性讀取一律在 try 內 | grep | 7 類 | 0 |
| [R2](#r2-寫入回應標頭之值一律經值域檢核) | 寫入回應標頭之值一律經值域檢核 | grep | 14 | 0 |
| [R3](#r3-codec-呼叫一律以嚴格模式取狀態) | codec 呼叫一律以嚴格模式取狀態 | grep | 9 | 0(1 待 wsemi) |
| [R4](#r4-數值選項一律經述詞--sink-上限) | 數值選項一律經述詞 + sink 上限 | grep | **21** | 0 |
| [R4b](#r4b-檢核與正規化須成對isp0intispint--cint) | 檢核與正規化須成對(`isp0int`/`ispint` → `cint`) | grep | 10 | 0 |
| [R4c](#r4c-重試次數與退避延遲須各自有上限) | 重試次數與退避延遲須各自有上限 | 常數 + 單元測試 | 2 | 0 |
| [R5](#r5-同一次失敗恰發一則-error-事件) | 同一次失敗恰發一則 error 事件 | 擁有者鎖 + 行為表 | **擁有者 8;總量 server 26 / client 11**(run02 +1:雜湊計算失敗之入口事件) | 0 |
| [R6](#r6-應用端形狀錯誤一律回套件錯誤封包) | 應用端形狀錯誤一律回套件錯誤封包 | **行為(測試)** | 13 情境(含 `/dwgf` 狀態碼之例外、本體無法解析 × 四路由;run02 +2:拒絕值之惡意值、下載成功之肯定式判定) | 0 |
| [R7](#r7-宣告長度須等於實送位元組) | 宣告長度須等於實送位元組 | **行為(測試)** | 2 | 0 |
| [R8](#r8-以軸列舉之測試-其成員清單須取自-fixture) | 以軸列舉之測試,成員清單須取自 fixture | grep + 覆蓋測試 | 6 檔 + 形狀軸(run02) | 0 |
| [R9](#r9-選用之回呼參數一律於呼叫前補預設) | 選用之回呼參數一律於呼叫前補預設 | grep | 3 | 0 |
| [R10](#r10-取因表達式一律經-geterrormessage且保護函數內非做不可之事排最前) | 取因表達式一律經 `getErrorMessage` | grep | **29** | 0 |
| [R11](#r11-事件一律於呼叫端堆疊上派發監聽器須為同步) | 事件一律於呼叫端堆疊上派發;監聽器須為同步 | grep + 探針 | 4 + 6 | 0 |
| [R12](#r12-應用端呼叫須有接聽者一次請求之終結不得取決於應用端是否回話) | 應用端呼叫須有接聽者;上傳管線受理新工作前亦然 | 位置鎖 + 行為表 | **12**(派發 6 + 上傳閘門 4 + 中斷補判 2) | 0 |
| [R13](#r13-應用端交出之回呼一律於套件之保護內呼叫) | 應用端交出之回呼一律於套件之保護內呼叫 | grep | 7 | 0 |
| [R14](#r14-盤點與修正須涵蓋實際執行之產物不得只掃-srcmjs) | 盤點與修正須涵蓋實際執行之產物 | grep + 差分測試 | 3 產物 | 0(第十輪建機械化保護) |
| [R15](#r15-切割結構化字串前須先確認它真的是那個結構) | 切割結構化字串前須先確認它真的是那個結構 | grep | 4(切割 1 擁有者 + 合成 1 + 既有 2) | 0(測試覆蓋另有缺口) |
| [R16](#r16-手上有事件契約載不下的原始值時才-consolog) | 手上有「事件契約載不下的原始值」時才 console.log | grep | 10 | 0(數處已流失,列觀察) |
| [R17](#r17-回前端之錯誤訊息不得含伺服器路徑與底層細節細節只進-error-事件) | 回前端之錯誤訊息不得含伺服器路徑與底層細節;細節只進 error 事件 | grep | 3 + 4 | 0 |
| [R18](#r18-完成標記須證明其所指之內容新一代開始前舊標記須失效) | 完成標記須證明其所指之內容;新一代開始前舊標記須失效 | grep + 行為 | 4(含 `/slc` 之 done) | 0 |
| [R19](#r19-不可信之外來值交出時須標明其可信度誰要拿它做危險操作誰處理只轉交者不得改寫) | 不可信之外來值交出時須標明其可信度;誰要拿它做危險操作誰處理,只轉交者不得改寫 | grep | 3 | 0 |
| [R20](#r20-模組須有獨立成檔之理由只被一處引用且無理由者併回其唯一呼叫者) | 模組須有獨立成檔之理由;只被一處引用且無理由者併回其唯一呼叫者 | grep | 13 檔 | 0 |
| [R23](#r23-匯出面須最小化未被模組外使用者不得匯出且每個匯出成員須說明其用途) | **匯出面須最小化**;未被模組外使用者不得匯出,且各成員須說明用途 | grep | 5 模組 19 成員 | 0 |
| [R21](#r21-各-mjs-一律以單一-export-default-匯出要給多個成員就合併為一個物件) | 各 `.mjs` 一律以單一 `export default` 匯出(前提:先過 R23) | grep | 23 | 0 |
| [R22](#r22-檔名須反映其全部匯出成員匯出多個成員者取集合概念不得取其中任一成員名) | 檔名須反映其全部匯出成員(前提:先過 R23 與 R21) | grep | 23 | 0 |
| [R24](#r24-測試用-port-一律自集中配發表取得不得手寫不得隨機不得衍生) | **測試用 port 一律自集中配發表取得**;不得手寫、隨機或衍生 | `unit-ports` | 58 檔 89 port | 0 |
| [R25](#r25-test-根目錄只放測試檔非測試之共用-mjs-一律置於-testtools) | `test/` 根目錄只放測試檔;非測試之共用 mjs 置於 `test/tools/` | `ls` + `unit-ports` | 70 + 3 | 0 |
| [R26](#r26-曝露與存取控制選項有給而無效時須收緊並告知未給者依預設) | **曝露與存取控制選項有給而無效時須收緊並告知**;未給者依預設 | grep + 行為表 | 4 選項 6 告知點 | 0 |
| [R27](#r27-一次公開呼叫對外之全部輸出經其-ctx-之出口公開-promise-與中止競速) | **一次公開呼叫對外之全部輸出經其 ctx 之出口;公開 promise 與中止競速**(前端中止) | 位置鎖 + 行為表 | 出口 5 類 / 入口 3 方法 / error 站點 11 | 0 |
| [R28](#r28-測試建構伺服器一律給-pathuploadtemp落-test_tmp案名測完即刪不得取預設值而於-repo-根建立-uploadtemp) | **測試建構伺服器一律給 pathUploadTemp**(落 test/_tmp/<案名>/,測完即刪) | 位置鎖(unit-ruleSites) | 74 站點 | 0 |
| [R29](#r29-一次嘗試之結局不得以外來值之形狀判定不需重試以自建包裝之參照識別成功須以肯定式證明) | **一次嘗試之結局不得以外來值之形狀判定**;不需重試以自建包裝之參照識別;成功須以肯定式證明 | 位置鎖 + 行為表 | 判定站點 6 | 0 |

> **第十二輪之總結(2026-10-13)**:起因為 w-serv-hapi 之 agent 提出之外部建議四項(上傳管線不判接聽者即落檔、verifyConn 非函數即全放行、serverHapi 模式之 stop、corsOrigins 文件)。四項事實全屬實,但三項修法各撞既有設計(建構期失敗不拋出之通道、R12 之單一擁有者、merge-slices-get S3 之冪等、hapi 無移除路由 API)。方案經三份獨立複審(Claude Opus 5.5 ×2、Codex GPT-6.1-Sol ×1,各自於 HEAD 之 worktree 實跑)擴充為七個變更單元:**R12 延伸至上傳管線**(閘門 4 站點 + admit 期間中斷之補判 2 站點,後者為複審發現之既有缺陷:handler 永不終結、/slc 漏 fd)、合併佇列在途消費之跨實例隔離(複審發現)、**新立 R26**(verifyConn、corsOrigins、useInert、pathStaticFiles)、文件。外部建議之 #3 只補文件,改行為列下輪提案。逐條核對見當輪之 `tmp/r12-複審彙整.md`,定案方案見 `tmp/r12-全盤.md` §9。
> 帳本自身之錯誤 2 件:R25 之執行指令 `--timeout 60000` 過期(package.json 為 180000)、`unit-ruleSites` 之「帳本須涵蓋全部規則」清單只列到 R18(R19–R25 缺頁不會紅);皆已更正。另 `tmp/measure_sites.mjs` 仍讀第十一輪併檔前之 `buildDownloadSource.mjs` 而無法執行,本輪以 `tmp/r12/sites.mjs`(同 `readCode` 剝註解規則、保留行號)產生逐站點清單。

**缺口合計 0 格。** 第九輪所發現之 **23 格**已全數修正(2026-09-10 至 09-11);第十輪所發現之缺陷 **7 個(D1–D7)** 經兩份外部複審擴充為 **13 個修正單元(F1–F13)**,已全數修正(2026-09-11);第十一輪(Fable 5.1 重審)發現 **12 格(N1–N12)**,經兩份外部複審補 **5 格(A1–A3、B9、B2)** 並推翻 2 個修法(N4 就地淨化、G6 之單一下載解析器),已全數修正(2026-09-12);測試 **354 passing / 0 failing**,e2e 26 passing。

> **第十一輪之總結**:12 格中 **4 格是既有規則的第二站點沒套**(N2 = R13 站點 4 之括號內自承之第二呼叫點;N4/N8/N11 各為同一規則之另一方向或另一函數),與前兩輪同一形狀,第五次記錄。
> 本輪最嚴重之缺陷(N1:`/slc` 於資料交給 OS 之前即回 done,慢磁碟下合併讀到短切片)不屬任何既有規則 —— 併入 R18。
> 結構面:六路由之前置 / 錯誤回覆 / 下載欄位處置原為 40 處同型片段,第十輪 13 個修正單元有 6 個各改 3–6 處;本輪收斂為 `src/routeSpec.mjs` 一張表 + `ctxOf`/`admit`/`replyOf`/`readOutput`/`replyPacket`,並以**行為表**(`api-errorEventOnce`:失敗種類 × 六路由)取代 `evEmit('error'` 之總量鎖 —— 總量鎖偵測不到「某條路由漏了處置」,而分辨力實驗證明行為表抓得到(把 `/dwgf` 之 authorization 來源改錯,325 條舊測試全綠而行為表紅)。
> 兩份複審對 N1–N12 之「現況」12 格全部確認屬實、無誤報;帳本自身之錯誤 4 件(R5 client 指令有假陽性、R12 站點表過期、R13 站點 4 之「已套」涵蓋不到第二呼叫點、R10 指令以變數名為錨而漏 `res`),皆已更正。

**本輪另有五種「請求永不終結」之形狀,其中一種(N1 無人接聽)歸為套件責任並已修,其餘四種裁定為呼叫端責任** —— 判準與已否決之修法見 [R12 之分界線](#本條之分界線2026-09-10-裁定適用於全部請求永不終結之形狀)。

**盤點方式為「行為(測試)」者**(R6、R7)無 grep 指令,係因該規則約束的是**回應之形狀**而非程式碼之寫法,只能以測試盤點 —— 此為刻意,不是缺漏。

盤點日期:2026-09-12(第十一輪修正後重跑;R19 為第十一輪新立,R5 改為擁有者鎖 + 行為表)

> **第十輪之總結**:兩份外部複審合計指出之「規則對了、站點清單少了」為 **5 條**(R1:擷取值之型別判定;R3:`str2b64`/`b642str` 亦為雙模 codec;R5:只盤 server 而缺口在 client;R6:協定鍵之內之 function/Symbol;R10:請求端 JSON 值)—— 與第九輪同一形狀,第四次記錄。
> 另有三件**帳本自身之錯誤**:R10 之「JSON 產物不可能拋錯」為假(自有屬性 `toString` 為非函數值即拋)、R14 之盤點指令判定字串過期(恆印 false)、R3 之盤點指令註解過濾失效(恆多計 3)。
> 本輪最嚴重之缺陷(D1:以 success 交出寫一半之合併檔)不屬任何既有規則 —— 已立 R18。

> **第九輪之總結**:本輪找到 9 個活缺口,其中 **6 個是既有規則的另一個站點**(R4b、R9、R10 各二,R6 一)。
> 亦即「規則對了,站點清單少了」仍是本套件缺陷的主要形狀 —— 這是本帳本第三次記錄同一件事(前兩次見 R3、R4b 之歷史)。
> 本輪另立三條新規則(R12 事件須有接聽者、R13 應用端回呼須於保護內呼叫、R14 盤點須涵蓋實際執行之產物),
> 其中 **R14 指出本帳本自身的盲區**:所有盤點指令皆掃 `src/*.mjs`,而伺服器實際 import 的是 `src/*.wk.umd.js`。

---

### R1 應用端可控值之屬性讀取一律在 try 內

**規則**:凡讀取應用端交出之物件的屬性(欄位擷取、型別辨識、狀態查詢、具體化),該讀取本身須在 try 內;失敗收斂為套件錯誤封包 + 一則帶真因之 error 事件,不得逸出成裸 HTTP 500。

**why**:應用端可用 getter 或 Proxy 包裝其值(觀測、記錄之常見手法),任何屬性讀取都可能拋錯。`instanceof` 會觸發 `getPrototypeOf` trap,typed-array 之 `.length` 對 Proxy receiver 會拋 `Method get TypedArray.prototype.length called on incompatible receiver`。

**盤點指令**(`node tmp/measure_sites.mjs` 為同一組正規式之完整版)
```bash
# 第十一輪起 attempt / buildDownloadSource / readDownloadFields / validDownloadField / destroyStreamRead 皆依 R20 併入 server,
# 故盤點改掃 server 並以「函式區段」判定歸屬; 權威判定在 test/unit-ruleSites.test.mjs 之 sect()(其 readCode 另剝除 JSDoc, 避免註解內之範例被計入)
grep -n "get(r, '" src/WConverhpServer.mjs                      # 扣除 encodeOut 區段後須為 0:路由層不得直接讀應用端欄位
grep -c "attempt(" src/WConverhpServer.mjs                      # 須為 6:定義 1 + buildDownloadSource 3 + readDownloadFields 1 + validDownloadField 1
grep -n "streamRead instanceof\|streamRead\.readableObjectMode\|streamRead\.destroyed\|streamRead\.readableEnded\|Buffer\.isBuffer(streamRead)\|buf\.length\|stream\.pipeline(streamRead" src/WConverhpServer.mjs   # 9 處, 且須全部落在 buildDownloadSource 區段內
```
**狀態:#32 已修(2026-09-09),本條之缺口為 0**

修法為引入 `attempt(stage, fn)` 原語並把所有觸碰收斂到兩處。**第十一輪起 `attempt`、`buildDownloadSource`、`readDownloadFields`、`validDownloadField`、`destroyStreamRead` 皆依 R20 併入 `WConverhpServer.mjs`**(只被一檔使用且無獨立單元測試),下表之「位置」由檔名改為 server 內之函式;`unit-ruleSites` 以 `sect()` 取函式區段為錨,斷言未放寬:

| 觸碰類別 | 位置 | 收斂方式 | 狀態 |
|---|---|---|---|
| 欄位擷取(三路由共 10 處) | server 之 `readDownloadFields` | 逐欄一個 `attempt`;各路由只讀自己需要的欄位(`/dwgfn` 僅 streamRead+filename,不讀 fileSize/fileType 以維持既有行為) | **已套** |
| 辨識(`instanceof`,觸發 Proxy 之 `getPrototypeOf` trap) | `buildDownloadSource.mjs` 之 `identify streamRead` | `attempt` | **已套** |
| 狀態讀取(`readableObjectMode`/`destroyed`/`readableEnded`) | 同上一段 | 同上 | **已套** |
| pipeline 建立(內部讀 `.pipe` 等方法) | `buildDownloadSource.mjs` 之 `setup pipeline` | `attempt` | **已套** |
| 具體化(`Buffer.isBuffer`、`instanceof Uint8Array`、`buf.length`) | `buildDownloadSource.mjs` 之 `materialize streamRead` | `attempt` | **已套** |
| 清理(`v.pipe`/`v.destroy`) | server 之 `destroyStreamRead` 與 `hasPipe`(第十一輪起皆併入 server) | 各自之 try | **已套**(第四輪 #31) |
| **擷取失敗時已讀到之資源之清理** | server 之 `readDownloadFields` 回傳 `fields`,三條下載路由於 `!rf.ok` 時 `destroyStreamRead(get(rf.fields, 'streamRead'))` | — | **已套**(第九輪) |
| **擷取值之型別判定**(`isestr`、`isValidFileSize` 皆經 `Object.prototype.toString.call`,會觸發值之 `Symbol.toStringTag` getter) | server 之 `validDownloadField` | 三欄(filename/fileSize/fileType)之判定與正規化整段於 `attempt` 內;三條下載路由皆經之且沿用既有檢核順序 | **已套(第十輪 A5)**:原為 7 格裸 HTTP 500 + 0 則事件,`/dw` 之串流且未銷毀 |

**第九輪新增之站點(擷取失敗時之清理)**:`streamRead` 一律排在 `keys` 之首,故凡**後續**欄位之 getter 拋錯者,該串流**已經在套件手上**。原本 `readDownloadFields` 只回 `{ ok:false, field, cause }` 而不回已讀到之欄位,路由層無從清理 —— 應用端交出之串流(常為 `fs.createReadStream`)就此失去引用且 fd 持續開啟。實測(`tmp/probe_r9_rest.mjs` 第 1 節):四欄之中**後三欄拋錯時串流皆為 `destroyed=false`**。

三條下載路由原有之註解「讀取失敗時尚未取得串流引用, 無從清理(屬呼叫端責任)」**僅對「首欄即拋錯」成立**,對後續欄位不實 —— 該註解正是 §2.1 第 5 條所說「講不出為什麼擋這個不擋那個,卻被寫成註解替它背書」的形狀,已一併更正。

**機械化保護**:`test/api-failureNotSuccess.test.mjs` 之兩條(三條下載路由 × 三個後續欄位,成員取自路由軸遵 R8)。分辨力已驗:停用該清理後 **1 failing**;對照組驗證正常交付後亦不得殘留未銷毀之串流。

**盤點期望值**:server 內 `get(r, '` 為 **0**;`buildDownloadSource.mjs` 內來源觸碰 **9** 處、`attempt` **3** 段;`readDownloadFields.mjs` 內 `attempt` **1** 段。

**取因不可再拋錯**:`attempt` 之 catch 以 wsemi 之 `getErrorMessage` 取原因。該處若用 `get(err,'message', String(err))` 會因預設值即時求值而在 `err.toString()` 拋錯時**於 catch 內再拋**,使外層 try 形同虛設。
wsemi 1.8.90 起 `getErrorMessage` 改為候選階梯(不做型別分派、每階獨立 try、整體再包一層 try),契約為**於任何輸入下皆不拋錯且回傳必為字串**;`tmp/probe_geterrmsg_190.mjs` 以 25 種惡意輸入實測(循環物件、含 BigInt、`message`/`toString`/`toJSON`/`cause`/`Symbol.toStringTag` 為拋錯 getter、Proxy 之 get/has/getPrototypeOf 陷阱全拋、已撤銷之 Proxy、無原型物件、TypedArray 之 Proxy、深巢狀 30 層):**0 拋錯、0 非字串**。
故本套件原本的 `src/causeOf.mjs`(以 try 包住 `getErrorMessage` 並以 `String` 為退路)已刪除。其唯一殘餘職責是「取不到內容時給非空字串」—— `getErrorMessage` 對 `new Error()`、已撤銷之 Proxy、`null`/`undefined`/`NaN` 等回空字串(25 例中 9 例),故 `attempt` 於呼叫處補一行 `isestr(cause) ? cause : 'unknown error'`;`buildDownloadSource` 之序列化失敗處則因下游本就以 `isestr` 分流而直接用其回傳值。

**機械化保護**:`test/unit-ruleSites.test.mjs` 鎖住上述期望值,`test/api-sourceTraps.test.mjs` 以六種形狀驗證收斂結果(分辨力:修正前 5 failing)。

> **本條之歷史**:第四輪修 #31 只套了清理那兩處(被投訴點名者);第五輪自審發現欄位擷取與兩個狀態屬性,編為 #32;第五輪外部複審再指出辨識、pipeline、具體化三階段仍在。**同一條規則被分三次發現** —— 這正是本帳本存在的理由。第六輪一次套完全部站點。

---

### R2 寫入回應標頭之值一律經值域檢核

**規則**:凡寫入 HTTP 回應標頭之值,若來源非套件內固定常數,須先通過 `isValidHeaderValue`(node `http.validateHeaderValue`)或等效之編碼(RFC 5987 / base64);未通過者收斂為錯誤封包,不得交給 node 拋錯而回裸 500。

**盤點指令**
```bash
grep -n "\.header('\|\.type(" src/WConverhpServer.mjs   # 須為 14; 第十一輪起 responsePacket 併入 server(R20), 其 6 處亦計入本檔
```
**站點數:14(已套 6 / 刻意不套 8 / 未套 0)** —— 2026-09-10 修 #25 後重掃;第十一輪 `responseU8aStreamWithError` 併入 `responseU8aStream` 同檔,站點數不變

| # | 站點 | 值之來源 | 狀態 |
|---|---|---|---|
| 1–3 | `responsePacket.mjs` 之 Cache-Control、Content-Type、Content-Length | 套件常數與套件計算 | 刻意不套;Content-Length 另受 R7 約束 |
| 4 | `responsePacket.mjs` 之 Return-Type | 套件常數 `'success'`/`'error'` | 刻意不套(常數) |
| 5 | **`responsePacket.mjs` 之 Return-Msg** | **可含請求端可控字串**(`invalid mode[${mode}]`) | **已套**(#25):以 `isValidHeaderValue` 檢核,不合法者**略過該標頭**而非使回應失敗 —— 完整訊息仍在本體之 error 封包內 |
| 6 | `responsePacket.mjs` 之 `responseU8aStreamWithError` 之 Return-Retryable | 套件常數 `'false'` | 刻意不套(常數) |
| 7、11 | `/dwgf`、`/dw` 之 `.type(fileType)` | 應用端 | **已套**(各自先以 `isValidHeaderValue` 驗) |
| 8、12 | 兩路由之 Content-Encoding | 套件常數 `'identity'` | 刻意不套(常數) |
| 9、14 | 兩路由之 Content-Length | 應用端 `fileSize` | **已套**(先以 `isValidFileSize` 驗並以 `cint` 正規化) |
| 10 | `/dwgf` 之 Content-Disposition | `encodeRfc5987` 產物(僅 attr-char 與 %XX) | **已套**(編碼保證) |
| 13 | `/dw` 之 Content-Disposition | `str2b64` 產物(ASCII) | **已套**(編碼保證) |

> **本條之歷史**:第三輪修 #19‴(fileType 含 CR/LF → 裸 500)時建立本規則並套到站點 7、11;站點 5 為**同型**缺口(請求端可控字串 → 標頭 → node 拒絕 → 裸 500 + 0 則事件),自第四輪列為「待討論」歷經兩輪未修,即 #25。第六輪把回應出口抽成模組後於該處一次修掉 —— **同一條規則的最後一個站點,在規則有了單一擁有者之後才被關上。**

---

### R3 codec 呼叫一律以嚴格模式取狀態

**規則**:凡呼叫 `obj2u8arr` / `u8arr2obj`,一律帶 `{ returnWithStateAndMsg: true }` 並判斷 `state`;不得把「底層沒拋錯」當成功。內容確定為套件自產字串者可列為刻意不套,但須逐一列出理由。

> **⚠ 盤點之陷阱(第十一輪實測)**:`unit-ruleSites` 之 `readCode` 只剝**行註解**(`^\s*//`),**不剝 JSDoc 之區塊註解**。故凡 JSDoc 內出現與本條正規式同形之表達式(如 `obj2u8arr({ success: undefined })`),即被計為一個真站點。
> 實例:`canonProtocolValue` 併入 `encodeOut` 時,其 JSDoc 的一句說明範例使總數由 9 變 10、寬鬆由 2 變 3(該檔原不在掃描清單內故從未被計入)。**凡以 `readCode` 為基礎之計數,其掃描範圍內的 JSDoc 不得出現與盤點正規式同形之表達式** —— 措辭改為「以編碼器對 `{...}` 編碼」即可。此為 E18(觀察工具自身失真)之同型,併檔時最易觸發(見 R20)。

**why**:wsemi 之 JSON 序列化對 `undefined`/function/Symbol **不拋錯而直接丟鍵**(見 `node_modules/wsemi/src/obj2stru8arr.mjs` 檔頭之失真集合),故 `state:'success'` 不代表封包仍有協定鍵。

**盤點指令**
```bash
grep -hn "obj2u8arr(\|u8arr2obj(" src/*.mjs | grep -v "import \|^[0-9]*:\s*//\|^[0-9]*:\s*\*"   # 須為 9
```
> **第十輪更正**:原指令為 `grep -n ... | grep -v "import \|^\s*//"` —— `grep -n` 之輸出行首已是 `src/檔名:行號:`,`^\s*//` 恆不命中,註解行(`canonProtocolValue.mjs:8`、`managerMergeSlices.mjs:28`、server 之被註解掉之測試碼)全數混入而裸跑得 12。改為 `-h`(不帶檔名)後過濾即生效。下方站點表之行號亦已過期,以表達式為準。
> 同屬雙模 codec 而未列入本條者:`str2b64`(`/dw` 之檔名)、`b642str`(client 之檔名)。前者之寬鬆模式吞掉孤立代理對之 URIError 而回空字串(第十輪 A7),已由 `validDownloadField` 於編碼前正規化;後者之輸入為伺服器自產之 base64,列刻意不套。
**站點數:9(已套 7 / 刻意不套 2 / 未套 0)** —— 2026-09-10 修 #26 後重掃,**本條缺口歸零**

| # | 站點 | 方向 | 內容來源 | 狀態 |
|---|---|---|---|---|
| 1 | `WConverhpClient.mjs:553` | decode | 伺服器回應 | **已套** |
| 2 | `WConverhpClient.mjs:709` | encode | 呼叫端 input | **已套** |
| 3 | `WConverhpServer.mjs:523` | encode | 套件自產字串(`responseU8aStreamWithError` 之 msg,28 個呼叫點全為字面或模板字串) | 刻意不套(此為最終退路,其自身失敗無處可退) |
| 4 | `WConverhpServer.mjs:569` | encode | 應用端(`encodeOut`) | **已套**;後置條件已補強:協定鍵之值先經 `canonProtocolValue` 正規化(undefined/function/symbol → null),使該鍵**結構上不可能消失**(#34) |
| 5 | `WConverhpServer.mjs`(`/main` 請求本體) | decode | 前端/傳輸 | **已套**(#26):解不出或非有效物件即回錯誤封包、發一則 error 事件、且**不觸發任何應用端事件**。修正前對壞封包回 `{}` 而以 `func` 為空字串觸發 execute, 最後「回報成功」 |
| 6 | `WConverhpServer.mjs`(`/slc`) | encode | 套件自產字串(成功/失敗訊息) | 刻意不套 |
| 7 | `WConverhpServer.mjs`(`/dwgfn`) | encode | 應用端 filename | **已套**(#34 + 第九輪補齊):改走 `encodeOut`,**且 filename 於放進封包前先以 `attempt` + `cstr` 正規化為字串基本型** |

> **#34 只修了一半(第九輪外部複審指出並實測)**:原記之理由已寫明兩種失真 —— `toJSON` 回 BigInt 則**序列化拋錯**、回 `undefined` 則 **filename 鍵消失**。而 `encodeOut` 只擋得住前者:其 `canonProtocolValue` 正規化的是**最外層之協定鍵**(`success`/`error`),蓋不到協定鍵**之內**的 `filename`。
>
> 實測(`tmp/probe_r9_final.mjs` 之 F2):filename 給一個帶 `Symbol.toStringTag='String'`(故 `isestr` 為真)且 `toJSON()` 回 `undefined` 之物件 → 回應為 **HTTP 200 + `Return-Type: success` + 本體 `{"success":{}}` + 0 則事件**;client 之 `get(resMg,'filename','')` 取得空字串,隨即 `a.download=''`,瀏覽器改以 URL 末段(`dwgf`)命名檔案。
>
> 教訓:**寫下了兩種失真,卻只驗了其中一種就標「已套」。** 帳本內凡列舉多種失效形狀者,每一種都要各有一次實測;否則「已套」只涵蓋你當時想到的那一格。
| 8 | `managerMergeSlices.mjs:94` | decode | 磁碟 `.ro` | **已套**(P0a 修 #35);另要求解出之值為物件且**自有 `ro` 鍵**,不符者視為未儲存而落到 S2 重新消費 |
| 9 | `managerMergeSlices.mjs:135`、`:145` | encode / decode | 應用端 upload 結果 | **已套**;`:145` 為 #34b 之修正:落地後解回 canonical 值並以之作為首次回應,使首次與重送必然相同、`toJSON` 只執行一次 |

> **#35 之殘餘(本套件側修不掉)**:二進位區截尾時 wsemi 之 decode 仍回 `state:'success'`(`TypedArray.slice` 只縮短不拋錯),站點 8 的兩道檢核皆通過而無從分辨。須由 wsemi 於 decode 時驗證分塊 framing(各段宣告長度總和須等於剩餘位元組數)。已以 `test/api-storedResult.test.mjs` 之 `[凍結待修 · 待 wsemi]` 一格鎖住現況。

> **本條即本帳本存在的理由**:第四輪立下本規則時套了 4 個站點,剩下 3 個真缺口(5、7、8)被編成 **#26、#34、#35**,分別在第四輪、第五輪、第五輪「發現」。**三次發現是同一次遺漏。**

---

### R4 數值選項一律經述詞 + sink 上限

**規則**:凡建構選項之整數,須以 `isp0int`/`ispint` 之 `{ useLimitSafe: true }` 檢核,並另檢核其 sink 之值域上限(TCP port 65535、node 計時器 2^31-1、hapi `maxBytes` 之 safe number);不符者取預設。請求參數與內部已驗值可列為刻意不套。

**盤點指令**
```bash
grep -n "isp0int(\|ispint(" src/*.mjs | grep -v "import "
```
**站點數:21(安全模式 11 / 刻意寬鬆 10 / 未套 0)** —— 第十輪更正:本行原寫 19、目錄與測試為 20、下表只列 18 列(漏列 19、20 兩列);第十輪 +1(第 21 列)

| # | 站點 | 用途 | 狀態 |
|---|---|---|---|
| 1–5 | `WConverhpClient.mjs:147,153,159,165,171` | sizeSlice / timeout / retryMain / retryUpload / retryDownload | **已套**(timeout 另受 maxTimer 約束) |
| 6–9 | `WConverhpServer.mjs:213,252,260,280` | port / sizeSlice / sizeMsg / delayForSlice | **已套**(port 另受 maxPort、delayForSlice 另受 maxTimer 約束) |
| 10 | `WConverhpClient.mjs:286` | `send` 內部 `retry` 之防呆 | 刻意不套:僅收到 1–5 已正規化之值 |
| 11–12 | `WConverhpClient.mjs:506,522` | 進度計算之 `ispint(total)` | 刻意不套:`total` 為 Content-Length 字串(`'1058915'`),嚴格模式會擋掉字串而使進度失效 |
| 13 | `WConverhpClient.mjs:856` | 伺服器回傳 sizeSlice 之比對 | 刻意不套:異常值只會觸發 mismatch reject |
| 14–16 | `WConverhpServer.mjs:966,1177,1182` | 請求參數 chunkTotal / chunkIndex / chunkTotal | 刻意不套(五輪裁定):`cint` 後僅產生名稱異常之切片檔;packageId 過 `isSafeId` 故無路徑逸出;`mergeSlices.mjs:17-19` 逐片存在檢查兜底 |
| 17 | `checkSlicesHash.mjs:43` | 請求之切片索引 | 刻意不套:非法者略過,不參與路徑組裝 |
| 18 | `checkTotalHash.mjs:112` | 磁碟檔名回解析之索引 | 刻意不套:只解析已在暫存夾之檔名,不依其值配置陣列 |
| 19 | `checkTotalHash.mjs` 之 `isp0int(fileSize, { useLimitSafe: true })` | 請求參數 fileSize | **已套**(第九輪;原表漏列) |
| 20 | `validDownloadField.mjs` 之 `isValidFileSize` 內之 `isp0int(v, { useLimitSafe: true })`(第十一輪起併入同檔) | 應用端 fileSize | **已套**(原表漏列) |
| 21 | `checkSlicesHash.mjs` 之 `isp0int(s)` | 暫存夾內實存切片檔名之索引段(本套件自產) | 刻意不套:另以 `String(cint(s)) === s` 要求正規寫法(第十輪 F4) |

> 本條之述詞部分**目前無缺口**。列入帳本之目的是固化「刻意不套」的 10 個理由 —— 否則下一次「順手統一」會把 11–12 一起改掉而使 #27 之修正失效。

### R4b 檢核與正規化須成對(`isp0int`/`ispint` → `cint`)

**規則**:`isp0int`/`ispint` 縱使帶 `useLimitSafe` 仍接受**數字字串**(`ispint('1048576', {useLimitSafe:true})` 為 `true`,與 `isValidFileSize` 同一契約)。故凡以此二述詞檢核而其值會流入 `===`/`!==` 比較、或會原樣送上線路者,**須另以 `cint` 正規化**。

**why**:算術與關係運算會自動轉型(`3000000 / '1048576'`、`1 > '5'` 皆正確),**只有嚴格相等會壞**。這使未正規化的站點在多數路徑上看起來正常,直到踩到那一個比較。

**盤點指令**
```bash
grep -n "isp0int(\|ispint(" src/WConverhpClient.mjs src/WConverhpServer.mjs | grep -v "import "
grep -n "= cint(" src/WConverhpClient.mjs src/WConverhpServer.mjs
```

**站點數:10(已套 10 / 未套 0)** —— 第七輪補齊 9 個建構選項;第九輪加入請求參數 1 個並修正

> **第九輪之教訓**:第七輪把本條的站點清單寫成「**9 個建構選項**」,而規則本身寫的是「凡以此二述詞檢核而其值會流入 `===`/`!==` 比較者」—— **清單的範圍比規則窄**。
> 於是 `checkTotalHash` 那個以 `isnum`(比 `isp0int` 更寬鬆,連負數與小數都收)檢核後直接 `===` 比對的請求參數,不在任何人的視野內。
> 盤點指令亦同:兩條指令都只掃 `WConverhpClient.mjs` 與 `WConverhpServer.mjs`,**不掃 `checkTotalHash.mjs`**。
> 立規則時,站點清單的範圍必須等於規則陳述的範圍;窄一格,就漏一格。

| 站點 | sink | 未正規化之後果 | 狀態 |
|---|---|---|---|
| client `sizeSlice` | `resUpCkt.sizeSlice !== sizeSlice`(`sendDataSlice`) | **兩端組態實為同值卻判為 mismatch,整個上傳被拒**(實測) | **已套**(第七輪) |
| server `sizeSlice` | 原樣回傳給 client 供上述比對 | 同上 | **已套**(第七輪) |
| client `timeout` | axios timeout → setTimeout | 轉型後正確,無實害 | 已套(一致性) |
| client `retryMain`/`retryUpload`/`retryDownload` | `n > retry` | 關係運算轉型後正確,無實害 | 已套(併同 R4c 之封頂) |
| server `port` | hapi port | hapi 接受字串,無實害 | 已套(一致性) |
| server `sizeMsg` | hapi `maxBytes` | 無實害 | 已套(一致性) |
| **請求參數 `fileSize`**(`checkTotalHash.mjs`) | 與 `fs.statSync().size` 之 `===` 比對 | 曾使**整檔去重路徑靜默失效,已上傳過之大檔每次重傳** | **已套(第九輪)**:述詞由 `isnum` 改為 `isp0int` 之安全模式(與 `isValidFileSize` 同一契約), 並補 `cint` |
| server `delayForSlice` | `setTimeout` | — | 已套(原就有) |
| client `resUpCkt.sizeSlice`(`sendDataSlice` 之 `ispint(resUpCkt.sizeSlice) && resUpCkt.sizeSlice !== sizeSlice`) | `!==` | 伺服器端已以 `cint` 正規化後才回傳,恆為數值 | 刻意不套(第十輪 B 卷指出原未分類) |
| 應用端 `fileSize`(下載) | Content-Length 與實送長度之 `===` | — | **已套**;第十輪起判定與 `cint` 同處收歸 server 之 `validDownloadField`;第十一輪起其呼叫者收斂為 `readOutput` 一處,「哪些路由驗 fileSize」由 `src/routeSpec.mjs` 之 `fields` 表達(與 `test/tools/api-axes.mjs` 對照,`unit-routeSpec`) |

**機械化保護**:`test/api-optionsNumericString.test.mjs`(分辨力:修正前 3 failing / 5 passing,修正後 5 passing),含一條對照組確保 sizeSlice 真的不同時仍須拒絕。

> **本條之由來**:第六輪已為 `fileSize` 立下「檢核與正規化須成對」並以測試鎖住(見上表之 cint 兩處),但**只登記了那一個站點**。第七輪以同一條規則盤點建構選項,立刻找到兩個會使上傳整個失敗的未套站點。又一次:規則對了,站點清單少了。

### R4c 重試次數與退避延遲須各自有上限

**規則**:重試次數上限 20(`WConverhpClient` 之 `maxRetryTimes`),單次退避延遲上限 180 秒(`src/retryDelay.mjs` 之內部常數 `maxDelay`)。兩者成對 —— 只封其一,另一者即失效。

> **第十一輪**:`maxDelay`/`nToPeak`/`baseDelay` 為該模組之**內部**常數,**不匯出**(原僅為了讓單元測試取用而匯出)。本條之規格值(1 秒起、第 10 次達 180 秒)由 `test/unit-retryDelay.test.mjs` 以**字面值**斷言,不再自實作取常數 —— 否則改了常數測試照樣綠(現狀指紋)。

**why**:原實作把「成長率之校準常數 10」與「迴圈上限(呼叫端可設之 `retry`)」當成同一件事,兩者實無關聯。實測退避曲線:

| n | 單次等待 | 累計 |
|---|---|---|
| 10 | 180 s | 0.11 h |
| 20 | **16.0 h** | 36.6 h |
| ≥ 27 | **超過 2^31−1,`setTimeout` 溢位 → 實際等 1 ms** | 退避塌陷為熱迴圈打伺服器 |

超過上限之次數採**截為上限**而非取預設 —— 取預設會**減少**重試次數,與本檔開頭之重試原則相牴觸;呼叫端給大值的意圖正是要多重試。封頂只限制單次等待,不減少次數。

**機械化保護**:`test/unit-retryBackoff.test.mjs`(7 條,含「任何 n 皆不得超過 32 位元計時器上限」之 200 點掃描)。

**同一規則之既有站點**:`WConverhpClient.mjs` 之 `maxTimer`(timeout)、`WConverhpServer.mjs` 之 `maxTimer`(delayForSlice)、`maxPort`(port)。第七輪之前,**三個計時器 sink 有兩個有上限**。

---

### R5 同一次失敗恰發一則 error 事件

**規則**:一次失敗對應恰一則 `error` 事件。兩層都認為自己擁有同一失敗時,須指定唯一持有者,下游只轉發不重報。

**盤點指令**
```bash
grep -cE "^\s*evEmit\('error'" src/WConverhpServer.mjs   # 總量(維護提示): 須為 21(第十一輪 28 → 19; 第十二輪 → 21: 上傳管線閘門、/main 之 admit 期間中斷補判); 以 ^\s* 錨定排除被註解掉之派發
grep -cE "^\s*(evEmit|ctx\.emit)\('error'" src/WConverhpClient.mjs   # 總量(維護提示): 須為 11(第十一輪 13 → 10; run02 起計入呼叫層級之 ctx.emit, 組成為 ctx.emit 9 + evEmit 1, 見下方 run02 註; 2026-10-14 結局判定修正 → 11: 雜湊計算失敗之入口事件 +1); 裸跑不加 ^\s* 會多計註解掉之派發 —— 第十輪納入時沿用 server 指令而未驗分辨力(B 卷 §①-1.5)
grep -cE "^\s*evEmit\('error'" src/WConverhpClient.mjs   # 擁有者鎖(run02): 須為 1, 只在 openCall 之 invalid opt.signal; 其餘一律經呼叫層級之 ctx.emit(中止後不發, 帳本 R27)
grep -c "checkConn(" src/WConverhpServer.mjs               # 擁有者鎖: 須為 2(定義 + admit 內唯一呼叫), 路由不得直接呼叫
grep -c "evEmit('handler'" src/WConverhpServer.mjs         # 擁有者鎖: 須為 1(只由 admit 發, 權限未通過即不發)
grep -c "attemptFailed(" src/WConverhpClient.mjs           # 擁有者鎖: 須為 2(callApi 之重試迴圈、checkMerging 之 state:error)
grep -c "serverError" src/WConverhpClient.mjs              # 剝註解後須為 0(已由 wrapNoRetry + attemptFailed 取代; 否則同一事實兩個擁有者); 裸跑得 2, 皆為說明其由來之註解, 權威判定在 unit-ruleSites
```
**站點數:總量 server 26**(即時派發 **21** + 建構期 `evEmitDelay('error'` **4** + 監聽器出錯之通報 `ev.emit('error'` 1,見 R11)**+ client 11**(2026-10-14 +1:`sendDataSlice` 之雜湊計算失敗);**擁有者鎖 8**(server:`admit`、`readOutput`、`replyPacket`、`failPayload`;client:`attemptFailed`、各入口拒絕、`ctx.wrapProgress`(run02 起;原 `cbProgressSafe`)、`invalid state`)。權威判定在 `test/unit-ruleSites.test.mjs`(剝註解後計數)。

> **run02(2026-10-13)之改寫(前端中止,R27)**:client 之 error 事件一律經「一次公開呼叫」之脈絡 `ctx.emit` 發出,中止後一律不發;唯一例外為 `openCall` 之 `invalid opt.signal`(型別錯誤時尚無中止範圍,以 `evEmit` 直接發出)。**總量 10 不變而組成改變**:新增 `invalid opt.signal` +1、`cbProgressSafe` 與 `sendDataSlice` 之包裝收斂為 `ctx.wrapProgress` 一處 −1(主控裁示原預估 10 → 11,係以收斂前之結構估算)。計數錨改為 `(evEmit|ctx.emit)('error'`(`test/unit-ruleSites.test.mjs` 之 R5)。**中止不是一次嘗試之失敗**:中止後之失敗(在途請求之 CanceledError、合併查詢之 state:error、sizeSlice mismatch、管理器路徑之 getToken error、cbProgress error)0 則;中止前已發者不收回。

> **第十一輪之改寫(B 卷 §③-3.6)**:總量數字只能偵測「有人增刪了一處」,偵測不到「同一次失敗發了兩則」或「某條路由漏了處置」;路由層收斂後總量必變,只改數字則鎖形同虛設。故本條改以**擁有者鎖**(擁有者之個數,有下界意義)為分辨力來源,總量降級為維護提示(維護規則第 6 條);server 側另以行為表 `test/api-errorEventOnce.test.mjs`(失敗種類 × 六路由,成員取自 `test/tools/api-axes.mjs` 之 `allRoutes`)逐格斷言則數、訊息、狀態碼,並鎖「權限未通過不發 handler 事件」與「六路由所見之 authorization」。**分辨力已驗**:把 `src/routeSpec.mjs` 之 `dwgf.authFrom` 改錯 → 該表與 `unit-routeSpec` 各 1 紅(而 325 條舊測試全綠 —— B 卷 B4 所指之靜默壞格)。

> **第十輪之範圍更正**:本條規則是全套件的,盤點指令卻只掃 server;client 之 11 個(修正前)站點無人盤點,而本輪 D6(「伺服器回業務錯誤」於標頭協定 0 則)正在 client。client 以 `serverError` 為該事實之唯一處置(`callApiCore`、`downloadStream`、`checkMerging` 三處皆經之)。本條無法只靠站點數判定(同一失敗可能跨站點),故以**失敗種類 × 事件則數**為表:

> **第九輪更正**:本行原寫「即時派發 24 + 建構期 `evEmitDefer` 1」,兩處皆過期 —— 實測即時派發為 **23**(`node tmp/measure_sites.mjs`),且函數名於第八輪已改為 `evEmitDelay`。
> `test/unit-ruleSites.test.mjs:244-246` 之期望值(23/1/1)一直是對的,**錯的是帳本的散文**。
> 教訓:帳本之數字與測試之期望值是同一件事的兩份寫法,兩份就會不一致(§本帳本存在之理由的同型)。修正任一處時須同時對照另一處。

| 失敗種類 | 現況則數 | 應然 | 狀態 |
|---|---|---|---|
| verifyConn 拋錯 | 1 | 1 | 已套(`api-verifyConnError` 斷言 `=== 1`) |
| 監聽器同步拋錯 | 1(`onListenerError`) | 1 | 已套 |
| download 形狀錯誤(`/dw`、`/dwgf`) | 1 | 1 | 已套 |
| download 形狀錯誤(`/dwgfn`) | 1(`:1455`,第五輪補) | 1 | 已套 |
| download 應用端 reject | 0(三路由一致) | 0 | 已套 |
| `/slc` 連線中斷 / 寫入失敗 | 1(第三輪修 #15 前為 2) | 1 | 已套 |
| `.ro` 序列化失敗 | 1(由外層 encodeOut 唯一持有;mmg 不再另報) | 1 | **已套**(#33) |
| `/main` 畸形本體 | 1 | 1 | **已套**(#26) |
| 標頭值非法(`Return-Msg`) | n/a(改為略過該標頭, 不再是失敗) | n/a | **已套**(#25) |
| 應用端輸出為 function / symbol | 1(`procApp`) | 1 | **已套(第十輪 A8)**:原為 0 則(execute 得 `invalid msg.output`) |
| `/ulctr` 內部呼叫拋錯 | 1(`internal`) | 1 | **已套(第十輪 A11)**:原為 0 則且錯誤封包含伺服器路徑 |
| 建構期:暫存資料夾無法建立 / 外部 serverHapi 路由註冊失敗 | 1 / 1(`evEmitDelay`) | 1 | **已套(第十輪 D7、A13)** |
| client:伺服器回業務錯誤(封包 / 標頭 / 合併查詢之 state:error) | 每次嘗試 1(`serverError`) | 1 | **已套(第十輪 D6、N2)**:原標頭協定與合併查詢皆 0 則 |
| client:upload 輸入不支援 / JSON 本體無法序列化 | 1 | 1 | **已套(第十輪 D2、A10)** |
| **本體無法解析(`/ulctr`、`/dwgfn`、`/dw` 之 JSON 語法錯誤)** | 1(`failPayload`) | 1 | **已套(第十一輪 A1)**:原為 hapi 裸 400、0 則 |
| **client:傳輸層失敗(連不上、逾時、413、5xx)** | 每次嘗試 1(`attemptFailed`) | 每次嘗試 1 | **已套(第十一輪 N3)**:原為 0 則(實測四種皆 0);413 因不重試而恰 1 |
| **上傳管線受理新工作而無 upload 接聽者(`/slc`、`/ulctr` 三模式)** | 1(`requireListener`) | 1 | **已套(第十二輪)**:原為 0 則且落檔(R12) |
| **前端於 admit 期間中斷(`/main`、`/slc`)** | 1(`/main` 之補判、`/slc` 之 onAbort) | 1 | **已套(第十二輪)**:原為 0 則且 handler 永不終結(R12) |
| **建構期:曝露與存取控制選項有給而無效** | 每選項 1(`errsOpt` 迴圈) | 每選項 1 | **已套(第十二輪)**:原為 0 則且靜默退回最寬鬆(R26) |
| 上傳之 `.ro` 損毀且無接聽者 | 2(損毀之記錄 1 + 無人接聽 1) | 2(兩件不同失敗) | 已套(第十二輪以 `api-uploadNoListener` 鎖住;非重複) |
| **client:`opt.signal` 有給而非 AbortSignal** | 每次呼叫 1(`openCall`) | 1 | **已套(run02,主控裁示 Q2)**;`api-clientAbort`、`e2e-abort` |
| **client:中止(`opt.signal`)之後之任何失敗** | 0(`ctx.emit` 之閘門) | 0(中止不是一次嘗試之失敗) | **已套(run02,R27)**:修正前無中止能力;`api-clientAbort` 以「`abort()` 返回後(含其同步期間)」量 |

**第十一輪:client 側改以「失敗種類 × 計數單位 × 擁有者」為表(B 卷 §③-3.3(4)),站點數不再是判準,改鎖「每一列各有一個擁有者且擁有者數 = 列數」**

| 失敗種類 | 計數單位 | 則數 | 擁有者 |
|---|---|---|---|
| 凡一次嘗試之失敗(傳輸:連不上、逾時、413、5xx;業務:錯誤封包、`Return-Type:error`;封包解析;getToken 拋錯) | 每次嘗試 | 1 | `callApi` 重試迴圈內之 `attemptFailed`(**唯一**);事件值經 `classifyFailure` 與最終拒絕值同一算法(413 → `Payload Too Large`) |
| 合併查詢之 `state:error`(HTTP 成功、本體為終結態,不經迴圈) | 每次查詢 | 1 | `checkMerging` 呼叫同一個 `attemptFailed`(第十輪 F6 之站點;A 卷指出照字面收斂會使此格靜默退回 0 則而唯一測試不計數,故 `api-uploadMergeError` 改為計數並斷言恰一則) |
| 入口即拒絕(`invalid opt.signal`(run02)、`invalid input for upload`、`invalid fdDownload`、`input can not be serialized`、`sizeSlice mismatch`、管理器路徑之 `getToken error`、**upload 之雜湊計算失敗(2026-10-14)**) | 每次呼叫 | 1 | 各入口(不進重試鏈);`invalid opt.signal` 以外皆經 `ctx.emit`;雜湊計算失敗之值經 `classifyFailure`(原以原始錯誤物件拒絕且 0 則:nodejs `fs.openAsBlob` 後改寫檔案 → `NotReadableError`,實測) |
| `cbProgress` 拋錯 | 每次請求(只報首次) | 1 | `ctx.wrapProgress`(run02 起;原為 `cbProgressSafe` 與 `sendDataSlice` 之包裝兩處手寫) |
| 中止(`opt.signal`)之後 | — | 0 | `ctx.emit` 之閘門(R27) |
| `invalid state` | 每次呼叫 | 1 | `execute` |

> **2026-10-14 結局判定修正(審計 run01 → 修正 run02,主控裁示 1–4)**:本表第一列之「`attemptFailed` 為一次嘗試失敗之**唯一**出口」修正前不成立 —— `callApi` 以 wsemi `pmConvertResolve` 分類嘗試結果,拒絕值之 `reason === 'cancelled'` 者被分為第三態而不進迴圈,以 `''` 結束:**0 則、不重試**(應用端拒絕值、其 `toJSON`、getToken 拒絕值、宿主 axios 攔截器之值、`signal.reason` 皆可觸發;CLAUDE.md 之 failTwice 以取消形狀實作即破);另 `isNoRetry` 以 `get(msg,'response.status') === 413` 對任意失敗值判不重試。修法:`callApi` 以自身之 `attempt`(try/catch)取 `{ state, msg }`,不再 import `pmConvertResolve`;不需重試改於來源標示(R29)。帳本之盲點:擁有者鎖只數 `attemptFailed(` 之呼叫點(2),量不到「有一條不經它的出口」—— 出口是由輔助函式之第三態產生,不是本檔之一行程式碼;行為面改由 `test/api-clientOutcomeShapes.test.mjs`(形狀軸 × 來源 × 路徑)鎖住。

**明文裁定(B 卷 B1)**:合併輪詢無限,長時間斷線之 `upload()` 每輪查詢各自重試並各發事件,**事件數無上界**(每輪最多 1+retryUpload 則,速率受退避約束,估算約 11 則 / 6.6 分鐘)—— 與「重試導致等待久」同族之刻意,已寫進 client JSDoc;不需要者不註冊 `error` 監聽器。修正前業務錯誤側本就每 2 秒一則(伺服器有回應故無退避),本輪之增量噪音小於既有噪音。機械化保護:`test/api-clientAttemptEvents.test.mjs`(ECONNREFUSED ×3、413 ×1、5xx ×3、timeout ×2,與 retry>0 之業務錯誤對照組 ×3 不變)。

---

### R6 應用端形狀錯誤一律回套件錯誤封包

**規則**:應用端交出之值不合契約時,回 HTTP 200 + `Return-Type: error` + 可解析封包;不得回裸 500、不得懸置、不得宣稱成功。屬應用端狀態,依重試原則**不標示** retryable。

**驗證形式**:行為規則,以測試而非 grep 盤點(本條約束回應之**形狀**而非程式碼之寫法,無 grep 指令為刻意)。**缺口 0**:

| 情境 | 現況 | 狀態 |
|---|---|---|
| fileSize/fileType/streamRead 各類非法 | 錯誤封包 | 已套(第三/四輪) |
| 屬性讀取拋錯 | 錯誤封包 + 一則帶真因之事件 | **已套**(#32) |
| `Return-Msg` 值非法 | 略過該標頭, 回應照常 | **已套**(#25) |
| `/main` 畸形本體 | 錯誤封包 + 一則事件 + 不觸發 execute | **已套**(#26) |
| 封包序列化後協定鍵消失 | 協定鍵經 canonProtocolValue 正規化, 結構上不可能消失 | **已套**(#34) |
| **`/ulctr` check-total-hash 之切片檔名無法解析索引** | 原直接 `throw`(而同一函數對「fileSize 非法」卻回 `{ error }`);已改為略過該檔(與 `checkSlicesHash.mjs:43` 之 `continue` 對稱) | **已套(第九輪)** |
| **worker 之 `{ error }` 被宣稱為 success** | `checkTotalHash` 與 `checkSlicesHash` 以**回傳 `{ error }`** 表達失敗而非拋錯,伺服器原未檢核,該物件原樣進入 `out.success` 並以 `Return-Type: success` 回應 | **已套(第九輪)**:`WConverhpServer` 之 `workerError` |

**第九輪新增之站點(worker 之 `{ error }`)**:此格同時違反本條(不得宣稱成功)與 R3(不得把「底層沒拋錯」當成功)。實測後果 —— 前端 `sendDataSlice` 之各項檢核(`bAllHash`/`sizeSlice`/`bSls`)皆因欄位為 `undefined` 而略過,於切片迴圈首次使用 `resUpCkt.slks` 時拋 `TypeError: Cannot read properties of undefined (reading 'indexOf')`。亦即**伺服器宣稱成功、前端崩在一個看不出原因的地方**(`tmp/probe_r9_rest.mjs` 第 2 節為修正前路徑,`rest2.mjs` 為端對端驗收)。

不標示 `retryable`:標示會減少重試,須另行舉證(見專案重試原則),本輪不做。

**第十輪新增之站點**

| 情境 | 現況 | 狀態 |
|---|---|---|
| 應用端輸出為 function / symbol(JSON 靜默丟鍵,`encodeOut` 之嚴格模式抓不到) | 錯誤封包 `output can not be serialized` + 一則事件(`procApp` 為應用端結果正規化之唯一擁有者,另把 `undefined` 正規化為 `null`) | **已套(第十輪 A8、D5)** |
| 下載欄位之型別判定拋錯(`Symbol.toStringTag` getter) | 錯誤封包 + 一則事件 + 串流銷毀(`validDownloadField`) | **已套(第十輪 A5)** |
| **例外:`/dwgf` 之錯誤狀態碼** | 本體封包與 `Return-Type`/`Return-Msg` 標頭同其他路由,**HTTP 狀態碼為非 2xx**:權限 403、參數 400、應用端無法提供檔案 404、應用端交出之內容不合契約 500 | **刻意(第十輪 A9)**;第十一輪起狀態碼表寫在 `src/routeSpec.mjs` 之 `statusOf`(六路由 × 六種 kind),由 `replyOf` 查表,不再於路由內手寫 |

**第十一輪新增之站點(A 卷 A1:R6 之站點清單只登記了 `/main`,而規則陳述是全套件的)**

| 情境 | 現況 | 狀態 |
|---|---|---|
| `/ulctr`、`/dwgfn`、`/dw` 之本體無法解析(截斷 JSON、中間層改寫) | 原為 hapi 於路由前置階段回**裸 400**、handler 不執行、0 則事件、client 照常重試;現由 `failPayload`(hapi 之 `payload.failAction`)回錯誤封包 `invalid request packet` + 一則事件,413 原樣拋回以維持 client 之不重試判定 | **已套(第十一輪 A1)**;`test/api-payloadParseFail.test.mjs`(修正前 3 紅) |
| `/dwgf` 未給 filename | 原不帶 `Content-Disposition`(跨來源直接 GET 可顯示型別即導頁);現一律 `attachment`,有名才加 `filename*` | **已套(第十一輪 N6)**;非形狀錯誤,列此因同屬「應用端輸出之處置」 |

**`/dwgf` 例外之理由**:本條「一律 HTTP 200」之前提是「回應由 JS 解析本體與標頭」。`/dwgf` 之唯一消費者是瀏覽器下載管理器(client 之 `downloadByManager` 以 `a[download]` 導覽至此,沒有任何 JS 讀其回應),而下載管理器**只以狀態碼判定成敗** —— 實測(A 卷 playwright chromium)應用端拒絕、permission denied 皆被存成使用者之 `report.txt`(52B / 41B 之錯誤封包,`failure=null`),兩端 0 則事件。修正後同一探針之下載顯示 `canceled` 且不落地。對標:S3 預簽 URL 以 403/404 使瀏覽器顯示下載失敗。
**前提不成立之成員列為例外,不改規則本身** —— 其餘五條路由仍一律 200。測試端把差異寫成 `test/tools/api-axes.mjs` 之路由資料 `errorStatus` 與 `downloadErrorStatus(route, kind)`,各檔取自軸而不各自手寫 200 或 404(遵 R8)。

> **為何九輪未發現**:約 11 條斷言鎖著「`/dwgf` 之錯誤為 HTTP 200」—— 它們是由本條翻譯而來的測試,**把本條之盲點一起凍結成了規格**。規則之前提若沒寫下來,就沒有人會去問某個成員是否符合前提。

**機械化保護**:`test/api-failureNotSuccess.test.mjs` 之三條。分辨力已驗:停用 `workerError` 之檢核後 **2 failing**;對照組涵蓋 `fileSize` 為 `0`、`1024` 與**數字字串** `'1048576'`(後者為 R4b 之既有契約,不得被本次收嚴誤擋)。

**第九輪新增之站點(P5/P6)**:`checkTotalHash` 之 `:92` 以 `indexOf(\`${fileHash}_\`) >= 0` 判定切片檔(應為 `startsWith`,否則 `<其他前綴><fileHash>_<n>` 會被誤認為本檔切片),其後 `:110-115` 以 `sep` + `last` 解析索引,解析失敗即 `throw`。兩者為同一段邏輯之前後半。**注意本站點受 R14 約束**:實際執行者為 `checkTotalHash.wk.umd.js`,只改 `.mjs` 無效。

**2026-10-14 新增之站點(審計 run01 → 修正 run02,主控裁示 1)**

| 情境 | 現況 | 狀態 |
|---|---|---|
| 應用端以惡意值**拒絕**(已撤銷之 Proxy、拋錯之 `Symbol.toStringTag`) | 原為 `encodeOut` 之 `canonProtocolValue` 以 wsemi `isfun`(= lodash `isFunction`,讀 `Symbol.toStringTag`、觸發 Proxy 之 `has` 陷阱)檢視拒絕值而拋錯逸出 → **裸 HTTP 500、伺服器 0 則**(同檔 `procApp` 對成功值早已改用 typeof —— 同一規則兩站點只套一處);改以 `typeof` 判 function/symbol,惡意值交 codec 嚴格模式 → 錯誤封包 `output can not be serialized` + 一則事件 | **已套**;`test/api-hostileErrorValues.test.mjs` |
| **client:下載之成功判定**(「不得宣稱成功」之 client 側) | 原以「沒有 `Return-Type: error`」判成功(否定式,fail-open):網址誤指 SPA 主機、代理之 2xx 錯誤頁、宿主 `axios.defaults.validateStatus` 全放行時,把該本體當成使用者之檔案交出、resolve、0 則;改為須帶本套件之下載標頭(`Content-Disposition`,伺服端 `/dw` 之成功回應必帶)才算成功,否則以 `invalid download response from server` 拒絕並照常重試(肯定式,與封包路由之嚴格解碼同型) | **已套**;`test/api-clientOutcomeShapes.test.mjs` |

> 前提(E20):本條「一律 HTTP 200 + 可解析封包」之前提為「回應由 JS 解析」;client 側之對應前提為「**成功須能證明是本套件之回應**」—— 封包路由由嚴格解碼證明(`u8arr2obj` 之嚴格模式 + 協定鍵),串流下載由下載標頭證明。下載以外之成功路徑無否定式判定(R29 之盤點)。

---

### R7 宣告長度須等於實送位元組

**規則**:寫入 `Content-Length` 之值須等於實際送出之位元組數。

| 站點 | 現況 | 狀態 |
|---|---|---|
| 下載回應(`/dw`、`/dwgf` 之 `.header('Content-Length', fileSize)`) | 計數 Transform + `stream.pipeline` 保證;可具體化者先算長度 | 已套(第三輪 #20),由 `test/api-downloadFraming.test.mjs` 與 `api-downloadLength.test.mjs` 鎖住 |
| 控制封包(`responsePacket.mjs` 之 `smr.readableLength`) | 取 `smr.readableLength` | **已套**;由 `test/api-characterization.test.mjs` 之「[鎖定] 控制封包之 Content-Length 等於實際本體位元組數」鎖住 |

> **第九輪更正**:本表原記「控制封包……**無任何測試斷言**|未驗證(非缺口,但為 P-1 特徵測試項)」—— 該斷言其實早已存在,帳本未跟著更新。
> 另原表以行號(`:1607`/`:1765`/`:488`)標示站點,**行號會隨任何一次編輯而失效**;已改以「檔名 + 表達式」標示。
> 教訓:帳本內凡以行號標示者,下一次重構就會全部指錯。除非該行極穩定,否則一律用可 grep 的錨點。

---

### R8 以軸列舉之測試, 其成員清單須取自 fixture

**規則**:凡以某條軸(路由、模式、欄位、階段)列舉的測試,成員清單一律取自 `test/tools/api-axes.mjs`,不得在測試檔內手寫字面陣列;要少測某成員,須經 `downloadRouteKeys({ 成員: '理由' })` 或以軸上的屬性(`body`/`stages`/`requiredFields`)表達,理由與屬性皆須可被挑戰。

**why**:「下載路由」原本是一條**沒有名字的軸** —— 成員清單手寫在五個測試檔內且各檔不一致(`api-downloadShape`/`api-sourceTraps`/`api-downloadFraming` 跑 `['dw','dwgf']`,`api-downloadEvents` 跑三個)。少掉的成員不是被裁定不測,而是**沒有人記得它也在這條軸上**;#23 與 #32 都落在這條接縫上,而測試照樣全綠 —— 因為每個檔案都「跑完了自己陣列裡的每一個成員」。缺格因此不會以任何形式浮出來。

**盤點指令**
```bash
node tmp/measure_axis.mjs                                   # 每個成員被哪些測試檔觸及
grep -rn "\['dw', *'dwgf'\]" test/*.test.mjs | grep -v unit-axisCoverage    # 須為 0:不得再手寫成員陣列
```
(排除 `unit-axisCoverage.test.mjs`:該檔為本規則之執行者,其註解與正規式字面必然含此樣式。已實測本指令現為 **0**,且把字面陣列插回任一測試檔即轉為非 0。)

> **第九輪更正**:本條原指令為 `grep -rn "\['dw'\|'dwgf'," test/*.test.mjs # 須為 0`,而**實跑恆得 5**(從未為 0)。
> 5 個命中全是假陽性:3 個為 `call('dwgf', 'multi-fault')` 這類**函數呼叫**(`'dwgf',` 這個片段同時匹配到參數列),2 個在 `unit-axisCoverage.test.mjs` 的註解與正規式字面內。
> 亦即這條指令**宣稱須為 0 卻從未有人跑過** —— 若跑過,第一次就會發現它永遠不為 0。
> 已改為只匹配真正的字面陣列。教訓:盤點指令自身也要驗分辨力(先確認它在「違規存在時為非 0、不存在時為 0」兩種狀態下都正確),否則它只是一行看起來很嚴謹的散文。
> 真正的機械化保護在 `test/unit-axisCoverage.test.mjs`(其正規式較精確且已驗分辨力),本指令僅供手動速查。

**站點數:5 個測試檔皆已改取自 fixture(未套 0)**

| 測試檔 | 原成員陣列 | 現取法 | 少測之成員與理由 |
|---|---|---|---|
| `api-downloadShape` | `['dw','dwgf']` | `downloadRouteKeysByBody('stream')` | `dwgfn` 只回檔名封包、不讀 fileSize/fileType,取得檔名後即銷毀來源,不受交付本體之契約約束 |
| `api-downloadFraming` | `['dw','dwgf']` | `downloadRouteKeysByBody('stream')` | 同上(本檔驗 Content-Length 之框幀) |
| `api-sourceTraps` | `['dw','dwgf']` + 一段 `dwgfn` 特例迴圈 | `downloadRouteKeysByStage(階段)` 與 `downloadRoutes[route].fields` | 由軸上的 `stages`/`fields` 決定,原本的特例迴圈已消去 |
| `api-downloadEvents` | `['dw','dwgf','dwgfn']`、`['dwgfn','dw']` | `downloadRouteKeys()` 與 `downloadRouteKeysRequiring('filename')` | `/dwgf` 之 filename 為選用欄位,已改為軸上的 `requiredFields`,並補一條正面斷言其應然 |
| `api-characterization` | 各測試自選單一路由 | 請求形狀取自 `fetchDownload` | 各測試本就針對單一路由之特徵行為 |
| `api-uploadNoListener`(第十二輪新檔) | —(新檔,未曾手寫) | `ulctrModes` 之 `gated` 成員(第十二輪新軸:`/ulctr` 之 mode 全集與「無 upload 接聽者時是否被擋」) | `merge-slices-get` 不擋,理由寫在軸上之 `why`(已承接工作之查詢與回放);該軸另由 `unit-routeSpec` 對照 src 之 mode 合法性字面與閘門豁免字面(A 卷 ③-2) |
| `api-executeError`(拒絕值形狀)、`api-clientOutcomeShapes`(2026-10-14 新檔) | `api-executeError:133` 手寫 8 員,漏 `{reason:'cancelled'}`(wsemi `pmConvertResolve` 之取消形狀)與 `{response:{status:413}}`(`isNoRetry` 之形狀)—— 兩個以形狀判定結局之站點,測試清單都沒有其觸發形狀(經驗 E1 之第四次) | **形狀軸** `rejectShapes`(每員附 `why`)、**序列軸** `rejectSequences`(取消形狀出現在第 k 次)、**惡意值工廠** `hostileShapes()`(每次呼叫產生新值;只用於不經 codec 之值與伺服端拒絕值) | 無少測;惡意值經伺服器 codec 後必為錯誤封包(R6),故前端之惡意值格只取 getToken |

**2026-10-14 之延伸(形狀軸)**:軸之成員由**契約與判定站點**推導,不由已知缺陷推導(E1):契約「非 Error 者不論形狀皆原樣交出」(`classifyFailure` 之說明)→ 原始型別、空字串、陣列、物件;**每個曾以值之形狀判定結局之站點** → 其觸發形狀(`reason:'cancelled'`、`response.status:413`);codec 之前後 → 以 `toJSON` 產生取消形狀之成員(觸發面是「抵達前端時之形狀」)。新增判定站點時(R29 之盤點),其觸發形狀須同時加入本軸。

**機械化保護**:`test/unit-axisCoverage.test.mjs` —— ①軸自身資料自洽(`requiredFields ⊆ fields`、`requestOf` 之 url 對得上路由路徑)②測試檔不得再手寫成員陣列(鑑別力已驗:插回一個字面陣列即轉紅)③排除成員未附理由或成員名打錯須拋錯 ④覆蓋聯集等於成員全集,且每個成員至少被兩個檔案觸及(第十輪重跑 `node tmp/measure_axis.mjs`:dw 11 / dwgf 9 / dwgfn 7;原記 8 / 6 / 4 已過期)。

**第十輪:錯誤狀態碼成為軸上之資料**:`/dwgf` 之錯誤改為非 2xx(見 R6 之例外)後,原有約 11 條斷言以 `r.status === 200` 手寫。改為各路由宣告 `errorStatus: { permission, param, app, output }`,斷言一律 `downloadErrorStatus(route, kind)` —— 差異是契約,寫在軸上,不寫在各檔。

**副產物**:五個測試檔原本各自手寫一份請求組裝與回應拆解(差異只在有無 `Accept-Encoding`、有無逾時、`text` 之長度上限),已收斂為 `fetchDownload` 一個函數加選項。

> **本條在本輪的第一個產出**:把 `api-downloadEvents` 之「缺 filename」一條改為全成員列舉後,`/dwgf` 立刻紅 —— 它對缺 filename 回 200 全量本體。查證 `src/WConverhpServer.mjs` 之 `/dwgf` filename 註解後確認為刻意設計(未給則不帶 Content-Disposition,由 `<a download>` 或 URL 命名,向後相容),故改寫成軸上的 `requiredFields` 並補一條正面斷言。**原本這一格是空白,現在它有值了。**

---

### R9 選用之回呼參數一律於呼叫前補預設

**規則**:公開方法之選用回呼參數(`cbProgress` 等),凡有直接呼叫該回呼之處,該處須自行補 `isfun` 預設;不得倚賴另一層已補過。

**why**:`send` 對其 `opt.cbProgress` 已補預設(`WConverhpClient.mjs:291-294`),故 `execute` 與 `download` 省略該參數皆正常;而 `sendDataSlice` 直接呼叫 `cbProgress`(不經 `send`),未補預設,`upload` 於**首片上傳完成時**才拋 `cbProgress is not a function`。**三個公開方法對同一個選用參數行為不一致**,且失敗點在流程中段而非入口。

**盤點指令**
```bash
grep -n "cbProgress(" src/WConverhpClient.mjs        # 每一個呼叫點所在之函數都須有 isfun 預設
grep -n "isfun(cb)" src/WConverhpClient.mjs          # run02 起為 1: ctx.wrapProgress(補預設之唯一擁有者; 原為 isfun(cbProgress) 2 處: send 與 sendDataSlice)
grep -nE "ctx\.wrapProgress\((get\(opt, 'cbProgress'\)|cbProgress)\)" src/WConverhpClient.mjs   # 須為 2: send 與 sendDataSlice 各於第一次使用前經之
```

**站點數:3(已套 3 / 未套 0)**

| 呼叫點 | 所在函數 | 預設補在哪 | 狀態 |
|---|---|---|---|
| `:523`、`:539`(上傳/下載進度) | `send` | `send` 開頭 | 已套(原就有) |
| `:806`、`:814`(切片累計/合併完成) | `sendDataSlice` | `sendDataSlice` 開頭 | **已套**(第七輪) |
| **`fdDownload`** | `downloadNodejs` 入口 | `downloadNodejs` 開頭以 `isestr` 檢核後即拒絕 | **已套(第九輪)** |

> **run02(2026-10-13)**:前兩列之補預設由兩處手寫收斂為呼叫層級之 `ctx.wrapProgress` 一處(帳本 R27 之進度出口,兼 R13 之拋錯保護與「中止後不呼叫」);站點(`send`、`sendDataSlice`)不變,擁有者由 2 個變 1 個。

**第九輪新增之站點(`fdDownload`)**:本條原只盤點 `cbProgress`,而規則陳述為「公開方法之**選用參數**,凡有直接使用之處,該處須自行補預設」。`download` 之 `opt.fdDownload` 同屬選用參數且同樣被直接使用,未給時 `fs.mkdirSync('')` 拋 `ENOENT: no such file or directory, mkdir ''`(實測 `tmp/probe_r9_hostile.mjs` E1),再經 `send` 之重試鏈重試 `retryDownload` 次(預設 2,含 1.0s + 1.78s 退避)後才以 ENOENT 訊息失敗 —— **呼叫端不會知道是自己沒給參數**。屬「可證明不需重試」(結果僅由 client 自身參數決定),應於入口即以明確訊息拒絕。

**與 R13 之分工**:本條管「參數缺漏」,R13 管「呼叫時拋錯」。`:523`/`:539` 兩格本條已套(有補預設)而 R13 未套(拋錯無保護)—— 兩條規則各管一半,不可互相假設。

**機械化保護**:`test/api-optionsNumericString.test.mjs` 之「三個公開方法省略選用之 cbProgress 時行為須一致」。

> **為何六輪沒發現**:**全部 18 處既有 upload 測試都寫了 `() => {}`** —— 測試取自使用範例,而範例一律帶著該參數。這一格是被自己的 fixture 遮住的,不是被漏列的。

---

### R10 取因表達式一律經 getErrorMessage,且保護函數內「非做不可」之事排最前

**規則**:凡於 catch 或錯誤回呼內把 `err` 轉成字串以組訊息者,一律用 wsemi 之 `getErrorMessage(err)`。禁用 `err.message`、`get(err,'message',err)`、`get(err,'message',String(err))`、`String(err)`、以及把 `err` 直接放進樣板字面量。
**另加一層結構保證**:保護函數內唯一「非做不可」之事(settle 該請求之 pm、把授權結果歸為不通過)須排在**回報之前**。

**why**:`err` 是應用端 `throw`/`reject` 的**任意值**,不限於 Error。其 `message` 可為會拋錯之 getter、`toString` 可拋錯、本身可為已撤銷之 Proxy。取因那一行因而會**在 catch 內再拋**,使外層 try 形同虛設。取值層(`getErrorMessage` 契約上不拋錯)擋住這一類;但保護函數內若還有其他會拋錯的步驟,排在其後的 settle 仍會被跳過 —— 故第二層是**順序**,不是檢查。

**實測後果(修正前,`tmp/probe_r7_errvalue.mjs`)**

| 注入點 | 修正前 | 修正後 |
|---|---|---|
| `verifyConn` 拋惡意值 | **裸 HTTP 500,0 則 error 事件** | HTTP 200 + `permission denied` 封包 + 一則事件 |
| download 監聽器拋惡意值 | **請求永久懸置**(探針 90s 逾時;路由層已關閉 server/socket 逾時,無兜底) | HTTP 200 + 錯誤封包 + 一則事件 |

懸置之機制:wsemi `evem.mjs` 之 `report` 以 `try{...}catch(e){}` 包住 `funGetListenerError`,組訊息拋錯被吞掉,**其後的 `pm.reject` 整段不執行**。而該自訂函數存在的理由,`WConverhpServer.mjs` 的註解上寫得清清楚楚是「一併 reject 使前端收到回應而非永久懸置」。`checkConn` 同理 —— 它存在的理由是「六路由對同一種失敗一律回 permission denied」,而它自己的 catch 把例外再拋了出去。

**盤點指令**
```bash
grep -nE "get\((err|e|res), '(message|stack)'|\b(err|e|res)\.(message|stack)\b|String\((err|e|res)\)" src/*.mjs   # 扣掉註解後須為 0(第十一輪錨點加入 res: client 之 send 曾以 get(res,'stack') 兜底, 變數叫 res 而躲過原指令, A 卷 §①-1.4; 另原文之 \b 曾被存成 0x08 控制字元而使指令不可複製, 已改為字面)
grep -c "getErrorMessage(" src/*.mjs                                                            # 剝註解後合計須為 29(第十輪 19 → 28, 第十一輪 28 → 30, run02 30 → 29;裸 grep 會多計註解行,權威判定在 unit-ruleSites)
```
**第一條指令裸跑會得 5,全為假陽性**:四處為 `console.log(..., err) //使用err.message會過於簡化...` 之**行尾註解**,一處在 `attempt.mjs` 之區塊註解內。權威判定在 `test/unit-ruleSites.test.mjs` 之 `stripCode`(剝除註解後為 **0**),**不要拿裸 grep 的結果下結論** —— 與 R8 曾發生之情形同型(盤點指令自身有假陽性而宣稱須為 0)。
**注意**:本專案檔案為 CRLF。以 `'
'` 分行會使每行尾端留 `
`,而 JS 的 `.` 不跨行終止符,行尾註解的正規式會因 `$` 錨不到而**整條失效**(踩過一次,誤報 3 個假陽性)。分行須用 `/
?
/`。

**站點數:29(已套 29 / 未套 0)** —— run02 30 → 29(client 之 cbProgress 拋錯保護兩處收斂為 `ctx.wrapProgress` 一處 −1);第九輪 14 → 19;第十輪 19 → 28(server 之請求端值進樣板 ×3、建構期失敗 ×2、`internal` ×1;managerMergeSlices 之 `removeStateFile` ×1 與 queueId 樣板 ×1;client 之 JSON 序列化 ×1);第十一輪 28 → 30(server 之 `failPayload` +1、`readOutput` 統一三路由之欄位失敗訊息而取代 `/dwgf` 與 `/dw` 之 fileSize 樣板 −1;client 之 `classifyFailure` +1(取代 `get(res,'stack')`,`attemptFailed` 之事件值亦經之)、`downloadBrowser` 之 getToken 拋錯 +1)。本數為總量鎖(維護提示),「禁用寫法為 0」那條才是擁有者鎖

| 站點 | err 之來源 | 應用端可控 |
|---|---|---|
| `WConverhpServer.mjs` `funGetListenerError` | 應用端監聽器 throw / reject 之值 | **是** |
| `WConverhpServer.mjs` `checkConn` | 應用端 `verifyConn` throw / reject 之值 | **是** |
| `WConverhpServer.mjs` `/main` payload ×2、`/slc` 寫入 ×1、`/slc` payload ×1、`server.start` ×1 | node / hapi 之 Error | 否 |
| `managerMergeSlices.mjs` ×4 | fs / hash / worker 之 Error | 否 |
| `buildDownloadSource.mjs` ×2 | 其一由 `err && bMismatch` 守衛保證為套件自產 Error | 否 |
| `attempt.mjs` ×1 | 觸碰應用端值時之例外 | **是**(已於第六輪套) |

不可控者一併收斂之理由:**規則以類別為單位,不以「今天打不打得到」為單位**。留著就是留一個下次會被複製的樣板。

**第九輪之擴充:被求值的不只是 `err`**

本條原句為「凡於 catch 或錯誤回呼內把 **`err`** 轉成字串以組訊息者」,禁用清單亦全部以 `err` 為對象。但**任何應用端可控值進入樣板字面量都會觸發同一件事** —— 樣板會對其求值(`ToPrimitive` → `Symbol.toPrimitive` → `valueOf` → `toString`),任一步拋錯即逸出。

實測(`tmp/probe_r9_hostile.mjs` B1–B4):

| 值之形狀 | `` `invalid fileSize[${v}]` `` | 對照:`` `${getErrorMessage(v)}` `` |
|---|---|---|
| `toString` 拋錯 | **拋錯** | 未拋錯 |
| `Symbol.toPrimitive` 為拋錯之 getter | **拋錯** | 未拋錯 |
| `Object.create(null)` | **拋錯**(`Cannot convert object to primitive value`) | 未拋錯 |

**新增站點 2 處(第九輪皆已套)**:

| 站點 | 值之來源 | 後果 |
|---|---|---|
| `/dwgf` 之 `invalid fileSize[...]` 樣板 | 應用端 `download` 事件回傳物件之欄位 | 曾使該行拋出 → 逸出 handler → **裸 HTTP 500 + 0 則事件**(而 `destroyStreamRead` 已於前一行執行,故串流已清、只有回應壞掉)。**已套(第九輪)**:改經 `getErrorMessage` |
| `/dw` 之同一表達式 | 同上 | 同上,**已套(第九輪)** |

**規則之修訂**:禁用對象由「`err`」擴大為「**任何應用端或請求端可控之值**」。同路由之 `fileType`、`filename` 未進樣板故安全。

> **⚠ 第十輪更正 —— 原記之豁免理由為假**:原文為「`mode`、`fileId`、`queueId` 等來自 `JSON.parse` 產物,結構上不可能帶拋錯 getter,列刻意不套」。**不需要 getter**:`JSON.parse('{"toString":1}')` 之自有屬性 `toString` 為非函數值,樣板求值時 `OrdinaryToPrimitive` 找不到可呼叫之 `toString`/`valueOf` 即拋 `Cannot convert object to primitive value`。
> 實測(`tmp/probe_r10_json.mjs`、兩份外部複審之 P1):`/ulctr` 之 `{"mode":{"toString":1}}` → **裸 HTTP 500 + 0 則事件**;`queueId` 同形 → 錯誤封包內容為內部 `TypeError` 字面 + 0 則;`/main` 之頂層陣列 `[{"toString":1}]` → 裸 500。
> 教訓同 R12 之「由某某代為處理」:**「結構上不可能」這種斷言必須實測過才能寫**,否則它就是一條把站點排除在盤點之外的假理由。

**第十輪之站點(皆已套,改經 `getErrorMessage`)**

| 站點 | 值之來源 |
|---|---|
| `/ulctr` 之 `invalid mode[...]`(於檢核前進樣板) | 請求 JSON |
| `/main` 之 `invalid request packet for apiMain: ...`(解碼成功但非物件者) | 請求本體(A1,兩份複審獨立發現) |
| `/main` 之 `execute func[...] output can not be serialized` | 請求本體 |
| `managerMergeSlices` 之 `invalid queueId[...]`(原另有 `invalid id[${id}]` 分支,已併入並補 reason 使兩者事件則數一致,A2) | 請求 JSON |

`fileId`(三路由)經 `isestr` 檢核後才進樣板,`isestr` 對 JSON 產物無從偽造 `Symbol.toStringTag`(JSON 無 Symbol 鍵),列刻意不套 —— 此理由已以探針驗證。

**盤點指令(修訂)**
```bash
# 除既有兩條外, 另掃「應用端或請求端值直接進樣板」(第十輪更正: 原指令 'invalid fileSize\[\${' 對修正後之寫法 ${getErrorMessage(fileSize)} 亦命中, 恆不為 0, 無分辨力)
grep -n 'invalid fileSize\[\${fileSize\|invalid mode\[\${mode\|\${get(inp, .func\|\${get(rdInp, .msg' src/WConverhpServer.mjs   # 須為 0
grep -n 'invalid id\[\${id' src/managerMergeSlices.mjs | grep -v "^[0-9]*:\s*//" | wc -l                                          # 須為 0(修正前為 1; 須排除註解行 —— qGet 之註解記載了原寫法; S4 之 reason 內之 queueId[${id}] 已通過 isSafeId 檢核而為字串, 故不可一併搜 queueId\[)
```

> **為何第七輪沒發現**:第七輪為本條建的軸是「**12 種惡意 err 形狀 × 2 個注入點**」,注入點取自當時那兩個活缺陷(`verifyConn` 與監聽器)。`fileSize` 不是 `err`,不在那條軸上。**又是「軸取自缺陷,不取自契約」**(見 `sgud/exp/experience.md` 之 E1)。

**機械化保護**:`test/unit-ruleSites.test.mjs` 兩條(禁用寫法為 0、站點數 14、以及兩個保護函數之順序);`test/api-hostileErrorValues.test.mjs` 以**12 種惡意形狀 × 2 個注入點 × 3 條路由**驗證行為(分辨力:修正前 5 failing / 1 passing)。

> **本條之由來**:第六輪的 R1 已經**逐字寫下**「該處若用 `get(err,'message', String(err))` 會於 catch 內再拋」,但那條規則只套進了 `attempt` 一處 —— **規則進了帳本,規則的站點清單沒有進帳本**。R1 的盤點指令只掃 `get(r, '` 與下載來源觸碰,取因表達式從未被列舉。第七輪把它列出來,12 個站點裡有 2 個是活的缺陷。
>
> 測試為何全綠:`api-verifyConnError` 丟的是 `new Error('verifyConn threw')`,`api-downloadEvents` 丟的是 `new Error('listener boom')` —— **都是當初那個缺陷的形狀**。軸取自缺陷,不取自契約。

---

### R11 事件一律於呼叫端堆疊上派發;監聽器須為同步

**規則**:
1. 派發一律於**呼叫端之堆疊上**直接 `ev.emit`,並以一個普通的 `try` 攔截監聽器之同步拋錯。**不得以 `setTimeout` 脫勾派發** —— 唯一例外是建構期之失敗事件,以 `evEmitDefer` 表達。
2. **監聽器須為同步函數**,不可為 `async`、不可回傳 promise。非同步結果一律以事件所帶之 `pm` 回覆。

**why —— 三種派發方式之實測**(`tmp/probe_r8_core.mjs`,同一組惡意監聽器,看呼叫端能否用一個普通 `try/catch` 接住):

| 做法 | 同步拋錯 | async reject |
|---|---|---|
| A `setTimeout` + `ev.emit`(原作法) | **殺行程** | **殺行程** |
| B 拿掉 setTimeout,直接 `ev.emit` | **呼叫端接住** | **殺行程** |
| C 於堆疊上 `await` 監聽器 | 接住 | 接住 |

兩個**獨立**的成因:

- **堆疊被切斷** —— `setTimeout` 開了一個沒有呼叫者的堆疊,監聽器之同步拋錯即為 uncaughtException,呼叫端無論如何 try 都攔不到。**與 async 無關**:A 的第一格就是純同步監聽器。
- **回傳值被丟棄** —— `emit` 依 EventEmitter 規範不看監聽器回傳什麼,async 監聽器之 rejection 無人持有 → unhandledRejection。**與 setTimeout 無關**:B 拿掉了 setTimeout,這一格照樣紅。

**裁定**:採 B,並**裁定不支援 async 監聽器**(2026-09-10)。理由:①事件簽章已帶 `pm` 作為回覆通道,監聽器再回傳 promise 即同一次呼叫兩條回覆通道,而 EventEmitter 對第二條沒有任何契約(Node 文件明載 async handler 有問題、`captureRejections` 為 opt-in、eventemitter3 未提供);②實際衝擊為 0 —— 全專案 `srv.mjs` 與所有測試共 86 個監聽器,**async 者為 0**,唯一使用者是驗證該承諾之測試 fixture 本身;③採 C 就得保留「取 listeners、處理 once、檢視回傳值」那整套自製機械,而該機械**本身會長洞**(見下)。

**建構期為何仍需延遲**(`tmp/probe_r8_defer.mjs`):

| 應用端註冊時機 | 直接 emit | setTimeout 包 |
|---|---|---|
| 建構後**同步**註冊(本專案寫法) | 1 | 1 |
| 建構後隔一個 `await` 才註冊 | **0** | 1 |

`startServer()` 之 `.catch` 本就在 promise 鏈上,故同步註冊者直接派發亦收得到;但隔一個 await 才註冊者收不到,延遲一輪即可涵蓋。**33 個派發站點中只有這 1 個需要延遲**,其餘皆於請求進來後才觸發,延遲對其毫無作用。

**實作:交由 wsemi 之 `evEmit` / `evEmitDelay`(1.8.92 起公開匯出)**

該兩者即「於呼叫端堆疊上直接 `ev.emit` 並以 try 攔截」之單一擁有者,且把本套件所需之紀律全部寫成**明文契約**:settle 排在通報之前(其 JSDoc 明載「此順序為明文要求,不得對調」)、通報自身亦包 try 並留痕、脫勾後仍於新堆疊內攔截、`ms` 夾至計時器上限。自行手寫等於把同一條規則寫第二遍,而規則寫兩遍正是本帳本各條重複出現之形狀。

本套件只補兩件 wsemi **明載不代為猜測**的事:

| 補什麼 | 為什麼 |
|---|---|
| `funSettle` | wsemi 不猜測 pm 之位置;本套件之 pm 為事件之**最後一個參數**。不傳即等於沒有 settle,監聽器出錯時該請求懸置 |
| `funEmit`(形狀轉接器 `funEmitOfPkg`) | wsemi 之通報形狀為 `{fun,name,msg,args}` **物件**,而本套件 `error` 事件之對外契約為**字串訊息**。須經 `funEmit` 轉換而非另發一則,否則同一次失敗會有兩則事件(違反 R5) |

**盤點指令**
```bash
grep -c "evEmitBase(" src/WConverhpServer.mjs src/WConverhpClient.mjs   # 須各為 1(派發擁有者)
grep -c "evEmitDelayBase(" src/WConverhpServer.mjs                      # 須為 1
grep -c "ev\.emit(" src/WConverhpServer.mjs src/WConverhpClient.mjs     # server 須為 2(皆於 funEmitOfPkg 內), client 須為 0
grep -c "evEmitDelay('" src/WConverhpServer.mjs                         # 須為 4(皆為建構期; 其位置須在路由定義之外, 由 unit-ruleSites 逐一斷言; 第十二輪 +1: errsOpt 之派發迴圈)
node tmp/probe_r8_core.mjs                                              # B 之同步拋錯須為「呼叫端接住」
```

**站點數:派發擁有者 2(server / client 各 1),脫勾站點 4,形狀轉接器 1 —— 以上已套;另建構期失敗 6,缺口 0(第九輪 3、第十輪 +2、第十二輪 +1)**

**本條之延伸:建構期之非同步失敗須被觀察**

規則同族 —— 凡於建構期發起而未被 await 之 promise,其 rejection 須被接住並以 error 事件通知,否則即為 unhandledRejection 而使行程崩潰。

| 站點 | 現況 | 狀態 |
|---|---|---|
| `startServer()`(`:1691`) | `.catch` → `evEmitDelay('error', ...)` | 已套 |
| **`stop()` 之 `server.stop()`** | 改為 `async`,內部 `await` 並以 try 收斂,失敗走 error 事件;回傳之 promise 恆 resolve | **已套(第九輪)** |
| **`stop()` 未等待 `startServer()`** | `startServer()` 之 promise 原被丟棄,`stop()` 於啟動未完成時呼叫即落入 hapi 之 initializing 階段而被拒 —— 實測 `new` 後立刻 `await stop()` 於 46ms 回來、發一則 `Cannot stop server while in initializing phase`,而**伺服器隨後照樣起來並持續服務**(port 可連線且回 HTTP 200);已改為保留 `pmStart` 並於 `stop()` 內先 `await` 之 | **已套(第九輪)** |
| **暫存資料夾建立失敗**(wsemi 之 `fsCreateFolder` 以回傳 `{error}` 表達而不拋) | `evEmitDelay('error', 'create pathUploadTemp[...] error: ...')` | **已套(第十輪 D7)**:原回傳值被丟棄,建構期 0 則、之後每次上傳各自失敗 |
| **曝露與存取控制選項有給而無效**(verifyConn、corsOrigins、useInert、pathStaticFiles;見 R26) | 解析時收進 `errsOpt`,於 `evEmitDelay` 定義後以單一迴圈逐則派發(一選項一則) | **已套(第十二輪)**:原為靜默退回最寬鬆之預設、0 則;其中 `corsOrigins: [123]`、`['*', x]` 與拋錯之 Proxy 型 verifyConn 原使建構子同步拋出,今皆不拋 |
| **外部 serverHapi 之路由註冊失敗**(路由衝突、apiName 非法) | try + `evEmitDelay` | **已套(第十輪 A13)**:原於建構子內同步拋出,而自建伺服器之同一失敗走 error 事件 —— 同一失敗依部署方式兩種通道 |

> **第十輪:不以包裝函數維持「脫勾站點恰為 1」**。規劃曾擬以 `emitStartupError()` 包住唯一之 `evEmitDelay`,使 `unit-ruleSites` 之數字不必改;兩份外部複審皆指出這會使鎖**名存實亡** —— 鎖住的變成「包裝函數存在」,日後在請求路徑呼叫該包裝函數不會紅。已改為三個站點各自直接呼叫,測試逐一斷言其位置在路由定義之外。**「數字不必改」不是優點,是鎖被繞過的訊號。**

> **本組之教訓**:第九輪修 `stop()` 時只登記了「未 await `server.stop()`」與「不回傳 promise」兩個缺口,交外部複審後才被指出**第三個** —— 而第三個才是使「呼叫端以為停了、其實沒停」的那一個。前兩個缺口都在 `stop()` 這個函數**之內**,第三個在它**之外**(建構期丟棄了一個 promise)。修某個函數時,只看它自己不夠,要看它依賴的狀態是誰建立的。

`stop()` 之缺口有二:①`server.stop()` 回 promise 而未接,一旦 reject 即 unhandledRejection;②不回傳 promise,呼叫端無從得知何時真正停止(測試中 `wo.stop()` 之後立即結束時,伺服器可能仍在關閉)。**兩者須一併處置** —— 只改其一時,「回傳 promise 但其 rejection 由呼叫端負責」與「不回傳但內部以事件通知」是兩種互斥的契約,選一種並寫清楚。

**結構層**:settle 排在通報之前這一條已由 wsemi 擁有並明載;本套件之責任縮為「**把 `funSettle` 傳進去**」。`checkConn` 之 `m = false` 須早於其通報則仍由本套件擁有。

**機械化保護**:`test/unit-ruleSites.test.mjs` 之 R11 兩條;行為面由 `test/api-processSafety.test.mjs`(含新契約之正向鎖定)與 `test/api-hostileErrorValues.test.mjs` 覆蓋。

> **本條之兩個教訓**
>
> **其一:對外承諾了一件由相依套件實作的事。** 本套件 JSDoc 承諾「監聽器同步拋錯或 async reject 皆由套件攔截,不會使伺服器行程崩潰」,而那是靠 wsemi 之 `evem({type:'safe'})` 兌現的。wsemi 1.8.91 基於規範考量移除該能力(且該移除是對的),承諾即落空 —— 落空的形式是**整個測試行程中斷**,不是編譯錯誤,也不是某個測試變紅。
>
> **其二:自製保護層自身會長洞,而且長的是同一類的洞。** 落空後我先寫了一個 `emitSafe`(取 listeners 逐一呼叫、處理 once、檢視回傳值以觀察 async rejection),隨即以審 wsemi 的同一套規則自審,**一小時內在自己的新模組裡找到四個洞**,其中三個(`ispm` 觸發 `Symbol.toStringTag`、已撤銷 Proxy、`then` 呼叫時拋錯)**是保護層自己去碰應用端回傳值才產生的** —— 原本的 `emit` 根本不碰那個值,那三個洞在未加保護時並不存在。
>
> 這就是「修不完」的具體形狀:補洞補的是「手工重建呼叫堆疊」的枝節,而不是那個切斷堆疊的決定。**正解是把堆疊接回去,不是把守衛補齊。** 接回去之後,`emitSafe`、`ispm` 檢視、`once` 處理、「settle 須排在通報之前」的那條順序規則所保護的整個表面,一起消失。
>
> **其三:自有能力該由誰擁有,判準是「有沒有公開契約」,不是「哪邊寫得比較好」。** 第七輪我拒用 wsemi 之 `_evemEmit`,理由之一是它未由 index 匯出 —— 依賴一個 `_` 開頭的私有檔來兌現本套件的公開承諾,是把「其二」那個錯誤再犯一次,且犯在更沒有訊號的一層(私有檔改名連建置都不報錯)。wsemi 1.8.92 把它公開為 `evEmit` / `evEmitDelay` 之後,該理由消失,本套件即改為委派。**判準是公開契約之有無,而不是實作品質。**

---

### R12 應用端呼叫須有接聽者;一次請求之終結不得取決於應用端是否回話

**狀態:第九輪新立並於同輪修正(2026-09-10),缺口 0**。實作為 server 之 `callApp`(應用端呼叫之唯一出口),`WConverhpServer.mjs` 之 `procApp` 取代原 `procDeal`/`procUpload`/`procDownload` 三份複本

**規則**:凡以事件呼叫應用端並等待其 `pm` 回覆者(`execute`、`upload`、`download`),派發前須確認**該事件有接聽者**;無接聽者即以錯誤封包回應並發一則 error 事件,不得等待一個不存在的回覆。

**why**:路由層刻意關閉 `timeout.server` 與 `timeout.socket`(大檔傳輸本就超過任何固定值),宿主的兜底因此不存在;而套件未自建替代出口。實測(`tmp/probe_r9_hang.mjs`、`probe_r9_hang2.mjs`):

| 情境 | 結果 |
|---|---|
| 未註冊 `execute` → `/main` | **6000ms 未回應,0 則事件** |
| 未註冊 `download` → `/dw` | **未回應,0 則事件** |
| 未註冊 `upload` → `/ulctr` merge-slices-get | **未回應**,且 `managerMergeSlices` 之 `consuming` Map **永久保留**一個永不 settle 之 promise(其 `.finally` 不執行) |
| 對照組:正常註冊 | HTTP 200,10ms |

對標:Node 之 `emit('error')` 無監聽器即拋、hapi 對 handler 回傳 `undefined` 即拋 `handler method did not return a value`、gRPC 回 `UNIMPLEMENTED` —— 三者皆認定「沒人接」須立即終結。

**判準不可用 `evEmit` 之回傳值**(實測 `tmp/probe_r9_emitret.mjs`):

| 情境 | `evEmit` 回傳 | funSettle | error 事件 |
|---|---|---|---|
| 完全無監聽器 | `false` | 0 | 0 |
| 有監聽器但同步拋錯 | **`false`** | 1 | **1** |
| 有監聽器且正常 | `true` | 0 | 0 |

`wsemi/src/evEmit.mjs:107` 於監聽器拋錯之 catch 分支亦 `return false`,與「無監聽器」不可分辨;而拋錯那格已由 `funSettle` settle 過且已發一則事件,以回傳值判定會**再發一則**而違反 R5。**須於派發前以 `ev.listenerCount(name) === 0` 判定**(`listenerCount` 為 eventemitter3 公開 API,`wsemi/src/evEmit.mjs:92` 自身即依賴之;對「`once` 已消費」回 0 為正確語意,對「監聽器執行中移除自己」因判定在派發前而不受影響)。

**盤點指令**
```bash
grep -c "listenerCount(" src/*.mjs | grep -v ":0"     # 須僅 src/WConverhpServer.mjs 為 1(callApp 於第十一輪依 R20 併入 server, 仍為判定之唯一擁有者)
grep -c "callApp(" src/WConverhpServer.mjs            # 須為 2(函式定義 1 + procApp 內之唯一呼叫 1; 併入前為 1)
grep -nE "evEmit\('(execute|upload|download)'" src/WConverhpServer.mjs   # 須為 0: 三個 RPC 事件不得繞過 procApp 直接派發
node tmp/probe_r9_hang.mjs                            # A/C 須為 HTTP 200 + 1 則事件; B 須維持懸置(已裁定為呼叫端責任)
```

**機械化保護**:`test/api-noListener.test.mjs`(6 條,軸 = 三個 RPC 事件 × 其入口,下載路由成員取自 `test/tools/api-axes.mjs` 遵 R8)。分辨力已驗 —— 同一支探針 `tmp/probe_r9_hang.mjs` 修正前為「6000ms 未回應 / 0 則事件」,修正後 `/main` 24ms、`/dw` 5ms,各回 HTTP 200 + error 封包 + 一則事件。該檔另含兩條對照組:①正常註冊須成功且 0 則事件 ②**監聽器同步拋錯時仍須只發一則**(此條專門擋住「以 evEmit 回傳值判定」那個錯誤修法 —— 該修法會使此格變兩則)。

**站點數:6(已套 6 / 未套 0 / 刻意不套 2)** —— 第十一輪更正(A 卷 A5):本表原仍逐列標「未套」、合計行寫「已套 0 / 未套 6」,與狀態行「缺口 0」矛盾;實作(server 之 `callApp` 為唯一擁有者)與測試(`api-noListener`)早已到位,屬散文過期

| # | 事件 × 入口 | 狀態 |
|---|---|---|
| 1 | execute × `/main` | **已套(第九輪)** |
| 2 | upload × `/ulctr` check-total-hash | **已套(第九輪)** |
| 3 | upload × `/ulctr` merge-slices-get | **已套(第九輪)**(`consuming` 之 promise 隨之終結) |
| 4 | download × `/dwgfn` | **已套(第九輪)** |
| 5 | download × `/dwgf` | **已套(第九輪)**;第十一輪起回 404(`routeSpec.dwgf.statusOf.app`) |
| 6 | download × `/dw` | **已套(第九輪)** |
| — | `handler` 事件 | 刻意不套:不帶 pm,無人接聽不影響回應 |
| — | `error` 事件 | 刻意不套 —— 理由見下方「error 事件無人接聽之裁定」 |

**⚠ 本表原記之理由為假(第九輪外部複審指出並實測)**:原文為「刻意不套:無人接聽時由 wsemi 走 `console.error` 留痕」。實測 —— `wsemi/src/evEmit.mjs` 之 `console.error` 整段位於 `catch (err)` 內,**只在監聽器拋錯時可達**;無監聽器時 `:75` 之 `emit` 正常回 `false`,catch 從不執行,stdout/stderr **0 行**。該說法把 client 註解裡的「其 error 監聽器**出錯**者走 console.error」抄成了「**無人接聽**時」。教訓:帳本裡「由某某代為處理」這類把責任推給相依套件的理由,**必須實測過才能寫**(E15 之同型)。

**error 事件無人接聽之裁定(2026-09-10):不加 console 退路**

事實(`tmp/probe_r9_errsink.mjs`):server 端 26 個 error 站點,應用端未註冊 `error` 監聽器時全部靜默;eventemitter3 對無監聽器之 `error` 回 `false` 不拋錯(node 原生 EventEmitter 則拋)。

**不做之理由**:

1. **R12 之分界線是必要條件,不是充分條件。** 「能在確定時點判出來」只排除了做不到的情形,不蘊含「凡判得出來就該做」—— 本表之 `handler` 一列即為反證:`listenerCount('handler')` 一樣判得出,照樣刻意不套,因為**沒有東西壞掉**。`execute` 無人接聽時套件有「在途請求」這個**自己的未了義務**,且補救走既有通道(錯誤封包);`error` 之 `emit` 已同步執行完畢,套件無未了義務,補救需要一條**契約外、呼叫端無法改道**的新通道。
2. **@returns 逐字檢視後未有承諾落空**:動詞一律為「發 / 以…通知」,受詞一律為「事件」,且「**可**監聽」為明文 opt-in;無任何一句承諾留痕、可見或不遺失。
3. **可逆性不對稱(決定性)**:不做 → 想要輸出者寫一行 `wo.on('error', console.error)`,那是本 API 的正常用法;做 → 想要安靜者只剩「註冊一個空監聽器去騙 `listenerCount`」這種變通。而「刻意不聽」與「忘了聽」不可分辨 —— 依 R12 之精神,不可分辨之事由**有權決定者畫界**,而那條界本來就在應用端手上(註冊與否)。
4. 「診斷全部消失」須收窄:26 格中 19 格另有**請求端**這個受眾(錯誤封包帶訊息),唯一以事件為唯一受眾者為合併佇列之兩格,其中一格之「不回傳前端」本身即刻意設計。

**已排除之其他做法**:建構期報一次(偽陽性率 100%,且以現在斷言未來,違 E3c)、首次派發後 latch(只降噪不解決)、`stop()` 彙總(不保證發生)、新增開關(把今天的行為變成一個要維護的組態態)。

**不採用「測試會被 console 噴爆」作為理由** —— 實測 41 檔僅 1 檔會噴共 2 行、0 檔變慢、0 檔變紅。理由要站得住腳,不能拿站不住的來湊。

**「監聽器註冊了但不 settle pm」不屬本條 —— 裁定為呼叫端責任**(2026-09-10):

分界為**該事實之資訊在誰手上**:「無接聽者」是 `ev.emit()` 已同步回傳、值已在套件手上只是被丟棄;「不 settle」則在應用端函數體內,套件只能裝計時器並猜一個值。後者與「以匿名函數持有參照而使物件無法 GC」同類,無任何函式庫會為此裝設監測;且強制逾時將與「刻意關閉 server/socket 逾時」「不替使用者決定次數與頻率」兩條既定設計牴觸。**連 JSDoc 警語都不加** —— 加警語等於宣稱套件對此有責任。故不列缺陷、不寫測試。

### 本條之分界線(2026-09-10 裁定,適用於全部「請求永不終結」之形狀)

**判準**:**套件須能在確定時點、只用手上的值、不挑任何時間長度把它判出來。**

**本判準為必要條件,不是充分條件。** 它只回答「這件事套件**有沒有資格**負責」——判不出來即一定不是套件責任;判得出來則還要再問**第二個問題**:

> **套件對這件事有沒有一個自己的未了義務?** 有(如「有一個在途請求還沒回應」)才是套件責任,且補救應走**既有通道**;沒有(事情已經同步做完了)則不是。

反證在本表內:`handler` 事件之 `listenerCount` 一樣判得出,卻刻意不套 —— 因為沒有東西壞掉。把必要條件當成充分條件,會推導出「凡判得出來的都要管」,那是本輪差點犯的錯(見下方「error 事件無人接聽之裁定」)。

「請求永不終結」共五種形狀,判定如下:

| 形狀 | 套件如何得知 | 與之**不可分辨**之合法形狀 | 判定 |
|---|---|---|---|
| **N1 完全未註冊監聽器** | `ev.listenerCount(name)` 回 0 —— **現在的狀態** | 無 | **套件責任,修** |
| N2 註冊了但忘記呼叫 pm | 只能裝計時器 | 監聽器很慢但正常 | 呼叫端責任,不修 |
| N3 `verifyConn` 回永不 settle 之 promise | 只能裝計時器 | `verifyConn` 很慢但正常 —— **本檔 JSDoc 範例內即有 `await w.delay(3000)`** | 呼叫端責任,不修 |
| N4 監聽器 `pm.resolve(一個 pending promise)` | 可同步得知「resolve 了 thenable」,但那是**合法用法** | 該 promise 只是稍後才 settle | 呼叫端責任,不修 |
| N5 應用端串流永不 `end` | pipeline 回 `ERR_STREAM_PREMATURE_CLOSE` | **使用者主動取消下載**(實測 `tmp/probe_r9_n5.mjs` 之 A 與 E:錯誤碼相同、來源皆 `destroyed=true`、事件皆 0 則) | 呼叫端責任,不修 |
| **N6 前端於 handler 訂閱本體事件前即中斷**(第十二輪新列) | 訂閱時 `req.payload.destroyed` 已為真 —— **現在的狀態** | 無(本體送達但未讀取者並非 destroyed,已以對照組實測) | **套件責任,修(第十二輪)**:套件有自己開的 fd 與在途 handler(未了義務) |

**分界線在 N1(及第十二輪之 N6)與其餘四者之間,不在 N2 與 N3/N4/N5 之間。** N1 判的是**現在的狀態**;N2–N5 判的都是「**永遠不會**」—— 對無限未來的斷言,而任何有限時點都與「還沒好」不可分辨。E4 之「資訊在誰手上」即為此句之另一種說法。

**N2–N5 一律不修、不寫 JSDoc 警語、不寫測試。** 寫警語等於宣稱套件對此有責任;寫測試等於把它收編為套件契約。

**已否決之修法(附否決理由,勿重提)**:

| 修法 | 否決理由 |
|---|---|
| **以「呼叫端消失」為終結條件**(偵測 `req.raw.res` 之 close / `request.active()`) | 「呼叫端消失」與「應用端不回話」是**獨立兩事**。實測逐格:對 N2 有效(但 N2 已裁定不修)、N3 無對象(`checkConn` 之 `await m` 沒有 pm 可 settle)、N4 為 no-op(`resolve(thenable)` 後 reject 無效)、N5 無增益(來源現況已 `destroyed=true`)。**真正關上的唯一一格,就是已裁定不修的那一格。** 另:三條 RPC 路由中斷時套件**沒有自己的資源**要清(不同於 `/slc` 之 `onAbort`,那清的是套件自己開的寫入 fd),故「對稱破缺」之論證不成立 |
| 於 `buildDownloadSource` 之 pipeline callback 對 `ERR_STREAM_PREMATURE_CLOSE` 發事件 | **每一次使用者取消下載都會變成一則 error 事件**(實測 A 與 E 不可分辨),且與 `:120` 之既有刻意設計「來源自身出錯或前端中斷則不另報」直接牴觸 |
| 強制逾時 / 可選逾時選項 | 與「刻意關閉 server/socket 逾時」及「套件不替使用者決定次數與頻率」牴觸 |
| 契約由 settle pm 改為回傳值 | 回傳值一樣可為永不 settle 之 promise,對五格零效益;且須自建派發機制,重蹈 R11 教訓其二 |

**唯一可處理 N2–N5 者為「期限傳遞」**(client 把自身 `opt.timeout` 以標頭傳給 server,server 據以設該次請求上限)。其之所以可行,正是因為它**不試圖判斷**「永遠不會」,而是讓呼叫端畫線 —— 不可分辨之事,本就該由有權決定者畫界。業界慣例為 gRPC 之 `grpc-timeout` 標頭(HTTP/REST 無統一標準,多用 `x-deadline` 類自訂標頭)。**代價**:①會一併終結已裁定不修之 N2 ②`timeout: 0`(套件明載之「不逾時」語意)時整個機制失效 ③新增協定表面。**列為獨立提案,不在第九輪範圍。**

### R12 之第十二輪延伸(2026-10-13):上傳管線之受理點;admit 期間之中斷;在途消費之跨實例隔離

**規則之延伸**:**受理新上傳工作之請求**(`/slc`、`/ulctr` 之 check-total-hash、check-slices-hash、merge-slices-push)於任何副作用前須確認 upload 有接聽者;無者回錯誤封包 `no listener for event[upload]`(不標 retryable:接聽者可能稍後註冊,屬狀態不穩)並發一則事件。**已承接工作之查詢、結果回放與狀態復原**(merge-slices-get:S3 回放、S2 在途共用、S7/S6 補標記)不經閘門,需派發應用端者(S2 未派發)由 callApp 於派發點判定。順序:權限(admit)→ 路由層參數 → 接聽者 → 副作用;worker 內檢核之參數(fileSize、fileSliceHashs)在閘門之後(明載於 `requireListener` 註解)。

**why**:上傳管線之前段請求不派發事件,原本無人接聽時照樣落檔並回 success —— verifyConn 未給時任何匿名請求皆可寫入 pathUploadTemp(切片任意數量;push 於切片不在時亦寫 `<fileHash>.error`),不用上傳者永遠不會清理;client 之 `upload()` 亦把整檔傳完、合併完(留下合併檔與 `.done`)才於 merge-slices-get 失敗。對標:S3 之 UploadPart 須先 CreateMultipartUpload(否則 `NoSuchUpload`)、tus 之 Creation 先以 POST 建立資源(超量回 413)—— 受理不了就在傳任何資料前失敗。本套件無 session,每片皆重判,故上傳途中才移除接聽者者留下可續傳之切片(已知取捨)。

**單一擁有者**:頂層 `noListenerOf(ev, name)` 為全檔唯一呼叫 `listenerCount` 之處,`callApp` 與 `requireListener` 共用。閘門之事件名取 `routeSpec.<路由>.event`(第十二輪新欄),派發之事件字面(`procDeal`/`procUpload`/`procDownload` 之 `procApp` 第一參數)須與之相等 —— 兩者為同一事實之兩份來源,由 `unit-ruleSites` 斷言一致(B 卷 ③-D5)。

**站點(閘門)**

| # | 入口 | 狀態 |
|---|---|---|
| 7 | `/slc`(packageId 檢核後、`createWriteStream` 前) | **已套(第十二輪)** |
| 8 | `/ulctr` check-total-hash | **已套(第十二輪)** |
| 9 | `/ulctr` check-slices-hash | **已套(第十二輪)** |
| 10 | `/ulctr` merge-slices-push | **已套(第十二輪)** |
| — | `/ulctr` merge-slices-get | 刻意不套:已承接工作之查詢與回放。S3 之儲存結果回放不呼叫應用端(重送冪等);S2 在途消費由同隊列共用(實測 `once` 已消費、listenerCount 為 0 時第二個併發查詢仍須共用在途結果);擋下即使已處理完之上傳於回應遺失後之重送變失敗 |

**站點(N6:前端於 handler 訂閱本體事件前即中斷)**:`/main`、`/slc` 皆於 `await admit` 之後才訂閱 end/error/close;前端於 verifyConn 等待期間中斷者,那些事件已發過而不會再發 → handler 永不終結、0 則事件,`/slc` 另漏寫入 fd 與殘片(實測 `tmp/r12/probe_abort_admit.mjs`;C 卷 ①-2)。判定為「現在的狀態」(訂閱時 `req.payload.destroyed` 已為真)且套件有自己開的 fd 與在途 handler,屬套件責任(見上表 N6)。補判:監聽註冊之後同步檢查 —— `/main` 發一則 `receive payload error: closed before receive` 並 reject;`/slc` 走既有 onAbort(中斷收尾之唯一路徑)。parse:true 之三路由由 hapi 於 handler 前讀完本體,不在此列。

| # | 入口 | 狀態 |
|---|---|---|
| 11 | `/main` | **已套(第十二輪)** |
| 12 | `/slc` | **已套(第十二輪)** |

**附:合併佇列在途消費之跨實例隔離(C 卷 ①-1)**:`consuming` 原以 queueId 為鍵,檔頭理由「不同實例撞號須同秒、同亂數、同 fileHash」只涵蓋偶然撞號 —— 他實例(不同 pathUploadTemp)以蓄意重送之 queueId 查詢、且其暫存夾亦有同一檔之合併檔時,即共用本實例之在途消費而回本實例之應用端結果(即使他實例無接聽者)。改以含絕對暫存夾之 `ps.fpr` 為鍵,同一實例內 fpr 與 queueId 一一對應,併發共用之語意不變。

**盤點指令**
```bash
grep -c "listenerCount(" src/WConverhpServer.mjs                  # 須為 1(noListenerOf 內)
grep -c "noListenerOf(" src/WConverhpServer.mjs                   # 須為 3(定義 + callApp + requireListener)
grep -n "requireListener(spec, reply)" src/WConverhpServer.mjs    # 須恰 2 處; 位置(/ulctr 於 merge-slices-get 以外之條件內且早於 procCore、/slc 早於 createWriteStream)由 unit-ruleSites 斷言
grep -n "req.payload.destroyed" src/WConverhpServer.mjs           # 須恰 2 處(/main、/slc 之 receive 內, 皆位於監聽註冊之後)
grep -n "consuming\.\(get\|set\|delete\)(" src/managerMergeSlices.mjs   # 鍵皆須為 key(= ps.fpr), 不得為 id
node tmp/r12/probe_abort_admit.mjs src                            # /main、/slc 各一則 closed before receive、/slc 無殘片
```

**機械化保護**:`test/api-uploadNoListener.test.mjs`(閘門四入口,模式取自 `test/tools/api-axes.mjs` 之 `ulctrModes`(R8);`/slc` 既有切片之內容哨兵與 `createWriteStream` 次數;S0、S2 × 無接聽者、`once` 在途共用、S3 回放、損毀 `.ro`、跨實例隔離、client `upload()`);`test/api-abortDuringAdmit.test.mjs`(N6 兩站點 + 「本體已送達」之對照組);`test/api-errorEventOnce.test.mjs` 之無人接聽列改以 `event` 涵蓋六路由(`appEvent` 保留,拋錯/拒絕兩列仍以其篩選);`test/unit-ruleSites.test.mjs` 之 R12 擁有者與位置鎖;`test/unit-routeSpec.test.mjs` 之 `event` 欄與 ulctr 模式軸(對照 src 之 mode 合法性字面與閘門豁免字面)。**分辨力已驗**:修正前新測試紅;變異「閘門擴及 merge-slices-get」使 S0、在途共用、S3 對照組轉紅;變異「consuming 鍵還原為 queueId」使跨實例格轉紅(數字見當輪回報)。

> **本條第九輪之站點表宣稱 upload 兩站點(#2、#3)以 `api-noListener` 保護,實際該檔沒有 upload 之 it**(檔頭列了而無對應 it;`no listener for event[upload]` 於 test/ 0 命中,第十二輪 A 卷 ①-11、B 卷 ①-13)—— 帳本宣稱之保護與實際不符,與 E25「被懷疑三輪的非缺陷要寫進帳本」同族之反面:**寫進帳本的保護也要能指到具體的 it**。今由 `api-uploadNoListener` 補上。

---

### R13 應用端交出之回呼一律於套件之保護內呼叫

**狀態:第九輪新立並於同輪修正(2026-09-10),缺口 0**。實作為 `WConverhpClient.mjs` 之 `cbProgressSafe`(run02 起收斂為呼叫層級之 `ctx.wrapProgress`,見 R27)

**規則**:凡套件主動呼叫應用端交出之函數(事件監聽器、`cbProgress`、`getToken`、`verifyConn`),該呼叫須在套件之保護內,其同步拋錯不得成為行程級例外。

**why**:server 側已由 `evEmit` 兌現此保證(R11,且 JSDoc 明文承諾「不會使伺服器行程崩潰」),**client 側完全沒有**。實測(`tmp/probe_r9_verify.mjs` 第 3 節):

```
uncaughtException: cbProgress boom
  at onUploadProgress   (src/WConverhpClient.mjs:523)
  at onDownloadProgress (src/WConverhpClient.mjs:539)
  at axios/lib/helpers/progressEventReducer.js:54
```

`cbProgress` 由 axios 於 progress 回呼內呼叫,其同步拋錯直接成為 `uncaughtException` → **node 行程死亡**。而同一個 `cbProgress` 於 `sendDataSlice:812/:820` 之呼叫則只會使該次 promise reject —— **同一個參數在同一個檔案內有兩種安全等級**。

**盤點指令**
```bash
grep -n "cbProgress(\|fetchToken()\|verifyConn(" src/WConverhpClient.mjs src/WConverhpServer.mjs
grep -c "getToken()" src/WConverhpClient.mjs      # 須為 1: getToken 之呼叫只在 fetchToken 內(取值 + await + undefined/null → 空字串之唯一擁有者; 處置留在兩個呼叫點)
grep -c "await ctx.callApp(() => fetchToken())" src/WConverhpClient.mjs   # 須為 2(callApiCore 每次嘗試、downloadBrowser 管理器路徑於 dwgfn 成功後); run02 起經呼叫層級之出口 ctx.callApp: 已中止即不呼叫、懸置中不再等待(R27)
```

**站點數:7(已套 7 / 未套 0)** —— 第十一輪更正(A 卷 A4):原站點 4 之括號內自承「`downloadBrowser` 為組 URL 另取一次」,而「已套」之敘述(在 async 函數內、拋錯進重試)只對 `callApiCore` 成立,**涵蓋不到第二個呼叫點**;該點無 `undefined/null` 正規化(URL 帶 `token=undefined`,伺服器 `isestr('undefined')` 為真而以 `Bearer undefined` 交 verifyConn)、拋錯原樣逸出 `download()`。教訓可轉移:**凡「已套」那一列的敘述裡出現第二個站點名,該站點就要各自有一列與各自的判準**

| # | 呼叫點 | 保護 | 狀態 |
|---|---|---|---|
| 1 | server 之三事件監聽器 | `evEmit` 之 try + funSettle | 已套(R11) |
| 2 | server 之 `verifyConn`(`checkConn`) | `checkConn` 之 try | 已套(R10) |
| 3 | client 之 `cbProgress`(`sendDataSlice` 內) | 於 `sendDataSlice` 內包裝,拋錯只留一則事件、不影響上傳結果 | 已套 |
| 4a | client 之 `getToken`(`callApiCore` 內每次嘗試一次,經 `fetchToken`) | 於 async 函數內,拋錯為該次嘗試之失敗而進入重試(每次嘗試恰一則事件,見 R5) | 已套(第十輪 F11) |
| 4b | client 之 `getToken`(`downloadBrowser` 管理器路徑,經 `fetchToken`,於 `/dwgfn` 成功後、導覽前) | 呼叫點之 try:拋錯為入口失敗,一則事件 + 拒絕 `download()`;`undefined/null → ''` 由 `fetchToken` 統一 | **已套(第十一輪 N2、N2')**;`test/e2e-download.test.mjs`(真 Chromium)鎖 URL 不含 `undefined` 與取用順序(dwgfn 帶第 1 次之 token、dwgf 帶第 2 次) |
| 5 | **client 之 `cbProgress`(`:523` onUploadProgress)** | **無** | **未套 —— 行程死亡** |
| 6 | **client 之 `cbProgress`(`:539` onDownloadProgress)** | **無** | **未套 —— 行程死亡** |

> **2026-10-14 更正(審計 run01 → 修正 run02,主控裁示 1、2)**:#4a 之「已套」修正前於下列形狀**不成立** —— getToken 以 `{reason:'cancelled'}`(含同步拋、thenable 拒絕、Error 帶該欄)拒絕:`''`、0 則、不重試;以已撤銷之 Proxy 或 `reason` 為拋錯 getter 之物件拒絕:wsemi `pmConvertResolve` 之 `.catch` 內讀 `reason` 拋錯 → 呼叫永不 settle + 未處理之 rejection(**Node 行程結束**,即本條所禁之行程級例外);以 `{response:{status:413}}` 拒絕:不重試;回 thenable 解出 undefined:送字面 `Bearer undefined`(wsemi `ispm` 不認 thenable,跳過 `fetchToken` 之正規化)。修法:嘗試結果以自身之 try 分類、不需重試以自建包裝之參照識別、`classifyFailure` 之讀取包 try(R29);`fetchToken` 一律 `await`。**#4a 之判準自此為**:getToken 之任何拋出或拒絕值(含惡意值)皆為該次嘗試之失敗 —— 每次嘗試一則事件、照常重試、最終以**原值**拒絕(Error 者為其訊息;惡意值原樣交出,其讀取由監聽器與呼叫端自行負責,主控裁示 2);機械化保護:`test/api-clientOutcomeShapes.test.mjs`(getToken 之形狀軸、序列、惡意值)、`test/api-clientToken.test.mjs`(thenable)。

以上 5、6 兩格已於第九輪修正:新增 `cbProgressSafe`,交予 axios 之兩個 progress 回呼一律經之。**只報首次** —— 進度回呼於單次請求內會觸發數十至數百次,逐次通報會把 error 通道灌爆;「本次請求之進度回呼壞了」為一個事實,故一則。

> **run02(2026-10-13)**:#3、#5、#6 三格之保護(`cbProgressSafe` 與 `sendDataSlice` 之包裝,同一保護兩處手寫)收斂為呼叫層級之 `ctx.wrapProgress` 一處,並加「中止後不呼叫」—— axios 於取消時補送節流中之進度(瀏覽器於 `abort()` 同步期間、nodejs 於其後數 ms),傳輸層不保證取消後不再回呼(R27)。#4a、#4b 之 `getToken` 經 `ctx.callApp`。保護之語意(拋錯只報首次一則、不影響結果)不變。

**`sendDataSlice` 之三個呼叫點原判「刻意不套」,第九輪外部複審推翻並實測**:理由原為「落在呼叫鏈之 promise 內,拋錯使該次 promise reject 而非殺行程」—— 對其中兩個成立,對第三個不成立。

| 呼叫點 | 原本之下場 |
|---|---|
| 切片進度(`cbProgressSlice`) | 142ms reject —— 上傳失敗 |
| `bAllHash` 去重路徑之完成通知 | reject —— 上傳失敗 |
| **合併完成通知(`checkMerging` 內)** | **12000ms 未 settle** —— 例外沿 `.then` 傳到 `.catch(() => {})` 被吞掉,`pm` 永不 settle,`upload()` **永久懸置**且 0 則事件、0 行 console |

**同一個 `cbProgress` 三種下場,其中一種是懸置。** 第三格同時是 R10 結構層(settle 須排在回報之前)之未登記站點。

修法兩層:①**排序** —— `pm.resolve(res.msg)` 移到 `cbProgressMerge(...)` 之前;②**收斂** —— 於 `sendDataSlice` 內把 `cbProgress` 包一層,拋錯不影響上傳結果、只留一則 error 事件(只報首次)。收斂後三格下場一致:**進度回呼是通知通道,其失敗不決定上傳成敗**。

**機械化保護**:`tmp/probe_r9_verify.mjs` 第 3 節。分辨力已驗 —— 修正前行程級例外 5 次且 `execute` 從未 settle(行程死亡),修正後 **0 次**且 `execute` 正常 resolve。

> **本條之由來**:R9 已為 `cbProgress` 立過規則(「選用之回呼參數一律於呼叫前補預設」),但那條只管**參數缺漏**,不管**呼叫時拋錯**;R11 管了呼叫時拋錯,但只套在 server 之事件監聽器上。兩條規則各管一半,而 `:523`/`:539` 這兩格**兩條都沒蓋到**。又一次:規則對了,站點清單少了。

---

### R14 盤點與修正須涵蓋實際執行之產物,不得只掃 `src/*.mjs`

**狀態:第九輪新立(2026-09-10)。本條為本帳本自身之盲區,重建步驟已登記,缺口 0**

**規則**:凡以 grep 盤點站點者,其掃描範圍須涵蓋**實際被 import 執行的那一份**;修正亦同。

**why**:伺服器實際 import 的不是 `.mjs`:

```
src/WConverhpServer.mjs:41   import checkTotalHash  from './checkTotalHash.wk.umd.js'
src/WConverhpServer.mjs:43   import checkSlicesHash from './checkSlicesHash.wk.umd.js'
src/managerMergeSlices.mjs:20 import mergeSlices    from './mergeSlices.wk.umd.js'
```

(對應之 `.mjs` import 皆被註解掉,見各行上一行。)

而 `.wk.umd.js` 為**壓縮過且把 worker 原始碼以 base64 內嵌**的 UMD 產物 —— 實測 `checkTotalHash.wk.umd.js` 含一段 48380 字元之 base64,解碼後才看得到 `can not parse index`、`indexOf` 等字串,識別字則已被壓縮改名(`isnum(fileSize)` 於解碼後亦不可見)。

**後果**:①**本帳本 R1–R11 全部盤點指令皆掃 `src/*.mjs`,對實際執行的程式碼完全無效**;②只改 `.mjs` 而不重建,行為零變更且 287 測試全綠 —— 修了等於沒修,且**沒有任何訊號**。

**受影響之待修站點**:第九輪之 P2(`checkTotalHash` 之 `isnum` + `===`)、P5(`throw` 逸出)、P6(`indexOf` vs `startsWith`)三者皆在 `checkTotalHash` 內,故各為「`.mjs` 一處 + 內嵌產物一處」。

**重建方式**:`node toolg/gDistRollup.mjs`(該檔以 `w-package-tools` 之 `rollupWorker` 先產三個 `src/*.wk.umd.js`,再以 `rollupFile` 產 `dist/*.umd.js`;**順序不可對調**,其檔頭註解已寫明「因為 WConverhpServer 會 import checkTotalHash.wk.umd.js 故得先編譯」)。發布流程見 `script.txt`(**該檔為使用者所有,不得修改**)。`package.json` 之 scripts 內無此指令,故此重建步驟只存在於 `script.txt` 與本節。

**盲區之嚴重程度(實測)**:三個 `.mjs` 被**零個**模組 import —— 全專案唯一的 import 皆指向 `.wk.umd.js`,對應之 `.mjs` import 在 `WConverhpServer.mjs:40,42` 與 `managerMergeSlices.mjs:19` 皆為註解;`test/` 亦無任何檔案 import 之。

亦即 `checkTotalHash.mjs`、`checkSlicesHash.mjs`、`mergeSlices.mjs` 是**純建置輸入**,不是執行碼。改了它們而不跑 `node toolg/gDistRollup.mjs`:

- 行為零變更
- 288 個測試全綠
- eslint 全過
- git diff 看得到改動

**四項訊號全部顯示「已修正」,而實際執行的仍是舊碼。** 這是本套件目前最沒有訊號的一種失敗。

**修正本條所涉站點之驗收程序**(P2/P5/P6 適用):①改 `.mjs` ②跑 `node toolg/gDistRollup.mjs` ③確認 `git status` 顯示對應之 `.wk.umd.js` 與 `dist/*` 亦有變動 —— **若無變動即代表重建未生效** ④再跑測試。

**盤點指令**
```bash
grep -n "\.wk\.umd\.js'" src/*.mjs                    # 實際執行之產物清單
node -e "let c=require('fs').readFileSync('src/checkTotalHash.wk.umd.js','utf8');let m=c.match(/[A-Za-z0-9+\/=]{500,}/g);console.log(Buffer.from(m[0],'base64').toString('utf8').includes('can not parse chunk index'))"   # 須為 true
npx mocha --no-config test/unit-workerBundles.test.mjs                     # 權威判定(見下)
```
> **第十輪更正**:第二條指令之判定字串原為 `can not parse index`,而第九輪已把該訊息改為 `can not parse chunk index` —— 對**正確之產物**亦恆印 false,不知情者會誤判「產物未重建」。盤點指令內寫死之字面,在字面被改時一起過期。

**機械化保護(第十輪已建)**:`test/unit-workerBundles.test.mjs`,兩層:
1. **字面值子集**:`.mjs` 剝註解後之樣板靜態段與單引號字串,須全數出現於 `.wk.umd.js` 之 base64 解碼內容。便宜,但**只抓得到新增或改動字面值者**。
2. **差分行為**:同一組 fixture 各以 `.mjs` 與 `.wk.umd.js` 執行(各自一個全新暫存夾),比對回傳值(路徑正規化)與執行後之磁碟內容。fixture 須涵蓋各 worker 之每一條回傳分支。

**分辨力(實測,第十輪修正時未重建之狀態)**:`mergeSlices.mjs` 依 F1 刪去寫 `.done` 之敘述、改回傳雜湊 —— **第一層綠(漏抓)、第二層紅**;`checkSlicesHash.mjs` 新增 `invalid fileSliceHashs` —— 兩層皆紅;`checkTotalHash.mjs` 未改 —— 兩層皆綠。兩份外部複審原以字面值演算法實測分辨力為 2/8,第二層即為此而加。
另:B 卷實測以 `rollupWorker` 相同參數重建之產物與既有產物**逐位元組相同**(兩次建置亦相同),建置可重現;但以測試重建須複製 `toolg/gDistRollup.mjs` 之參數而形成第二份設定,故不採。

---

### R15 切割結構化字串前須先確認它真的是那個結構

**狀態:第九輪新立並於同輪修正(2026-09-11),缺口 0**

**規則**:凡以固定長度或固定分隔切割請求端可控之字串以取出其中一段者,須先確認該字串**確實具有該結構**;不符者視為未提供,不得把切出來的殘段當成有效值往下傳。

**why**:`/dwgfn` 與 `/dw` 原以 `authorization.slice(cstr(tokenType).length + 1)` 無條件切,**從不驗前綴**。實測(`tmp/probe_r9_final.mjs` 之 Q4,server 設 `tokenType: 'Token'`):

| 送出之 Authorization | 應用端於 download 事件收到之 token |
|---|---|
| `Token abc123`(相符) | `"abc123"` ✔ |
| `Bearer abc123` | `" abc123"` —— 帶前導空白之殘段 |
| `Basic dXNlcjpwYXNz` | `"dXNlcjpwYXNz"` —— **整個 Basic 憑證原樣成為 token** |
| `abc123`(無方案) | `""` |

兩個殘段皆可通過 `isestr`,應用端無從察覺自己拿到的不是 token。而同為「兩端須一致」之 `sizeSlice` 早有明確的 mismatch 訊息(見 R4b)—— **同一種組態不一致,一個有明確訊息、一個靜默交出錯值**。

**盤點指令**
```bash
grep -c "slice(cstr(tokenType).length + 1)" src/WConverhpServer.mjs   # 須為 0(不得再無條件切; 注意不可只搜 authorization.slice —— 修正後之寫法仍含該片段)
grep -c "startsWith(pfxToken)" src/WConverhpServer.mjs                          # 須為 1(第十一輪起切割只在 ctxOf 一處; 原 /dwgfn 與 /dw 各一份)
grep -c "authFrom: 'query'" src/routeSpec.mjs                                   # 須為 1(/dwgf: authorization 由 query 之 token 合成)
```

**站點數:4(切割 1 擁有者 / 合成 1 刻意 / 既有 2)** —— 第十一輪:切割收斂為 `ctxOf`(依 `routeSpec.authFrom` 查表),並登記「合成」為同一軸之第三個成員(B 卷 B4)

| 站點 | 狀態 |
|---|---|
| header 路由(`/main`、`/ulctr`、`/slc`、`/dwgfn`、`/dw`)之 token 提取 | **已套**:`ctxOf` 先 `startsWith(pfxToken)` 才切(第九輪立、第十一輪收斂為一處) |
| `/dwgf` 之 authorization | **刻意(登記)**:token 走 query string,authorization 由套件**合成**為 `<tokenType> <token>`,使應用端 `verifyConn` 於六路由所見同一形狀。原未登記 —— 若統一為「從標頭取」,`/dwgf` 之 verifyConn 輸入靜默變為空字串而 325 條測試全綠(B 卷 B4);現由 `routeSpec.dwgf.authFrom = 'query'` 表達,`test/api-errorEventOnce.test.mjs`(六路由所見 authorization)與 `unit-routeSpec`(與測試軸對照)鎖住,分辨力已驗 |

**同一規則之既有站點(已套)**:`fileHash`/`packageId` 之 `isSafeId`、`queueId` 之 `sep(id,'|')` 後檢查段數為 3 且三段皆 `isSafeId`(`managerMergeSlices.mjs`)。

**覆蓋缺口(第九輪指出,未補)**:`grep -rn "tokenType" test/` 為 **0** —— 45 個測試檔、299 條測試**無一設過非預設 tokenType**,連 JSDoc 範例都硬編碼 `strdelleft(authorization, 7)`(即寫死 `'Bearer '` 之長度)。此為 R8「軸取自契約」之同型缺口:`tokenType` 是一條有成員的軸,而測試只跑了預設那一個成員。

---

### R16 手上有「事件契約載不下的原始值」時才 console.log

**狀態:第九輪登記既有規則(2026-09-11),缺口 0 —— 但三個模組已流失**

**規則**:本套件之 `error` 事件契約為**字串訊息**,故凡手上握有**原始拋出值 / 原始 Error 物件**(其 stack、cause、自訂欄位為字串所載不下者)之處,另以 `console.log(訊息, err)` 傾印該原始值;其餘只發事件,不另印。

**why 要登記**:第九輪一度把「26 個站點只有 5 個有 console.log」判為對稱破缺,提議「全部統一」。兩份獨立複審各自實測後推翻 —— 那 5(實為 7)個並非隨機分佈,而是**恰好落在「手上有原始 err」之處,零例外**;其中 4 處還把理由寫在行尾(`//使用err.message會過於簡化, 另外要開啟顯示err供debug`)。

**這是一條沒有名字的規則。** 沒有名字的規則會被下一次「順手統一」抹掉 —— 而抹掉的方向恰好是**刪掉那 7 個**(因為它們看起來才是「不一致的少數」)。登記即是為此。

**盤點指令**
```bash
grep -nE "console\.log\(\`[^\`]*\`, (err|e|errL)\)" src/*.mjs | grep -v "^\S*: \* "   # 排除 JSDoc 範例; 每一處旁邊都該有一個原始 err 物件
```
(裸跑得 **12**:扣掉兩處 **JSDoc 範例**後為 **10**。盤點前先驗這條指令的分辨力 —— 本條初次登記時即因未排除 JSDoc 而把 11 誤寫成 7。)

**站點數:10(已套 10)** —— 第十輪 +1(外部 serverHapi 之路由註冊失敗)

| 檔案 | 站點 |
|---|---|
| `WConverhpServer.mjs` ×8 | `funEmitOfPkg`(監聽器拋出值)、`checkConn`(verifyConn 拋出值)、`/main` payload、`/slc` 寫入失敗、`/slc` payload、外部 serverHapi 之路由註冊、`startServer` 之 catch、`stop` 之 catch |
| `managerMergeSlices.mjs` ×2 | `verifyMerged` 與 `qPush` 之「寫 .error 檔失敗」—— 手上為 fs 之原始 Error |

**已流失之處(第九輪複審指出,列為觀察項不修)**:同一判準在 `attempt.mjs`、`buildDownloadSource.mjs`、以及 `managerMergeSlices` 之 `readStored`/`consume` 消失 —— 這些地方同樣手上有原始 err,卻只取 `getErrorMessage` 而未傾印。複審之 git 史查證顯示該 console.log 起於 2025-05-18 之作者除錯習慣、靠複製傳播,**每抽出一個新模組就掉一格**。不修之理由:那些 err 皆為 fs / JSON 之 Error,`getErrorMessage` 已足以診斷;**但若哪天要動,是補這幾處,不是刪那九處**。

---

### R17 回前端之錯誤訊息不得含伺服器路徑與底層細節;細節只進 error 事件

**狀態:第十輪登記既有規則並補齊站點(2026-09-11),缺口 0**

**規則**:凡回給前端之錯誤訊息(錯誤封包之內容、`Return-Msg` 標頭),不得含伺服器絕對路徑、底層例外之原文或其他實作細節;細節一律只進 error 事件供應用端診斷。應用端**自己交出的**拒絕值不在此限(依設計原樣傳回前端)。

**why**:這是一條早已存在、卻**沒有名字**的規則 —— 同套件四處註解各自守著它(`/slc` 寫入失敗「細節(含伺服器路徑)僅以error事件通知應用端, 回前端之訊息不含路徑」、S5「不含路徑與底層細節」、check-total-hash 之 `delete out.path`「會外洩伺服器目錄結構」、`checkSlicesHash` 之「ENOENT訊息含伺服器絕對路徑, 會隨error回應外洩至前端」),唯獨 `/ulctr` 之 procCore 把 worker 與合併佇列之**例外**原樣放進錯誤封包。實測(A 卷 P5c、B 卷 P10):暫存資料夾不在時,前端收到 `Error: fd[<伺服器絕對路徑>] is not a folder`,伺服器 0 則事件。
第九輪之 `workerError` 只處理「worker **回傳** `{error}`」,「worker **拋錯**」這一型沒有處置。沒有名字的規則,新增一條失敗型態時就沒有人去對照(與 R16 之由來同型)。

**盤點指令**
```bash
grep -cE "(^|[^.])internal\('" src/WConverhpServer.mjs                               # 須為 3(第十一輪起 reply.internal(...) 為錯誤回覆器之 kind, 不計; 裸搜 internal(' 會得 4)
grep -nE "await (checkTotalHash|checkSlicesHash|mmg\.push)\(" src/WConverhpServer.mjs   # 須為 0(不得繞過 internal; 此為擁有者鎖, 第一條為總量)
```

**站點數:3(`internal` 之使用) + 4(既有之守護處)**

| 站點 | 作法 | 狀態 |
|---|---|---|
| `/ulctr` 之 check-total-hash(`checkTotalHash` worker) | `internal`:例外 → 一則帶真因之事件 + 拒絕 `<mode> failed` | **已套(第十輪 A11/N5)** |
| `/ulctr` 之 check-slices-hash(`checkSlicesHash` worker) | 同上;worker 內讀切片失敗(與合併並發之 TOCTOU)另改為略過而不拋 | **已套(第十輪)** |
| `/ulctr` 之 merge-slices-push(`mmg.push`,含新增之「刪不掉舊 `.done`」例外) | 同上 | **已套(第十輪)** |
| `/slc` 寫入失敗、S5 之 `msg`、check-total-hash 之 `path`、`checkSlicesHash` 之存在檢查 | 各自既有之處置 | 已套(既有) |
| `/ulctr` 之 merge-slices-get | 應用端拒絕值依設計原樣傳回;mmg.get 自身之非應用端失敗皆以 `reason` 走事件 | 刻意不經 `internal`(否則應用端拒絕值會被改寫) |

**機械化保護**:`test/unit-ruleSites.test.mjs` 之 R17(上述兩條指令);行為面由 `tmp/r10A_p5_misc.mjs` 之 (c) 驗(修正前 `含伺服器路徑=true`、0 則;修正後 `check-total-hash failed`、1 則)。

---

### R18 完成標記須證明其所指之內容;新一代開始前舊標記須失效

**狀態:第十輪新立並於同輪修正(2026-09-11),缺口 0**

**規則**:凡以一個標記檔證明「某內容已完成」者(本套件為合併佇列之 `.done`),須同時滿足:①**寫入標記前核對內容**(雜湊 = fileHash);②**標記之寫入者只在單一模組**;③**新一代寫入內容之前,舊標記先失效**,且須確認真的刪掉了;④正式名之內容只由「暫存名寫完 → 核對 → rename」產生。不變式:**`.done` 存在 ⇒ 合併檔之雜湊 = fileHash**。

**why(第十輪 D1,本輪最嚴重之缺陷)**:原本 `.done` 由 worker 合併完即寫(不核對),且新一代合併不清除舊 `.done`。實測(`tmp/probe_r10_crash.mjs`,序列式:S4 → 補切片 → push → 合併途中殺行程 → 重啟 → 查詢):**134217728 bytes 之檔以 success 交出 3342336 bytes**;補傳切片重推亦被 qPush 判為已完成而 no-op —— **此後該檔每次上傳皆交出同一個殘檔**。另兩個觸發:用戶端送出錯誤內容(ArrayBuffer 只送 1 byte,D2)、同檔並發時他請求以寫入模式重開切片而截斷(A 卷實測交出 12574654/16764871 bytes)。
同一個「此檔即 fileHash」之宣稱,去重路徑(`checkTotalHash`)與中止復原(`verifyMerged`)皆核對,**唯獨一般合併不核對**;對標 S3 CompleteMultipartUpload、GCS resumable finalize、tus Checksum 皆於完成時核對,git/cacache 以暫存名 + rename 使正式名只指向就緒內容。

**盤點指令**
```bash
grep -c "writeFileSync" src/mergeSlices.mjs                            # 須為 0(worker 不寫標記; 修正前為 2。不可搜 \.done —— 本檔註解即含該字而恆為 2, 無分辨力)
grep -n "writeFileSync(ps.fpd" src/managerMergeSlices.mjs              # 須為 2(合併後核對相符、verifyMerged 驗證相符)
grep -n "renameSync(ps.fpm, ps.fp)" src/managerMergeSlices.mjs         # 須為 1(正式名之唯一來源)
grep -n "removeStateFile(ps.fpd)" src/managerMergeSlices.mjs           # 須為 1(新一代合併前)
node tmp/probe_r10_crash.mjs                                           # 須判「未交出殘檔」
grep -c "streamWrite.writableFinished" src/WConverhpServer.mjs         # 須為 1(/slc 之 done 以寫入串流 finish 為肯定式證明, 第十一輪 N1)
```

**站點數:4(寫入者 2 + 失效點 1 + 切片之 done 1)** —— 第十一輪併入 `/slc`:「done」亦是一種完成標記

| 站點 | 作法 | 狀態 |
|---|---|---|
| `/slc` 之成功回應(N1) | 原於 request 本體 `end` 即排程回 done,而 pipe 於 end 時只是把最後一片**交給**寫入串流,其 fs.write 尚未完成 —— 慢磁碟下(實測 `tmp/probe_r11_a.mjs` P1:每次寫入延後 400ms)前端已送出 merge-slices-push,合併讀到短切片而以 `merge slices failed` 告終;且 end 之後(flush 階段)才發生之寫入失敗,錯誤晚於 `delayForSlice` 到達時 pm 已 resolve,不完整切片被當成功。現於寫入串流 `close` 時以 `bEnded && streamWrite.writableFinished`(肯定式,被 destroy 中斷者恆為假)才排程 resolve。**措辭**:done 代表切片已**交給 OS**(fd 已關),非持久化(無 fsync) | **已套(第十一輪 N1)**;`test/api-sliceDurable.test.mjs`(慢寫入 + flush 階段失敗,修正前各 1 紅) |
| 一般合併(qPush) | worker 合併至 `<fileHash>.merging` 並回傳雜湊;mmg 核對相符 → rename → 寫 `.done`;不符 → 刪暫存、寫 `.error` | **已套(第十輪 F1)** |
| `verifyMerged`(S7、及 qPush 遇「合併檔 + `.done` 並存」) | 驗證相符才寫 `.done`;不符寫 `.error`;驗證本身出錯者不重新合併(以例外交由前端重送 push) | **已套**(qPush 之 `.done` 並存分支為第十輪新增:原直接 no-op) |
| 新一代合併之前(qPush) | `removeStateFile` 刪 `.done` 與 `.error` 並確認已不存在,刪不掉即拋 | **已套(第十輪 F1、A17)** |
| qGet 之 S2 | 信任 `.done`(不變式由寫入端守住) | 刻意不加驗證:A 卷模擬 RAV 使三條既有測試紅,且不變式成立時為重複成本 |

**被排除之做法(附理由)**:只刪殘留 `.done` 而不改為暫存名(即第十輪原規劃 R-A 之字面)—— A、B 兩卷各自模擬證實 E2/E4 兩格仍 success 交出殘檔(刪除位於 qPush 之早返之後);合併時邊寫邊算雜湊以省二次讀 —— 須自行重寫 wsemi 之 `fsMergeFilesCore`,而實測二次讀之增量僅 13–20%(1GB +539ms)。

**機械化保護**:`test/unit-mergeGeneration.test.mjs`(新一代合併之 push 回傳當下舊 `.done` 須已不存在;修正前 1 failing)、`test/api-uploadMergeIntegrity.test.mjs`(切片雜湊不符須以失敗終結、不寫 `.done`、不呼叫應用端;修正前 1 failing)、`test/unit-workerBundles.test.mjs` 之 mergeSlices 差分(worker 不寫 `.done`)。

> **本條測試之設計教訓**:最初以探針直接造出「殘檔 + 舊 `.done`」之靜態狀態來寫測試 —— 但修正後該狀態**本應不可達**(開始合併之 push 已先刪 `.done`),拿它當測試會使修正後仍紅、而且測到的是錯的東西。改為驗「使該狀態不可達之不變式有被維持」,真正之中止則以子行程序列式驗收(見 `sgud/exp/experience.md`)。

---

### R19 不可信之外來值,交出時須標明其可信度;誰要拿它做危險操作誰處理,只轉交者不得改寫

**狀態:第十一輪新立並於同輪修正(2026-09-12),缺口 0**

**規則**:凡來自對端之識別值(檔名等),交給誰、誰要用它做什麼決定處置:**套件自己要拿它做危險操作**(組路徑落地、寫標頭)者由套件負責淨化或編碼;**套件只是轉交**給應用端者不得代為改寫,須原樣交出並**標明不可信**,另給一個已淨化之值且命名可分辨。判準是「誰要用它」,不是「方向」。

**why(第十一輪 N4 與兩份複審)**:原規劃為「client 檔名於伺服器就地淨化後才交應用端」,理由是「client 對伺服器檔名已淨化,兩方向須對稱」。兩份複審獨立反駁:①本套件之檔案系統**不吃** client 之 `filename`(切片與合併檔皆以經 `isSafeId` 之 `fileHash`/`packageId` 命名),它只進 `procUpload` 之 `ri` 交給應用端 —— 套件側沒有要關的攻擊面;②`sanitizeFilename` 會不可逆地改寫 12 種 Linux 合法檔名(`a:b.txt`、`what?.md`、`CON.txt`…),且 `a/b/c.txt → c.txt` 毀掉瀏覽器 `webkitdirectory` 之相對路徑這個真實用法;③我自己引的對標 multer 是 `originalname`(原樣、明載不可信)**外加** `filename`(安全值),express-fileupload 之 `safeFileNames` 為 opt-in —— 對標推出的應然與原規劃相反。而 client 對伺服器檔名之就地淨化(`decodeFilenameFromHeader`)是對的:那個值套件自己要拿去 `path.resolve` 落地。

**盤點指令**
```bash
grep -cE "^\s*(let filenameSafe|filenameSafe,)" src/WConverhpServer.mjs   # 須為 3(定義 1 + check-total-hash 與 merge-slices-get 之 ri 各 1); 裸搜 filenameSafe 會得 5(另 2 為註解與 JSDoc)
grep -n "sanitizeFilename(" src/*.mjs                  # 須為 2: server 之 filenameSafe(轉交, 另給安全值)、client 之 decodeFilenameFromHeader(落地, 就地淨化)
grep -c "encodeRfc5987(\|str2b64(" src/WConverhpServer.mjs   # 須為 2(寫標頭者編碼: /dwgf 之 filename*、/dw 之 base64)
```

**站點數:3(已套 3)**

| 站點 | 誰要用它 | 處置 | 狀態 |
|---|---|---|---|
| 伺服器 → client 之 Content-Disposition 檔名(`WConverhpClient.mjs` 之 `decodeFilenameFromHeader`) | 套件自己拿去 `path.resolve` 落地(另有 `isPathInside` 第二道防線) | **就地淨化** | 已套(第八輪) |
| client → 伺服器之 `payload.filename`(`/ulctr` 入口讀一次,交 upload 事件之 `ri`) | 只轉交應用端(顯示、存 DB、或自行落地) | **原樣 `filename`(JSDoc 明載不可信)+ `filenameSafe`**;未給或全為非法字元者 `filenameSafe` 為空字串,套件不代為發明 `unknown`(B 卷 B7);回前端封包之 `filename` 亦維持原值(B 卷 B6) | **已套(第十一輪 N4')**;`test/api-uploadFilenameSanitize.test.mjs`(7 種 × 兩路徑 + 4 種空值) |
| 應用端 download 事件之 `filename` 寫入標頭(`/dw` 之 `str2b64`、`/dwgf` 之 `encodeRfc5987`) | 套件自己要寫標頭 | **編碼**(孤立代理對以 U+FFFD 取代,見 `validDownloadField`) | 已套(第十輪 F8) |

**機械化保護**:`test/api-uploadFilenameSanitize.test.mjs`(應用端須同時收到原值與安全值;`docs/2024/report.pdf` 之原值須保留目錄結構、`a:b.txt` 之原值不動);`test/api-uploadLargeFile.test.mjs` 鎖 `./1mb.7z` 原樣交出(本輪一度改為 `1mb.7z` 又改回,即為就地淨化被推翻之痕跡)。

---

### R20 模組須有獨立成檔之理由;只被一處引用且無理由者併回其唯一呼叫者

**狀態:第十一輪新立並於同輪整併(2026-09-12),缺口 0**

**規則(使用者裁示,2026-09-12)**:

> 「**重要的、需獨立測試的函數**才須成為單檔,例如 `managerMergeSlices.mjs`;而**多檔會共用**的函數才能再抽提出單檔。」

`src/` 下每個檔皆須滿足下列之一才得獨立成檔;皆不滿足者一律**併回其唯一呼叫者**,不留單檔。

| # | 得獨立之理由 | 判準(可機械化) |
|---|---|---|
| A | **多檔共用** | `grep -l "from './<name>.mjs'" src/*.mjs` ≥ 2 |
| B | **重要且有獨立單元測試直接 import** | `grep -l "from '\.\./src/<name>.mjs'" test/*.mjs` ≥ 1 |
| C | **是建置輸入** | `toolg/gDistRollup.mjs` 之 `fpSrc`(三個 worker,R14) |

> **⚠ 已撤銷之理由 D「是某條規則之單一擁有者」**:第十一輪一度以此保留六個檔(`callApp`、`buildDownloadSource`、`readDownloadFields`、`validDownloadField`、`destroyStreamRead`、`encodeOut`)。使用者指出後確認**該理由是循環論證** —— 帳本之盤點指令以檔名為錨,只是因為它當初就是獨立檔;併入後把錨點改成「函式區段」即可(`hasPipe` 正是如此處理,`unit-ruleSites` 之 `sect()` 為其通用作法)。**保護自己寫的 grep,不是保留一個檔案的理由。**
> 另注意 A 之判準是「多**檔**共用」而非「多處呼叫」:`destroyStreamRead` 於 server 內被呼叫 5 次,但呼叫者只有一個檔,仍不合格。

**why**:模組化的理由是「給一條規則一個擁有者」或「讓核心邏輯可被單獨測試」(見專案 `CLAUDE.md` 之重構原則),不是「函式多了就拆檔」。而本套件十一輪累積下來,出現了一批**只為一個述詞而存在、只被一個檔引用、也沒有任何測試或規則以它為錨**的單檔 —— `hasPipe` 42 行只為一句 `isfun(v.pipe)`,`canonProtocolValue` 34 行只為三個 `=== undefined`。它們讓 `src/` 從 26 個檔看起來像一個大系統,實際上只是把一個模組的內部細節攤成了目錄。**沒有理由的檔案,下一個讀的人也判斷不出能不能動它** —— 本條存在就是為了讓那個判斷變成查表。

**盤點指令**
```bash
# 逐檔列出「被幾個 src 模組引用 / 被幾個 test 真 import」, 凡 src 為 1 且 test 為 0 者, 須能指出其 C 或 D 之理由
for f in src/*.mjs; do n=$(basename "$f" .mjs); \
  echo "$n src=$(grep -l "from './$n.mjs'" src/*.mjs 2>/dev/null | wc -l) test=$(grep -l "from '\.\./src/$n.mjs'" test/*.mjs 2>/dev/null | wc -l)"; done
ls src/*.mjs | wc -l   # 須為 13(第十一輪 26 → 21 → 12; run02 新增 abortScope → 13)
```

**站點數:13 檔(A 2 / B 5 / C 3 / 入口 2;`sanitizeFilename` 同時屬 A 與 B)** —— 第十一輪 26 → 21 → 12;run02 新增 `abortScope`(B)→ **13**

| 理由 | 檔 |
|---|---|
| **A 多檔共用** | `isSafeId`(server、checkSlicesHash、managerMergeSlices 三檔)、`sanitizeFilename`(server、client 兩檔;亦屬 B) |
| **B 重要且有獨立單元測試** | `managerMergeSlices`(`unit-mergeGeneration`)、`routeSpec`(`unit-routeSpec`)、`retryDelay`(`unit-retryDelay`)、`encodeRfc5987`(`unit-encodeRfc5987`)、`isPathInside` 與 `sanitizeFilename`(`unit-pathSafety`)、`abortScope`(`unit-abortScope`;run02 主控裁示「中止範圍移至獨立模組並以單元測試涵蓋」,只被 client 引用,故理由為 B 而非 A) |
| **C 建置輸入** | `mergeSlices`、`checkSlicesHash`、`checkTotalHash`(三者另有 `unit-workerBundles` 之差分測試) |
| 入口 | `WConverhpServer`、`WConverhpClient` |

**第十一輪之整併(26 → 21)**:下列五者四項理由皆不滿足,已併回其唯一呼叫者,行為零變更。

| 原檔 | 行 | 併入 | 原本為何不該獨立 |
|---|---|---|---|
| `hasPipe.mjs` | 42 | `buildDownloadSource.mjs` | 只被 buildDownloadSource 引用;R1 那一列鎖的是「屬性讀取在 try 內」,與住哪個檔無關(測試錨點已改取函式區段) |
| `canonProtocolValue.mjs` | 34 | `encodeOut.mjs` | 只被 encodeOut 引用;R3/R6 提到它是以**函式名**為錨,不是檔名 |
| `isValidFileSize.mjs` | 37 | `validDownloadField.mjs` | 只被 validDownloadField 引用;R4 之述詞計數改掃 validDownloadField |
| `normalizeUploadInput.mjs` | 51 | `WConverhpClient.mjs` | 只被 client 引用,且 client 已有三個同層級之模組層函式(`decodeFilenameFromHeader`/`saveStreamToFile`/`classifyFailure`) |
| `responseU8aStreamWithError.mjs` | 55 | `responsePacket.mjs`(具名匯出) | 只被 server 引用,且它本身即 `responseU8aStream` 之薄包裝 —— 兩者是同一協定層的兩個出口 |

**機械化保護**:`test/unit-ruleSites.test.mjs` 之 R1/R2/R3/R4 諸條錨點已改為「函式區段」或「併入後之檔」,故**併檔會使它們紅**(須同步更新);`ls src/*.mjs | wc -l` 為 21。行為零變更之證據:`npm test` 與 e2e 於整併前後之數字相同(見 `tmp/r11-驗收.md` 第五節)。

---

### R21 各 `.mjs` 一律以單一 `export default` 匯出;要給多個成員就合併為一個物件

**狀態:第十一輪新立並於同輪套用(2026-09-12),缺口 0**

**前提:先過 R23**(未被模組外使用者不得匯出)。本條只管「**怎麼**匯出」,不回答「**要不要**匯出」—— 順序顛倒就會像第十一輪一樣,為一個本就不該存在的匯出面去設計形式與檔名。

**規則**:`src/` 與 `test/` 之每個 `.mjs`,其匯出**恰為一行 `export default`**。需對外提供多個成員者,於檔尾合併為單一物件再 `export default`;**不得**使用 `export { a, b }`、`export let x`、或 `export default` 與具名匯出並用。呼叫端以預設匯入後解構取用(`import w from './x.mjs'` → `let { a, b } = w`)。

**why(使用者裁示,2026-09-12)**:本套件對外只提供 `WConverhpServer` 與 `WConverhpClient` 兩個入口,`src/` 各模組於 `node toolg/gDistRollup.mjs` 時**整包併入**該兩個 UMD 產物 —— 具名匯出所換得之按需打包(tree-shaking)在此**沒有任何效果**。留著它只是讓「如何匯出」這件事有兩種寫法,而「同一規則兩種寫法」正是本帳本各條反覆記錄的形狀(R3、R4b、R5、R13…)。

**盤點指令**
```bash
grep -c "^export" src/*.mjs test/*.mjs | grep -vE ":[01]$"            # 須為空: 有匯出者恰一行(0 為測試檔本就無匯出, 不可用 grep -v ":1$" —— 那會把 58 個無匯出之測試檔全部誤報)
grep -n "^export" src/*.mjs test/*.mjs | grep -v "export default"     # 須為空: 該行須為 export default
```

**站點數:15(src 13 + test 2)** —— 第十一輪改正 4 檔;其後依 R20 再併入 9 檔,故總數由 23 降為 14;run02 新增 `src/abortScope.mjs`(單一物件 `{ isAbortSignal, genAbortScope }`;client 於全部 import 之後解構)→ 15

| 檔 | 原形式 | 現形式 |
|---|---|---|
| `src/responsePacket.mjs`(其後依 R20 併入 server) | `export default responseU8aStream` + `export { responseU8aStreamWithError }` | 單一物件(回應之兩個出口);併入後兩者成為 server 之內部函式,已無匯出 |
| `src/retryDelay.mjs` | `export default retryDelay` + `export { maxDelay, nToPeak, baseDelay }` | **單一函式**(三個校準常數改為不匯出,見 R22 之後記) |
| `test/tools/api-axes.mjs` | 9 個 `export let` | 單一物件(11 個測試檔改以解構取用) |
| `test/tools/e2e-setup.mjs` | `export { ... }` 七個成員 | 單一物件(3 個 e2e 檔改以解構取用) |

`src/managerMergeSlices.mjs` 之 `{ push, get }` 早已是本條之範例形式。

> **實作陷阱(本輪踩過三個,皆為「盤點與替換之工具形狀」所致)**:
> 1. 以整檔替換把 `export let ` 換成 `let` 時**少了尾隨空格**,9 個宣告靜默變成 `letdownloadRoutes` —— 該檔只被測試 import,`eslint src/` 不掃、當時也還沒跑到測試,一度看不出來。批次替換涉及識別字邊界時,替換後須立即以 `grep -nE "^let "` 逐條回驗。
> 2. 盤點「哪些檔用具名 import」時用的是**單行**正規式(`import .*\{.*\}.*from`),於是 `test/unit-axisCoverage.test.mjs` 的**多行** `import {\n a,\n b\n} from` 整個沒被抓到 —— 改完全測才以 `SyntaxError: does not provide an export named` 炸出來(該檔 5 條測試整檔未執行,總數 354 → 349)。掃 import 須另加 `grep -n "^import {$"` 一條。
> 3. 解構行插在**其他 import 之前**會違反 `import/first`(6 條 eslint 錯誤)。`let { ... } = w` 一律放在該檔**所有** import 之後。

---

### R22 檔名須反映其全部匯出成員;匯出多個成員者取集合概念,不得取其中任一成員名

**狀態:第十一輪新立並於同輪改正(2026-09-12),缺口 0**

**前提:先過 R23 與 R21**。檔名是「匯出面」之名字,匯出面未定之前不要取名。

**規則**:模組之檔名須讓人一眼判斷「這個檔提供什麼」。單一匯出者,檔名即該識別字;**匯出多個成員者,檔名取涵蓋全部成員之集合概念**,不得等於其中任一成員名。

**why(使用者指出)**:`retryDelay.mjs` 實際提供 4 個成員(`retryDelay` 函式與 `baseDelay`/`nToPeak`/`maxDelay` 三個校準常數),檔名卻只取了其中一個 —— **開發者看到檔名會以為裡面只有那一個函式**,另外三個常數形同隱藏。`responseU8aStream.mjs` 同型(2 個成員)。這不只是可讀性:R21 要求多成員以單一物件匯出,若檔名又等於某成員名,`import responseU8aStream from './responseU8aStream.mjs'` 取回的其實是**物件而非函式**,呼叫端極易誤用。兩者同時發生時,命名等於沒有經過規劃。

**盤點指令**
```bash
# 列出物件匯出者之成員, 並檢查檔名(去副檔名)是否等於任一成員名; 須無 VIOLATION
for f in src/*.mjs test/*.mjs; do n=$(basename "$f" .mjs); \
  ms=$(sed -n '/^let r = {/,/^}/p' "$f" | sed '1d;$d' | sed 's/[ ,:].*//' | tr -d ' '); \
  for m in $ms; do [ "$m" = "$n" ] && echo "VIOLATION $f 之檔名與成員 $m 同名"; done; done
```

**站點數:15(多成員 5 / 單一匯出 10)** —— 第十一輪依 R20 併入 9 檔後之現況;run02 新增 `abortScope`(多成員)

| 類別 | 檔 | 判定 |
|---|---|---|
| 多成員,檔名為集合概念 | `managerMergeSlices`(push/get)、`routeSpec`(六路由之表)、`test/api-axes`(9 個軸成員)、`test/e2e-setup`(7 個設定與工具)、`abortScope`(isAbortSignal / genAbortScope,皆屬「一次呼叫之中止範圍」;run02) | 合規 |
| 多成員,**原檔名取自成員** | `responseU8aStream.mjs` → **`responsePacket.mjs`**(responseU8aStream / responseU8aStreamWithError) | **第十一輪改正** |

**後記(同輪,使用者再指出)**:`retryDelay.mjs` 一度依本條改名為 `retryBackoff.mjs`,因它匯出 4 個成員。但使用者接著問「明明只用 `retryDelay`,為何還要提供另外三個」—— **問題的根源不是檔名,是匯出面**。查證:生產程式碼只用 `retryDelay`,三個常數僅出現在註解;唯一取用它們的是單元測試,而其用法為 `retryDelay(1) === baseDelay`,是拿實作比實作,改了常數測試照樣綠。遂改為以規格字面值斷言、三個常數不再匯出,匯出面縮為單一函式,檔名依本條回到 `retryDelay.mjs`。

> **本條之正確用法順序**:先問「這些成員**該不該**匯出」,再問「檔名怎麼取」。順序顛倒就會像本輪一樣,為一個本就不該存在的匯出面去設計檔名。與 R20 同源 —— R20 問「這個檔該不該存在」,本條問「這些匯出該不該存在」。
| 單一匯出,檔名 = 識別字 | 其餘 17 個(`attempt`、`callApp`、`encodeOut`、`validDownloadField`…) | 合規 |

**與 R21 之關係**:R21 管「怎麼匯出」(一律單一 `export default`),R22 管「檔名怎麼取」。兩條成對 —— 只守 R21 會產生「檔名是函式名、匯出的卻是物件」這種最容易誤用的形狀,而那正是本輪被指出的問題。

---

### R23 匯出面須最小化:未被模組外使用者不得匯出;且每個匯出成員須說明其用途

**狀態:第十一輪新立並於同輪改正(2026-09-12),缺口 0**

**規則**:模組之每個匯出成員,須有**該模組以外**的實際使用者;只被自身使用者一律**不匯出**(降為模組內部變數或函式)。多成員之模組,其匯出處須逐一說明各成員之用途與適用時機。

**三條規則之順序(不可顛倒)**:

| 順序 | 規則 | 問題 |
|---|---|---|
| 1 | **R23** | 這些成員**該不該**匯出? |
| 2 | [R21](#r21-各-mjs-一律以單一-export-default-匯出要給多個成員就合併為一個物件) | 決定要匯出者,**怎麼**匯出? |
| 3 | [R22](#r22-檔名須反映其全部匯出成員匯出多個成員者取集合概念不得取其中任一成員名) | 匯出面定了,檔名**怎麼取**? |

**why(使用者連續指出,第十一輪)**:本輪先做了 R21 之形式統一、再做 R22 之檔名重整,**唯獨沒有人問過「這些成員該不該匯出」**。於是:

| 實例 | 現況 | 處置 |
|---|---|---|
| `retryDelay.mjs` 之 `maxDelay` / `nToPeak` / `baseDelay` | 生產程式碼只用 `retryDelay`,三者於 client 內**只出現在註解**;唯一取用者是單元測試 | **不匯出**,降為模組內部常數;匯出面縮為單一函式,檔名依 R22 回到 `retryDelay.mjs` |
| `test/tools/e2e-setup.mjs` 之 `cleanup` | **零個外部使用者** —— 它在該檔內已由 `globalThis.after` 註冊完畢 | **不匯出** |

而為了那個不該存在的匯出面,還連帶做了兩件多餘的事:把函式包成物件、把檔名改為集合概念。**兩件事都是在遷就一個錯誤的前提。**

**測試不是擴大匯出面的理由**:單元測試驗的是**功能是否符合規格**,不是「實作與自己一致」。原本 `unit-retryDelay` 之 `retryDelay(1) === baseDelay` 從實作 import 常數再拿去比對實作 —— 把 `baseDelay` 改成 5000、`maxDelay` 改成 999999,測試照樣全綠。改為以規格字面值(1 秒 / 第 10 次 / 3 分鐘,取自 R4c 與模組 JSDoc)斷言後,測試才有分辨力,而模組也不必為它匯出任何常數。**覆蓋率同理:覆蓋率是量測結果,不是放寬封裝的理由。**

**盤點指令**
```bash
# 逐一列出各匯出成員之外部使用者; 出現「無人使用」即為違規
for f in src/*.mjs test/tools/api-axes.mjs test/tools/e2e-setup.mjs; do \
  ms=$(sed -n '/^let r = {/,/^}/p' "$f" | sed '1d;$d' | sed 's/[ ,:].*//' | tr -d ' '); \
  for m in $ms; do u=$(grep -l "\b$m\b" src/*.mjs test/*.mjs 2>/dev/null | grep -v "^$f$" | wc -l); \
    [ "$u" -eq 0 ] && echo "VIOLATION $f 之 $m 無外部使用者"; done; done
# 多成員模組之匯出處須有逐成員之說明
grep -B12 "^let r = {" src/managerMergeSlices.mjs src/routeSpec.mjs test/tools/api-axes.mjs test/tools/e2e-setup.mjs | grep -c "^\S*-//"
```

**站點數:5 個多成員模組(成員合計 19,全部有外部使用者)** —— run02 新增 `abortScope`(2 成員)

| 模組 | 匯出成員 | 外部使用者 |
|---|---|---|
| `src/managerMergeSlices.mjs` | push、get | server 之 `/ulctr` |
| `src/routeSpec.mjs` | 單一資料表 | server 六路由查表 |
| `test/tools/api-axes.mjs` | 9 個軸與工具 | 11 個測試檔 |
| `test/tools/e2e-setup.mjs` | 6 個(原 7,`cleanup` 已撤) | 3 個 e2e 檔 |
| `src/abortScope.mjs`(run02) | `isAbortSignal`、`genAbortScope` | client 之 `openCall`(型別檢核 opt.signal、建立每次呼叫之範圍);內部之 `abortReasonOf` 只被 `genAbortScope` 使用,**不匯出**(其補值以 `genAbortScope` 之 `reason()` 於 `unit-abortScope` 測試) |

`responsePacket` 原亦在此列,其後依 R20 併入 server(只被一個檔使用、無獨立單元測試),兩個成員成為 server 之內部函式。

其餘 17 個單一匯出模組,其匯出即該模組存在之理由(R20 之 A–D 四類),不另列。

**與 R20 同源**:R20 問「這個**檔**該不該存在」,本條問「這些**匯出**該不該存在」。兩條都是在問「有沒有人真的需要它」,而不是「它寫得好不好」。

---

### R24 測試用 port 一律自集中配發表取得;不得手寫、不得隨機、不得衍生

**狀態:第十一輪新立(2026-09-12,使用者指出),缺口 0**

**規則**:`test/` 下每個測試檔所用之 port,一律經 `test/tools/ports.mjs` 之 `portOf(檔名, i)` 取得。**不得手寫字面值、不得以 `Math.random` 產生、不得以 `port + 1` 衍生**。同一檔需要多台伺服器者,於 `alloc` 宣告數量並以索引取用;配額用盡時 `portOf` 拋錯,不靜默共用。

**why(使用者指出:「為何測試還要用 random 隨機產 port,這樣不會衝突嗎?沒有先訂好配發規則嗎」)**:mocha 以 `--parallel` 同時跑 61 個檔,port 撞號即 `EADDRINUSE`;而該錯誤看不出「誰跟誰撞」,下一次跑又可能因時序而過 —— 最難查的 flake。改為集中配發前之現況與**兩件實害**:

| 現況 | 後果 |
|---|---|
| 47 檔手寫固定值(散在 8184-8628) | 新增測試檔須自行 grep 找空號,靠註解「同時test故得要不同port」提醒,無任何機械化保證 |
| 2 檔以 `Math.random` 產生(9200+300、9600+300) | 不可重現之 flake;且其中一檔之隨機**在函式內**,是為了「每次起一台就要新號」,並非單純規避 |
| 3 處以 `port + 1` / `port + 2` 衍生,未納入任何盤點 | **已存在真實撞號**:`api-clientErrorEvents` 之 8497、8498 與 `api-startupErrors` 寫死者相同,兩檔皆在 `--parallel` 範圍內,僅靠時序僥倖未炸 |
| `api-executeWithU8a` 佔用套件預設值 8080 | `api-optionsRange` 之「port 非法時須取預設 8080」無法斷言,只能放寬為「建構不拋錯」 |

**配發規則**:`8080`(套件預設值)、`8199` 與 `1`(連線失敗測試指向)、`70000`(值域檢核之非法輸入)為保留區,不得配發;其餘自 `8300` 起依 `alloc` 之順序連續配發,一檔一段。新增測試檔於 `alloc` **表末**加一行並填數量即可,不必找空號。

**盤點指令**
```bash
npx mocha --no-config test/unit-ports.test.mjs   # 五條全綠
```
五條分別鎖:①配發不重疊且自 base 連續 ②不涵蓋保留區 ③`portOf` 對未登記名稱與越界索引拋錯 ④每個會啟動伺服器之測試檔都已登記 ⑤**測試檔內不得再手寫 port 字面值**。第五條是關鍵 —— 前四條只證明「表是對的」,第五條才防止有人繞過表。

**站點數:57 檔 / 87 個 port(8300-8386)+ 保留 4 個** —— run02 於表末新增 `api-clientAbort`(3)、`api-hostLifecycle`(1)、`e2e-abort`(1);第十二輪於表末新增 `api-uploadNoListener`(3)、`api-optionsFailClosed`(13)、`api-abortDuringAdmit`(1);同輪內調整數量之列皆為本輪新增者,既有配發未位移

> **第五條之判準須精確**:初版以 `\b8\d{3}\b|\b9\d{3}\b` 掃全檔,把 `timeout: 8000`、`pollUntilSettled(q, 8000, h)` 等**非 port 之數值**全部誤報(20 處)。誤報會使本條淪為雜訊而被繞過,故收窄為只認 port 之語法位置:`port 變數之賦值` / `物件之 port 鍵` / `localhost:` 與 `127.0.0.1:` 之後綴。

---

### R25 `test/` 根目錄只放測試檔;非測試之共用 mjs 一律置於 `test/tools/`

**狀態:第十一輪新立(2026-09-12,使用者指示),缺口 0**

**規則(使用者指示)**:「test 內不屬於測試的 mjs,要放在 `./test/tools`」。`test/` 根目錄下只得有 `*.test.mjs`;軸、fixture、設定、工具一律置於 `test/tools/`。

**why**:三個共用檔(路由與六路由軸 `api-axes`、e2e 設定與瀏覽器工具 `e2e-setup`、port 配發表 `ports`)原與 60 個測試檔混在同一層 —— 「這個檔是不是一組測試」要逐檔打開才知道;而 runner 之白名單(`package.json` 之 test script 所列之 `test/api-*.test.mjs` 等)沒把它們當測試跑,只是**碰巧**因為命名不合,不是因為位置分明。目錄分層讓這件事變成結構上的事實。

**併同之命名要求(全域規範 §15.3)**:`test/` 根目錄之測試檔一律以 `api-` / `unit-` / `e2e-` 前綴標明層級。第十一輪改正四個舊命名檔 —— `executeWithU8a`、`executeWithFile`、`uploadLargeFile`、`downloadLargeFile` 皆起真伺服器並走真 HTTP、不經瀏覽器,屬 api 層,已加上 `api-` 前綴;`test/tools/ports.mjs` 之 `alloc` 鍵與各檔之 `describe` 名稱同步更名。

**盤點指令**
```bash
ls test/*.mjs | grep -v "\.test\.mjs$"                       # 須為空: 根目錄只放測試檔
ls test/*.test.mjs | sed 's|test/||' | grep -vE "^(api|unit|e2e)-"   # 須為空: 每個測試檔都有層級前綴
ls test/tools/                                                # api-axes.mjs、e2e-setup.mjs、ports.mjs
```
機械化保護:`test/unit-ports.test.mjs` 之末兩條(`test 根目錄只得放測試檔`、`測試檔一律以 api- / unit- / e2e- 前綴標明層級`)。

**站點數:test 根目錄 69 個測試檔 / `test/tools/` 3 個共用檔**(資產目錄 `test/pics/`、`test/_tmp/` 不在此列;run02 +5:`api-clientAbort`、`api-hostLifecycle`、`e2e-abort`、`unit-abortScope`、`unit-hostSideEffects`;第十二輪 +3:`api-uploadNoListener`、`api-optionsFailClosed`、`api-abortDuringAdmit`)

> 搬移之連動:54 個測試檔之 import 前綴改為 `./tools/`;`e2e-setup` 自身之 `../src/` 改為 `../../src/`、`projRoot` 之 `..` 改為 `.., ..`;`unit-ports` 之掃描範圍改為「test 根目錄 + tools」—— 只掃根目錄會讓「有人在 fixture 裡寫死 port」整個掉出視野。

**執行指令(使用者裁示,2026-09-12)**

```
"test": "mocha --parallel \"test/*.test.mjs\" --timeout 180000"
```

> **第十二輪更正**:本處原寫 `--timeout 60000`,與 `package.json` 現值(180000,全域規範 §16.5 之規定值)不符,屬帳本散文過期;以 `package.json` 為準。

| 項目 | 規定 |
|---|---|
| **不得有 `.mocharc.json`** | 該檔會影響套件之統一處理機制與流程。**連 `--no-config` 也不必加** —— 那是在防一個依本條不該存在的檔 |
| **`npm test` 跑全部測試,含 e2e** | 不分單元與 e2e。scripts **不為開發者一時之方便而設** —— 要跑特定範圍是執行者自己下 `npx mocha <檔>`,不在 package.json 留捷徑 |
| **不留 `test:e2e`** | 已刪除 |
| **`--timeout` 不可省** | 其語意為**每個 test 與每個 hook 各自**之上限,非全套總和(全套無上限)。省略則退回 mocha 預設 2000ms —— 實測 **14 failing**,為逾時與其連帶之斷言失敗 |
| **spec 用 `test/*.test.mjs`** | 單層萬用字元;不用 `test/**/*.test.mjs`(會遞迴掃入 `tools/`),亦不依賴 mocha 預設(其預設為 `test/*.mjs`,會連非測試檔一併抓) |

> **e2e 與單元測試同跑之前提:`test/tools/e2e-setup.mjs` 須為並發安全**。原本它假設「同一個 process 內只打包一次」,而 `--parallel` 使每個測試檔在獨立 worker process 執行,於是:
> ①module 層之 bundle 快取跨不了 process,三個 e2e 檔同時打包到同一路徑而互相覆蓋(實測 `e2e-upload` 6 條失敗於 `window.tUpload is not a function`);
> ②`cleanup` 註冊於 root after 並刪**整個** `test/_tmp`,而每個 worker 各有一份 root after,先結束者會刪掉他人正在使用之 bundle 與頁面,連 api 測試之上傳暫存夾亦一併刪除。
> 修法:bundle 與頁面落於 `test/_tmp/e2e-<pid>/`,`cleanup` 只刪該子夾。**當時我把這個缺陷誤讀為「e2e 不該與單元測試混跑」而去改執行指令 —— 那是拿指令繞開缺陷,不是修它。**
>
> **連帶之迴歸(同輪發現並修)**:原 `cleanup` 刪整個 `test/_tmp` 時,同時兼了「清自己」與「清各 e2e 檔之暫存夾與落地檔」兩個角色。改為只刪自己子夾後,`e2e-upload` 之 `uploadTemp-e2e-upload` 無人清 —— **第二次執行**時合併檔仍在,多切片案例改走去重路徑,`from` 得 `check-total-hash` 而斷言失敗。已由各 e2e 檔於自己的 `after` 清自己的產物(`e2e-upload` 之上傳暫存夾、`e2e-download` 之 `dl-manager-*`);`e2e-upload` 之清理須在 `after` 而非 `beforeEach`,因其末條「重複上傳須去重」依賴同一次執行內之殘留。
>
> **驗證方式**:此類「跨執行殘留」只有**連跑兩次**才會現形。定案後實測兩次皆 386 passing 且執行後無殘留。

---

### R26 曝露與存取控制選項有給而無效時須收緊並告知;未給者依預設

**狀態:第十二輪新立並於同輪修正(2026-10-13),缺口 0**

**規則**:決定「誰可以呼叫本套件之 API」「哪些來源可跨來源讀取回應」「哪些檔案不經授權即公開」之建構選項,**有給(非 undefined、非 null)而無效時,不得退回最寬鬆之預設**,須收緊(拒絕/停用/不提供)並於建構期以一則 error 事件告知;建構子不得因此同步拋出(建構期失敗之通道見 R11)。**未給**者依 JSDoc 之預設(本套件慣例以 null 表示未給)。

**why**:四個選項原本與數值選項(R4)同一處置 ——「無效取預設」—— 而它們的預設正是最寬鬆之值:`verifyConn` 給錯(`false`、字串、物件)即全部放行;`corsOrigins` 給錯(字串、`[]`、`{}`、`['']`)即 `['*']` 放行任何來源;`useInert` 給錯(環境變數之字串 `'false'`、數值 `0`)即公開整個靜態資料夾(JSDoc 範例之 `pathStaticFiles: '.'` 即專案根目錄);皆 0 則事件 —— 使用端以為擋了/關了,實際沒擋且不留任何訊號。同一道關卡之回傳值本就只認 `=== true`(checkConn),型別判定卻放寬,兩層規則相反。另 `corsOrigins: [123]`、`['*', x]` 與拋錯之 Proxy 型 verifyConn 使建構子同步拋出(違反 R11 之通道)。對標:Express 4.22.2 之 `app.use(非函數)` 於設定時拋 TypeError(`lib/application.js:217`)、hapi 之路由設定驗證、w-serv-webdata 之選填 `methods` 有給而非陣列即拋錯且 null 視同未給(`WServWebdataServerExec.mjs:63-69`)—— 方向皆為 fail-closed;本套件之差異只在通道(事件而非拋錯,R11/A13),且採「照常啟動、API 一律 permission denied + 建構期事件」而非「不啟動」:外部 serverHapi 模式下擋不了宿主,而「路由在、一律拒絕 + 事件」比「路由不存在(宿主回 404)」易察覺。

**各選項之處置**

| 選項 | 未給 | 合法 | 有給而無效 |
|---|---|---|---|
| verifyConn | 全部放行 | sync/async 函數 | API 一律 permission denied(靜態檔不經 verifyConn,不受影響)+ 一則事件;`isfun` 判定本身拋錯(惡意/已撤銷之 Proxy)亦屬此(判定包 try) |
| corsOrigins(自建) | `['*']` | `false`、`''`、`[]`(含只有空字串者)→ 停用 CORS 且**不告知**(明示不允許跨來源讀取之合法寫法;否則使用端沒有不帶錯誤事件之寫法);非空字串 `s` → `[s]`;陣列 → 剔除空字串元素後**交 hapi 判定** | 其他型別 → 停用 CORS + 一則事件;hapi 建構時拒絕之陣列(`[123]` 之 TypeError、`['*', x]` 之 assert 等)→ 以停用 CORS 重建 + 一則事件(不在本套件重寫一份 hapi 之規則,A 卷 ③-4、B 卷 ①-4) |
| corsOrigins(serverHapi) | — | — | 有給即一則事件告知不作用(跨來源政策由外部伺服器決定;使用端之白名單被靜默忽略即「以為擋了」) |
| useInert(自建) | true | 布林 | 不提供靜態檔 + 一則事件 |
| pathStaticFiles(自建且提供靜態檔時) | `'dist'` | 非空字串 | 不提供靜態檔 + 一則事件(無從得知使用端要公開哪個資料夾,改公開 dist 即擅自曝露) |

「停用 CORS」之真實語意(C 卷 ①-8):交 hapi 之 `routes.cors` 為 `false`,不回 CORS 授權標頭,瀏覽器無法跨來源讀取回應、非簡單請求之預檢失敗而不送出;**伺服器端之存取控制仍由 verifyConn 決定**(簡單請求仍會進 handler)。

**盤點指令**
```bash
grep -n "errsOpt.push(" src/WConverhpServer.mjs               # 須恰 6 處: useInert、pathStaticFiles、verifyConn、corsOrigins(serverHapi 不作用、其他型別、hapi 拒絕)
grep -n "for (let msg of errsOpt)" src/WConverhpServer.mjs    # 須恰 1 處, 位於 evEmitDelay 定義之後、路由定義之前(R11 位置鎖)
grep -n "isfun(verifyConn)" src/WConverhpServer.mjs           # 須位於 try 內
```

**站點數:4 選項 / 6 告知點(已套 6)**

| 刻意不套 | 理由(可挑戰) |
|---|---|
| port、sizeSlice、sizeMsg、delayForSlice(R4)、apiName、tokenType、pathUploadTemp | 非曝露/存取控制:無效值取預設不會使未授權者得以呼叫、跨來源讀取或讀到檔案;其中 sizeMsg 之預設本身即記憶體保護上限。是否補「告知」(行為不變)列下一輪(A 卷 ②-7),本輪不擴及 11 個選項與既有選項測試之契約 |
| client 之 `getToken` 有給而非函數 → 視為不帶 token | 方向本為收緊(不帶憑證);client 依設計無建構期事件通道(`unit-ruleSites` 斷言 client 之 evEmitDelay 為 0);伺服器端關卡若要求 token 即以 permission denied 使其可察覺。JSDoc 已寫明(A 卷 ②-6、B 卷 ②-5;C 卷主張改為每次嘗試失敗,未採) |
| 選項物件本身為惡意 Proxy(`get(opt, ...)` 即可拋) | 選項由程式設計者給,非請求端可控(R1 之範圍為應用端交出之值) |

**機械化保護**:`test/api-optionsFailClosed.test.mjs`(verifyConn:`false` 之伺服器六路由皆 permission(狀態碼取自軸)、handler 0 則、應用端 0 次、建構期 1 則;`null` 對照組;值域十一種無效值(含已撤銷之 Proxy)與五種合法寫法以未啟動之外部 serverHapi + `inject` 驗;useInert/pathStaticFiles 以 `GET /package.json` 驗是否公開 + 合法對照組;corsOrigins 之無效(物件、`[123]`、`['*', x]`)、明示停用(`false`、`[]`、`['']`)、合法寬鬆寫法(單一字串、含空字串之陣列)三組,各以實際請求與預檢之 ACAO 及同源請求驗;serverHapi × corsOrigins 有給之告知)。分辨力:修正前除對照組外全紅(見當輪回報);`['', x]` 之格修正前即綠 —— 為「既有之合法行為不得被收緊誤殺」之對照組(A 卷 ①-4)。

---

### R27 一次公開呼叫對外之全部輸出經其 ctx 之出口;公開 promise 與中止競速

**狀態:2026-10-13 新立並套用(前端中止,`opt.signal`),缺口 0**。實作為 `src/WConverhpClient.mjs` 之 `openCall`(入口)、`genCallCtx`(出口)與 `src/abortScope.mjs`(中止範圍)

**規則**:client 之每一次公開呼叫(`execute`、`upload`、`download`)於入口由 `openCall` 建立**唯一**之呼叫層級脈絡 `ctx`,並明傳至 `send`、`sendPkg`、`sendDataSlice`、`checkMerging`、`attemptFailed`、`downloadNodejs`、`downloadBrowser`。該呼叫對外之全部輸出一律經 `ctx` 之出口,出口於中止後一律不輸出:

| 輸出通道 | 出口 | 中止後 |
|---|---|---|
| error 事件 | `ctx.emit` | 不發 |
| console 訊息(重試訊息、回應形狀異常之診斷) | `ctx.log` | 不印 |
| 應用端 `cbProgress` | `ctx.wrapProgress`(兼補預設與拋錯只報首次,R9、R13) | 不呼叫 |
| 應用端 `getToken` | `ctx.callApp(() => fetchToken())` | 已中止不呼叫;懸置中不再等待 |
| 公開 promise 之結局 | `ctx.run`(入口競速:本體與中止競速) | 尚未 settle 者一律以 `signal.reason` 拒絕 |

唯一例外:`openCall` 內之 `invalid opt.signal`(型別錯誤時尚無中止範圍,以 `evEmit` 直接發出)。各等待點之判斷(`send` 開頭、重試迴圈、切片迴圈、合併輪詢之 `.then`)**只是提早停工、釋放資源之最佳化,不是正確性之來源**——漏判不構成契約缺陷,只延後資源之釋放。**例外為不可撤銷之副作用前之判斷**(交給瀏覽器下載管理器之 `a.click()` 前、nodejs 落檔之建檔前):入口競速只決定 promise 之結局,擋不住已發生之副作用,故此二處是正確性之一環,以 `unit-ruleSites` 之 R27 位置鎖守住(取 token 之後、`a.click()` 之前判中止;建檔前判中止、建檔後註冊刪除)。

**why**:前端原無「一次公開呼叫」之範圍概念,對外輸出散在各站點直接呼叫。run01 審計之模擬版 v1 把「判中止」手寫在 8 個等待點,獨立複審找出之 4 個缺口全部是「下一個沒被手寫到之站點」:

| 缺口(複審編號) | 機制 |
|---|---|
| 中止後仍呼叫 cbProgress(R1) | axios 之進度節流(`helpers/throttle.js`,3Hz)於取消時 flush:瀏覽器於 `abort()` 之同步期間(`adapters/xhr.js` 之 `onCanceled` → `done()` → `flushDownload`),nodejs 於其後數 ms(`adapters/http.js` 之 `flushOnFinish` 經 nextTick) |
| 中止後拋錯之 cbProgress 仍發 `cbProgress error`(R2) | 同上 |
| 回應已到、續行未執行之窗口內中止 → 以值 resolve、sizeSlice mismatch 仍發、切片回應後仍呼叫進度(R3) | 等待點已過,續行無守門 |
| 已中止仍呼叫 getToken 一次(R4) | `race(fetchToken())` 先求值 |

逐站點補 `if` 只會在下一個新增之 await 再漏(同一規則手寫 ≥2 處即補丁堆積)。改為兩個擁有者後,上述四格皆由出口與入口競速擋下(`tmp/run01/review/r1_races.v2.out.json`、`tmp/run01/review/r2_browser.v2.out.json`)。

**分界(與既有規則)**:

| 規則 | 關係 |
|---|---|
| R5(同一次失敗恰一則) | 中止不是一次嘗試之失敗:中止後之失敗不發(ctx.emit 擋);中止前已發者不收回。client 之 error 站點總量改以 `(evEmit|ctx.emit)('error'` 計 |
| R9、R13(cbProgress 之預設與保護) | 兩處手寫之保護(send 之 cbProgressSafe、sendDataSlice 之包裝)收斂為 `ctx.wrapProgress` 一處 |
| 專案 CLAUDE.md 之重試原則 | 不變。中止不是錯誤類型,是呼叫端撤回請求;「可證明不需重試」之例外清單不增項 |
| R12(請求永不終結之分界線) | 中止是「讓有權決定者畫線」之一種:呼叫端以 `AbortSignal.timeout()` 為整個呼叫設上限,套件不自訂期限 |

**盤點指令**
```bash
grep -cE "evEmit\('error'" src/WConverhpClient.mjs                 # 剝註解後須為 1: 只在 openCall(invalid opt.signal); 裸跑 2(executeCore 內另有一行註解掉之舊派發), 權威判定在 unit-ruleSites
grep -cE "ctx\.emit\('error'" src/WConverhpClient.mjs              # 須為 10(見下表; 2026-10-14 +1: sendDataSlice 之雜湊計算失敗)
grep -cE "console\.log\(" src/WConverhpClient.mjs                  # 剝註解後須為 1: 只在 genCallCtx 之 ctx.log(裸跑另含註解內之字樣, 權威判定在 unit-ruleSites)
grep -cE "ctx\.callApp\(\(\) => fetchToken\(\)\)" src/WConverhpClient.mjs   # 須為 2: callApiCore、downloadBrowser 管理器路徑
grep -cE "ctx\.wrapProgress\(" src/WConverhpClient.mjs             # 剝註解後須為 2: send、sendDataSlice; 裸跑 4(另 2 行為說明之註解), 權威判定在 unit-ruleSites
grep -cE "openCall\(opt\)" src/WConverhpClient.mjs                 # 須為 3: execute、upload、download
grep -cE "ctx\.run\(" src/WConverhpClient.mjs                      # 須為 4: execute 1、upload 1、download 2(依環境)
grep -nE "new AbortController\(|addEventListener\('abort'" src/WConverhpClient.mjs   # 須為空: 由 src/abortScope.mjs 擁有
```

**站點數:出口 5 類 / 入口 3 方法;error 站點 11(ctx.emit 10 + evEmit 1)**(2026-10-14 盤點;2026-10-13 為 10)

| ctx.emit('error' 之站點 | 所在 |
|---|---|
| 一次嘗試之失敗 | `attemptFailed`(呼叫點:`callApi` 之重試迴圈、`checkMerging` 之 state:error) |
| cbProgress 拋錯 | `ctx.wrapProgress`(send 與 sendDataSlice 共用) |
| JSON 本體無法序列化 | `send` |
| execute 輸入無法序列化 | `sendPkg` |
| sizeSlice mismatch | `sendDataSlice` |
| invalid state(不可達) | `executeCore` |
| upload 輸入不支援 | `uploadCore` |
| 未給 fdDownload | `downloadNodejs` |
| 管理器路徑 getToken 拋錯 | `downloadBrowser`(catch 內先判中止,中止者不發) |
| upload 之雜湊計算失敗(2026-10-14) | `sendDataSlice` 之 `hashOf`(catch 內先判中止,中止者以 reason 拒絕、不發;其餘一則事件 + `classifyFailure` 之值、不重試) |

| 最佳化之等待點(非正確性來源) | 所在 |
|---|---|
| 已中止不送出 | `send` 開頭 |
| 迴圈開頭、attemptFailed 之後(監聽器內中止之重入)判中止 | `callApi` |
| 可中止之退避 | `ctx.scope.delay(t)` |
| 雜湊之等待 | `sendDataSlice` 之 `hashOf`(內為 `ctx.scope.race(() => calcHash(...))`;整檔雜湊與各切片雜湊共用;2026-10-14 起失敗者為入口失敗,中止者以 reason 拒絕) |
| 切片迴圈開頭 | `sendDataSlice` |
| 合併輪詢:onAbort 清 interval;`.then` 開頭判中止 | `checkMerging` |
| 交給瀏覽器下載管理器前(**不可撤銷之副作用,正確性之一環**) | `downloadBrowser`:取 token 之後、`a.click()` 之前 |
| 交 axios 之 signal | `send` 之組態 `signal: ctx.scope.signal` |
| nodejs 落檔(驗收時補,見下) | `saveStreamToFile(..., ctx.scope)`:建檔前判中止(已中止者不建檔);建檔後以 `scope.onAbort` 註冊,中止時於 `abort()` 之同步期間關閉寫入並刪除不完整檔,其後錯誤分支不再刪 |

**機械化保護**:`test/unit-ruleSites.test.mjs` 之「R27」(上列之數字與位置鎖:直接 evEmit('error' 只在 openCall 內、console.log 只在 genCallCtx 內、fetchToken 皆經 ctx.callApp、sendDataSlice 於第一次呼叫 cbProgress 前即包裝、client 不得自建 AbortController)、`test/unit-abortScope.test.mjs`(中止範圍之單元)、`test/api-clientAbort.test.mjs`(Node 側之入口 × 中止階段 × 觸發時序 × cbProgress 之行為表,斷言量 `abort()` 返回後含其同步期間)、`test/e2e-abort.test.mjs`(真 Chromium:XHR 中止、blob 下載中止與 `abort()` 期間之進度 flush、下載管理器交出前後)。

**分辨力**:`api-clientAbort` 對 HEAD 之 client(無 opt.signal)與 run01 模擬版 v1(只在等待點判中止)皆紅,見 run02 修正報告。

> **run02 使用者視角驗收時發現並修正(2026-10-13)**:以真實呼叫端寫法於 nodejs 下載中途取消,**拒絕當下**不完整檔仍在(10/10;`setImmediate` 後才刪)—— pipeline 之錯誤分支於串流銷毀、寫入 fd 關閉之後才執行。原測試於拒絕後等 500ms 才查,量不到「拒絕當下」(與 run01 之「settle 之後」代替「abort 之後」同型,經驗 E3b 之第五次)。且「取消後立刻重新下載同一檔」時,晚到之刪除可刪到新檔、晚到之建檔(標頭已到時中止,續行仍進落檔)可截斷新檔。修法見上表「nodejs 落檔」列;`api-clientAbort` 之 D1、T1 改於拒絕當下查(修正前紅、修正後綠),另增「標頭已到時中止後立即重下載同一檔」一格(修正前亦綠:本機時序下舊呼叫之建檔與刪檔皆早於新下載建檔,只作回歸守門);`unit-ruleSites` 之 R27 鎖「建檔前判中止、建檔後註冊」之位置。

---

### R28 測試建構伺服器一律給 pathUploadTemp(落 test/_tmp/<案名>/),測完即刪;不得取預設值而於 repo 根建立 uploadTemp/

**狀態:2026-10-13 新立(run02 Q6、run03),缺口 0**

**規則**:`test/` 下凡建構伺服器之處(`new WConverhpServer(`、`test/tools/e2e-setup.mjs` 之 `startServer(` 呼叫端;含子行程碼字串內者)一律給 `pathUploadTemp`,其值落在 `test/_tmp/<案名>/`(或其下),並由該測試檔之 `after` 刪除。只上傳不到檔案之測試亦同 —— 建構伺服器即建立該資料夾。

**why**:伺服器之 `pathUploadTemp` 預設為 `./uploadTemp`,測試以 repo 根為 cwd,故取預設者一律於 repo 根建立 `uploadTemp/`(全域規範 §16.4:測試中介資料一律落 `test/_tmp/<案名>/`,測完即刪)。run02 盤點:`api-uploadLargeFile` 取預設且其應用端只刪合併檔與 `.done`,合併查詢之結果檔(`.ro`)每跑一次留一個,自 2026-09-08 起累積 117 個;另 8 檔(`api-downloadLargeFile`、`api-downloadVariants`、`api-executeError`、`api-executeProgress`、`api-executeWithFile`、`api-executeWithU8a`、`e2e-download`、`e2e-execute`)不上傳,只是每次重建 repo 根之空資料夾。逐檔各自手寫路徑沒有問題,問題是**新增測試時忘了給**也不會有任何訊號 —— 故以機械鎖補上訊號。

**盤點指令**
```bash
git grep -n "new WConverhpServer(\|startServer(" -- "test/*.mjs" "test/tools/*.mjs"   # 站點全集(人工檢視用; 參數為 opt 等識別字者須看同檔之 let 物件)
npx mocha --no-parallel test/unit-ruleSites.test.mjs --grep R28 --timeout 60000
```
跑完 `npm test` 後之端到端判準:repo 根無 `uploadTemp/`(若有,即有站點取預設或有人手動跑 `srv.mjs`)、`test/_tmp/` 為空。

**站點數:73 個建構站點(`test/tools/e2e-setup.mjs` 之轉交定義不計),皆給 pathUploadTemp**(2026-10-13 盤點)

| 類別 | 站點 | 狀態 |
|---|---|---|
| 直接寫在參數物件內 | 其餘 61 個 | 已套(原即如此,或 run02 Q6 ① 補 after) |
| 參數為 `opt` 識別字(同檔 `let opt = { ... }`) | `api-uploadLargeFile`(run02 Q6 ②)、`api-uploadVariants`(原即如此)、`api-downloadLargeFile`、`api-downloadVariants`、`api-executeError`、`api-executeProgress`、`api-executeWithFile`、`api-executeWithU8a`(run03) | 已套 |
| `startServer(` 呼叫端 | `e2e-upload`、`e2e-abort`(原即如此)、`e2e-download`、`e2e-execute`(run03) | 已套 |
| 轉交定義 | `test/tools/e2e-setup.mjs` 之 `new WConverhpServer({ pathStaticFiles: '.', ...opt })` | 刻意不計:值由呼叫端給,呼叫端皆在本掃描內 |

**不在本條**:`srv.mjs`(repo 根之手動示範伺服器)取預設 `./uploadTemp` —— 非測試,為開發者手動操作 `web.html` 之用,其產物不可歸因於測試(run02 Q6 ④ 保留之 3 個 `.ro` 即此來源)。

**機械化保護**:`test/unit-ruleSites.test.mjs` 之「R28」(掃 `test/*.mjs` 與 `test/tools/*.mjs` 剝註解後之每個建構站點,參數為識別字者解析同檔內最近之 `let <識別字> = {...}`;站點數 < 70 即判掃描失效)。

**分辨力**:把任一站點之 `pathUploadTemp` 拿掉即紅(run03 實測,見 run03 修正報告)。

---

### R29 一次嘗試之結局不得以外來值之形狀判定;不需重試以自建包裝之參照識別;成功須以肯定式證明

**狀態:2026-10-14 新立並套用(審計 run01 → 修正 run02,主控裁示 1–4),缺口 0**

**規則**:client 判定「一次嘗試之結局」(成功或失敗、是否重試、交出何值)時:

1. **不得以外來值之形狀判定**。外來值指:伺服器轉交之應用端值(經 codec 之後)、應用端回呼(getToken)之值、宿主掛在共用 axios 實例上之攔截器之值。嘗試之結果由本套件自己的 try/catch 分類,**不得交給帶隱含慣例之通用輔助函式**(如 wsemi `pmConvertResolve` 之 `reason === 'cancelled'` 第三態)。
2. **「可證明不需重試」一律於失敗之來源標示,以本套件自建之包裝之參照識別**(`noRetrySet`,WeakSet)。HTTP 413 只在 axios 之錯誤上讀(`axios.isAxiosError(err)`),不在重試迴圈對任意值讀 `response.status`。
3. **讀取外來值之型別或屬性(`instanceof`、`get`)一律在 try 內**;讀不出者視為非 Error 而**原樣交出**(惡意值原樣,其讀取由監聽器與呼叫端自行負責)。
4. **成功須以肯定式證明是本套件之回應**:封包路由以嚴格解碼與協定鍵;串流下載以本套件之下載標頭(`Content-Disposition`)。不得以「沒看到錯誤標記」判成功。
5. **請求之狀態碼判定以本套件之 `validateStatus` 為準**(明給於請求組態),不取宿主之 `axios.defaults`。

**why**(審計 run01,`tmp/cancelled-全盤.md` 48 列 432 格):`callApi` 以 `pmConvertResolve` 分類嘗試結果 —— 應用端或 getToken 以 `{reason:'cancelled',…}` 拒絕即以 `''` 結束、0 則、不重試(execute、upload 去重、upload 合併之事件、全部 8 條經 send 之 getToken 路徑、瀏覽器同;failTwice 以取消形狀實作即破);惡意之 getToken 拒絕值使其 `.catch` 內讀 `reason` 拋錯 → 呼叫永不 settle + 未處理之 rejection(Node 行程結束);`isNoRetry` 以 `get(msg,'response.status') === 413` 對任意失敗值判不重試;下載以「沒有 `Return-Type: error`」判成功 → 網址誤指 SPA 主機時把 HTML 存成檔並 resolve;宿主 `axios.defaults.validateStatus = () => true` 時 404 下載被當成功落檔。既有 492 條測試無一能分辨上述任一格 —— 本條為「沒有規則、沒有軸」之補位(形狀軸見 R8)。

**對標**:axios 之 `isCancel` 只認其自建錯誤上之命名空間旗標 `__CANCEL__`;p-retry 之不重試以自己之類別 `instanceof AbortError` 判;axios-retry 之重試判定只讀 AxiosError 之 `code`/`response.status`/`config.method`、不讀回應本體;WHATWG 之中止以呼叫端自己之 signal 判。本套件之重試原則(CLAUDE.md:預設重試,例外須可證明)比 p-retry 更嚴,故例外只能以自建物件之參照識別。

**盤點指令**
```bash
git grep -n "pmConvertResolve\|pm2resolve" -- src/WConverhpClient.mjs   # 剝註解後須為 0(說明由來之註解除外; 權威判定在 unit-ruleSites)
git grep -n "response\.status'" -- src/WConverhpClient.mjs              # 須為 1: callApiCore 之 axios 失敗處, 同一運算式含 axios.isAxiosError(帶結尾引號: 不帶時另命中 classifyFailure 之 response.statusText 與 2 行註解, 2026-10-14 重掃更正)
git grep -n "noRetrySet" -- src/WConverhpClient.mjs                     # 不需重試之唯一識別(定義、wrapNoRetry 之 add、isNoRetry 與 unwrapNoRetry 之 has)
git grep -n "content-disposition" -- src/WConverhpClient.mjs            # downloadStream: 先證明有本套件之下載標頭, 才解檔名與落檔
git grep -n "validateStatus:" -- src/WConverhpClient.mjs                # 須為 1: send 之請求組態(帶冒號: 不帶時另命中 JSDoc @returns 之說明, 2026-10-14 重掃更正)
npx mocha --no-parallel test/unit-ruleSites.test.mjs --grep R29 --timeout 60000
```

**站點數:判定站點 6(已套 6)+ 刻意不套 3**(2026-10-14 盤點)

| # | 站點 | 判定之內容 | 狀態 |
|---|---|---|---|
| 1 | `callApi` 之 `attempt` | 嘗試結果之分類(自身 try/catch,不經 `pmConvertResolve`) | 已套 |
| 2 | `callApiCore` 之 axios 失敗處 | 413 → 不需重試(只對 `axios.isAxiosError` 為真者) | 已套 |
| 3 | `noRetrySet`(`wrapNoRetry`/`isNoRetry`/`unwrapNoRetry`) | 不需重試之識別(WeakSet 只比參照,不觸發外來值之任何陷阱) | 已套 |
| 4 | `classifyFailure` | 本地 Error → 訊息;其餘(含 `instanceof` 讀不出者)原樣 | 已套 |
| 5 | `downloadStream` | 成功之肯定式判定(`Content-Disposition`) | 已套 |
| 6 | `send` 之請求組態 | `validateStatus` 明給(2xx 為成功) | 已套 |
| — | `executeCore` 之成功殼檢查、`checkMerging` 之 `res.state`、`sendDataSlice` 之 `resUpCkt` 欄位 | 檢視者為伺服器自建之協定殼(非外來值);其異常形狀與配對伺服器不可達(全盤 r38、r39) | 刻意不套 |
| — | 伺服端 `checkConn` 之 `ispm(m)` | JSDoc 明載 verifyConn「可為sync或async函數…回傳其他值…不通過」,thenable 屬其他值(全盤 §2.3) | 刻意不套 |
| — | 下載管理器導覽前之 getToken 失敗(`downloadBrowser`) | 刻意為入口失敗(`getToken error: <訊息>`、一則、不重試;R13 #4b),值經 `getErrorMessage`(全域不拋) | 刻意不套 |

**機械化保護**:`test/unit-ruleSites.test.mjs` 之「R29」(位置鎖:不得 import `pmConvertResolve`/`pm2resolve`;`response.status` 只在 axios 失敗處且經 `axios.isAxiosError`;`isNoRetry`/`unwrapNoRetry` 只以 `noRetrySet.has`;`downloadStream` 先驗下載標頭;`validateStatus` 明給;伺服端 `canonProtocolValue` 不用 `isfun`)、`test/api-clientOutcomeShapes.test.mjs`(行為表:形狀軸 × 來源 × 路徑、序列、惡意值、codec 後之形狀、非本套件之 2xx 回應、宿主 validateStatus、雜湊失敗)、`test/api-noRetry.test.mjs`(413 形狀之對照組)、`test/api-hostileErrorValues.test.mjs`(伺服端拒絕值之惡意值)、`test/api-clientToken.test.mjs`(thenable)、`test/api-clientAbort.test.mjs`(中止 reason 為取消形狀、A5)。

**分辨力**(2026-10-14 實測):新增與修改之測試 26 條中,修前 **23 條紅**(api/unit 於 src 仍為 HEAD 時直接跑;e2e 以 `git show HEAD:src/*` 之 repo 副本跑,因 e2e 自 src 打包)—— `api-clientOutcomeShapes` 11/12(對照組綠)、`api-executeError` 1、`api-noRetry` 1、`api-clientToken` 1、`api-hostileErrorValues` 2、`unit-ruleSites` 3(R5 總量、R27 錨點、R29)、`api-clientAbort` 之 A5 1、e2e 3(`e2e-execute` 2、`e2e-download` 1);修前即綠之 3 條為守門(新檔之對照組、C5 之取消形狀 reason、帳本須涵蓋 R29)。修後 `npm test` **512 passing / 0 failing**(基準 492 + 新增 20;`node toolg/gDistRollup.mjs` 重建前後各一次)。

---

## 已知限制(2026-10-14 起;本套件刻意不修或不在本 repo 修者)

| # | 限制 | 理由與處置 |
|---|---|---|
| L1 | **Node.js 下使用 axios 之預設實例,宿主掛於其上之攔截器亦作用於本套件之請求**(例:回應錯誤攔截器改以 `err.response.data` 拒絕時,413 之不重試失效、該本體被當成伺服器回傳值交出;請求攔截器拋出者為每次嘗試之失敗)。狀態碼判定已不受宿主 `axios.defaults.validateStatus` 影響(R29 第 5 點)。瀏覽器之 dist 自帶 axios,不受影響;以打包工具引用 src 之瀏覽器應用同 Node.js | 主控裁示 3:私有實例須改寫 8 條以全域攔截器打時窗之中止測試,且宿主刻意之全域設定(httpsAgent、adapter)不再套用;注入實例為公開 API 增項 —— 皆屬設計取捨,現無觀察到之宿主攔截器問題。JSDoc 明載 |
| L2 | **「原樣交出」以 codec 往返為界**:頂層 undefined → null(伺服端正規化);Error → `'Name: message'`;**非 plain 之類別實例帶字串 name/message → `'[object Object]'`**(wsemi `obj2stru8arr` 之 replacer 以 lodash `isError` 判為 Error 後 `toString()`,資訊全失);`toJSON` 先於上述判定 | wsemi codec 之行為,不在本 repo 修;repo 根 `建議wsemi修正-codec.md` 交 wsemi 主責判斷 |
| L3 | **惡意值原樣交出**:getToken 以已撤銷之 Proxy 等惡意值拒絕時,該值原樣交給 error 監聽器與呼叫端,其讀取可能拋錯 | 主控裁示 2:「非 Error 者原樣交出」(`classifyFailure`)不因值難讀而改變;JSDoc 明載 |

## 破壞性變更紀錄

| 日期 | 情境 | 舊行為(2.1.8) | 新行為 | 可能受影響者 |
|---|---|---|---|---|
| 2026-10-14 | 應用端(execute、upload)或 getToken 以帶 `reason: 'cancelled'` 之物件拒絕 | 以 `''` 拒絕、0 則、不重試 | 以原值拒絕(getToken 之 Error 為其訊息)、每次嘗試一則、照常重試 | 依賴空字串者;等待時間依 retry 次數變長 |
| 2026-10-14 | 應用端或 getToken 以 `{ response: { status: 413 } }` 形之物件拒絕 | 不重試(1 則) | 照常重試 | 等待時間依 retry 次數變長 |
| 2026-10-14 | 宿主設 `axios.defaults.validateStatus` | 影響本套件之成敗判定(如 404 之下載被當成功並落檔) | 不再影響(本套件明給) | 刻意以全域設定放寬本套件狀態碼者 |
| 2026-10-14 | 非本套件之 2xx 下載回應(無 `Content-Disposition`:網址誤指 SPA 主機、代理錯誤頁) | resolve、本體落檔為 `unknown` | 以 `invalid download response from server` 拒絕、每次一則、照常重試、不落檔 | 外部 serverHapi 未曝露 `Content-Disposition` 之跨來源瀏覽器 blob 下載(JSDoc 本已載「download會失效」)由「以 unknown 檔名交出」改為失敗 |
| 2026-10-14 | upload 之雜湊計算失敗(輸入讀取失敗) | 以原始錯誤物件拒絕、0 則 | 一則事件 + `classifyFailure` 之訊息(字串)、不重試、不送出請求 | 以 `instanceof` 判此錯誤者 |
| 2026-10-14 | getToken 以惡意值拒絕 | 行程結束(未處理之 rejection)或呼叫永不 settle | 每次一則、照常重試、以原值拒絕 | — |
| 2026-10-14 | getToken 回 thenable 解出 undefined/null | 送 `Bearer undefined` | 送空 token(同原生 promise) | — |
| 2026-10-14 | 伺服端:應用端以惡意值拒絕 | 裸 HTTP 500、伺服器 0 則 | 錯誤封包 `output can not be serialized` + 一則事件 | — |

---

## e2e 落地映射(規則帳本之一節;對應全域技能 role-coder-for-test-e2e §3 契約)

**狀態:run02(2026-10-13)補立**。技能 §0 要求「專案映射表缺 → 先依範本補」;本套件之 e2e 定位原只寫在 `test/tools/e2e-setup.mjs` 檔頭,本節為其帳本版。

**定位**:w-converhp 於瀏覽器端**沒有 UI**,是傳輸函式庫,對外只有 `execute` / `upload` / `download` 三個 JS API。e2e 存在之理由是瀏覽器端走 rollup 打包之 UMD(相依解析與 Node 不同、XHR 之進度與中止語意不同、下載管理器路徑只存在於瀏覽器),`api-*` 測不到。act 為頁內呼叫公開 API(使用者 = 應用程式碼),不是鍵鼠。

### 服務與 port

| 項目 | 值 |
|---|---|
| 後端 | 每個 e2e 檔各起一台 `WConverhpServer`(`startServer`),port 取自 `test/tools/ports.mjs` 之 `alloc`(R24),`pathStaticFiles: '.'` 供頁面與 bundle |
| 前端 | 無前端服務;`buildClientBundle` 於測試時自 `src/WConverhpClient.mjs` 以 rollup 打包至 `test/_tmp/e2e-<pid>/`,`writePage` 寫測試頁 |
| e2e 執行 | 隨 `npm test` 一併執行;單檔:`npx mocha --no-parallel test/e2e-<flow>.test.mjs --timeout 180000` |
| 共用實作 | `test/tools/e2e-setup.mjs`(未引用 w-package-tools-e2e:其模組皆為截圖、比對、篩選、生命週期等像素管線,本套件不適用) |

### 契約映射

| 契約 | 本專案實名 / 模式 | 偏離與依據 |
|---|---|---|
| C1 launch wrapper | `launchBrowser()`(`chromium.launch({ headless: true })`) | 不帶確定性渲染旗標:旗標之適用前提為像素比對,本套件無 |
| C2 server lifecycle | `startServer(opt)`(呼叫端一律給 `pathUploadTemp: test/_tmp/<案名>/`,各檔 `after` 中 `await wsv.stop()` 後刪除,帳本 R28);cleanup 只刪本行程之 `test/_tmp/e2e-<pid>/`,以 `globalThis.after` 註冊 | 每檔各起停自己的伺服器,不需 reuse 偵測 |
| C3–C5、C10、C12、C15 | 不適用 | 無換設定重啟、無持久資料、無登入與語系、無文字輸入、無動畫容器、畫面無時間戳 |
| C6–C9、C13 | 不適用 | 無 UI 故無標準圖、紅框、遮罩、pixel 比對與 regen;斷言一律為語意斷言(回傳值、事件數、下載事件、伺服端觀察) |
| C11 偵測等待 | 頁內以 `await` 公開 API 之結局為主;需等外部條件者以頁內輪詢(如 e2e-abort 之「等第一則事件」) | — |
| C14 端點 | `HOST = '127.0.0.1'` | e2e-download 之跨來源案例刻意以 `localhost` 製造不同 origin(該檔檔頭載明) |

### 專案特有機制

- 「修正前」之瀏覽器端分辨力:Node 之 resolve hook 管不到 rollup 打包,於 `tmp/` 建副本並以 junction 指回 node_modules(經驗 E40;run02 之 `tmp/run02/e2ecopy_run.mjs`)。
- 決定性時點(e2e-abort):頁內掛鉤 `Blob.prototype.arrayBuffer`(client 轉換回應本體 = 回應已到、續行未執行)與 `encodeURIComponent`(下載管理器組網址 = 已取得 token、交出前);觸發一次即解除(經驗 E44)。

### 已知缺口 / 待辦

- 無。

---

### 附:本帳本之維護規則

1. **每立一條新規則,同時在此新增一節**,並附可重跑之盤點指令。
2. **修正任一站點時,先跑該條盤點指令**,對照站點數;不一致即代表有未登記之新站點。
3. **修正完成後於回報中附該條之重掃輸出**,而非只附「該站點已修」。
4. `刻意不套` 之理由須寫得可被挑戰(說明「為何此站點不受該規則約束」),不可只寫「不需要」。
5. 本帳本之站點清單**由指令產生**,不由記憶產生;盤點日期過舊時先重跑再引用。
6. **數字鎖分兩型**(第十一輪,B 卷 §③-3.6):數字若是「**擁有者的個數**」(恰 1 = 單一擁有者、恰 N = 每條路由各一次)就鎖,收斂後更強;若是「**站點的總量**」則只能偵測有人增刪了一處,偵測不到「同一次失敗發了兩則」或「某條路由漏了處置」,一律降級為維護提示,分辨力改由**行為表**(失敗種類 × 入口,成員取自測試軸)承擔。凡「收斂後數字改一下就好」即為總量鎖被繞過之訊號。
