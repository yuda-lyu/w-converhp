import get from 'lodash-es/get.js'
import attempt from './attempt.mjs'


/**
 * 讀取應用端download事件回傳物件之欄位
 *
 * 逐欄各自以attempt收斂, 使某欄之getter拋錯不影響不需該欄之路由:
 *   /dwgfn 只需 streamRead 與 filename, 若一併讀 fileSize 而其getter拋錯, 該路由會由成功變失敗(行為改變)
 *
 * @param {Object} r 輸入應用端download事件所resolve之物件
 * @param {Array} keys 輸入本次需要之欄位名稱陣列
 * @returns {Object} 回傳 { ok: true, fields } 或 { ok: false, field, cause }
 * @example
 *
 * console.log(readDownloadFields({ filename: 'a.bin', fileSize: 3 }, ['filename', 'fileSize']))
 * // => { ok: true, fields: { filename: 'a.bin', fileSize: 3 } }
 *
 * let r = {}
 * Object.defineProperty(r, 'fileSize', { get() { throw new Error('boom') }, enumerable: true })
 * console.log(readDownloadFields(r, ['fileSize']))
 * // => { ok: false, field: 'fileSize', cause: 'boom' }
 *
 */
function readDownloadFields(r, keys) {
    let fields = {}
    for (let k of keys) {
        let a = attempt(`read field[${k}]`, () => {
            return get(r, k)
        })
        if (!a.ok) {
            return { ok: false, field: k, cause: a.cause }
        }
        fields[k] = a.value
    }
    return { ok: true, fields }
}


export default readDownloadFields
