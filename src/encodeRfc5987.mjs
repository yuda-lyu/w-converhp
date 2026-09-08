import cstr from 'wsemi/src/cstr.mjs'


/**
 * 將字串編碼為 RFC 5987/8187 之 ext-value 內容, 供 Content-Disposition 之 filename*=UTF-8''<此值> 使用
 *
 * 與 encodeURIComponent 之差異: 後者不編碼 ' ( ) *, 但此四字元不在 RFC 5987 attr-char 內, 須一併 percent-encoding;
 * 孤立代理對(lone surrogate)會使 encodeURIComponent 拋 URIError, 逐 code point 編碼並以 U+FFFD 取代, 使任何字串皆可安全置入標頭
 *
 * @param {String} s 輸入字串(非字串以 cstr 轉換)
 * @returns {String} 回傳僅含 attr-char 與 %XX 之字串
 */
function encodeRfc5987(s) {
    let cs = Array.from(cstr(s)) //以 code point 切分, 合法代理對保持成對
    let r = ''
    for (let c of cs) {
        let e = ''
        try {
            e = encodeURIComponent(c)
        }
        catch (err) {
            e = '%EF%BF%BD' //U+FFFD
        }
        r += e
    }
    return r.replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
}


export default encodeRfc5987
