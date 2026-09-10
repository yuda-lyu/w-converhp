import stream from 'stream'
import get from 'lodash-es/get.js'
import isestr from 'wsemi/src/isestr.mjs'
import isValidHeaderValue from './isValidHeaderValue.mjs'


/**
 * 以octet-stream回應二進位封包, 並附上本套件之回應協定標頭
 *
 * 本套件之回應協定有兩層: 本體(obj2u8arr之success/error)與標頭(Return-Type、Return-Msg、Return-Retryable、Content-Disposition)。
 * 下載路徑(client之downloadStream)只讀標頭不解析本體, 故標頭是協定的一部分而非附屬資訊
 *
 * Return-Msg之值域檢核(見isValidHeaderValue):
 * 錯誤訊息可能回顯請求端可控之字串(如 invalid mode[<mode>] in payload), 該值若含CR/LF或超出latin1範圍(如中文),
 * node於寫標頭時拋錯而hapi只能回裸HTTP 500 —— 非本套件之錯誤封包, 前端無法解析且伺服器不發error事件。
 * 故不合法者**不送該標頭**而非讓整個回應失敗: 完整訊息仍在本體之error封包內, 前端解析本體即可取得;
 * 下載路徑雖只讀標頭, 但其錯誤訊息皆為套件自產之固定字串, 不受影響
 *
 * @param {Object} res 輸入hapi之response toolkit
 * @param {Uint8Array} u8a 輸入待回應之二進位封包
 * @param {Object} [opt={}] 輸入設定物件, 預設{}
 * @param {String} [opt.returnType=''] 輸入Return-Type標頭值, 為'success'或'error', 空字串代表不送
 * @param {String} [opt.returnMsg=''] 輸入Return-Msg標頭值, 空字串或非法標頭值代表不送
 * @returns {Object} 回傳hapi之response物件
 */
function responseU8aStream(res, u8a, opt = {}) {

    //stream
    let smr = new stream.Readable()
    smr._read = () => {}
    smr.push(u8a)
    smr.push(null)

    //returnType
    let returnType = get(opt, 'returnType', '')

    //returnMsg
    let returnMsg = get(opt, 'returnMsg', '')

    //r
    let r = res.response(smr)
        .header('Cache-Control', 'no-cache, no-store, must-revalidate')
        .header('Content-Type', 'application/octet-stream')
        .header('Content-Length', smr.readableLength)
    if (isestr(returnType)) {
        r.header('Return-Type', returnType)
    }

    //check, 標頭值須通過值域檢核; 不合法者略過該標頭而非使整個回應失敗(完整訊息仍在本體)
    if (isestr(returnMsg) && isValidHeaderValue('Return-Msg', returnMsg)) {
        r.header('Return-Msg', returnMsg)
    }

    return r
}


export default responseU8aStream
