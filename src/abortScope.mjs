import delay from 'wsemi/src/delay.mjs'


/**
 * 判定是否為 AbortSignal
 *
 * 以鴨子型別判定(aborted 為布林, 且具 addEventListener 與 removeEventListener), 不用 instanceof:
 * 跨 realm(iframe)與 polyfill 之 signal 其原型不同, instanceof 會誤判為非 AbortSignal 而使中止靜默失效。
 * 不用 wsemi 之 isobj: AbortSignal 之 Object.prototype.toString 為 [object AbortSignal], isobj 對其回 false
 *
 * @param {*} v 輸入任意值
 * @returns {Boolean} 回傳是否為 AbortSignal
 */
function isAbortSignal(v) {
    return v !== null && typeof v === 'object' && typeof v.aborted === 'boolean' && typeof v.addEventListener === 'function' && typeof v.removeEventListener === 'function'
}


//abortReasonOf, 中止之拒絕值: 依 WHATWG DOM 之慣例取 signal.reason 原樣;
//執行環境之 AbortSignal 不提供 reason 者(較舊之瀏覽器)補一個 name 為 AbortError 之錯誤, 使拒絕值不為 undefined
function abortReasonOf(signal) {
    let r = signal ? signal.reason : undefined
    if (r !== undefined) {
        return r
    }
    try {
        return new DOMException('This operation was aborted', 'AbortError')
    }
    catch (err) {}
    let e = new Error('This operation was aborted')
    e.name = 'AbortError'
    return e
}


/**
 * 建立一次公開呼叫(execute、upload、download)之中止範圍
 *
 * 對外部 signal 只掛一個 abort 監聽, 於 dispose 時移除: 長壽 signal 被重複用於大量呼叫時不累積監聽。
 * 交給 axios 者為範圍內部之 AbortController 之 signal(axios 每次請求各自於其上掛監聽), 外部 signal 不承受逐次請求之監聽。
 * 未給 signal(undefined、null)者為永不中止之範圍: 不建 AbortController、signal 為 undefined、race 直通、delay 即一般之延遲 ——
 * 使未使用中止之既有呼叫其行為與組態(含交給 axios 之 signal)皆與未支援中止前相同。
 *
 * 中止為單向且只觸發一次: 觸發時先中止內部 AbortController(使在途之 axios 請求中止), 再依註冊順序呼叫 onAbort 之處理器;
 * 已中止後才註冊之處理器立即被呼叫。處理器之拋錯一律吞下, 不得中斷其餘處理器。
 *
 * @param {AbortSignal} [signal] 輸入外部之 AbortSignal, 未給(undefined 或 null)代表永不中止; 是否為 AbortSignal 由呼叫端先以 isAbortSignal 判定
 * @returns {Object} 回傳範圍物件, 含 signal(交 axios 之內部 signal, 未給外部 signal 者為 undefined)、isAborted()、reason()、
 * onAbort(fn)(註冊中止處理器, 回傳取消註冊之函數)、race(promise 或 function)(中止即以 reason 拒絕; 給函數者於已中止時不呼叫)、
 * delay(ms)(可被中止之延遲, 中止即清除計時器並以 reason 拒絕)、dispose()(移除對外部 signal 之監聽, 呼叫結束時呼叫)
 * @example
 *
 * let ac = new AbortController()
 * let scope = genAbortScope(ac.signal)
 * scope.race(() => new Promise((resolve) => setTimeout(resolve, 1000)))
 *     .catch((err) => {
 *         console.log(err === ac.signal.reason) // => true
 *     })
 * ac.abort()
 * scope.dispose()
 *
 */
function genAbortScope(signal) {
    let bSignal = signal !== undefined && signal !== null
    let ac = bSignal ? new AbortController() : null
    let hs = []
    let aborted = false
    let reason

    //fire, 中止之唯一觸發點: 只觸發一次
    let fire = () => {
        if (aborted) {
            return
        }
        aborted = true
        reason = abortReasonOf(signal)
        try {
            ac.abort(reason)
        }
        catch (err) {}
        let list = hs
        hs = []
        for (let h of list) {
            try {
                h(reason)
            }
            catch (err) {}
        }
    }

    //onUserAbort, 掛於外部 signal 之唯一監聽
    let onUserAbort = () => {
        fire()
    }
    if (bSignal) {
        if (signal.aborted) {
            fire()
        }
        else {
            signal.addEventListener('abort', onUserAbort)
        }
    }

    //onAbort, 註冊中止處理器; 已中止者立即呼叫
    let onAbort = (h) => {
        if (aborted) {
            try {
                h(reason)
            }
            catch (err) {}
            return () => {}
        }
        hs.push(h)
        return () => {
            hs = hs.filter((x) => x !== h)
        }
    }

    //race, 與中止競速: 未給外部 signal 者直通; 已中止者不呼叫所給函數; 所給 promise 之後續拒絕由此接住, 不成未處理之 rejection
    let race = (pOrFn) => {
        if (!bSignal) {
            return typeof pOrFn === 'function' ? pOrFn() : pOrFn
        }
        if (aborted) {
            return Promise.reject(reason)
        }
        let p = typeof pOrFn === 'function' ? pOrFn() : pOrFn
        return new Promise((resolve, reject) => {
            let off = onAbort(reject)
            Promise.resolve(p).then((v) => {
                off()
                resolve(v)
            }, (e) => {
                off()
                reject(e)
            })
        })
    }

    //delayAbortable, 可被中止之延遲
    let delayAbortable = (ms) => {
        if (!bSignal) {
            return delay(ms)
        }
        return new Promise((resolve, reject) => {
            let t = null
            let off = onAbort((r) => {
                if (t !== null) {
                    clearTimeout(t)
                    t = null
                }
                reject(r)
            })
            if (aborted) {
                return
            }
            t = setTimeout(() => {
                t = null
                off()
                resolve()
            }, ms)
        })
    }

    //dispose, 呼叫結束: 移除對外部 signal 之監聽並清空處理器
    let dispose = () => {
        if (bSignal) {
            signal.removeEventListener('abort', onUserAbort)
        }
        hs = []
    }

    return {
        signal: ac ? ac.signal : undefined,
        isAborted: () => aborted,
        reason: () => reason,
        onAbort,
        race,
        delay: delayAbortable,
        dispose,
    }
}


//r, 匯出面(帳本 R21、R23): 兩成員皆有模組外之使用者 —— isAbortSignal 供 client 之入口檢核 opt.signal 之型別(Q2), genAbortScope 供 client 建立每次公開呼叫之範圍;
//abortReasonOf 只被 genAbortScope 使用, 不匯出(其補值行為以 genAbortScope 之 reason() 測試)
let r = {
    isAbortSignal,
    genAbortScope,
}


export default r
