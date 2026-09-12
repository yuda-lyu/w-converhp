import path from 'path'
import fs from 'fs'
import stream from 'stream'
import { validateHeaderValue } from 'http'
import Hapi from '@hapi/hapi'
import Inert from '@hapi/inert' //提供靜態檔案
import get from 'lodash-es/get.js'
import genPm from 'wsemi/src/genPm.mjs'
import evem from 'wsemi/src/evem.mjs'
import evEmitBase from 'wsemi/src/evEmit.mjs'
import evEmitDelayBase from 'wsemi/src/evEmitDelay.mjs'
import getErrorMessage from 'wsemi/src/getErrorMessage.mjs'
import iseobj from 'wsemi/src/iseobj.mjs'
import isestr from 'wsemi/src/isestr.mjs'
import isstr from 'wsemi/src/isstr.mjs'
import isp0int from 'wsemi/src/isp0int.mjs'
import ispint from 'wsemi/src/ispint.mjs'
import isearr from 'wsemi/src/isearr.mjs'
import isbol from 'wsemi/src/isbol.mjs'
import isfun from 'wsemi/src/isfun.mjs'
import ispm from 'wsemi/src/ispm.mjs'
import cint from 'wsemi/src/cint.mjs'
import cstr from 'wsemi/src/cstr.mjs'
import str2b64 from 'wsemi/src/str2b64.mjs'
import haskey from 'wsemi/src/haskey.mjs'
import obj2u8arr from 'wsemi/src/obj2u8arr.mjs'
import u8arr2obj from 'wsemi/src/u8arr2obj.mjs'
import fsIsFolder from 'wsemi/src/fsIsFolder.mjs'
import fsCreateFolder from 'wsemi/src/fsCreateFolder.mjs'
import fsDeleteFile from 'wsemi/src/fsDeleteFile.mjs'
import isSafeId from './isSafeId.mjs'
import sanitizeFilename from './sanitizeFilename.mjs'
import routeSpec from './routeSpec.mjs'
import encodeRfc5987 from './encodeRfc5987.mjs'
import mmg from './managerMergeSlices.mjs'
// import checkTotalHash from './checkTotalHash.mjs'
import checkTotalHash from './checkTotalHash.wk.umd.js'
// import checkSlicesHash from './checkSlicesHash.mjs'
import checkSlicesHash from './checkSlicesHash.wk.umd.js'


//=== 本檔專用之內部函式 =========================================================================
//以下九者原各自為一個單檔, 第十一輪依帳本 R20 併入: 判準為「唯有**重要且需獨立測試**之函數(如 managerMergeSlices),
//或**多檔共用**之函數, 才獨立成檔」。九者皆只被本檔使用、且皆無獨立單元測試, 故不具獨立成檔之理由。
//排列依相依順序: attempt → isValidHeaderValue → hasPipe → buildDownloadSource → readDownloadFields
//  → validDownloadField → destroyStreamRead → encodeOut → responseU8aStream / WithError → callApp
//仍獨立成檔者: isSafeId(三檔共用)、sanitizeFilename(兩檔共用 + 有單元測試)、encodeRfc5987 / routeSpec(有單元測試)、
//  managerMergeSlices(重要 + 有單元測試)、三個 worker(建置輸入)


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


/**
 * 檢核值是否可作為HTTP回應標頭之值
 *
 * 以node之低階標頭驗證(同setHeader之判定, 禁CR/LF與其他控制字元、禁超出latin1範圍者)檢核應用端或請求端可控之標頭值
 *
 * why: 原只以isestr檢核, 含CR/LF或非latin1字元者交給hapi設定標頭時拋錯而回裸HTTP 500,
 * 非套件之錯誤封包, 前端無法解析且伺服器不發error事件
 *
 * @param {String} name 輸入標頭名稱字串
 * @param {*} value 輸入待檢核之標頭值
 * @returns {Boolean} 回傳是否為合法標頭值
 */
function isValidHeaderValue(name, value) {
    try {
        validateHeaderValue(name, value)
        return true
    }
    catch (err) {
        return false
    }
}


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
 * why try 須包住屬性讀取本身: 應用端物件之 pipe 可為會拋錯之 getter 或 Proxy trap(帳本 R1)
 *
 * @param {*} v 輸入任意值
 * @returns {Boolean|null} 回傳三態判定
 */
function hasPipe(v) {
    try {
        return isfun(v.pipe)
    }
    catch (err) {
        return null
    }
}


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
 * 任一階段之屬性讀取皆可能拋錯而逸出成裸HTTP 500(見attempt之說明)
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


/**
 * 檢核應用端給之fileSize是否可用
 *
 * fileSize有兩個用途, 兩者決定了值域:
 *   1. 原樣(經cint正規化後)寫入Content-Length —— HTTP之訊息分框依據
 *   2. 與實際位元組數比較(可事前具體化者比 buf.length, 串流則於計數之flush比) —— 故比較前須先以cint轉為數值
 *
 * why 須為安全整數: 原以lodash isNumber檢核, 其對NaN、Infinity、負數、小數皆回true, 此類值交給node寫標頭即拋錯,
 * hapi於送標頭階段失敗只能直接斷線, 前端連回應標頭都收不到而伺服器亦不發error事件;
 * 另超出安全整數者(如Number.MAX_SAFE_INTEGER+1或1e21)雖為整數, 但其字串形式帶指數記號(如'1e+21'),
 * 不合Content-Length之1*DIGIT語法, 實測同樣是連線懸置且無回應標頭
 *
 * 採wsemi之isp0int搭配useLimitSafe, 故數字字串(如'1058915')亦視為有效, 呼叫端須以cint正規化後才可用於比較與寫標頭(帳本R4b)
 *
 * @param {*} v 輸入任意值
 * @returns {Boolean} 回傳是否為可用之fileSize
 */
function isValidFileSize(v) {
    return isp0int(v, { useLimitSafe: true })
}


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
 */
function destroyStreamRead(v) {
    try {
        if (v && isfun(v.pipe) && isfun(v.destroy)) {
            v.destroy()
        }
    }
    catch (err) {}
}


/**
 * 正規化協定鍵之值, 使該鍵不可能於序列化時消失
 *
 * why: JSON對值為undefined、function、symbol之鍵是「靜默丟棄整個鍵」而非拋錯
 * (見wsemi之obj2stru8arr檔頭所列失真集合), 故以編碼器對 { success: undefined } 編碼會回 state 為 success
 * 但解回 {} —— 連success鍵都不存在。前端只能以無意義之'data does not contain success or error'拒絕,
 * 而伺服器亦不發任何error事件, 應用端無從得知
 *
 * 於包入協定外殼前先把這三種值轉為null(與procApp對output已有之處置一致), 協定鍵遂於結構上不可能消失,
 * 不需encode後再decode回來檢查(大輸出之代價加倍)
 *
 * @param {*} v 輸入協定鍵之值
 * @returns {*} 回傳可安全序列化之值
 */
function canonProtocolValue(v) {
    if (v === undefined || isfun(v) || typeof v === 'symbol') {
        return null
    }
    return v
}


/**
 * 序列化回應封包之唯一出口
 *
 * 兩道保護:
 *   1. 協定鍵之值先經canonProtocolValue正規化, 使該鍵於結構上不可能因JSON之靜默失真而消失
 *   2. 以wsemi之嚴格模式取狀態, 值無法序列化者(如含BigInt、循環參照)回null並呼叫funError
 *
 * why 不用「encode後再decode回來檢查協定鍵」: 該作法對大輸出之代價加倍, 而第1點已於結構上保證
 *
 * @param {Object} out 輸入待序列化之封包物件, 其鍵為協定鍵(success或error)
 * @param {Function} funError 輸入序列化失敗時之回報函數, 參數為原因字串
 * @returns {Uint8Array|null} 回傳序列化結果; 失敗時回null(已呼叫funError)
 */
function encodeOut(out, funError) {

    //canon, 協定鍵之值先正規化, 使其不因JSON之靜默失真而消失
    let o = {}
    for (let k of Object.keys(out)) {
        o[k] = canonProtocolValue(out[k])
    }

    let r = obj2u8arr(o, { returnWithStateAndMsg: true })
    if (get(r, 'state') !== 'success') {
        funError(get(r, 'msg', 'unknown error'))
        return null
    }

    return r.msg
}


/**
 * 以octet-stream回應二進位封包, 並附上本套件之回應協定標頭
 *
 * 本套件之回應協定有兩層: 本體(obj2u8arr之success/error)與標頭(Return-Type、Return-Msg、Return-Retryable、Content-Disposition)。
 * 下載路徑(client之downloadStream)只讀標頭不解析本體, 故標頭是協定的一部分而非附屬資訊
 *
 * Return-Msg之值域檢核(見isValidHeaderValue):
 * 錯誤訊息可能回顯請求端可控之字串(如 invalid mode[<mode>] in payload), 該值若含CR/LF或超出latin1範圍(如中文),
 * node於寫標頭時拋錯而hapi只能回裸HTTP 500 —— 非本套件之錯誤封包, 前端無法解析且伺服器不發error事件。
 * 故不合法者**不送該標頭**而非讓整個回應失敗: 完整訊息仍在本體之error封包內, 前端解析本體即可取得;
 * 下載路徑雖只讀標頭, 但其錯誤訊息皆為套件自產之固定字串, 不受影響
 *
 * @param {Object} res 輸入hapi之response toolkit
 * @param {Uint8Array} u8a 輸入待回應之二進位封包
 * @param {Object} [opt={}] 輸入設定物件, 預設{}
 * @param {String} [opt.returnType=''] 輸入Return-Type標頭值, 為'success'或'error', 空字串代表不送
 * @param {String} [opt.returnMsg=''] 輸入Return-Msg標頭值, 空字串或非法標頭值代表不送
 * @returns {Object} 回傳hapi之response物件
 */
function responseU8aStream(res, u8a, opt = {}) {

    //stream
    let smr = new stream.Readable()
    smr._read = () => {}
    smr.push(u8a)
    smr.push(null)

    //returnType
    let returnType = get(opt, 'returnType', '')

    //returnMsg
    let returnMsg = get(opt, 'returnMsg', '')

    //r
    let r = res.response(smr)
        .header('Cache-Control', 'no-cache, no-store, must-revalidate')
        .header('Content-Type', 'application/octet-stream')
        .header('Content-Length', smr.readableLength)
    if (isestr(returnType)) {
        r.header('Return-Type', returnType)
    }

    //check, 標頭值須通過值域檢核; 不合法者略過該標頭而非使整個回應失敗(完整訊息仍在本體)
    if (isestr(returnMsg) && isValidHeaderValue('Return-Msg', returnMsg)) {
        r.header('Return-Msg', returnMsg)
    }

    return r
}


/**
 * 以本套件之錯誤封包回應
 *
 * 本函數為所有失敗之最終出口: 其自身之序列化不再以嚴格模式取狀態, 因為輸入之msg恆為套件自產字串
 * (全部呼叫點皆為字面或模板字串), 且此處若再失敗亦無處可退(帳本R3之刻意不套站點)
 *
 * why 與 responseU8aStream 並存而非合一: 前者之本體由呼叫端算好(可能是成功結果), 後者之本體由本函數依 msg 產生 ——
 * 輸入不同, 合一會多一個「這次是不是錯誤」的旗標參數
 *
 * @param {Object} res 輸入hapi之response toolkit
 * @param {String} msg 輸入錯誤訊息字串
 * @param {Object} [opt={}] 輸入設定物件, 預設{}
 * @param {Boolean} [opt.retryable=true] 輸入是否可重試布林值, 預設true。
 * 給false者限「可證明不需重試」之錯誤: 結果僅由client自行建構之請求內容(mode、fileHash、chunkTotal、chunkIndex、packageId、fileId)決定, 重送同一請求必得同一結果;
 * 凡涉及權限(permission denied)、應用端reject、應用端回傳形狀不合、磁碟、網路者皆為狀態不穩, 不得標示, 依重試原則由前端照常重試。
 * 標示同時置於封包(供execute/upload/dwgfn之本體解析)與標頭Return-Retryable(供download之串流路徑, 該路徑只讀標頭不解析本體)
 * @returns {Object} 回傳hapi之response物件
 */
function responseU8aStreamWithError(res, msg, opt = {}) {

    //check
    if (!isestr(msg)) {
        console.log('msg', msg)
        console.log(`msg is not an effective string, set msg=''`)
        msg = ''
    }

    //retryable
    let retryable = get(opt, 'retryable', true)

    //out
    let out = {
        error: msg,
    }
    if (retryable === false) {
        out.retryable = false
    }

    //u8aOut
    let u8aOut = obj2u8arr(out)

    //r
    let r = responseU8aStream(res, u8aOut, { returnType: 'error', returnMsg: msg })
    if (retryable === false) {
        r.header('Return-Retryable', 'false')
    }

    return r
}


/**
 * 派發一次應用端呼叫, 並保證該次呼叫必定終結
 *
 * why: 本套件之路由層刻意關閉 timeout.server 與 timeout.socket(大檔傳輸本就超過任何固定值),
 * 宿主之兜底因此不存在。無人接聽時該 pm 永無人 settle, 請求即**永久懸置**且 0 則 error 事件
 * (實測 tmp/probe_r9_hang.mjs: /main、/dw、/ulctr 三入口皆 6000ms 未回應)。
 * 而該事實其實早就在套件手上 —— eventemitter3 之 emit 對無監聽器回 false, 只是被丟棄。
 *
 * why 於派發前以 listenerCount 判定, 而非取 evEmit 之回傳值:
 * wsemi 之 evEmit 對「無監聽器」與「監聽器同步拋錯」**皆回 false**(其 evEmit.mjs:107 之 catch 分支),
 * 兩者不可分辨(實測 tmp/probe_r9_emitret.mjs)。而拋錯那格已由 evEmit 之 funSettle 拒絕過 pm、
 * 且已發過一則 error 事件 —— 以回傳值判定會對該格**再發一則**, 即同一次失敗兩則(違反規則帳本 R5)。
 * 派發前判定則兩者分明, 且不受「監聽器於執行中移除自己」影響(判定早於執行)。
 *
 * 本函數只處理「**現在沒有人接聽**」這一種狀態。應用端接了卻不回話(忘記 settle pm、
 * resolve 一個永不 settle 之 promise、verifyConn 回 pending promise)一律**不在本函數職責內** ——
 * 那是對無限未來之斷言, 任何有限時點皆與「還沒好」不可分辨, 屬呼叫端責任。判準與否決過的修法見帳本 R12 之分界線。
 *
 * @param {Object} ev 輸入事件物件, 為 wsemi 之 evem 所建立之 eventemitter3 實例
 * @param {Function} evEmit 輸入本套件之派發函數, 簽章為 (name, ...args)
 * @param {String} name 輸入事件名稱字串
 * @param {Array} args 輸入事件參數陣列(不含 pm)
 * @param {Object} pm 輸入本次呼叫之回覆通道, 會作為事件之最後一個參數交給監聽器
 * @param {Function} funError 輸入無人接聽時之回報函數, 參數為原因字串
 * @returns {Boolean} 回傳是否已派發; false 代表無人接聽且 pm 已被拒絕
 */
function callApp(ev, evEmit, name, args, pm, funError) {

    //check, 無人接聽即終結: 一次失敗恰一則事件(帳本 R5), 且不得懸置
    if (ev.listenerCount(name) === 0) {
        let msg = `no listener for event[${name}]`

        //settle 須排在回報之前(帳本 R10 之結構層): pm.reject 為此處唯一「非做不可」之事,
        //funError 會走到應用端之 error 監聽器, 其若拋錯而排在前面, 該次請求就永遠不會被 settle ——
        //那正是本模組存在所要防止的懸置。順序即保證, 不可對調
        pm.reject(msg)
        funError(msg)

        return false
    }

    //emit, pm 為事件之最後一個參數(本套件之契約)
    evEmit(name, ...args, pm)

    return true
}

//=== 本檔專用之內部函式結束 =====================================================================


//回傳前端stream時(POST或GET皆可), 前端會須等stream傳完才能判斷是否為大檔或錯誤訊息, 此會導致若回傳超大檔, 會需要對超大檔進行解析會有記憶體上限問題, 故需要通過header提供基本成功或失敗訊息, 讓前端能進行解析判斷
//回傳前端(nodejs)時, 針對超大檔, 只能用POST並用stream回傳
//回傳前端(browser)時, 針對超大檔, 可用POST並用stream回傳但還要處理進度條, 若要交由瀏覽器下載器處理, 只能用GET並用stream回傳, 且前端只能用window.location.href或a.href+a.click()下載


/**
 * 建立Hapi伺服器
 *
 * @class
 * @param {Object} [opt={}] 輸入設定物件，預設{}
 * @param {Integer} [opt.port=8080] 輸入Hapi伺服器所在port正整數，預設8080，須為1至65535。埠被占用等啟動失敗時不拋出，以error事件通知。本套件各整數選項(port、sizeSlice、sizeMsg、delayForSlice)須為安全整數(Number.isSafeInteger)，Infinity與超出安全範圍者(如Number.MAX_SAFE_INTEGER+1)一律視為無效取預設；另各依其用途有值域上限(port為65535、delayForSlice為計時器上限2147483647)，超過者亦取預設
 * @param {Boolean} [opt.useInert=true] 輸入是否提供瀏覽pathStaticFiles資料夾內檔案之布林值，預設true
 * @param {String} [opt.pathStaticFiles='dist'] 輸入當useInert=true時提供瀏覽資料夾字串，預設'dist'
 * @param {String} [opt.pathUploadTemp='./uploadTemp'] 輸入暫時存放切片上傳檔案資料夾字串，預設'./uploadTemp'。資料夾內除切片與合併檔外另有狀態標記檔(<fileHash>.done為合併完成、<fileHash>.error為合併失敗、<fileHash>.q<隊列>.ro為該次上傳已由upload事件處理完成之結果)，為合併佇列之狀態載體，前端重送查詢時據以回傳相同結果而不重複觸發upload事件；上傳可能仍在進行時不得刪除，應用端可依修改時間清理確定已結束者
 * @param {String} [opt.apiName='api'] 輸入API名稱字串，預設'api'
 * @param {String} [opt.tokenType='Bearer'] 輸入token類型字串，預設'Bearer'
 * @param {Integer} [opt.sizeSlice=1024*1024] 輸入切片上傳檔案之切片檔案大小整數，單位為Byte，預設為1024*1024。須與前端之sizeSlice一致，伺服器以此為單一切片請求(/slc)之本體上限並據以判定切片是否完整，check-total-hash會回傳此值供前端比對，不一致時前端upload會以sizeSlice mismatch訊息終止
 * @param {Integer} [opt.sizeMsg=100*1024*1024] 輸入單次請求本體大小上限整數，單位為Byte，預設為100*1024*1024。適用於除切片上傳(/slc)外之各API(/main、/ulctr、/dwgfn、/dw)，此類請求須將整個本體讀入記憶體，超過上限會回應413且不觸發execute/upload/download事件(請求帶Content-Length者於進入路由前即被拒，亦不觸發verifyConn與handler事件；無Content-Length之chunked本體則須讀入後才能判定，故verifyConn與handler事件已觸發)；切片上傳之單次請求上限為sizeSlice，大檔案總大小不受此限制，請改用upload
 * @param {Function} [opt.verifyConn=()=>{return true}] 輸入呼叫API時檢測函數，預設()=>{return true}
 * @param {Array} [opt.corsOrigins=['*']] 輸入允許跨域網域陣列，若給予['*']代表允許全部，預設['*']。回應一律以Access-Control-Expose-Headers曝露Return-Type、Return-Msg、Return-Retryable、Content-Disposition四個標頭，使前端(browser)與API不同源時download仍可讀取成敗與檔名
 * @param {Integer} [opt.delayForSlice=100] 輸入切片上傳檔案API用延遲響應時間，單位ms，預設100
 * @param {Boolean} [opt.serverHapi=null] 輸入外部提供Hapi伺服器物件，預設null。外部提供者須自行於其routes.cors設定additionalExposedHeaders含Return-Type、Return-Msg、Return-Retryable、Content-Disposition，否則前端(browser)與API不同源時download會失效
 * @returns {Object} 回傳事件物件，可監聽事件execute、upload、download、handler、error。upload事件之input為{from,filename,filenameSafe,path}：from為'merge-slices-get'(切片合併完成)或'check-total-hash'(整檔已存在之去重)，path為合併檔之伺服器絕對路徑；**filename為用戶端所給之原值、未經淨化、不可信**(可含路徑分隔符、`..`、各平台非法字元、保留裝置名，亦可為非字串)，供顯示或保留目錄結構(如瀏覽器webkitdirectory之相對路徑)；**filenameSafe**為其淨化值(只取最末路徑段、去除非法字元與保留裝置名，無可用檔名時為空字串)，應用端以filename組落地路徑前須自行驗證，或直接改用filenameSafe。**監聽器須為同步函數，不可為async函數、亦不可回傳promise**：事件派發依EventEmitter規範丟棄監聽器之回傳值，其rejection無人觀察，於nodejs即unhandledRejection而使整個行程崩潰；非同步結果一律以事件所帶之pm回覆(pm即本套件提供之回覆通道，監聽器不需要第二條)，寫法為`wo.on('upload', (input, pm) => { doWork().then(pm.resolve, pm.reject) })`。監聽器之同步拋錯則由套件攔截：以error事件通知，該請求以錯誤回應，不會使伺服器行程崩潰。execute與upload事件之回傳值須能序列化(不可含BigInt或循環參照，此類值會使整包無法編碼)，不能者回錯誤封包並發error事件；download事件須resolve物件{streamRead,filename,fileSize,fileType}：streamRead為非objectMode之可讀串流(Buffer、Uint8Array、字串、數值、布林、可JSON化物件亦可，後數者由套件以JSON.stringify具體化後交出，故route之json政策replacer/space/suffix不套用於下載本體，需自訂序列化者請自行序列化後以字串或Buffer交出)，fileSize須為安全非負整數且等於實際位元組數(伺服器據以寫Content-Length，串流實送不符時以錯誤中止回應並發error事件使前端失敗，不會把不完整檔案當成功；Buffer等可事前具體化者不符則直接回錯誤封包)，fileType須為合法標頭值；欄位缺漏或值非法一律回錯誤封包並發error事件，不會懸置或回500。fileSize為0之空檔以HTTP 200與Content-Length:0回應(不採hapi預設之204，否則瀏覽器下載管理器會將下載標記為取消)。下載回應帶Content-Encoding:identity而不壓縮，使Content-Length得以保留供前端計算下載進度。瀏覽器下載管理器路徑(downloadByManager=true)對同一fileId會觸發兩次download事件(第一次僅取檔名並銷毀串流)，每次皆須交出新串流。回傳之物件另帶stop方法：其回傳promise供等待伺服器真正停止(`await wo.stop()`)，該promise恆resolve，停止失敗以error事件通知而不外拋。**應用端未註冊某事件之監聽器時，該事件之請求會立即以錯誤封包回應並發一則error事件**(不會等待一個不存在的回覆)；而註冊了監聽器卻未呼叫pm者屬呼叫端自身之疏漏，套件不代為偵測。錯誤回應一律為HTTP 200並以Return-Type:error標頭與錯誤封包表達，唯瀏覽器下載管理器所用之GET下載路由(dwgf)以非2xx狀態碼表達(權限403、參數400、應用端無法提供檔案404、應用端交出之內容不合契約500)，使瀏覽器顯示下載失敗而不把錯誤內容存成檔案。回前端之錯誤訊息不含伺服器路徑與底層細節，細節一律以error事件通知
 * @example
 *
 * import fs from 'fs'
 * import _ from 'lodash-es'
 * import w from 'wsemi'
 * import WConverhpServer from './src/WConverhpServer.mjs'
 *
 * let ms = []
 *
 * let opt = {
 *     port: 8080,
 *     apiName: 'api',
 *     pathStaticFiles: '.', //要存取專案資料夾下web.html, 故不能給dist
 *     sizeMsg: 100 * 1024 * 1024, //單次請求本體上限, 預設100mb, 適用於除切片(/slc)外之各API; 切片單次上限為sizeSlice, 大檔案總大小不受限, 請改用upload
 *     verifyConn: async ({ apiType, authorization, query, headers, req }) => {
 *         console.log('verifyConn', `apiType[${apiType}]`, `authorization[${authorization}]`)
 *         let token = w.strdelleft(authorization, 7) //刪除Bearer
 *         if (!w.isestr(token)) {
 *             return false
 *         }
 *         // await w.delay(3000)
 *         return true
 *     },
 * }
 *
 * //new
 * let wo = new WConverhpServer(opt)
 *
 * wo.on('execute', (func, input, pm) => {
 *     // console.log(`Server[port:${opt.port}]: execute`, func, input)
 *     console.log(`Server[port:${opt.port}]: execute`, func)
 *
 *     try {
 *
 *         if (func === 'add') {
 *
 *             if (_.get(input, 'p.d.u8a', null)) {
 *                 console.log('input.p.d.u8a', input.p.d.u8a)
 *                 ms.push({ 'input.p.d.u8a': input.p.d.u8a })
 *             }
 *
 *             let r = {
 *                 _add: input.p.a + input.p.b,
 *                 _data: [11, 22.22, 'abc', { x: '21', y: 65.43, z: 'test中文' }],
 *                 _bin: {
 *                     name: 'zdata.b2',
 *                     u8a: new Uint8Array([52, 66, 97, 115]),
 *                 },
 *             }
 *
 *             pm.resolve(r)
 *
 *         }
 *         else {
 *             console.log('invalid func')
 *             pm.reject('invalid func')
 *         }
 *
 *     }
 *     catch (err) {
 *         console.log('execute error', err)
 *         pm.reject('execute error')
 *     }
 *
 * })
 * wo.on('upload', (input, pm) => {
 *     console.log(`Server[port:${opt.port}]: upload`, input)
 *
 *     try {
 *         ms.push({ 'receive and return': input })
 *         let output = input
 *         pm.resolve(output)
 *     }
 *     catch (err) {
 *         console.log('upload error', err)
 *         pm.reject('upload error')
 *     }
 *
 * })
 * wo.on('download', (input, pm) => {
 *     console.log(`Server[port:${opt.port}]: download`, input)
 *
 *     let streamRead = null
 *     try {
 *         ms.push({ 'download': input })
 *
 *         //fp
 *         let fp = `./test/1mb.7z`
 *
 *         //check, 檔案存在才往下
 *
 *         //fileSize
 *         let stats = fs.statSync(fp)
 *         let fileSize = stats.size
 *
 *         //streamRead
 *         streamRead = fs.createReadStream(fp)
 *
 *         //filename
 *         let filename = `1mb中文.7z` //測試支援中文
 *
 *         //fileType
 *         let fileType = 'application/x-7z-compressed'
 *
 *         //output
 *         let output = {
 *             streamRead,
 *             filename,
 *             fileSize,
 *             fileType,
 *         }
 *
 *         pm.resolve(output)
 *     }
 *     catch (err) {
 *         console.log('download error', err)
 *         // try {
 *         //     streamRead.destroy() //若fs.createReadStream早於fs.statSync執行, 但fs.statSync發生錯誤時, stream得要destroy
 *         // }
 *         // catch (err) {}
 *         pm.reject('download error')
 *     }
 *
 * })
 * wo.on('error', (err) => {
 *     console.log(`Server[port:${opt.port}]: error`, err)
 * })
 * wo.on('handler', (data) => {
 *     // console.log(`Server[port:${opt.port}]: handler`, data)
 * })
 *
 * setTimeout(() => {
 *     console.log('ms', ms)
 *     // console.log('ms', JSON.stringify(ms))
 *     wo.stop()
 * }, 3000)
 *
 */
function WConverhpServer(opt = {}) {

    //maxTimer, node計時器以32位元帶號整數表達, 超過即溢位: setTimeout(2**31)實測不是等24.9日而是立即(1ms)觸發並印TimeoutOverflowWarning;
    //故凡進入計時器之毫秒值皆須以此為上限, 超過者視為無效而取預設(與Infinity同處置), 不採截斷: 使用者若要表達「不逾時」另有正式語意(client之timeout為0), 給超大數字屬誤用
    let maxTimer = 2147483647 //2**31-1

    //maxPort, TCP port之值域上限
    let maxPort = 65535

    //optSafe, 數值選項一律以wsemi之安全整數模式檢核: 其預設(寬鬆)對Infinity與超出安全整數者皆回true,
    //而Infinity給hapi之port會於建構即拋錯、給maxBytes(sizeSlice/sizeMsg)會使伺服器啟動失敗、給setTimeout(delayForSlice)會溢位成1ms;
    //超出安全整數者(如Number.MAX_SAFE_INTEGER+1)則使hapi以「must be a safe number」於建構同步拋錯. 各選項另依其sink之值域上限檢核
    let optSafe = { useLimitSafe: true }

    //port
    let port = get(opt, 'port')
    if (!ispint(port, optSafe) || cint(port) > maxPort) {
        port = 8080
    }
    port = cint(port) //檢核與正規化須成對: ispint亦接受數字字串

    //useInert
    let useInert = get(opt, 'useInert')
    if (!isbol(useInert)) {
        useInert = true
    }

    //pathStaticFiles
    let pathStaticFiles = get(opt, 'pathStaticFiles')
    if (!isestr(pathStaticFiles)) {
        pathStaticFiles = 'dist'
    }

    //pathUploadTemp
    let pathUploadTemp = get(opt, 'pathUploadTemp')
    if (!isestr(pathUploadTemp)) {
        pathUploadTemp = './uploadTemp'
    }
    //errCreateTemp, 暫存資料夾建立失敗之原因; 於 evEmitDelay 定義後以建構期事件通知
    //why: wsemi 之 fsCreateFolder 以回傳 { error } 表達失敗而不拋, 原本丟棄回傳值 —— 建構期 0 則事件, 之後每一次上傳才各自失敗
    //(該路徑為既有檔案、無權限等; 實測第十輪 D7)。與埠被占同為啟動失敗, 依 JSDoc 以 error 事件通知而不拋出
    let errCreateTemp = ''
    if (!fsIsFolder(pathUploadTemp)) {
        let rc = fsCreateFolder(pathUploadTemp)
        if (haskey(rc, 'error')) {
            errCreateTemp = getErrorMessage(rc.error)
        }
    }

    //apiName
    let apiName = get(opt, 'apiName')
    if (!isestr(apiName)) {
        apiName = 'api'
    }

    //tokenType
    let tokenType = get(opt, 'tokenType')
    if (!isestr(tokenType)) {
        tokenType = 'Bearer'
    }

    //sizeSlice, 交予hapi之payload.maxBytes, 其要求為safe number
    //檢核與正規化須成對: ispint亦接受數字字串('1048576'), 而本值會原樣回傳給client並由其以!==比對(見client之sendDataSlice),
    //未正規化時兩端縱使組態為同一個值, 字串與數值仍判為mismatch而使上傳整個失敗
    let sizeSlice = get(opt, 'sizeSlice')
    if (!ispint(sizeSlice, optSafe)) {
        sizeSlice = 1024 * 1024 //1m
    }
    sizeSlice = cint(sizeSlice)

    //sizeMsg, 單次請求本體上限, 適用於除切片(/slc)外之各API(/main、/ulctr、/dwgfn、/dw)
    //why: 此類請求須整包讀入記憶體再反序列化(/main實測記憶體約為本體5至6倍), 上限若給到遠超RAM之值(原為1tb), 單一請求即可令整個行程OOM;
    //切片(/slc)為串流直接落地不緩衝, 其單次上限為sizeSlice; 大檔本就應走切片上傳, 總大小不受此限制
    let sizeMsg = get(opt, 'sizeMsg')
    if (!ispint(sizeMsg, optSafe)) {
        sizeMsg = 100 * 1024 * 1024 //100m
    }
    sizeMsg = cint(sizeMsg) //檢核與正規化須成對: ispint亦接受數字字串

    //verifyConn
    let verifyConn = get(opt, 'verifyConn')
    if (!isfun(verifyConn)) {
        verifyConn = () => {
            return true
        }
    }

    //corsOrigins
    let corsOrigins = get(opt, 'corsOrigins', [])
    if (!isearr(corsOrigins)) {
        corsOrigins = ['*']
    }

    //delayForSlice, 交予setTimeout故另受計時器上限約束(見maxTimer)
    let delayForSlice = get(opt, 'delayForSlice', '')
    if (!isp0int(delayForSlice, optSafe) || cint(delayForSlice) > maxTimer) {
        delayForSlice = 100
    }
    delayForSlice = cint(delayForSlice)

    //server
    let server = null
    if (get(opt, 'serverHapi')) {

        //use serverHapi
        server = opt.serverHapi

    }
    else {

        //create server
        server = Hapi.server({
            //host: 'localhost',
            port,
            routes: {
                timeout: {
                    server: false, //關閉伺服器超時
                    socket: false, //關閉socket超時
                },
                cors: {
                    origin: corsOrigins, //Access-Control-Allow-Origin
                    credentials: false, //Access-Control-Allow-Credentials
                    //additionalExposedHeaders, 本套件回應協定除本體外另靠此四個標頭傳成敗(Return-Type/Return-Msg)、可否重試(Return-Retryable)與檔名(Content-Disposition);
                    //瀏覽器對跨來源回應只讓 JS 讀 Access-Control-Expose-Headers 列出者(hapi 預設僅 WWW-Authenticate,Server-Authorization), 未列則 client 讀到空字串,
                    //download 路徑(只讀標頭不解析本體)整條失效: 錯誤封包被當檔案、檔名解析拋錯; execute/upload 只解析本體故不受影響. 用 additional 以保留 hapi 預設兩項
                    additionalExposedHeaders: ['Return-Type', 'Return-Msg', 'Return-Retryable', 'Content-Disposition'],
                },
                // compression: { //壓縮須納入通用訊息處理(obj2u8arr與u8arr2obj), 其他傳輸或提供下載檔案等, 通常為已壓縮, 故不須指定壓縮
                //     minBytes: {
                //         value: 1024, //超過1KB才壓縮
                //     },
                //     mime: {
                //         'application/json': true,
                //         'text/html': true,
                //         'application/octet-stream': true, //針對application/octet-stream壓縮的話, Content-Length得要回傳壓縮後的資料長度
                //     },
                // },
            },
        })

    }

    //ev, 原生eventemitter3(wsemi 1.8.91起evem不再包裝監聽器, 其語意完全遵循EventEmitter規範)
    let ev = evem()

    //optEv, 交予wsemi之evEmit/evEmitDelay之共用設定
    //why 派發交由wsemi: 其evEmit即為「於呼叫端堆疊上直接ev.emit並以try攔截」之單一擁有者, 且把本套件所需之紀律
    //(settle排在通報之前、通報自身亦包try並留痕、脫勾後仍於新堆疊內攔截、ms夾至計時器上限)全部寫成明文契約;
    //自行手寫等於把同一條規則寫第二遍, 而規則寫兩遍正是本帳本各條重複出現之形狀
    let optEv = {
        tag: 'w-converhp',
    }

    //evEmit, 於呼叫端之堆疊上派發
    //funSettle, settle該次請求之pm使流程不懸置; 本套件之pm為execute/upload/download事件之最後一個參數,
    //  wsemi不猜測pm之位置(其JSDoc明載), 故由此處指定
    //funEmit, wsemi之通報形狀為{fun,name,msg,args}物件, 而本套件error事件之對外契約為**字串訊息**, 於此轉換為本套件形狀;
    //  該轉換須經funEmit而非另發一則, 否則同一次失敗會有兩則事件(違反帳本R5)
    let evEmit = (name, ...args) => {
        return evEmitBase(ev, name, args, {
            ...optEv,
            funSettle: () => {
                let pm = args[args.length - 1]
                if (ispm(pm)) {
                    pm.reject(`listener of event[${name}] error`)
                }
            },
            funEmit: funEmitOfPkg,
        })
    }

    //evEmitDelay, 以timer脫勾後派發(脫勾後仍由wsemi於新堆疊內以try攔截); **僅供建構期之失敗事件使用**
    //why: startServer()於建構期執行, 其失敗須以error事件通知, 而應用端於`new`回傳後才有機會呼叫wsv.on('error', ...)
    //實測(tmp/probe_r8_defer.mjs): 建構後同步註冊者直接派發亦收得到(該.catch本就在promise鏈上), 但隔一個await才註冊者收不到;
    //其餘32個派發站點皆於請求進來後才觸發, 脫勾對其毫無作用故一律不脫勾
    let evEmitDelay = (name, ...args) => {
        return evEmitDelayBase(ev, name, args, {
            ...optEv,
            funEmit: funEmitOfPkg,
        })
    }

    //funEmitOfPkg, 把wsemi之物件型通報轉為本套件之字串型error事件; 其餘一律原樣派發
    //取因一律經getErrorMessage: err為應用端throw之任意值, 其message可為拋錯之getter、toString可拋錯(見帳本R10)
    function funEmitOfPkg(nm, ...a) {
        if (nm === 'error' && iseobj(a[0]) && a[0].fun === 'listener') {
            let nmL = get(a[0], 'name', '')
            let errL = get(a[0], 'msg')
            console.log(`listener of event[${nmL}] error`, errL)
            return ev.emit('error', `listener of event[${nmL}] error: ${getErrorMessage(errL)}`)
        }
        return ev.emit(nm, ...a)
    }

    //建構期失敗: 暫存資料夾無法建立(見 errCreateTemp); 須於 evEmitDelay 定義之後
    if (isestr(errCreateTemp)) {
        evEmitDelay('error', `create pathUploadTemp[${pathUploadTemp}] error: ${errCreateTemp}`)
    }

    //checkConn, 各路由呼叫verifyConn之唯一出口, 拋錯或reject一律視為未通過, 各路由不得再自行呼叫verifyConn
    //why: 原本僅apiMain有try/catch, 其餘五路由於verifyConn拋錯或reject時會回HTTP 500且body不可解析,
    //六路由對同一種失敗之行為不對稱; 收斂於此後一律回permission denied, 並以error事件通知應用端(與其他路由之錯誤回報方式一致)
    async function checkConn(inp) {
        let m = false
        try {
            m = verifyConn(inp)
            if (ispm(m)) {
                m = await m
            }
        }
        catch (err) {

            //m先歸false再回報: 以往回報寫在前面, 而取因以get(err,'message',err)配樣板字面量組訊息 ——
            //應用端verifyConn拋出message為拋錯getter之值時, 該行於catch內再拋, 例外逸出checkConn而由各路由上拋至hapi, 回裸HTTP 500且0則事件;
            //而本函數存在之理由正是「六路由對同一種失敗一律回permission denied」. 先歸false使該保證在結構上成立
            m = false

            //取因一律經getErrorMessage(見帳本R10)
            console.log(`verifyConn error for apiType[${get(inp, 'apiType', '')}]`, err) //使用err.message會過於簡化, 另外要開啟顯示err供debug
            evEmit('error', `verifyConn error for apiType[${get(inp, 'apiType', '')}]: ${getErrorMessage(err)}`)
        }
        return m === true
    }

    //procApp, 呼叫應用端事件之唯一出口
    //why 三者合一: procDeal/procUpload/procDownload 原為同一函數之三份複本(procUpload與procDownload逐字相同, 只差事件名),
    //  故任何加諸於「呼叫應用端」之紀律都得寫三遍 —— 而規則寫多遍正是本帳本各條重複出現之形狀
    //funThen, 僅execute需要對回傳值再加工(補output鍵、刪input), 以參數表達其差異而非另開一份複本
    //無人接聽時由callApp拒絕pmm並回報, 使請求不懸置(見src/callApp.mjs與帳本R12)
    let procApp = (name, args, funThen) => {

        //pm, pmm
        let pm = genPm()
        let pmm = genPm()

        //重新處理回傳結果, 須早於派發以確保拒絕必有處理者
        pmm
            .then((output) => {

                //canon, 應用端結果之正規化只在此處(三事件、各交付路徑共用)
                //undefined → null: 序列化會把值為 undefined 之鍵整個省略, 協定鍵之內之 output/msg 因而消失 ——
                //原本 execute(procDeal)與合併消費(managerMergeSlices 之 consume)各自正規化, 去重路徑(check-total-hash)沒有,
                //同一個「應用端 pm.resolve() 不帶值」使 upload() 依伺服器走哪條路徑而回 null 或 undefined(實測第十輪 D5)
                if (output === undefined) {
                    output = null
                }

                //function/symbol: JSON 對其靜默丟鍵而非拋錯, 故 encodeOut 之嚴格模式抓不到 —— 原本 execute 得 invalid msg.output 且兩端 0 則事件,
                //合併消費之 .ro 缺鍵而同一 queueId 重送再呼叫應用端(實測第十輪 A8); JSDoc 明載「不能序列化者回錯誤封包並發error事件」, 於此兌現
                //以 typeof 判定而不用 wsemi 之 isfun: 後者經 Object.prototype.toString.call, 會觸發應用端值之 Symbol.toStringTag getter
                let tp = typeof output
                if (tp === 'function' || tp === 'symbol') {
                    pm.reject('output can not be serialized') //settle 排在回報之前(帳本 R10 之結構層)
                    evEmit('error', `event[${name}] output can not be serialized: output is a ${tp}`)
                    return
                }

                pm.resolve(isfun(funThen) ? funThen(output) : output)
            })
            .catch((err) => {
                pm.reject(err)
            })

        //callApp, 派發並保證必定終結
        callApp(ev, evEmit, name, args, pmm, (msg) => {
            evEmit('error', msg)
        })

        return pm
    }

    //procDeal
    async function procDeal(data) {
        return procApp('execute', [get(data, 'func', ''), get(data, 'input', null)], (output) => {

            //add output, undefined 已由 procApp 正規化為 null(前端收不到 output 鍵即判為畸形封包而拒絕, 見 procApp 之 canon)
            data['output'] = output

            //delete input, 因input可能很大故回傳數據不包含原input
            delete data['input']

            return data
        })
    }

    //procUpload
    async function procUpload(input) {
        return procApp('upload', [input])
    }

    //procDownload
    async function procDownload(input) {
        return procApp('download', [input])
    }

    //路由層之共同部件(第十一輪 G6): 六路由之差異寫在 routeSpec 一張表上(apiType、handler 事件之 api、authorization 來源、錯誤狀態碼、下載欄位順序),
    //下列函數一律查表而不各自傳參; 原本同一規則手寫展開於六條路由(前置 6 份、token 切割 2 份 + 合成 1 份、下載欄位處置 3 份、/dwgf 狀態碼 8 處),
    //每加一條規則就得寫六遍而漏其一(第十輪 A5/A6/A9/F10 各改 3–6 處; 第十一輪 N2/N4 皆為「同一規則第二站點沒套」)

    //pfxToken, 授權方案前綴(含尾隨空白), 供自 authorization 切出 token
    let pfxToken = `${cstr(tokenType)} `

    //ctxOf, 各路由之請求脈絡(headers / query / authorization / token)之唯一取得處, 依 spec.authFrom 決定 authorization 與 token 之來源
    //  header: authorization 為請求標頭原樣; token 須先確認授權方案前綴相符才切, 不符者視為未帶 token(帳本 R15)
    //    why: 原以 slice(tokenType.length + 1) 無條件切, 從不驗前綴 —— 實測(tmp/probe_r9_final.mjs 之 Q4, server 設 tokenType='Token'):
    //    送 `Bearer abc123` 切出 " abc123"(帶前導空白)、送 `Basic dXNlcjpwYXNz` 整段成為 token, 兩者皆為可通過 isestr 之錯誤授權值, 應用端於 download 事件收到後無從察覺
    //  query: /dwgf 之下載由瀏覽器導覽而無標頭可用, token 走 query string, authorization 由套件合成為 `<tokenType> <token>`(刻意, 使應用端 verifyConn 於六路由所見同一形狀; B 卷 B4)
    let ctxOf = (req, spec) => {
        let headers = get(req, 'headers')
        headers = iseobj(headers) ? headers : ''
        let query = get(req, 'query')
        query = iseobj(query) ? query : ''
        let authorization = ''
        let token = ''
        if (spec.authFrom === 'query') {
            token = get(query, 'token', '')
            token = isestr(token) ? token : ''
            if (isestr(token)) {
                authorization = `${tokenType} ${token}`
            }
        }
        else {
            authorization = get(headers, 'authorization', '')
            authorization = isestr(authorization) ? authorization : ''
            token = authorization.startsWith(pfxToken) ? authorization.slice(pfxToken.length) : ''
        }
        return { headers, query, authorization, token }
    }

    //replyOf, 各路由之錯誤回覆器: 種類(kind)→ HTTP 狀態碼由 spec.statusOf 查表, 本體封包與 Return-Type / Return-Msg 標頭一律經 responseU8aStreamWithError; param 另標示 retryable:false
    //why 狀態碼與 retryable 為兩張表: 狀態碼依路由之消費者而異(只有 /dwgf 非 2xx, 帳本 R6 之例外), retryable 依錯誤種類而異(只有 param 可證明不需重試, 見專案重試原則);
    //原本 /dwgf 之 8 處 replyError(code, ...) 各自手寫狀態碼, 其餘五路由 9 處 retryable:false 各自手寫 —— 實為「同一 kind」之兩個面向(B 卷 §③-3.4.2③)
    let replyOf = (res, spec) => {
        let send = (kind, msg, opt) => {
            return responseU8aStreamWithError(res, msg, opt).code(spec.statusOf[kind])
        }
        return {
            permission: () => send('permission', 'permission denied'),
            param: (msg) => send('param', msg, { retryable: false }),
            app: (msg) => send('app', msg),
            output: (msg) => send('output', msg),
            packet: (msg) => send('packet', msg),
            internal: (msg) => send('internal', msg),
        }
    }

    //admit, 各路由之共同前置: 經 checkConn 呼叫 verifyConn, 未通過即回 permission denied(**不發 handler 事件**); 通過才發 handler 事件。回傳 null 代表放行, 各路由之參數檢核一律在其後
    //why 函數版而非 hapi route 級之 options.pre / options.ext(A 卷 §③-3.6(a) 允許但要求寫下理由): 兩者對本套件之保證等價(皆為 route 級, 不污染外部 serverHapi 之其他路由);
    //而 handler 內一行 `if (denied) return denied` 使「先驗權限 → 發 handler 事件 → 檢核參數」之順序於每條路由可直接讀出, 不需追 hapi 生命週期;
    //且 pre 之 takeover 回應與串流型 payload(/main、/slc 之 output:'stream')之互動未經驗證, 不值得為此承擔。不用 server.ext: 那是伺服器層, 會套到外部 serverHapi 之其他路由
    let admit = async(req, ctx, spec, reply) => {
        let m = await checkConn({ apiType: spec.apiType, authorization: ctx.authorization, query: ctx.query, headers: ctx.headers, req })
        if (m !== true) {
            return reply.permission()
        }
        evEmit('handler', {
            api: spec.api,
            headers: ctx.headers,
            query: ctx.query,
        })
        return null
    }

    //readOutput, 三條下載路由對應用端 download 事件回傳值之逐欄處置: 依 spec.fields 之**順序**讀取(attempt, 見帳本 R1)並判定(validDownloadField), 任一欄失敗即銷毀已取得之串流、發一則帶真因之事件、回錯誤封包
    //回 { ok: true, v } 或 { ok: false, res }(res 為已組好之錯誤回覆); 應用端拒絕之分流不在此(各路由於呼叫前處理)
    //why 只抽「逐欄之原子」而不抽整段(B 卷 §③-3.4.2④): 三路由之欄位集合、順序、選用性兩兩不同, 順序是契約(api-characterization 鎖住), 由 spec.fields 表達而非函數參數
    //fileSize 之值須經 getErrorMessage 而不可直接進樣板(帳本 R10): 其為應用端交出之任意值, 樣板求值時 toString 可拋錯
    let readOutput = (r, fileId, spec, reply) => {
        let rf = readDownloadFields(r, spec.fields.map((f) => f.name))
        if (!rf.ok) {
            destroyStreamRead(get(rf.fields, 'streamRead')) //streamRead 排在首位, 故後續欄位拋錯時該串流已在套件手上, 不清理即 fd 持續開啟(實測 tmp/probe_r9_rest.mjs 第1節)
            evEmit('error', `download fileId[${fileId}] output error: can not read field[${rf.field}]: ${rf.cause}`)
            return { ok: false, res: reply.output('invalid streamRead') }
        }
        let v = { streamRead: rf.fields.streamRead }
        for (let f of spec.fields) {
            if (f.name === 'streamRead') {
                continue
            }
            let vv = validDownloadField(f.name, rf.fields[f.name])
            if (vv.ok) {
                v[f.name] = vv.value
                continue
            }
            if (f.optional === true && !isestr(vv.cause)) {
                v[f.name] = '' //選用欄位: 判定不通過且判定本身未拋錯者視為未給(原本 toString 拋錯者送出空檔名之標頭, 第十輪 A6); 判定時拋錯者與必要欄位同一處置
                continue
            }
            destroyStreamRead(v.streamRead) //提供 stream 前發生錯誤, 得強制 destroy
            let detail = (f.name === 'fileSize') ? `[${getErrorMessage(rf.fields.fileSize)}]` : ''
            evEmit('error', `download fileId[${fileId}] output error: invalid ${f.name}${detail}${isestr(vv.cause) ? `: ${vv.cause}` : ''}`)
            return { ok: false, res: reply.output(`invalid ${f.name}`) }
        }
        return { ok: true, v }
    }

    //replyPacket, 控制封包路由之共同收尾: 以 success / error 鍵包裝結果, 經 encodeOut 嚴格序列化(不能者回錯誤封包 + 一則事件, 不可宣稱成功), 以 responseU8aStream 回應
    //label 為事件訊息之主詞(如 execute func[...]), 由呼叫端組; 含請求端值者須先經 getErrorMessage(帳本 R10)
    let replyPacket = async(res, reply, pm, label) => {
        let out = {}
        let returnType = ''
        let returnMsg = 'need to parse'
        await pm
            .then((r) => {
                out.success = r
                returnType = 'success'
            })
            .catch((err) => {
                out.error = err
                returnType = 'error'
            })
        let u8aOut = encodeOut(out, (msg) => {
            evEmit('error', `${label} output can not be serialized: ${msg}`)
        })
        if (u8aOut === null) {
            return reply.internal('output can not be serialized')
        }
        return responseU8aStream(res, u8aOut, { returnType, returnMsg })
    }

    //failPayload, parse:true 之路由(/ulctr、/dwgfn、/dw)本體解析失敗之處置: 由套件擁有, 回本套件之錯誤封包 + 一則事件, 而非 hapi 之裸 400
    //why: JSDoc 承諾「錯誤回應一律為 HTTP 200 + 錯誤封包(唯 /dwgf 例外)」, 而 hapi 對 JSON 語法錯誤(截斷、中間層改寫)於路由前置階段回 400 且 handler 從未執行 ——
    //前端收到無法解析之本體、兩端 0 則事件、client 照常重試(第十一輪 A1, A 卷實測 tmp/r11A_3_out.txt §D/§E)。
    ///main 為 parse:false 自行解碼, 早於第四輪即回 invalid request packet + 一則事件(#26); 三條 parse:true 路由為同一規則之未套站點(帳本 R6)
    //413(本體超過 maxBytes)原樣拋回: client 以狀態碼判定其為可證明不需重試, 該契約不變。解析失敗屬傳輸不穩, 依重試原則不標示 retryable
    let failPayload = (spec) => {
        return (req, h, err) => {
            if (get(err, 'output.statusCode') === 413) {
                throw err
            }
            evEmit('error', `invalid request packet for ${spec.api}: ${getErrorMessage(err)}`)
            return replyOf(h, spec).packet('invalid request packet').takeover()
        }
    }


    //apiMain
    let apiMain = {
        path: `/${apiName}/main`,
        method: 'POST',
        options: {
            payload: {
                maxBytes: sizeMsg, //hapi預設1mb; 本路由整包緩衝, 上限須誠實反映記憶體能力, 由opt.sizeMsg設定(預設100mb)
                maxParts: 1000 * 1000 * 1000, //預設為1000, 給予3次方
                timeout: false, //避免請求未完成時中斷
                output: 'stream', //代表前端用stream傳至伺服器(Content-Type為application/octet-stream)
                parse: false,
            },
            timeout: {
                server: false, //關閉伺服器超時
                socket: false, //關閉socket超時
            },
        },
        handler: async function (req, res) {
            // console.log(req, res)
            // console.log('payload', req.payload)

            //spec, reply, ctx, admit: 路由前置(查表取脈絡與錯誤回覆器, 驗權限, 發 handler 事件), 見 routeSpec / ctxOf / replyOf / admit
            let spec = routeSpec.main
            let reply = replyOf(res, spec)
            let ctx = ctxOf(req, spec)
            let denied = await admit(req, ctx, spec, reply)
            if (denied) {
                return denied
            }

            //receive
            let receive = () => {

                //pm
                let pm = genPm()

                //chunks
                let chunks = []

                //nReceived, 自行累計已收位元組
                //why: hapi之maxBytes對output:'stream'僅於請求帶Content-Length時預判(實測), 無Content-Length之chunked本體會整包收進來,
                //上限形同虛設; 故於此計數, 超限即停止接收、釋放已緩衝資料, 由handler比照hapi回413
                let nReceived = 0
                let bOver = false

                let smw = new stream.Writable({
                    write(chunk, encoding, cb) {
                        // console.log('smw receive payload', chunk)

                        //check, 超限後不再緩衝, 但持續讀完剩餘本體(丟棄)而不destroy請求串流: destroy會使hapi視為請求中止而直接斷線, 413回不到前端;
                        //讀完於end才回413, 記憶體仍受保護(不再累積), 且前端必收到明確回應
                        nReceived += chunk.length
                        if (nReceived > sizeMsg) {
                            chunks = []
                            bOver = true
                            cb()
                            return
                        }

                        //push
                        chunks.push(chunk)
                        // console.log('chunk.length', chunk.length)

                        //cb
                        cb()

                    }
                })

                //finish
                smw.on('finish', () => {
                    // console.log(`smw finish`)
                })

                //pipe
                req.payload.pipe(smw)

                //end
                req.payload.on('end', () => {
                    // console.log(`req.payload end`)

                    //check, 超限者於此reject, 由handler回413
                    if (bOver) {
                        pm.reject('payload too large')
                        return
                    }

                    //bb
                    let bb = Buffer.concat(chunks)
                    // console.log('bb', bb, bb.length)

                    //clear, 釋放記憶體
                    chunks = []

                    //resolve
                    pm.resolve(bb)

                })

                //close
                req.payload.on('close', () => {
                    // console.log(`req.payload close`)
                })

                //error
                req.payload.on('error', (err) => {
                    console.log(`apiMain req.payload err`, err) //使用err.message會過於簡化, 另外要開啟顯示err供debug
                    evEmit('error', `receive payload error: ${getErrorMessage(err)}`)
                    pm.reject(`receive payload error: ${getErrorMessage(err)}`)
                })

                return pm
            }

            //receive
            let bbInp = null
            try {
                bbInp = await receive()
            }
            catch (err) {

                //check, 超過sizeMsg(無Content-Length之本體由receive自行計數攔截), 比照hapi對有Content-Length者之處置回413,
                //使前端不論送法皆收到同一種結果(Payload Too Large), 且不觸發execute事件
                if (err === 'payload too large') {
                    return res.response({ statusCode: 413, error: 'Request Entity Too Large', message: `Payload content length greater than maximum allowed: ${sizeMsg}` }).code(413)
                }

                //其餘(如接收中斷線)維持原行為向外拋出
                throw err
            }
            // console.log('bbInp', bbInp)

            //u8aInp
            let u8aInp = new Uint8Array(bbInp)
            // console.log('u8aInp', u8aInp)

            //u8arr2obj, 以嚴格模式取狀態並檢核請求封包之形狀
            //why: 寬鬆模式對壞封包回{}而不報錯, procDeal隨即以func為空字串、input為null觸發應用端execute事件,
            //之後把output寫進該空物件並回200+Return-Type success —— 畸形或截斷之請求本體被「回報為成功」, 且應用端被一次不存在的呼叫驚動。
            //改為解不出或非有效物件即回錯誤封包並**不觸發任何應用端事件**; 屬傳輸不穩(截斷、中間層改寫), 依重試原則不標示retryable
            let rdInp = u8arr2obj(u8aInp, { returnWithStateAndMsg: true })
            if (get(rdInp, 'state') !== 'success' || !iseobj(rdInp.msg)) {
                //訊息之值經 getErrorMessage: 解碼成功但非物件者(如頂層陣列)其值來自請求端, 樣板對之求值時元素之 toString 可為非函數值而拋 ——
                //[{"toString":1}] 即回裸 HTTP 500 + 0 則事件(實測第十輪 A1, 帳本 R10)
                let msgInp = getErrorMessage(get(rdInp, 'msg', ''))
                evEmit('error', `invalid request packet for apiMain: ${isestr(msgInp) ? msgInp : 'not an effective object'}`)
                return reply.packet('invalid request packet')
            }
            let inp = rdInp.msg
            // console.log('inp', inp)

            //procDeal, 收尾經 replyPacket(應用端execute事件之回傳值或拒絕值無法序列化時不可宣稱成功, 見encodeOut); func 為請求端任意值, 須經 getErrorMessage(帳本 R10)
            return replyPacket(res, reply, procDeal(inp), `execute func[${getErrorMessage(get(inp, 'func', ''))}]`)
        },
    }

    //apiUploadCheck
    let apiUploadCheck = {
        path: `/${apiName}/ulctr`,
        method: 'POST',
        options: {
            payload: {
                maxBytes: sizeMsg, //控制用JSON(含check-slices-hash之各切片雜湊清單, 每片約36byte), parse:true整包讀入記憶體, 與/main共用上限(預設100mb, 約對應2.7tb檔案), 原為1tb形同無上限
                maxParts: 1000 * 1000 * 1000, //預設為1000, 給予3次方
                timeout: false, //避免請求未完成時中斷
                // output: 'stream',
                parse: true, //前端送obj過來須自動解析
                failAction: failPayload(routeSpec.ulctr), //解析失敗回套件錯誤封包(見 failPayload)
            },
            timeout: {
                server: false, //關閉伺服器超時
                socket: false, //關閉socket超時
            },
        },
        handler: async function (req, res) {
            // console.log(req, res)
            // console.log('payload', req.payload)

            //spec, reply, ctx, admit: 路由前置, 見 routeSpec / ctxOf / replyOf / admit
            let spec = routeSpec.ulctr
            let reply = replyOf(res, spec)
            let ctx = ctxOf(req, spec)
            let denied = await admit(req, ctx, spec, reply)
            if (denied) {
                return denied
            }

            //mode, 從payload接收
            let mode = get(req, 'payload.mode', '')

            //check
            if (mode !== 'check-total-hash' && mode !== 'check-slices-hash' && mode !== 'merge-slices-push' && mode !== 'merge-slices-get') {
                // console.log('invalid mode in payload')
                //mode 為請求端任意 JSON 值, 於檢核前進樣板須經 getErrorMessage: {"toString":1} 之自有屬性 toString 非函數, 樣板求值即拋 → 裸 HTTP 500 + 0 則事件(實測第十輪 D3)
                return reply.param(`invalid mode[${getErrorMessage(mode)}] in payload`)
            }

            //fileHash, 從payload接收
            let fileHash = get(req, 'payload.fileHash', '')
            // console.log(mode, 'fileHash', fileHash)

            //check, fileHash會參與pathUploadTemp下之路徑組裝, 須為安全識別字(英數字), 否則可 ../ 逸出資料夾
            if (!isSafeId(fileHash)) {
                // console.log('invalid fileHash in payload')
                return reply.param('invalid fileHash in payload')
            }

            //chunkTotal, 從payload接收, 僅merge-slices-push使用
            //check, chunkTotal決定mergeSlices配置路徑陣列之長度, 須為正整數; 巨大值另由mergeSlices逐片確認存在(缺片即停)兜底, 不會依此值無上限配置而耗盡記憶體
            let chunkTotal = get(req, 'payload.chunkTotal', '')
            if (mode === 'merge-slices-push') {
                if (!ispint(chunkTotal)) {
                    // console.log('invalid chunkTotal in payload')
                    return reply.param('invalid chunkTotal in payload')
                }
                chunkTotal = cint(chunkTotal)
            }

            //filename, 從payload接收, **原樣**交予應用端(check-total-hash 之去重與 merge-slices-get 之消費皆同), 於此讀一次而非各模式各讀一份
            //filenameSafe, 其淨化值(sanitizeFilename: 只取最末路徑段、去除各平台非法字元與保留裝置名; 未給或全為非法字元者為空字串, 套件不代為發明 unknown), 供應用端組落地路徑
            //why 兩者皆給而非就地淨化(第十一輪 N4, 兩份複審一致): 本套件自身不以此值組任何路徑(切片與合併檔皆以經 isSafeId 之 fileHash/packageId 命名), 風險只在應用端如何使用;
            //就地淨化會刪掉合法資料 —— a:b.txt 於 Linux 合法、瀏覽器 webkitdirectory 之 docs/2024/report.pdf 會只剩 report.pdf 且應用端無從得知目錄曾存在。
            //對標 multer: originalname 原樣且明載不可信, 另給 filename。本套件對另一方向(伺服器交出之檔名, client 之 downloadStream)則就地淨化 ——
            //因為那個值是套件自己要拿去 path.resolve 落地的; 誰要用它, 誰淨化(帳本 R19)
            let filename = get(req, 'payload.filename', '')
            let filenameSafe = sanitizeFilename(filename, '')

            //throwIfWorkerError, checkTotalHash與checkSlicesHash以回傳 { error } 表達失敗而非拋錯, 未檢核即會被當成功回給前端
            //why: 原無此檢核 —— checkTotalHash 對非法 fileSize 回 { error: 'invalid fileSize in payload' },
            //該物件原樣進入 out.success 而以 Return-Type: success 回應; 前端 sendDataSlice 之各項檢核(bAllHash/sizeSlice/bSls)皆為 undefined 而略過,
            //於切片迴圈首次使用 resUpCkt.slks 時拋 TypeError: Cannot read properties of undefined (reading 'indexOf')(實測 tmp/probe_r9_rest.mjs 第2節)
            //亦即「伺服器宣稱成功、前端崩在一個看不出原因的地方」, 屬帳本 R6(不得宣稱成功)與 R3(不得把底層沒拋錯當成功)之同型
            //回非空字串即代表失敗, 由呼叫處以 Promise.reject 交出而成為錯誤封包(值維持純字串, 與其他錯誤封包一致);
            //不標示 retryable(標示會減少重試, 須另行舉證, 見專案重試原則)
            let workerError = (o) => {
                if (iseobj(o) && haskey(o, 'error')) {
                    return `${mode}: ${cstr(o.error)}`
                }
                return ''
            }

            //internal, 本路由內部呼叫(worker 與合併佇列)之唯一出口: 其例外為套件內部失敗, 細節只進 error 事件, 回前端之訊息不含細節(帳本 R17)
            //why: 原本例外原樣進入 procCore 之 catch 而成為錯誤封包之內容 —— 暫存資料夾不在時前端收到 `Error: fd[<伺服器絕對路徑>] is not a folder` 且伺服器 0 則事件
            //(實測第十輪 A11/N5); 同套件之 /slc 寫入失敗、S5、check-total-hash 之 path 皆已明載不外送伺服器路徑, 唯此處不守
            //應用端之拒絕值不經本函數(merge-slices-get 之 funConsume 依設計原樣傳回前端)
            let internal = async(stage, fn) => {
                try {
                    return await fn()
                }
                catch (err) {
                    evEmit('error', `upload-controller mode[${mode}] ${stage} error: ${getErrorMessage(err)}`)
                    return Promise.reject(`${mode} failed`)
                }
            }

            //procCore
            let procCore = async() => {
                let out = null
                if (mode === 'check-total-hash') {

                    //fileSize, 從payload接收
                    let fileSize = get(req, 'payload.fileSize', '')
                    // console.log(mode, 'fileSize', fileSize)

                    //checkTotalHash
                    out = await internal('check total hash', () => checkTotalHash(fileSize, sizeSlice, fileHash, pathUploadTemp))
                    // console.log(mode, 'out', out)

                    //check, 失敗不得被當成功回給前端(見workerError)
                    let we = workerError(out)
                    if (isestr(we)) {
                        return Promise.reject(we)
                    }

                    //check, 因合併大檔後可能非預期中斷而重傳, 每次偵測有合併完成大檔, 就得調用procUpload讓伺服器攔截函數處理
                    if (out.bAllHash) {

                        //ri
                        let ri = {
                            from: 'check-total-hash',
                            filename,
                            filenameSafe,
                            path: out.path, //out.path使用path.resolve為絕對路徑
                        }

                        //procUpload
                        // console.log('procUpload start')
                        let ro = await procUpload(ri)
                        // console.log('procUpload done', ro)

                        //out merge, 此處(bAllHash=true時)ro儲存至out.msg, 非此處(bAllHash=false時)回傳原本out, 前端須分開處理
                        out = {
                            ...out,
                            msg: ro,
                        }

                    }

                    //path, 為伺服器絕對路徑, 僅供上方procUpload使用, 不回傳前端(前端未使用, 且會外洩伺服器目錄結構)
                    delete out.path

                    //sizeSlice, 回傳伺服器切片大小供前端比對, 前後端不一致時前端可提早以明確訊息終止, 而非於/slc被413拒絕或永遠無法續傳
                    out.sizeSlice = sizeSlice

                }
                else if (mode === 'check-slices-hash') {

                    //fileSliceHashs, 從payload接收
                    let fileSliceHashs = get(req, 'payload.fileSliceHashs', [])
                    // console.log(mode, 'fileSliceHashs', fileSliceHashs)

                    //checkSlicesHash
                    out = await internal('check slices hash', () => checkSlicesHash(fileSliceHashs, fileHash, pathUploadTemp))
                    // console.log(mode, 'out', out)

                    //check, 失敗不得被當成功回給前端(見workerError); 本模式之失敗為 invalid fileHash 與 no fileSliceHashs
                    let we = workerError(out)
                    if (isestr(we)) {
                        return Promise.reject(we)
                    }

                }
                else if (mode === 'merge-slices-push') {

                    //mmg.push, chunkTotal已於上方檢核為正整數; 合併檔在而.done不在(前次中止)時會先驗證完整性, 故為async
                    let queueId = await internal('push merge task', () => mmg.push(fileHash, chunkTotal, pathUploadTemp))

                    //out
                    out = {
                        queueId,
                    }

                }
                else if (mode === 'merge-slices-get') {

                    //queueId, 從payload接收
                    let queueId = get(req, 'payload.queueId', '')
                    // console.log(mode, 'queueId', queueId)

                    //mmg.get, 狀態判定與消費(呼叫應用端upload事件)皆於managerMergeSlices內依其檔頭狀態表處理, 此處只提供消費函數與記錄函數並組回應;
                    //首次消費之結果會落地, 同一queueId之重送(回應遺失、逾時)直接回儲存之結果而不再呼叫應用端; 應用端拒絕值由mmg.get原樣向外拋, 經procCore之catch成為error封包送回前端(依重試原則由前端重送)
                    let r = await mmg.get(queueId, pathUploadTemp, {
                        funConsume: async(fp) => {
                            return await procUpload({
                                from: 'merge-slices-get',
                                filename,
                                filenameSafe,
                                path: fp, //fp使用path.resolve為絕對路徑
                            })
                        },
                        funLog: (msg) => {
                            evEmit('error', msg)
                        },
                    })

                    //out, r.path為伺服器絕對路徑, 不回傳前端; state為'success'時msg為應用端之結果(首次消費或儲存之結果), 'error'時為不含伺服器路徑與底層細節之訊息
                    out = {
                        state: r.state,
                        msg: r.msg,
                        queueId,
                        filename,
                    }

                    //check, 失敗細節(含伺服器路徑)僅以error事件通知應用端, 不回傳前端; 格式為「<msg> for fileHash[...]: <reason>」
                    if (r.state === 'error' && isestr(r.reason)) {
                        evEmit('error', `${r.msg} for fileHash[${fileHash}]: ${r.reason}`)
                    }

                }
                // console.log('out', out)

                return out
            }

            //procCore, 收尾經 replyPacket(應用端upload事件之回傳值(經merge-slices-get之msg)無法序列化時不可宣稱成功, 見encodeOut); mode 已檢核為四個字面之一
            return replyPacket(res, reply, procCore(), `upload-controller mode[${mode}]`)
        },
    }

    //apiUploadSlice
    let apiUploadSlice = {
        path: `/${apiName}/slc`,
        method: 'POST',
        options: {
            payload: {
                maxBytes: sizeSlice, //單一切片本就不超過sizeSlice(checkTotalHash亦以sizeSlice判定切片是否完整), 前後端sizeSlice須一致; 原為1tb形同無上限
                maxParts: 1000 * 1000 * 1000, //預設為1000, 給予3次方
                timeout: false, //避免請求未完成時中斷
                output: 'stream', //代表前端用stream傳至伺服器(Content-Type為application/octet-stream)
                parse: false,
            },
            timeout: {
                server: false, //關閉伺服器超時
                socket: false, //關閉socket超時
            },
        },
        handler: async function (req, res) {
            // console.log(req, res)
            // console.log('payload', req.payload)

            //spec, reply, ctx, admit: 路由前置, 見 routeSpec / ctxOf / replyOf / admit
            let spec = routeSpec.slc
            let reply = replyOf(res, spec)
            let ctx = ctxOf(req, spec)
            let denied = await admit(req, ctx, spec, reply)
            if (denied) {
                return denied
            }

            //chunkIndex, chunkTotal, packageId, 從headers接收
            let chunkIndex = get(ctx.headers, 'chunk-index', '')
            let chunkTotal = get(ctx.headers, 'chunk-total', '')
            let packageId = get(ctx.headers, 'package-id', '')

            //check
            if (!isp0int(chunkIndex)) {
                // console.log('invalid chunkIndex in headers')
                return reply.param('invalid chunkIndex in headers')
            }
            chunkIndex = cint(chunkIndex)
            if (!isp0int(chunkTotal)) {
                // console.log('invalid chunkTotal in headers')
                return reply.param('invalid chunkTotal in headers')
            }
            chunkTotal = cint(chunkTotal)
            if (!isSafeId(packageId)) { //packageId會參與切片檔路徑組裝, 須為安全識別字(英數字), 否則可 ../ 逸出資料夾
                // console.log('invalid packageId in headers')
                return reply.param('invalid packageId in headers')
            }

            //pathFileChunk
            let pathFileChunk = path.resolve(pathUploadTemp, `${packageId}_${chunkIndex}`)
            // console.log('pathFileChunk', pathFileChunk)

            //streamWrite
            let streamWrite = fs.createWriteStream(pathFileChunk)

            //receive
            let receive = () => {

                //pm
                let pm = genPm()

                //nReceived, 自行累計已收位元組
                //why: 同/main, hapi之maxBytes對output:'stream'僅於請求帶Content-Length時預判, 無Content-Length之chunked本體會繞過;
                //超限即停止落地(unpipe須早於pipe之data監聽, 故此監聽先註冊)並刪除已寫部分, 持續讀完剩餘本體而不destroy(否則413回不到前端), 於end回413
                let nReceived = 0
                let bOver = false

                //bWriteErr, 寫入失敗(資料夾被清、磁碟滿、權限不足)須攔截: Writable之error無監聽時會拋成未捕捉例外, 整個伺服器行程會崩潰而前端仍收到200
                //細節(含伺服器路徑)僅以error事件通知應用端, 回前端之訊息不含路徑
                let bWriteErr = false

                //bAbort, bEnded, 前端中斷(斷線)須收尾目的串流: .pipe()不會因源串流出錯或提前關閉而關閉目的, 寫入fd會隨每次中斷累積(實測5次中斷5個fd全開), 長跑伺服器終至EMFILE;
                //比照bOver/bWriteErr: destroy後於close刪除不完整切片(續傳本就以大小不等於sizeSlice判定須重傳, 殘留無用); bEnded供close判別「未end即close」之中斷路徑
                let bAbort = false
                let bEnded = false

                //done, 成功之唯一終結點, 於寫入串流 close 時判定: 須「request 本體已 end」且「寫入串流已 finish」(writableFinished: end() 正常走完、所有 write 之回呼皆已返回)
                //why: 原本於 request 之 end 即排程回 done, 而 pipe 於 end 時只是把最後一片**交給**寫入串流, 其 fs.write 尚未完成 ——
                //慢磁碟下(實測 tmp/probe_r11_a.mjs P1: 每次寫入延後 400ms)前端已收到 done 並送出 merge-slices-push, 合併讀到短切片而整個上傳以 merge slices failed 告終;
                //且 end 之後(flush 階段)才發生之寫入失敗, 錯誤晚於 delayForSlice 到達時 pm 已 resolve, 不完整之切片被當成功(A 卷 §①-1.3(a) 第 4 點)。
                //「done」須代表切片已交給 OS(fd 已關; 非持久化, 無 fsync)—— 與帳本 R18「完成標記須證明其所指之內容」同族
                //why 以 writableFinished 作肯定式證明而非列舉 bOver/bWriteErr/bAbort 之否定式(B 卷 §③-3.1): 被 destroy() 中斷者其 writableFinished 恆為假, 日後新增中斷路徑亦不需改此守衛;
                //bEnded 必早於 close: pipe 之 onend 與本路由之 end 監聽於同一次 emit 內同步執行, 而 finish/close 至少要到下一個 tick(兩份複審各自推導)
                let done = () => {
                    if (!bEnded || streamWrite.writableFinished !== true) {
                        return
                    }

                    //setTimeout, 切片上傳添加延遲處理, 避免佔滿伺服器CPU與流量
                    setTimeout(() => {
                        pm.resolve(`chunk[${chunkIndex + 1}/${chunkTotal}] of packageId[${packageId}] done`)
                    }, delayForSlice)
                }
                streamWrite.on('error', (err) => {
                    if (bWriteErr || bOver || bAbort) {
                        return
                    }
                    bWriteErr = true
                    req.payload.unpipe(streamWrite)
                    req.payload.resume() //持續讀完剩餘本體, 使錯誤回應能回到前端
                    console.log(`apiUploadSlice streamWrite chunk[${chunkIndex + 1}/${chunkTotal}] of packageId[${packageId}] err`, err)
                    evEmit('error', `write chunk[${chunkIndex + 1}/${chunkTotal}] of packageId[${packageId}] error: ${getErrorMessage(err)}`)
                    pm.reject(`write chunk[${chunkIndex + 1}/${chunkTotal}] of packageId[${packageId}] error`)
                })
                streamWrite.on('close', () => {
                    if (bOver || bWriteErr || bAbort) {
                        fsDeleteFile(pathFileChunk) //待fd關閉(close)後才刪, 否則Windows下會EBUSY; 檔案不存在視為成功且不拋錯; 寫入失敗與中斷者亦清除殘留之不完整切片
                        return
                    }
                    done()
                })

                //data
                req.payload.on('data', (chunk) => {
                    if (bOver) {
                        return
                    }
                    nReceived += chunk.length
                    if (nReceived > sizeSlice) {
                        bOver = true
                        req.payload.unpipe(streamWrite)
                        req.payload.resume() //unpipe移除最後一個目的地時Node會自動pause, 須resume才會繼續讀完剩餘本體並觸發end
                        streamWrite.destroy()
                    }
                })

                //pipe
                req.payload.pipe(streamWrite)
                // console.log(`receiving chunk[${chunkIndex + 1}/${chunkTotal}]...`)

                //end
                req.payload.on('end', () => {
                    // console.log(`receive chunk[${chunkIndex + 1}/${chunkTotal}] done`)
                    bEnded = true

                    //check, 寫入失敗者已於streamWrite error中reject
                    if (bWriteErr) {
                        return
                    }

                    //check, 超限者於此reject, 由handler回413; 成功不於此 resolve, 須待寫入串流 close(見 done)
                    if (bOver) {
                        pm.reject('payload too large')
                    }

                })

                //onAbort, 源串流出錯(如aborted/ECONNRESET)或未end即close皆為中斷, 只處理一次: 關閉寫入fd(其close會刪除不完整切片)、emit一則error事件、reject;
                //已正常end或已由寫入失敗路徑處置者不再處理; 超限(bOver)排空中斷線者仍須reject使handler結束(413已無法送達, 但不可懸置)
                let onAbort = (msg) => {
                    if (bAbort || bEnded || bWriteErr) {
                        return
                    }
                    bAbort = true
                    streamWrite.destroy()
                    evEmit('error', `receive chunk[${chunkIndex + 1}/${chunkTotal}] of packageId[${packageId}] error: ${msg}`)
                    pm.reject(`receive chunk[${chunkIndex + 1}/${chunkTotal}] of packageId[${packageId}] error: ${msg}`)
                }

                //error
                req.payload.on('error', (err) => {
                    console.log(`apiUploadSlice req.payload chunk[${chunkIndex + 1}/${chunkTotal}] of packageId[${packageId}] err`, err) //使用err.message會過於簡化, 另外要開啟顯示err供debug
                    onAbort(getErrorMessage(err))
                })

                //close, 未end即close亦視為中斷(部分中斷路徑只發close不發error); 正常路徑end先於close, 由bEnded擋下
                req.payload.on('close', () => {
                    onAbort('closed before end')
                })

                return pm
            }

            //receive
            let out = {}
            let returnType = ''
            let returnMsg = ''
            try {
                let r = await receive()
                out.success = r
                returnType = 'success'
                returnMsg = 'need to parse'
            }
            catch (err) {

                //check, 超過sizeSlice(無Content-Length之本體由receive自行計數攔截), 比照hapi對有Content-Length者之處置回413, 使前端不論送法皆收到同一種結果
                if (err === 'payload too large') {
                    return res.response({ statusCode: 413, error: 'Request Entity Too Large', message: `Payload content length greater than maximum allowed: ${sizeSlice}` }).code(413)
                }

                //其餘錯誤(源串流出錯或中斷、寫入失敗)已於receive內各路徑各emit一則error事件(含底層訊息), 此處只組回應不再emit, 否則同一失敗會有兩則(且寫入失敗者兩則文字不同, 形同兩次故障)
                out.error = err
                returnType = 'error'
                returnMsg = 'need to parse'
            }
            // console.log('out', out)

            //u8aOut
            let u8aOut = obj2u8arr(out)
            // console.log('u8aOut', u8aOut)

            // //測試失敗重傳
            // if (Math.random() < 0.6) {
            //     out = {
            //         error: 'force error'
            //     }
            //     returnType = 'error'
            //     returnMsg = 'force error'
            //     // console.log('out', out)
            //     u8aOut = obj2u8arr(out)
            // }

            return responseU8aStream(res, u8aOut, { returnType, returnMsg })
        },
    }

    //apiDownloadGetFilename
    let apiDownloadGetFilename = {
        path: `/${apiName}/dwgfn`,
        method: 'POST',
        options: {
            payload: {
                maxBytes: sizeMsg, //控制用JSON({fileId}), parse:true整包讀入記憶體, 與/main共用上限, 原為1tb形同無上限
                maxParts: 1000 * 1000 * 1000, //預設為1000, 給予3次方
                timeout: false, //避免請求未完成時中斷
                // output: 'stream',
                parse: true, //前端送obj過來須自動解析
                failAction: failPayload(routeSpec.dwgfn), //解析失敗回套件錯誤封包(見 failPayload)
            },
            timeout: {
                server: false, //關閉伺服器超時
                socket: false, //關閉socket超時
            },
        },
        handler: async function (req, res) {
            // console.log(req, res)
            // console.log('payload', req.payload)

            //spec, reply, ctx, admit: 路由前置, 見 routeSpec / ctxOf / replyOf / admit
            let spec = routeSpec.dwgfn
            let reply = replyOf(res, spec)
            let ctx = ctxOf(req, spec)
            let denied = await admit(req, ctx, spec, reply)
            if (denied) {
                return denied
            }

            //fileId, 從payload接收
            let fileId = get(req, 'payload.fileId', '')
            // console.log('fileId', fileId)

            //check
            if (!isestr(fileId)) {
                // console.log('invalid fileId in payload')
                return reply.param('invalid fileId in payload')
            }

            //inp, token 自 ctx 取得(來源與前綴檢核見 ctxOf), 供外部download事件進行授權檢查
            let inp = { fileId, token: ctx.token }

            //procDownload
            let out = {}
            await procDownload(inp)
                .then((res) => {
                    out.success = res
                })
                .catch((err) => {
                    out.error = err
                })
            // console.log('out', out)

            //return, 應用端拒絕(或其監聽器拋錯經safe emitter轉為拒絕)者於此結束, 與/dwgf、/dw同一控制流
            //why: 原無此早返而讓拒絕值落入下方之形狀檢核, 造成兩個問題 —— 一是回前端之訊息為'invalid filename'而非另兩路由之'can not get file from fileId'(同一失敗三路由兩種說法),
            //二是監聽器拋錯時safe emitter(見funGetListenerError)已發過一則error事件, 若再於形狀檢核處補發即成同一次請求兩則. 先分流拒絕, 形狀檢核才只處理「真的resolve了但形狀不對」
            if (haskey(out, 'error')) {
                // console.log('out.error', out.error)
                return reply.app('can not get file from fileId')
            }

            //ro, 依 spec.fields 之順序讀取與檢核(streamRead → filename), 失敗即銷毀串流 + 一則事件 + 錯誤回覆(見 readOutput)
            //本路由只取檔名與串流兩欄, 不讀 fileSize / fileType, 以免其 getter 拋錯影響本路由(維持既有行為, 順序寫在 routeSpec)
            //filename 須經 validDownloadField 轉為字串基本型才可放進封包(否則帶 Symbol.toStringTag='String' 且 toJSON 回 undefined 之物件會使 filename 鍵於序列化時消失, 第九輪 F2)
            let ro = readOutput(get(out, 'success'), fileId, spec, reply)
            if (!ro.ok) {
                return ro.res
            }

            //destroy, 本路由只取檔名不提供stream故須預先destroy; 瀏覽器下載管理器路徑接著會以同一fileId再觸發一次download事件取串流, 應用端每次皆須交出新串流
            destroyStreamRead(ro.v.streamRead)

            //重新提供out: 只交出檔名, 應用端回傳物件之其他欄位不外送; 收尾經 replyPacket(須經 encodeOut 而非直接 obj2u8arr:
            //filename 來自應用端, 其 toJSON 若回 BigInt 則序列化拋錯、回 undefined 則 filename 鍵消失, 兩者於直接 obj2u8arr 下皆是「宣稱成功之壞封包」且 0 則事件)
            return replyPacket(res, reply, Promise.resolve({ filename: ro.v.filename }), `download fileId[${fileId}]`)
        },
    }

    //apiDownloadGetFile
    let apiDownloadGetFile = {
        path: `/${apiName}/dwgf`,
        method: 'GET',
        options: {
            timeout: {
                server: false, //關閉伺服器超時
                socket: false, //關閉socket超時
            },
            //response.emptyStatusCode, 見/dw之同一設定
            response: {
                emptyStatusCode: 200,
            },
        },
        handler: async function (req, res) {
            // console.log(req, res)
            // console.log('payload', req.payload)

            //spec, reply, ctx, admit: 路由前置, 見 routeSpec / ctxOf / replyOf / admit
            //本路由之錯誤回應: 本體封包與標頭同其他路由, 唯 HTTP 狀態碼為非 2xx(routeSpec.dwgf.statusOf: 403 權限、400 參數、404 應用端無法提供檔案、500 內容不合契約)
            //why: 本路由之唯一消費者是瀏覽器下載管理器(client 之 downloadByManager 以 a[download] 導覽至此, 無任何 JS 讀其本體或標頭),
            //而下載管理器只以狀態碼判定成敗 —— 原本錯誤一律 HTTP 200, 應用端拒絕、permission denied 皆被存成使用者之檔案
            //(Chromium failure=null, 存下 52B / 41B 之錯誤封包; 實測第十輪 A9), 兩端 0 則事件。
            //帳本 R6「一律 HTTP 200」之前提為「由 JS 解析本體」, 於本路由不成立, 列為 R6 之例外。對標: S3 預簽 URL 以 403/404 使瀏覽器顯示下載失敗
            //token 走 query string(下載由瀏覽器導覽, 無標頭可用), authorization 由 ctxOf 合成
            let spec = routeSpec.dwgf
            let reply = replyOf(res, spec)
            let ctx = ctxOf(req, spec)
            let denied = await admit(req, ctx, spec, reply)
            if (denied) {
                return denied
            }

            //fileId
            let fileId = get(ctx.query, 'fileId', '')
            fileId = isestr(fileId) ? fileId : ''
            // console.log('fileId', fileId)

            //check
            if (!isestr(fileId)) {
                // console.log('invalid fileId in query')
                return reply.param('invalid fileId in query')
            }

            //inp, token供外部download事件進行授權檢查
            let inp = { fileId, token: ctx.token }

            //procDownload
            let out = {}
            await procDownload(inp)
                .then((res) => {
                    out.success = res
                })
                .catch((err) => {
                    out.error = err
                })
            // console.log('out', out)

            //return
            if (haskey(out, 'error')) {
                // console.log('out.error', out.error)
                return reply.app('can not get file from fileId')
            }

            //ro, 依 spec.fields 之順序讀取與檢核四欄(streamRead → fileSize → fileType → filename(選用)), 失敗即銷毀串流 + 一則事件 + 錯誤回覆(見 readOutput)
            //fileSize 會原樣寫入 Content-Length(須為安全非負整數, 經 cint 正規化); fileType 會原樣寫入 Content-Type(須通過標頭值驗證); 形狀錯誤皆屬應用端狀態, 依重試原則不標示 retryable
            //filename 為選用: 應用端有給則以 RFC 6266 之 filename*(值為 RFC 5987 percent-encoding)回傳, 使瀏覽器不論頁面與 API 是否同源皆以此命名
            //  why: 瀏覽器只對同源 URL 採用 <a download> 之檔名, 跨來源時忽略而以 URL 末段(dwgf)命名; 以往不給此標頭之理由(中文於 filename="..." 須 base64)是舊寫法之限制, filename* 由瀏覽器直接還原 UTF-8;
            //  判定不通過者(未給、非字串、toString 拋錯而無法取得字串)一律視為未給(原本 toString 拋錯者送出空檔名之標頭, 第十輪 A6); 判定時拋錯者(Symbol.toStringTag getter 等)與其他欄位同一處置
            let ro = readOutput(get(out, 'success'), fileId, spec, reply)
            if (!ro.ok) {
                return ro.res
            }
            let streamRead = ro.v.streamRead
            let fileSize = ro.v.fileSize
            let fileType = ro.v.fileType
            let filename = ro.v.filename

            //bs, 收斂streamRead並保證實送位元組數與fileSize一致(見buildDownloadSource)
            //forHead, 本路由為GET, hapi對GET路由自動支援HEAD; HEAD不送本體故不建計數串流(見buildDownloadSource之forHead)
            let bs = buildDownloadSource(streamRead, fileSize, (msg) => {
                evEmit('error', `download fileId[${fileId}] stream error: ${msg}`)
            }, { forHead: cstr(get(req, 'method', '')).toLowerCase() === 'head' })
            if (bs.error) {
                destroyStreamRead(streamRead)
                evEmit('error', `download fileId[${fileId}] output error: ${bs.reason}`)
                return reply.output(bs.error)
            }

            //rr
            //Content-Disposition, 一律 attachment: 本路由為下載端點, 未給 filename 者亦不得由瀏覽器依型別改為導頁(跨來源時 <a download> 之檔名與強制下載皆被忽略, 可直接顯示之型別即導頁, 第十一輪 N6);
            //有 filename 才加 filename*(對標 nginx / S3 / Express 之 res.download)
            let rr = res.response(bs.source)
                .type(fileType)
                .header('Content-Encoding', 'identity') //見/dw之同一設定
                .header('Content-Length', fileSize)
                .header('Content-Disposition', isestr(filename) ? `attachment; filename*=UTF-8''${encodeRfc5987(filename)}` : 'attachment')

            return rr
        },
    }

    //apiDownload
    let apiDownload = {
        path: `/${apiName}/dw`,
        method: 'POST',
        options: {
            payload: {
                maxBytes: sizeMsg, //控制用JSON({fileId}), parse:true整包讀入記憶體, 與/main共用上限, 原為1tb形同無上限
                maxParts: 1000 * 1000 * 1000, //預設為1000, 給予3次方
                timeout: false, //避免請求未完成時中斷
                // output: 'stream',
                parse: true, //前端送obj過來須自動解析
                failAction: failPayload(routeSpec.dw), //解析失敗回套件錯誤封包(見 failPayload)
            },
            timeout: {
                server: false, //關閉伺服器超時
                socket: false, //關閉socket超時
            },
            //response.emptyStatusCode, 應用端提供之0byte檔為合法檔案, 須以200+Content-Length:0表達
            //why: hapi預設emptyStatusCode為204, 會把本體長度為0之成功回應改為204並刪除Content-Length(見其transmit.js);
            //204語意為「沒有回應內容」而非「有一個長度為0的內容」, 瀏覽器下載管理器路徑(a[download]打/dwgf)因而把下載標記為取消且不落地檔案,
            //而nodejs與blob兩路徑卻正常 —— 同一download API三條交付路徑不對稱. nginx、Express之sendFile、S3取空物件皆以200+CL0表達空檔.
            //設於route層而非server層: 使自建與外部serverHapi兩種部署得到相同契約, 且不覆寫宿主其他route之政策. 錯誤封包本體非空故不受影響
            response: {
                emptyStatusCode: 200,
            },
        },
        handler: async function (req, res) {
            // console.log(req, res)
            // console.log('payload', req.payload)

            //spec, reply, ctx, admit: 路由前置, 見 routeSpec / ctxOf / replyOf / admit
            let spec = routeSpec.dw
            let reply = replyOf(res, spec)
            let ctx = ctxOf(req, spec)
            let denied = await admit(req, ctx, spec, reply)
            if (denied) {
                return denied
            }

            //fileId, 從payload接收
            let fileId = get(req, 'payload.fileId', '')
            // console.log('fileId', fileId)

            //check
            if (!isestr(fileId)) {
                // console.log('invalid fileId in payload')
                return reply.param('invalid fileId in payload')
            }

            //inp, token 自 ctx 取得(來源與前綴檢核見 ctxOf), 供外部download事件進行授權檢查
            let inp = { fileId, token: ctx.token }

            //procDownload
            let out = {}
            await procDownload(inp)
                .then((res) => {
                    out.success = res
                })
                .catch((err) => {
                    out.error = err
                })
            // console.log('out', out)

            //return
            if (haskey(out, 'error')) {
                // console.log('out.error', out.error)
                return reply.app('can not get file from fileId')
            }

            //ro, 依 spec.fields 之順序讀取與檢核四欄(streamRead → filename → fileSize → fileType), 失敗即銷毀串流 + 一則事件 + 錯誤回覆(見 readOutput)
            //filename 經 validDownloadField 轉為字串基本型並以 U+FFFD 取代孤立代理對(否則 str2b64 之寬鬆模式回空字串而檔名整個消失, 第十輪 A7);
            //fileSize 會原樣寫入 Content-Length(須為安全非負整數, 經 cint 正規化); fileType 會原樣寫入 Content-Type(須通過標頭值驗證); 形狀錯誤皆屬應用端狀態, 依重試原則不標示 retryable
            let ro = readOutput(get(out, 'success'), fileId, spec, reply)
            if (!ro.ok) {
                return ro.res
            }
            let streamRead = ro.v.streamRead
            let filename = str2b64(ro.v.filename) //headers內對中文支援度不佳須用base64傳
            let fileSize = ro.v.fileSize
            let fileType = ro.v.fileType

            //bs, 收斂streamRead並保證實送位元組數與fileSize一致(見buildDownloadSource)
            //forHead, 本路由為POST故一般不會收到HEAD; 與/dwgf同式處理, 使兩路由對此不對稱不再由「寫法差異」產生
            let bs = buildDownloadSource(streamRead, fileSize, (msg) => {
                evEmit('error', `download fileId[${fileId}] stream error: ${msg}`)
            }, { forHead: cstr(get(req, 'method', '')).toLowerCase() === 'head' })
            if (bs.error) {
                destroyStreamRead(streamRead)
                evEmit('error', `download fileId[${fileId}] output error: ${bs.reason}`)
                return reply.output(bs.error)
            }

            //Content-Encoding: identity, 使hapi跳過回應壓縮而保留Content-Length
            //why: hapi對可壓縮mime(text/*、application/json等)於前端帶Accept-Encoding時會壓縮並刪除Content-Length(見其compression.js與transmit.js);
            //而axios於nodejs預設即送Accept-Encoding, 故應用端只要宣告文字型fileType, 前端onDownloadProgress之ev.total就永遠是undefined,
            //cbProgress之prog恆為0直到結束 —— 同一download API下載二進位有進度、下載CSV/JSON卻沒有.
            //hapi之compression.encoding()於回應已帶content-encoding時即跳過壓縮, 故以此表達. 代價為文字型下載不再壓縮而傳輸量增加;
            //保留意見: RFC 9110 §8.4 之identity保留給Accept-Encoding, 於Content-Encoding為SHOULD NOT, 此為hapi 21缺乏route層停用壓縮能力下之實用途徑,
            //屬實作細節而非本套件協定之一部分, 日後hapi提供正式能力時應改用之
            return res.response(bs.source)
                .type(fileType)
                .header('Content-Encoding', 'identity')
                .header('Content-Disposition', `attachment; filename="${filename}"`) //針對前端(nodejs)用POST下載, 可基於header內base64檔名解析出並直接給予檔名, 不用預先取得檔名
                .header('Content-Length', fileSize)
        },
    }

    //startServer
    async function startServer() {

        //register inert
        if (useInert) {
            await server.register(Inert)
        }

        //apiRoutes
        let apiRoutes = []
        if (useInert) {
            let api = {
                method: 'GET',
                path: '/{file*}',
                handler: {
                    directory: {
                        path: `${pathStaticFiles}/`
                    }
                },
            }
            apiRoutes = [
                ...apiRoutes,
                api,
            ]
        }
        if (true) {
            apiRoutes = [
                ...apiRoutes,
                apiMain,
                apiUploadCheck,
                apiUploadSlice,
                // apiUploadSliceMerge,
                apiDownloadGetFilename,
                apiDownloadGetFile,
                apiDownload,
            ]
        }

        //route
        server.route(apiRoutes)

        //start
        await server.start()

        console.log(`Server running at: ${server.info.uri}`)

    }

    //start
    //pmStart, 保留建構期之啟動promise供stop等待
    //why: 原本此promise被丟棄, stop() 於啟動尚未完成時呼叫即落入 hapi 之 initializing 階段而被拒 ——
    //實測(tmp/probe_r9_final.mjs之F3): `new` 之後立刻 `await stop()` 於46ms回來、發一則
    //「Cannot stop server while in initializing phase」, 而伺服器隨後照樣起來並持續服務(port可連線且回HTTP 200);
    //亦即呼叫端以為停了而實際上沒有。本promise已帶catch故恆resolve, stop 內await它不會再拋
    let pmStart = null
    if (get(opt, 'serverHapi')) {

        //route, 註冊於外部伺服器之失敗(路由衝突、apiName 非法)須以建構期事件通知而不拋出
        //why: 自建伺服器之同一失敗於 async 之 startServer 內發生而走 error 事件, 外部伺服器原本於建構子內同步拋出 ——
        //同一種失敗依部署方式兩種通道, 與 JSDoc「啟動失敗時不拋出，以error事件通知」不合(實測第十輪 A13)
        try {
            // server.route([apiMain, apiUploadCheck, apiUploadSlice, apiUploadSliceMerge, apiDownloadGetFilename, apiDownloadGetFile, apiDownload])
            server.route([apiMain, apiUploadCheck, apiUploadSlice, apiDownloadGetFilename, apiDownloadGetFile, apiDownload])
        }
        catch (err) {
            console.log(`register routes error`, err) //使用err.message會過於簡化, 另外要開啟顯示err供debug
            evEmitDelay('error', `register routes error: ${getErrorMessage(err)}`) //建構期, 應用端尚未註冊監聽器
        }

    }
    else {
        pmStart = startServer()
            .catch((err) => {
                //埠被占用(EADDRINUSE)等啟動失敗須攔截: 未await之promise被reject即為unhandledRejection, 整個行程會崩潰且應用端無從得知; 改以error事件通知, 由應用端決定處置
                console.log(`start server error`, err)
                evEmitDelay('error', `start server error: ${getErrorMessage(err)}`) //建構期, 應用端尚未註冊監聽器
            })
    }

    //stop, 回傳promise供呼叫端等待真正停止; 其失敗以error事件通知而不外拋
    //why: 原實作為 `server.stop()` —— 既未await亦未catch, hapi之stop一旦reject即為unhandledRejection而使行程崩潰
    //(與建構期之startServer().catch為同一條規則之兩個站點, 而只有前者套了, 見帳本R11);
    //且原實作不回傳promise, 呼叫端無從得知何時真正停止(測試中wo.stop()之後立即結束時伺服器可能仍在關閉)
    //本函數之promise恆resolve(失敗走error事件), 與建構期失敗之處置方式一致, 呼叫端不需再包try
    let stop = async() => {
        try {

            //await pmStart, 須先等啟動完成才停: hapi 於 initializing 階段拒絕 stop, 而其後伺服器仍會起來並持續服務
            if (ispm(pmStart)) {
                await pmStart
            }

            await server.stop()
        }
        catch (err) {
            console.log(`stop server error`, err) //使用err.message會過於簡化, 另外要開啟顯示err供debug
            evEmit('error', `stop server error: ${getErrorMessage(err)}`)
        }
    }

    //save
    ev.stop = stop

    return ev
}


export default WConverhpServer
