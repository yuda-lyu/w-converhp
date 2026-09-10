import isfun from 'wsemi/src/isfun.mjs'


/**
 * 清理應用端交出之串流
 *
 * 只對「像串流(有pipe)且可destroy」者呼叫, 不對任意值(Buffer、字串、數值、plain object)盲呼叫destroy
 *
 * why try須包住屬性讀取本身而非只包v.destroy(): 應用端物件之pipe/destroy可能是會拋錯之getter或Proxy trap,
 * 只包v.destroy()時該例外會逸出handler, hapi只能回裸HTTP 500且伺服器不發error事件 —— 與本函數要收斂之情形同型
 *
 * 本函數不回報成敗: 清理為盡力而為, 失敗不應改變呼叫端之錯誤處置流程
 *
 * @param {*} v 輸入應用端交出之值
 * @example
 *
 * import fs from 'fs'
 * destroyStreamRead(fs.createReadStream('./a.txt')) //銷毀
 * destroyStreamRead(Buffer.from('x'))               //非串流, 不動作
 * destroyStreamRead(null)                           //不動作
 *
 */
function destroyStreamRead(v) {
    try {
        if (v && isfun(v.pipe) && isfun(v.destroy)) {
            v.destroy()
        }
    }
    catch (err) {}
}


export default destroyStreamRead
