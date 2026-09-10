import get from 'lodash-es/get.js'
import obj2u8arr from 'wsemi/src/obj2u8arr.mjs'
import canonProtocolValue from './canonProtocolValue.mjs'


/**
 * 序列化回應封包之唯一出口
 *
 * 兩道保護:
 *   1. 協定鍵之值先經canonProtocolValue正規化, 使該鍵於結構上不可能因JSON之靜默失真而消失
 *   2. 以wsemi之嚴格模式取狀態, 值無法序列化者(如含BigInt、循環參照)回null並呼叫funError
 *
 * why 不用「encode後再decode回來檢查協定鍵」: 該作法對大輸出之代價加倍, 而第1點已於結構上保證
 *
 * @param {Object} out 輸入待序列化之封包物件, 其鍵為協定鍵(success或error)
 * @param {Function} funError 輸入序列化失敗時之回報函數, 參數為原因字串
 * @returns {Uint8Array|null} 回傳序列化結果; 失敗時回null(已呼叫funError)
 * @example
 *
 * console.log(encodeOut({ success: { a: 1 } }, () => {}) !== null)
 * // => true
 *
 * console.log(encodeOut({ error: undefined }, () => {}) !== null) //協定鍵被正規化為null而保留
 * // => true
 *
 * console.log(encodeOut({ success: { id: 1n } }, (msg) => console.log(msg)))
 * // => obj2stru8arr: TypeError: Do not know how to serialize a BigInt
 * // => null
 *
 */
function encodeOut(out, funError) {

    //canon, 協定鍵之值先正規化, 使其不因JSON之靜默失真而消失
    let o = {}
    for (let k of Object.keys(out)) {
        o[k] = canonProtocolValue(out[k])
    }

    let r = obj2u8arr(o, { returnWithStateAndMsg: true })
    if (get(r, 'state') !== 'success') {
        funError(get(r, 'msg', 'unknown error'))
        return null
    }

    return r.msg
}


export default encodeOut
