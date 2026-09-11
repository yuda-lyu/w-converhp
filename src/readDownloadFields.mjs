import get from 'lodash-es/get.js'
import attempt from './attempt.mjs'


/**
 * 讀取應用端download事件回傳物件之欄位
 *
 * 逐欄各自以attempt收斂, 使某欄之getter拋錯不影響不需該欄之路由:
 *   /dwgfn 只需 streamRead 與 filename, 若一併讀 fileSize 而其getter拋錯, 該路由會由成功變失敗(行為改變)
 *
 * 失敗時**一併回傳已成功讀到之欄位**(fields), 使呼叫端能清理已取得之資源
 *
 * why: streamRead 一律排在 keys 之首, 故凡後續欄位之 getter 拋錯者, 該串流**已經在套件手上**。
 * 原本只回 { ok:false, field, cause } 而不回 fields, 路由層遂無從清理 —— 應用端交出之串流(常為 fs.createReadStream)
 * 就此失去引用且未被 destroy, 其 fd 持續開啟。實測(tmp/probe_r9_rest.mjs 第1節): 四欄之中後三欄拋錯時
 * 串流皆為 destroyed=false。三條下載路由原有之註解「讀取失敗時尚未取得串流引用, 無從清理」僅對「首欄即拋錯」成立
 *
 * @param {Object} r 輸入應用端download事件所resolve之物件
 * @param {Array} keys 輸入本次需要之欄位名稱陣列
 * @returns {Object} 回傳 { ok: true, fields } 或 { ok: false, field, cause, fields };後者之 fields 為失敗前已讀到者
 * @example
 *
 * console.log(readDownloadFields({ filename: 'a.bin', fileSize: 3 }, ['filename', 'fileSize']))
 * // => { ok: true, fields: { filename: 'a.bin', fileSize: 3 } }
 *
 * let r = { filename: 'a.bin' }
 * Object.defineProperty(r, 'fileSize', { get() { throw new Error('boom') }, enumerable: true })
 * console.log(readDownloadFields(r, ['filename', 'fileSize']))
 * // => { ok: false, field: 'fileSize', cause: 'boom', fields: { filename: 'a.bin' } }
 *
 */
function readDownloadFields(r, keys) {
    let fields = {}
    for (let k of keys) {
        let a = attempt(`read field[${k}]`, () => {
            return get(r, k)
        })
        if (!a.ok) {
            return { ok: false, field: k, cause: a.cause, fields } //fields為已成功讀到者, 供呼叫端清理
        }
        fields[k] = a.value
    }
    return { ok: true, fields }
}


export default readDownloadFields
