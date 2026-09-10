import assert from 'assert'
import retryDelay, { maxDelay, nToPeak, baseDelay } from '../src/retryDelay.mjs'


/**
 * unit: 重試退避曲線(對應 src/retryDelay.mjs)
 *
 * 修正前之寫法把「成長率之校準常數」與「迴圈上限」當成同一件事:
 *     let maxRetry = 10
 *     let ratio = Math.pow(180000 / baseDelay, 1 / (maxRetry - 1))
 *     ...
 *     while (...) { let t = Math.round(baseDelay * Math.pow(ratio, n - 1)) }
 * 而迴圈上限實際是呼叫端可設之 retry, 與該常數毫無關聯。故 retry 大於 10 時延遲無界:
 *     n=20 → 16 小時, n=24 → 6.7 天, n≥27 → 超過 2^31-1 而 setTimeout 溢位成 1ms(退避塌陷為熱迴圈)
 *
 * 本檔鎖住三件事: 起點、封頂、以及「任何 n 皆不超過 32 位元計時器上限」。
 */
describe('unit-retryDelay', function() {

    //maxTimer, node 計時器以 32 位元帶號整數表達, 超過即溢位並以 1ms 觸發
    let maxTimer = 2147483647

    it('第 1 次重試之等待為 baseDelay', function() {
        assert.strict.deepEqual(retryDelay(1), baseDelay)
    })

    it('第 nToPeak 次恰達上限 maxDelay', function() {
        assert.strict.deepEqual(retryDelay(nToPeak), maxDelay)
    })

    it('nToPeak 之前為嚴格遞增', function() {
        for (let n = 1; n < nToPeak; n++) {
            assert.strict.deepEqual(retryDelay(n) < retryDelay(n + 1), true, `n=${n}: ${retryDelay(n)} 應小於 ${retryDelay(n + 1)}`)
        }
    })

    it('nToPeak 之後一律維持在 maxDelay, 不再成長(修正前 n=20 為 16 小時、n=24 為 6.7 天)', function() {
        for (let n of [11, 12, 16, 20, 24, 27, 50, 1000]) {
            assert.strict.deepEqual(retryDelay(n), maxDelay, `n=${n}`)
        }
    })

    it('任何 n 之等待皆不得超過 32 位元計時器上限(修正前 n≥27 溢位, 實際等 1ms 而使退避塌陷為熱迴圈)', function() {
        for (let n = 1; n <= 200; n++) {
            let t = retryDelay(n)
            assert.strict.deepEqual(t <= maxTimer, true, `n=${n} 之等待 ${t}ms 超過計時器上限`)
        }
    })

    it('非法之 n 退回 baseDelay, 不得回 NaN 或負值', function() {
        for (let v of [0, -1, NaN, Infinity, -Infinity, undefined, null, 'x', {}]) {
            let t = retryDelay(v)
            assert.strict.deepEqual(Number.isInteger(t) && t >= 0 && t <= maxDelay, true, `${String(v)} → ${t}`)
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
