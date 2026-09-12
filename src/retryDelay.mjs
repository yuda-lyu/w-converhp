//maxDelay, 單次等待上限, 3分鐘
let maxDelay = 180000

//nToPeak, 第幾次重試達到上限
let nToPeak = 10

//baseDelay, 第1次重試前之等待, 1秒
let baseDelay = 1000

//ratio, 使第nToPeak次恰為maxDelay之成長率(實測1.7807)
let ratio = Math.pow(maxDelay / baseDelay, 1 / (nToPeak - 1))


/**
 * 取第n次重試前之等待毫秒
 *
 * 自baseDelay起以ratio指數成長, 第nToPeak次達到maxDelay, 其後維持在maxDelay不再成長
 *
 * why 須封頂: 原實作把成長率之校準常數(10)與迴圈上限(呼叫端可設之retry)當成同一件事, 兩者實際無關聯,
 * 故retry大於10時延遲無界 —— 實測第20次單次等待16小時、第24次6.7天;
 * 第27次起更超過32位元帶號整數(2147483647), setTimeout溢位而以1ms觸發, 退避反倒塌陷成熱迴圈打伺服器
 * (實測setTimeout(2**31)印TimeoutOverflowWarning且4ms即觸發)
 *
 * 封頂只限制單次等待, 不減少重試次數(次數另由WConverhpClient之maxRetryTimes約束), 與本套件之重試原則相容
 *
 * @param {Integer} n 輸入第幾次重試正整數, 自1起算
 * @returns {Integer} 回傳等待毫秒整數, 必不超過maxDelay
 * @example
 *
 * console.log(retryDelay(1), retryDelay(2), retryDelay(10))
 * // => 1000 1781 180000
 *
 * console.log(retryDelay(20), retryDelay(100))
 * // => 180000 180000
 *
 */
function retryDelay(n) {
    if (!Number.isFinite(n) || n < 1) {
        return baseDelay
    }
    return Math.min(Math.round(baseDelay * Math.pow(ratio, n - 1)), maxDelay)
}


//maxDelay / nToPeak / baseDelay / ratio 為本模組之**內部**校準常數, 一律不匯出
//why: 呼叫端只需要「第 n 次要等多久」這一個答案, 給了常數反而多一條可被誤用的路(改了它不會改變曲線, 因為 ratio 已在載入時算好)。
//三者原本只為了讓單元測試拿去斷言而匯出 —— 而 `retryDelay(1) === baseDelay` 這種寫法是拿實作比實作:
//把 baseDelay 改成 5000、maxDelay 改成 999999, 測試照樣全綠(現狀指紋, 見 CLAUDE.md §15.2 與經驗 E20)。
//已改為以規格字面值斷言(見 test/unit-retryDelay.test.mjs), 匯出面因而縮為單一函式, 檔名亦依帳本 R22 回到該識別字


export default retryDelay
