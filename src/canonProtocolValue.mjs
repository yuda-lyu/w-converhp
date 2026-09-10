import isfun from 'wsemi/src/isfun.mjs'


/**
 * 正規化協定鍵之值, 使該鍵不可能於序列化時消失
 *
 * why: JSON對值為undefined、function、symbol之鍵是「靜默丟棄整個鍵」而非拋錯
 * (見wsemi之obj2stru8arr檔頭所列失真集合), 故 obj2u8arr({ success: undefined }) 會回 state 為 success
 * 但解回 {} —— 連success鍵都不存在。前端只能以無意義之'data does not contain success or error'拒絕,
 * 而伺服器亦不發任何error事件, 應用端無從得知
 *
 * 於包入協定外殼前先把這三種值轉為null(與procDeal對output已有之處置一致), 協定鍵遂於結構上不可能消失,
 * 不需encode後再decode回來檢查(大輸出之代價加倍)
 *
 * @param {*} v 輸入協定鍵之值
 * @returns {*} 回傳可安全序列化之值
 * @example
 *
 * console.log(canonProtocolValue(undefined), canonProtocolValue(() => {}), canonProtocolValue(Symbol('x')))
 * // => null null null
 *
 * console.log(canonProtocolValue({ a: 1 }), canonProtocolValue(0), canonProtocolValue(null))
 * // => { a: 1 } 0 null
 *
 */
function canonProtocolValue(v) {
    if (v === undefined || isfun(v) || typeof v === 'symbol') {
        return null
    }
    return v
}


export default canonProtocolValue
