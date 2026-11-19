import obj2u8arr from 'wsemi/src/obj2u8arr.mjs'
import probeReadable from './probeReadable.mjs'


/**
 * 嚴格序列化: 以嚴格模式取狀態, 且先確認值可讀(帳本 R3、R32)
 *
 * 本套件對應用端與呼叫端交出之值之序列化(伺服端之回應封包、合併消費結果之落地、前端 execute 之請求封包)唯一經此函數:
 * 狀態取法同 wsemi 之 obj2u8arr 嚴格模式(returnWithStateAndMsg), 不可序列化者(含 BigInt、循環參照)回 state 為 error;
 * 另於其前以探針(probeReadable)確認值內無不可讀者 —— wsemi 1.9.69 起判斷函數對不可讀值不再拋錯, 序列化器不再因此回 error,
 * 而是把拋錯之 Symbol.toStringTag 之物件序列化為其可見之鍵(甚至 {}), 宣稱成功卻已失真
 *
 * @param {Object|Array} data 輸入待序列化之物件或陣列
 * @returns {Object} 回傳 { state, msg }: state 為 'success' 時 msg 為 Uint8Array, 為 'error' 時 msg 為原因字串
 */
function encodeStrict(data) {
    let cause = probeReadable(data)
    if (cause !== '') {
        return { state: 'error', msg: `unreadable value: ${cause}` }
    }
    return obj2u8arr(data, { returnWithStateAndMsg: true })
}


export default encodeStrict
