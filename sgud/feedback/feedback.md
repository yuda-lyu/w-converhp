# 回饋

本檔記任務中發現之自有套件、全域技能、全域設定之調整與抽提提案;**只增不改**,處置結果(已通報、已修、不採納)另記一列並寫明承接哪一列。回饋是紀錄與提案,不等於自行修改:實際修改走全域設定 §5.2、§13 之通報管道。

| 日期 | 類別 | 對象 | 內容 | 依據 |
|---|---|---|---|---|
| 2026-11-13 | 全域技能 | role-coder-for-test-e2e §6(每 case fresh browser,「不為省時間共用」) | 與 w-playwright 設計之「會啟動真 Chrome／Edge／完整 Chromium 之測試檔,每檔最多啟動一次(`before` 起、`after` 關)」相衝,技能 §6 未區分兩類瀏覽器:headless shell 啟動不消耗 Windows 帳號之錯誤密碼次數(每 case fresh 無虞),真 Chrome／Edge／完整 Chromium 每次啟動 +1(10 分鐘內 10 次鎖帳號)。建議 §6 加例外:非 headless shell 之瀏覽器改為每檔共用一個 browser,case 間以 `newContext()` 隔離 | 本套件 e2e 為 headless shell,故維持每 case fresh(帳本 R31 規則 3、e2e 映射〈瀏覽器〉列);技能 §6 第一條;w-playwright 設計報告 §5.2 |
| 2026-11-13 | 自有套件 | w-playwright(`setBrowserTypeForTest` 之接線測試輔助) | 使用端之接線測試要斷言「此啟動點為無頭 headless shell(不觸發 LogonUser)」,只能在替身內自行以 `o.headless === true && o.channel === undefined && o.executablePath === undefined` 推斷,與 w-playwright 登入守門內部判定「何謂 headless shell」(README〈執行期登入守門〉:`executablePath` 只有等於受管 headless shell 路徑者才算)可能分叉。提案:提供一個判斷函數(例:收合併後選項、回是否為 headless shell),供使用端接線測試與守門共用同一判定 | `test/unit-pwWiring.test.mjs` 末案之最後三個斷言;w-playwright README〈執行期登入守門〉 |
