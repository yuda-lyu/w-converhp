import isfun from 'wsemi/src/isfun.mjs'


/**
 * 安全判定值是否像串流(有可呼叫之pipe)
 *
 * 回三態, 不回布林二態:
 *   true  確定像串流
 *   false 確定不像串流
 *   null  判定失敗(pipe為會拋錯之getter或Proxy trap) —— 其值本就不可用, 由呼叫端收斂為錯誤封包
 *
 * why 須區分 false 與 null: 「確定不是串流」者(如plain object)可走具體化路徑,
 * 而「讀不到」者不可當成「不是串流」而繼續處理, 否則後續之JSON.stringify等操作會再次觸發同一個拋錯getter
 *
 * @param {*} v 輸入任意值
 * @returns {Boolean|null} 回傳三態判定
 * @example
 *
 * import stream from 'stream'
 * console.log(hasPipe(new stream.PassThrough()))
 * // => true
 *
 * console.log(hasPipe({ x: 1 }))
 * // => false
 *
 * let o = {}
 * Object.defineProperty(o, 'pipe', { get() { throw new Error('boom') } })
 * console.log(hasPipe(o))
 * // => null
 *
 */
function hasPipe(v) {
    try {
        return isfun(v.pipe)
    }
    catch (err) {
        return null
    }
}


export default hasPipe
