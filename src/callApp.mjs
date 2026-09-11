/**
 * 派發一次應用端呼叫, 並保證該次呼叫必定終結
 *
 * why: 本套件之路由層刻意關閉 timeout.server 與 timeout.socket(大檔傳輸本就超過任何固定值),
 * 宿主之兜底因此不存在。無人接聽時該 pm 永無人 settle, 請求即**永久懸置**且 0 則 error 事件
 * (實測 tmp/probe_r9_hang.mjs: /main、/dw、/ulctr 三入口皆 6000ms 未回應)。
 * 而該事實其實早就在套件手上 —— eventemitter3 之 emit 對無監聽器回 false, 只是被丟棄。
 *
 * why 於派發前以 listenerCount 判定, 而非取 evEmit 之回傳值:
 * wsemi 之 evEmit 對「無監聽器」與「監聽器同步拋錯」**皆回 false**(其 evEmit.mjs:107 之 catch 分支),
 * 兩者不可分辨(實測 tmp/probe_r9_emitret.mjs)。而拋錯那格已由 evEmit 之 funSettle 拒絕過 pm、
 * 且已發過一則 error 事件 —— 以回傳值判定會對該格**再發一則**, 即同一次失敗兩則(違反規則帳本 R5)。
 * 派發前判定則兩者分明, 且不受「監聽器於執行中移除自己」影響(判定早於執行)。
 *
 * 本函數只處理「**現在沒有人接聽**」這一種狀態。應用端接了卻不回話(忘記 settle pm、
 * resolve 一個永不 settle 之 promise、verifyConn 回 pending promise)一律**不在本函數職責內** ——
 * 那是對無限未來之斷言, 任何有限時點皆與「還沒好」不可分辨, 屬呼叫端責任。判準與否決過的修法見帳本 R12 之分界線。
 *
 * @param {Object} ev 輸入事件物件, 為 wsemi 之 evem 所建立之 eventemitter3 實例
 * @param {Function} evEmit 輸入本套件之派發函數, 簽章為 (name, ...args)
 * @param {String} name 輸入事件名稱字串
 * @param {Array} args 輸入事件參數陣列(不含 pm)
 * @param {Object} pm 輸入本次呼叫之回覆通道, 會作為事件之最後一個參數交給監聽器
 * @param {Function} funError 輸入無人接聽時之回報函數, 參數為原因字串
 * @returns {Boolean} 回傳是否已派發; false 代表無人接聽且 pm 已被拒絕
 * @example
 *
 * let ev = evem()
 * let pm = genPm()
 * console.log(callApp(ev, evEmit, 'execute', ['add', {}], pm, (msg) => console.log(msg)))
 * // => no listener for event[execute]
 * // => false
 *
 */
function callApp(ev, evEmit, name, args, pm, funError) {

    //check, 無人接聽即終結: 一次失敗恰一則事件(帳本 R5), 且不得懸置
    if (ev.listenerCount(name) === 0) {
        let msg = `no listener for event[${name}]`

        //settle 須排在回報之前(帳本 R10 之結構層): pm.reject 為此處唯一「非做不可」之事,
        //funError 會走到應用端之 error 監聽器, 其若拋錯而排在前面, 該次請求就永遠不會被 settle ——
        //那正是本模組存在所要防止的懸置。順序即保證, 不可對調
        pm.reject(msg)
        funError(msg)

        return false
    }

    //emit, pm 為事件之最後一個參數(本套件之契約)
    evEmit(name, ...args, pm)

    return true
}


export default callApp
