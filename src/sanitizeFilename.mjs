import isestr from 'wsemi/src/isestr.mjs'


/**
 * 將來源不可信之檔名(如伺服器回傳之Content-Disposition)整理為可安全落地之單一檔名
 *
 * 依瀏覽器對下載檔名之處理慣例:
 *   - 只取最末路徑段(同時處理 / 與 \), 去除 . 與 .. 段
 *   - 去除控制字元(含NUL)與各平台非法字元 < > : " | ? *; 其中冒號亦擋掉Windows磁碟機相對路徑(如 C:evil, 無分隔符卻能逸出當前資料夾)
 *   - 去除結尾之點與空白(Windows會忽略, 避免判定與實際落點不一致)
 *   - Windows保留裝置名(CON/PRN/AUX/NUL/COM1-9/LPT1-9, 不分大小寫且不論副檔名)前置底線
 * 不做路徑包含判定, 該判定需path模組, 由nodejs端另行以isPathInside處理
 *
 * @param {String} name 輸入不可信之檔名
 * @param {String} [def='unknown'] 輸入整理後為空時之替代檔名, 預設'unknown'
 * @returns {String} 回傳整理後之檔名
 */
function sanitizeFilename(name, def = 'unknown') {

    //check
    if (!isestr(name)) {
        return def
    }

    //只取最末路徑段
    let s = name.replace(/\\/g, '/').split('/').filter((v) => v !== '' && v !== '.' && v !== '..').pop() || ''

    //去除控制字元與非法字元(比對控制字元正是本意, 故停用no-control-regex)
    // eslint-disable-next-line no-control-regex
    s = s.replace(/[\x00-\x1f\x7f<>:"|?*]/g, '_')

    //去除結尾之點與空白
    s = s.replace(/[. ]+$/g, '')

    //保留裝置名
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i.test(s)) {
        s = `_${s}`
    }

    //check
    if (s === '') {
        return def
    }

    return s
}


export default sanitizeFilename
