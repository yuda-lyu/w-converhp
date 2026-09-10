import get from 'lodash-es/get.js'
import isestr from 'wsemi/src/isestr.mjs'
import obj2u8arr from 'wsemi/src/obj2u8arr.mjs'
import responseU8aStream from './responseU8aStream.mjs'


/**
 * 以本套件之錯誤封包回應
 *
 * 本函數為所有失敗之最終出口: 其自身之序列化不再以嚴格模式取狀態, 因為輸入之msg恆為套件自產字串
 * (全部呼叫點皆為字面或模板字串), 且此處若再失敗亦無處可退
 *
 * @param {Object} res 輸入hapi之response toolkit
 * @param {String} msg 輸入錯誤訊息字串
 * @param {Object} [opt={}] 輸入設定物件, 預設{}
 * @param {Boolean} [opt.retryable=true] 輸入是否可重試布林值, 預設true。
 * 給false者限「可證明不需重試」之錯誤: 結果僅由client自行建構之請求內容(mode、fileHash、chunkTotal、chunkIndex、packageId、fileId)決定, 重送同一請求必得同一結果;
 * 凡涉及權限(permission denied)、應用端reject、應用端回傳形狀不合、磁碟、網路者皆為狀態不穩, 不得標示, 依重試原則由前端照常重試。
 * 標示同時置於封包(供execute/upload/dwgfn之本體解析)與標頭Return-Retryable(供download之串流路徑, 該路徑只讀標頭不解析本體)
 * @returns {Object} 回傳hapi之response物件
 */
function responseU8aStreamWithError(res, msg, opt = {}) {

    //check
    if (!isestr(msg)) {
        console.log('msg', msg)
        console.log(`msg is not an effective string, set msg=''`)
        msg = ''
    }

    //retryable
    let retryable = get(opt, 'retryable', true)

    //out
    let out = {
        error: msg,
    }
    if (retryable === false) {
        out.retryable = false
    }

    //u8aOut
    let u8aOut = obj2u8arr(out)

    //r
    let r = responseU8aStream(res, u8aOut, { returnType: 'error', returnMsg: msg })
    if (retryable === false) {
        r.header('Return-Retryable', 'false')
    }

    return r
}


export default responseU8aStreamWithError
