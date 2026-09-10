import { validateHeaderValue } from 'http'


/**
 * 檢核值是否可作為HTTP回應標頭之值
 *
 * 以node之低階標頭驗證(同setHeader之判定, 禁CR/LF與其他控制字元、禁超出latin1範圍者)檢核應用端或請求端可控之標頭值
 *
 * why: 原只以isestr檢核, 含CR/LF或非latin1字元者交給hapi設定標頭時拋錯而回裸HTTP 500,
 * 非套件之錯誤封包, 前端無法解析且伺服器不發error事件
 *
 * @param {String} name 輸入標頭名稱字串
 * @param {*} value 輸入待檢核之標頭值
 * @returns {Boolean} 回傳是否為合法標頭值
 * @example
 *
 * console.log(isValidHeaderValue('Content-Type', 'text/plain'))
 * // => true
 *
 * console.log(isValidHeaderValue('Content-Type', 'text/plain\r\nX: 1'))
 * // => false
 *
 * console.log(isValidHeaderValue('Content-Type', 'text/中文'))
 * // => false
 *
 */
function isValidHeaderValue(name, value) {
    try {
        validateHeaderValue(name, value)
        return true
    }
    catch (err) {
        return false
    }
}


export default isValidHeaderValue
