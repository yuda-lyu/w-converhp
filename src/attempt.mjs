import isestr from 'wsemi/src/isestr.mjs'
import getErrorMessage from 'wsemi/src/getErrorMessage.mjs'


/**
 * 觸碰應用端可控值之唯一入口
 *
 * 應用端可用會拋錯之getter或Proxy包裝其交給套件之值(觀測、記錄之常見手法), 而任何屬性讀取都可能拋錯:
 *   instanceof 會觸發 Proxy 之 getPrototypeOf trap;
 *   typed array 之 .length 對 Proxy receiver 會拋 Method get TypedArray.prototype.length called on incompatible receiver;
 *   stream.pipeline 建立時會讀來源之 pipe 等方法。
 * 這些例外若逸出 handler, hapi 只能回裸 HTTP 500, 且套件不發任何 error 事件, 應用端無從得知是自己給錯值。
 *
 * 本原語把每一次觸碰收斂為 tagged result, 使「公開訊息穩定、內部真因不丟」兩者兼得:
 *   成功回 { ok: true, value };失敗回 { ok: false, stage, cause }
 * stage 供組錯誤訊息, cause 為原始例外訊息 —— 公開訊息維持既有字面(invalid streamRead 等), 真因只進 error 事件供診斷
 *
 * 取因用 wsemi 之 getErrorMessage 而非 String(err): 後者對 toString 會拋錯之物件、對 null 與 undefined 皆拋錯,
 * 會使 catch 區塊自身拋出而讓例外仍逸出、外層 try 形同虛設。getErrorMessage 以候選階梯取值且整體包 try,
 * 契約上於任何輸入下皆不拋錯且回傳必為字串(wsemi 1.8.90 實測 25 種惡意輸入: 0 拋錯、0 非字串),
 * 但其取不到內容時回空字串(如 new Error()、已撤銷之 Proxy), 故此處另補非空退路
 *
 * @param {String} stage 輸入本次觸碰之階段名稱字串, 供錯誤訊息辨識
 * @param {Function} fn 輸入實際執行觸碰之函數
 * @returns {Object} 回傳 { ok: true, value } 或 { ok: false, stage, cause }
 * @example
 *
 * let o = {}
 * Object.defineProperty(o, 'x', { get() { throw new Error('boom') } })
 *
 * console.log(attempt('read x', () => o.x))
 * // => { ok: false, stage: 'read x', cause: 'boom' }
 *
 * console.log(attempt('read y', () => 1))
 * // => { ok: true, value: 1 }
 *
 */
function attempt(stage, fn) {
    try {
        return { ok: true, value: fn() }
    }
    catch (err) {
        let cause = getErrorMessage(err)
        return { ok: false, stage, cause: isestr(cause) ? cause : 'unknown error' }
    }
}


export default attempt
