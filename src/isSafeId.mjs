import isestr from 'wsemi/src/isestr.mjs'


/**
 * 檢核前端可控之識別字(fileHash、packageId等)是否安全
 *
 * 此類字串會直接參與伺服器檔案路徑之組裝(pathUploadTemp下之切片檔、合併檔、.done、.error),
 * 含 . / \ : 即可能以 ../ 逸出資料夾造成路徑穿越, 故僅允許英數字(xxhash為16位hex, 自然符合)並限制長度
 *
 * @param {String} s 輸入識別字
 * @returns {Boolean} 回傳是否安全
 */
function isSafeId(s) {
    return isestr(s) && s.length <= 128 && /^[A-Za-z0-9]+$/.test(s)
}


export default isSafeId
