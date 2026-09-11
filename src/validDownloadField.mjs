import isestr from 'wsemi/src/isestr.mjs'
import cstr from 'wsemi/src/cstr.mjs'
import cint from 'wsemi/src/cint.mjs'
import attempt from './attempt.mjs'
import isValidFileSize from './isValidFileSize.mjs'
import isValidHeaderValue from './isValidHeaderValue.mjs'


//toWellFormed, 以 U+FFFD 取代孤立代理對
let toWellFormed = (s) => {
    if (typeof s.toWellFormed === 'function') {
        return s.toWellFormed()
    }
    return s.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '�')
}


/**
 * 判定並正規化應用端 download 事件回傳之單一欄位(filename、fileSize、fileType)
 *
 * why 判定本身須在 attempt 內: 欄位之**擷取**已由 readDownloadFields 收進 attempt, 而擷取到的值之**型別判定**原本在其外 ——
 * wsemi 之 isestr / isValidFileSize 皆經 Object.prototype.toString.call, 會觸發值之 Symbol.toStringTag getter;
 * 該 getter 拋錯時三條下載路由皆回裸 HTTP 500 且 0 則事件, /dw 之應用端串流且未被銷毀(實測第十輪 A5, 7 格)。與帳本 R1 之 #32 同型。
 *
 * why 須正規化為字串基本型: 通過 isestr 之物件(帶 Symbol.toStringTag='String')其 toString 可拋錯, 原本 /dwgfn 有 attempt + cstr 而 /dw、/dwgf 無 ——
 * 同一個 filename 於 /dwgfn 回錯誤 + 1 則事件, 於另兩路由靜默送出空檔名(實測第十輪 A6)。收斂於此, 三路由同一判定。
 *
 * why filename 須取代孤立代理對: /dw 以 wsemi 之 str2b64 編碼, 其寬鬆模式吞掉 URIError 而回空字串, 檔名整個消失;
 * /dwgf 之 encodeRfc5987 則以 U+FFFD 取代(實測第十輪 A7)。正規化於此, 兩種編碼器得到同一個檔名。
 *
 * @param {String} name 輸入欄位名稱, 為 'filename'、'fileSize' 或 'fileType'
 * @param {*} v 輸入應用端交出之欄位值
 * @returns {Object} 回傳 { ok, value, cause }: ok 為是否可用; value 為正規化後之值(fileSize 為數值, 其餘為字串基本型); cause 為判定時拋出之原因(未拋錯者為空字串)
 * @example
 *
 * console.log(validDownloadField('fileSize', '1024'))
 * // => { ok: true, value: 1024, cause: '' }
 *
 * console.log(validDownloadField('filename', 123))
 * // => { ok: false, value: undefined, cause: '' }
 *
 * let fake = { get [Symbol.toStringTag]() { throw new Error('boom') } }
 * console.log(validDownloadField('fileType', fake))
 * // => { ok: false, value: undefined, cause: 'boom' }
 *
 */
function validDownloadField(name, v) {
    let a = attempt(`check field[${name}]`, () => {
        if (name === 'fileSize') {
            if (!isValidFileSize(v)) {
                return { ok: false }
            }
            return { ok: true, value: cint(v) } //isValidFileSize 亦接受數字字串, 須正規化為數值後才可寫 Content-Length 並與實送位元組數以 === 比較
        }
        if (name === 'filename' || name === 'fileType') {
            if (!isestr(v)) {
                return { ok: false }
            }
            let s = cstr(v) //toString 拋錯者 cstr 回空字串
            if (!isestr(s)) {
                return { ok: false }
            }
            if (name === 'fileType') {
                if (!isValidHeaderValue('Content-Type', s)) {
                    return { ok: false }
                }
                return { ok: true, value: s }
            }
            return { ok: true, value: toWellFormed(s) }
        }
        throw new Error(`unknown field[${name}]`)
    })
    if (!a.ok) {
        return { ok: false, value: undefined, cause: a.cause }
    }
    return { ok: a.value.ok, value: a.value.value, cause: '' }
}


export default validDownloadField
