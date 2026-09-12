import assert from 'assert'
import retryDelay from '../src/retryDelay.mjs'


/**
 * unit: 重試退避曲線(對應 src/retryDelay.mjs)
 *
 * 修正前之寫法把「成長率之校準常數」與「迴圈上限」當成同一件事:
 *     let maxRetry = 10
 *     let ratio = Math.pow(180000 / 1000, 1 / (maxRetry - 1))
 *     ...
 *     while (...) { let t = Math.round(1000 * Math.pow(ratio, n - 1)) }
 * 而迴圈上限實際是呼叫端可設之 retry, 與該常數毫無關聯。故 retry 大於 10 時延遲無界:
 *     n=20 → 16 小時, n=24 → 6.7 天, n≥27 → 超過 2^31-1 而 setTimeout 溢位成 1ms(退避塌陷為熱迴圈)
 *
 * 本檔鎖住三件事: 起點、封頂、以及「任何 n 皆不超過 32 位元計時器上限」。
 *
 * why 斷言用規格字面值, 不自模組取其常數(第十一輪, 使用者指出):
 * 原本本檔 import 了 maxDelay / nToPeak / baseDelay 再以 `retryDelay(1) === baseDelay` 斷言 ——
 * 那是「實作與自己一致」而非「實作符合規格」: 把 baseDelay 改成 5000、maxDelay 改成 999999, 本檔照樣全綠。
 * 此即 CLAUDE.md §15.2 所禁之現狀指紋(經驗 E20 之同型)。規格值取自帳本 R4c 與該模組之 JSDoc。
 * 改用字面值後, 該模組亦不必為了測試而匯出三個內部常數, 其匯出面因而縮為單一函式。
 */
describe('unit-retryDelay', function() {

    //規格值(帳本 R4c 與 src/retryDelay.mjs 之 JSDoc), **不自實作取得** —— 改了實作常數本檔即紅, 那正是本檔的用處
    let specBase = 1000 //第 1 次重試前之等待, 1 秒
    let specPeak = 10 //第幾次重試達到上限
    let specMax = 180000 //單次等待上限, 3 分鐘

    //maxTimer, node 計時器以 32 位元帶號整數表達, 超過即溢位並以 1ms 觸發
    let maxTimer = 2147483647

    it('第 1 次重試之等待為 1 秒', function() {
        assert.strict.deepEqual(retryDelay(1), specBase)
    })

    it('第 10 次恰達上限 3 分鐘', function() {
        assert.strict.deepEqual(retryDelay(specPeak), specMax)
    })

    it('達峰之前為嚴格遞增', function() {
        for (let n = 1; n < specPeak; n++) {
            assert.strict.deepEqual(retryDelay(n) < retryDelay(n + 1), true, `n=${n}: ${retryDelay(n)} 應小於 ${retryDelay(n + 1)}`)
        }
    })

    it('達峰之後一律維持在 3 分鐘, 不再成長(修正前 n=20 為 16 小時、n=24 為 6.7 天)', function() {
        for (let n of [11, 12, 16, 20, 24, 27, 50, 1000]) {
            assert.strict.deepEqual(retryDelay(n), specMax, `n=${n}`)
        }
    })

    it('任何 n 之等待皆不得超過 32 位元計時器上限(修正前 n≥27 溢位, 實際等 1ms 而使退避塌陷為熱迴圈)', function() {
        for (let n = 1; n <= 200; n++) {
            let t = retryDelay(n)
            assert.strict.deepEqual(t <= maxTimer, true, `n=${n} 之等待 ${t}ms 超過計時器上限`)
        }
    })

    it('非法之 n 退回第 1 次之等待, 不得回 NaN 或負值', function() {
        for (let v of [0, -1, NaN, Infinity, -Infinity, undefined, null, 'x', {}]) {
            let t = retryDelay(v)
            assert.strict.deepEqual(Number.isInteger(t) && t >= 0 && t <= specMax, true, `${String(v)} → ${t}`)
        }
    })

    it('20 次重試之累計等待須在可用範圍內(以 1 小時為界)', function() {
        //why: 重試次數上限為 20(見 WConverhpClient 之 maxRetryTimes)。修正前 20 次累計 36.6 小時, 形同永不結束
        let tot = 0
        for (let n = 1; n <= 20; n++) {
            tot += retryDelay(n)
        }
        assert.strict.deepEqual(tot <= 3600000, true, `20 次累計 ${(tot / 3600000).toFixed(2)} 小時`)
    })

})
