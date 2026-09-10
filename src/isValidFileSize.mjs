import isp0int from 'wsemi/src/isp0int.mjs'


/**
 * 檢核應用端給之fileSize是否可用
 *
 * fileSize有兩個用途, 兩者決定了值域:
 *   1. 原樣(經cint正規化後)寫入Content-Length —— HTTP之訊息分框依據
 *   2. 與實際位元組數比較(可事前具體化者比 buf.length, 串流則於計數之flush比) —— 故比較前須先以cint轉為數值
 *
 * why 須為安全整數: 原以lodash isNumber檢核, 其對NaN、Infinity、負數、小數皆回true, 此類值交給node寫標頭即拋錯,
 * hapi於送標頭階段失敗只能直接斷線, 前端連回應標頭都收不到而伺服器亦不發error事件;
 * 另超出安全整數者(如Number.MAX_SAFE_INTEGER+1或1e21)雖為整數, 但其字串形式帶指數記號(如'1e+21'),
 * 不合Content-Length之1*DIGIT語法, 實測同樣是連線懸置且無回應標頭
 *
 * 採wsemi之isp0int搭配useLimitSafe, 故數字字串(如'1058915')亦視為有效, 呼叫端須以cint正規化後才可用於比較與寫標頭
 *
 * @param {*} v 輸入任意值
 * @returns {Boolean} 回傳是否為可用之fileSize
 * @example
 *
 * console.log(isValidFileSize(0), isValidFileSize(1058915), isValidFileSize('1058915'))
 * // => true true true
 *
 * console.log(isValidFileSize(NaN), isValidFileSize(Infinity), isValidFileSize(-1), isValidFileSize(1.5))
 * // => false false false false
 *
 * console.log(isValidFileSize(Number.MAX_SAFE_INTEGER + 1), isValidFileSize(1e21))
 * // => false false
 *
 */
function isValidFileSize(v) {
    return isp0int(v, { useLimitSafe: true })
}


export default isValidFileSize
