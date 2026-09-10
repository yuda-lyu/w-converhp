import stream from 'stream'
import get from 'lodash-es/get.js'
import isestr from 'wsemi/src/isestr.mjs'
import getErrorMessage from 'wsemi/src/getErrorMessage.mjs'
import isstr from 'wsemi/src/isstr.mjs'
import isbol from 'wsemi/src/isbol.mjs'
import haskey from 'wsemi/src/haskey.mjs'
import attempt from './attempt.mjs'
import hasPipe from './hasPipe.mjs'


/**
 * 將應用端交出之streamRead收斂為可交給hapi之回應本體, 並保證實送位元組數與fileSize一致
 *
 * why: 伺服器以fileSize寫Content-Length, 應用端給錯時hapi與node皆不會替套件擋:
 *   缺streamRead、非串流物件 → 本體不完整而連線懸置至前端閒置逾時(預設5分鐘, 再乘retryDownload); 宣告大於實送 → 同樣懸置;
 *   宣告小於實送 → 回200且前端存下被截斷之檔案並判成功(靜默毀損); stream-like、objectMode → hapi拒收回裸500且來源未被銷毀;
 *   已destroy之串流(如瀏覽器兩階段下載重用同一串流) → 懸置
 *
 * 作法: 可事前具體化者(Buffer、Uint8Array、字串、數值、布林、可JSON化物件, 皆為hapi現已接受之本體型別, 維持相容)先算實際長度,
 * 不符即回錯誤封包(標頭尚未送出);
 * 真串流則以計數串流(pipeline接於其後)包住: 超量立即以錯誤終止, 來源正常結束但不足則於flush產生錯誤 ——
 * 兩者皆令hapi中止回應(res.destroy), 前端收到不完整而失敗, 不會把壞檔當成功;
 * 來源自身出錯者沿用其錯誤不另報; pipeline亦使hapi於前端中斷時銷毀計數串流後連帶銷毀來源(維持原有收尾)
 *
 * 不採instanceof Readable之白名單: 會擋掉目前可正常下載之Buffer與plain object用法
 *
 * 四個階段(辨識 / 狀態讀取 / 建立pipeline / 具體化)全部經attempt: 應用端可用Proxy或拋錯之getter包裝其值,
 * 任一階段之屬性讀取皆可能拋錯而逸出成裸HTTP 500(見attempt.mjs之說明)
 *
 * 取捨(須知): 可事前具體化者由本函數以JSON.stringify產生bytes後交hapi, 故該route之json政策(replacer/space/suffix/escape)不套用於下載本體.
 * 代價是外部serverHapi若設有json.replacer(如移除敏感欄位), 對download本體不生效; 換得的是本體長度可於送標頭前確知並與fileSize比對.
 * 應用端若需套用自訂序列化政策, 應自行序列化後以字串或Buffer交出
 *
 * @param {*} streamRead 輸入應用端交出之本體來源
 * @param {Number} fileSize 輸入應用端宣告之位元組數(已經呼叫端以isValidFileSize檢核並以cint正規化)
 * @param {Function} funError 輸入長度不符時之回報函數, 參數為原因字串
 * @param {Object} [opt={}] 輸入設定物件, 預設{}
 * @param {Boolean} [opt.forHead=false] 輸入本次是否為HEAD請求布林值, 預設false。HEAD不送本體故不建計數串流, 直接交來源供hapi收尾
 * @returns {Object} 回傳 { source } 或 { error, reason };error為回前端之公開訊息, reason供error事件
 * @example
 *
 * console.log(buildDownloadSource(Buffer.from('abc'), 3, () => {}))
 * // => { source: <Buffer 61 62 63> }
 *
 * console.log(buildDownloadSource(Buffer.from('abc'), 5, () => {}))
 * // => { error: 'fileSize mismatch', reason: 'streamRead has 3 bytes but fileSize is 5' }
 *
 * console.log(buildDownloadSource(null, 0, () => {}))
 * // => { error: 'invalid streamRead', reason: 'streamRead is null or undefined' }
 *
 */
function buildDownloadSource(streamRead, fileSize, funError, opt = {}) {

    //forHead
    let forHead = get(opt, 'forHead', false) === true

    //check
    if (streamRead === undefined || streamRead === null) {
        return { error: 'invalid streamRead', reason: 'streamRead is null or undefined' }
    }

    //階段1 辨識, 階段2 狀態讀取: instanceof會觸發Proxy之getPrototypeOf trap, 三個狀態屬性亦可為會拋錯之getter, 故一併納入attempt
    let ri = attempt('identify streamRead', () => {
        if (!(streamRead instanceof stream.Readable)) {
            return { isReadable: false }
        }
        return {
            isReadable: true,
            objectMode: streamRead.readableObjectMode === true,
            done: streamRead.destroyed === true || streamRead.readableEnded === true,
        }
    })
    if (!ri.ok) {
        return { error: 'invalid streamRead', reason: `${ri.stage} failed: ${ri.cause}` }
    }

    //stream
    if (ri.value.isReadable) {

        //check
        if (ri.value.objectMode) {
            return { error: 'invalid streamRead', reason: 'streamRead is in object mode' }
        }
        if (ri.value.done) {
            return { error: 'invalid streamRead', reason: 'streamRead is already destroyed or ended (each download event must provide a new stream)' }
        }

        //check, HEAD不建pipeline, 直接交來源供hapi收尾
        if (forHead) {
            return { source: streamRead }
        }

        //階段3 建立pipeline: 其內部會讀來源之pipe等方法, Proxy可於此拋錯
        let rp = attempt('setup pipeline', () => {

            //counter, 計數並於不符時以錯誤終止
            let n = 0
            let bMismatch = false
            let counter = new stream.Transform({
                transform(chunk, encoding, cb) {
                    n += chunk.length
                    if (n > fileSize) {
                        bMismatch = true
                        cb(new Error(`streamRead sent more than fileSize[${fileSize}] bytes`))
                        return
                    }
                    cb(null, chunk)
                },
                flush(cb) {
                    if (n !== fileSize) {
                        bMismatch = true
                        cb(new Error(`streamRead ended at ${n} bytes but fileSize is ${fileSize}`))
                        return
                    }
                    cb()
                },
            })

            //pipeline, 任一方出錯或提前關閉皆銷毀雙方; 長度不符者另以error事件通知應用端, 來源自身出錯或前端中斷則不另報
            stream.pipeline(streamRead, counter, (err) => {
                if (err && bMismatch) {
                    funError(getErrorMessage(err))
                }
            })

            return counter
        })
        if (!rp.ok) {
            return { error: 'invalid streamRead', reason: `${rp.stage} failed: ${rp.cause}` }
        }

        return { source: rp.value }
    }

    //階段4 具體化: Buffer.isBuffer與instanceof皆可觸發Proxy trap, typed array之.length對Proxy receiver亦會拋
    //(實測 Method get TypedArray.prototype.length called on incompatible receiver), 故整段納入attempt
    let rm = attempt('materialize streamRead', () => {
        if (Buffer.isBuffer(streamRead)) {
            return { buf: streamRead }
        }
        if (streamRead instanceof Uint8Array) {
            return { buf: Buffer.from(streamRead) }
        }
        if (isstr(streamRead)) {
            return { buf: Buffer.from(streamRead, 'utf8') }
        }

        //number與object刻意不用wsemi之isnum與isobj(實測差異):
        //  isnum 收數字字串('42'為true)而拒NaN —— 本處需要的是「primitive number」之型別分派, 收字串會使字串走進數值分支
        //  isobj 拒陣列、Buffer、Uint8Array、Date —— 而陣列([1,2,3]得'[1,2,3]')為目前可正常下載且有測試鎖住之用法
        //字串與布林則已驗證與typeof完全一致, 故改用isstr與isbol
        if (typeof streamRead === 'number' || isbol(streamRead) || (typeof streamRead === 'object' && hasPipe(streamRead) === false)) {
            //number與boolean為hapi原生即接受之本體型別(其marshal以JSON序列化, 如42得'42'), 須維持相容;
            //物件則須先確認不像串流(hasPipe回false), 回null者代表其pipe為會拋錯之getter, 落到下方之不支援分支
            let s = null
            try {
                s = JSON.stringify(streamRead)
            }
            catch (err) {
                return { unserializable: getErrorMessage(err) } //取不到內容時回空字串, 下方以 isestr 分流故無須另補退路
            }
            if (typeof s !== 'string') {
                return { unserializable: '' }
            }
            return { buf: Buffer.from(s, 'utf8') }
        }
        return { unsupported: true }
    })
    if (!rm.ok) {
        return { error: 'invalid streamRead', reason: `${rm.stage} failed: ${rm.cause}` }
    }
    if (haskey(rm.value, 'unserializable')) {
        let d = rm.value.unserializable
        return { error: 'invalid streamRead', reason: isestr(d) ? `streamRead can not be serialized: ${d}` : 'streamRead can not be serialized' }
    }
    if (rm.value.unsupported === true) {
        return { error: 'invalid streamRead', reason: 'streamRead must be a readable stream, buffer, string, number, boolean or plain object' }
    }

    //check, buf為套件自建或已確認之Buffer, 此處讀length為套件自有值
    let buf = rm.value.buf
    if (buf.length !== fileSize) {
        return { error: 'fileSize mismatch', reason: `streamRead has ${buf.length} bytes but fileSize is ${fileSize}` }
    }

    return { source: buf }
}


export default buildDownloadSource
