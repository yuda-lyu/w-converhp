import axios from 'axios'
import get from 'lodash-es/get.js'
import size from 'lodash-es/size.js'
import isWindow from 'wsemi/src/isWindow.mjs'
import evem from 'wsemi/src/evem.mjs'
import evEmitBase from 'wsemi/src/evEmit.mjs'
import genPm from 'wsemi/src/genPm.mjs'
import getErrorMessage from 'wsemi/src/getErrorMessage.mjs'
import haskey from 'wsemi/src/haskey.mjs'
import isfun from 'wsemi/src/isfun.mjs'
import ispint from 'wsemi/src/ispint.mjs'
import isp0int from 'wsemi/src/isp0int.mjs'
import isestr from 'wsemi/src/isestr.mjs'
import isobj from 'wsemi/src/isobj.mjs'
import iseobj from 'wsemi/src/iseobj.mjs'
import isbol from 'wsemi/src/isbol.mjs'
import ispm from 'wsemi/src/ispm.mjs'
import cint from 'wsemi/src/cint.mjs'
import dig from 'wsemi/src/dig.mjs'
import strright from 'wsemi/src/strright.mjs'
import b642str from 'wsemi/src/b642str.mjs'
import blob2u8arr from 'wsemi/src/blob2u8arr.mjs'
import obj2u8arr from 'wsemi/src/obj2u8arr.mjs'
import u8arr2obj from 'wsemi/src/u8arr2obj.mjs'
import pmConvertResolve from 'wsemi/src/pmConvertResolve.mjs'
import delay from 'wsemi/src/delay.mjs'
import getFileXxHash from 'wsemi/src/getFileXxHash.mjs'
import sanitizeFilename from './sanitizeFilename.mjs'
import isPathInside from './isPathInside.mjs'
import retryDelay from './retryDelay.mjs'


/**
 * 將 upload 之輸入正規化為兩種表示之一: Blob(含 File)或位元組視圖(Uint8Array, Buffer 原樣保留)
 *
 * why: 原本 upload 不正規化, 而大小、切片、雜湊三者對同一輸入各自解讀 —— 大小以 bb.size、bb.length 依序猜, 切片以 bb.slice, 雜湊以 new Blob([inp]);
 * 實測(第十輪 D2): ArrayBuffer 兩個屬性皆無而大小取 1, 雜湊卻以整個 ArrayBuffer 計, 應用端以 success 收到 **1 byte**;
 * DataView 無 slice 而拋 TypeError; Uint16Array 之 length 為元素數而切出之位元組為 2 倍 → Payload Too Large; 非 ASCII 字串以字元數切、以 UTF-8 送 → 同;
 * null 等不支援之輸入則以看不出原因之 TypeError 失敗且 0 則事件。
 *
 * 位元組語意與 fetch / axios 之 BodyInit 一致: ArrayBuffer 與所有 ArrayBufferView 取其位元組, 字串取其 UTF-8 位元組。
 * 判定 Blob 以 instanceof 而非 wsemi 之 isblob: File 之 Object.prototype.toString 為 [object File], isblob 對其回 false(nodejs 實測)。
 * 非 Buffer 之視圖以 new Uint8Array(buffer, byteOffset, byteLength) 表達, 其後切片須用會複製之 slice(使 axios 送出之 data.buffer 恰為該片;
 * axios 對非 Buffer 之視圖送 data.buffer, 以 subarray 切出之視圖會連同底層其餘位元組一併送出)。
 *
 * @param {*} v 輸入 upload 之輸入
 * @returns {Blob|Uint8Array|null} 回傳正規化後之輸入; 不支援者回 null
 */
function normalizeUploadInput(v) {
    try {
        if (typeof Blob !== 'undefined' && v instanceof Blob) {
            return v
        }
        if (typeof Buffer !== 'undefined' && Buffer.isBuffer(v)) {
            return v
        }
        if (v instanceof ArrayBuffer) {
            return new Uint8Array(v)
        }
        if (ArrayBuffer.isView(v)) {
            return new Uint8Array(v.buffer, v.byteOffset, v.byteLength)
        }
        if (typeof v === 'string') {
            return new TextEncoder().encode(v)
        }
    }
    catch (err) {}
    return null
}


//decodeFilenameFromHeader, /dw 之協定解碼: Content-Disposition 之 filename="<base64>" → 還原 → 淨化
//why 與落檔分開(B 卷 §③-3.5): 解碼是協定, 落檔是 I/O; 混在一起使 'unknow' 拼字錯藏了多輪(N12)。取不到者為 unknown(b642str('unknown') 為空字串, 再經 sanitizeFilename 回 unknown, 行為自洽)
//淨化(sanitizeFilename): 檔名來自伺服器不可信, 只取最末路徑段並去除非法字元(含可逸出之 Windows 磁碟機相對路徑 C:x)與保留裝置名 ——
//本值由套件自己拿去 path.resolve 落地, 故就地淨化(帳本 R19: 誰要拿它做危險操作, 誰處理; 只轉交者不得改寫)
function decodeFilenameFromHeader(contentDisposition) {
    let fn = 'unknown'
    try {
        let matches = /filename="(.+?)"/.exec(contentDisposition)
        fn = matches ? matches[1] : 'unknown'
    }
    catch (err) {}
    return sanitizeFilename(b642str(fn)) //headers內對中文支援度不佳須用base64傳, 此處解析提取後須反轉
}

//drainResponse, 離開 downloadStream 前排空對端串流: nodejs 之 responseType:'stream' 時 res.data 為 IncomingMessage, 未消費之回應會使該 socket 於 keep-alive 下直到伺服器 keepAliveTimeout 才釋放,
//且位於重試鏈內時每次嘗試各留一條(第十一輪 N8、B9、A2); 瀏覽器之 Blob 無 resume 即略過; 已被 pipeline 銷毀者 resume 為 no-op
function drainResponse(res) {
    try {
        let d = get(res, 'data')
        if (d && isfun(d.resume)) {
            d.resume()
        }
    }
    catch (err) {}
}

//saveStreamToFile, nodejs 之落檔: 以 pipeline 把回應串流寫入 fdDownload/filename, 回傳落點絕對路徑
//path, fs, stream 使用動態 import 且以變數字串給予, 否則用於前端時會被 webpack 偵測而報錯(**不可改為字面量**; 唯一保護為 e2e-download 之真瀏覽器)
//串流出錯由 pipeline 回報; 其餘同步失敗(路徑判定、mkdir、lstat)直接拋出, 由呼叫端排空對端串流後進重試
async function saveStreamToFile(streamRecv, fdDownload, filename) {
    let cImPath = 'path'
    let cImFs = 'fs'
    let cImStream = 'stream'
    let path = await import(cImPath)
    let fs = await import(cImFs)
    let stream = await import(cImStream)

    //fdDownload, 只有nodejs下載才使用fdDownload
    fs.mkdirSync(fdDownload, { recursive: true }) //須使用mkdirSync, 不要用fsIsFolder與fsCreateFolder避免編譯

    //fdReal, 以realpath正規化基準資料夾, 消除符號連結造成之路徑歧異(OWASP: 先正規化再做邊界判定)
    let fdReal = fs.realpathSync(fdDownload)

    //fp
    let fp = path.resolve(fdReal, filename)

    //check, 落點須仍在fdDownload之內(檔名已淨化, 此為第二道防線), 以path.relative判定, 不用startsWith(base+sep): 後者於base為磁碟根目錄時誤判
    if (!isPathInside(fdReal, fp, path)) {
        throw new Error('invalid filename from server')
    }

    //check, 目標已存在且為符號連結則拒絕: createWriteStream會穿過連結寫到其指向處, 預先植入之連結可使寫入逸出資料夾
    let st = null
    try {
        st = fs.lstatSync(fp)
    }
    catch (err) {}
    if (st !== null && st.isSymbolicLink()) {
        throw new Error('invalid filename from server')
    }

    //streamWriter
    let streamWriter = fs.createWriteStream(fp)

    //pipeline, 不用streamRecv.pipe(streamWriter): .pipe()不會因源串流出錯或中途斷線而關閉目的串流, 伺服器串流中途失敗時finish永不發生,
    //本promise永不settle(axios之timeout只涵蓋到回應標頭, 不涵蓋串流本體)、寫入fd開啟、殘留部分檔; pipeline對源與目的任一方出錯或提前關閉皆銷毀雙方並回報,
    //使失敗能reject而進入send之重試(傳輸不穩須重試, 前提是失敗要被偵測到)
    return new Promise((resolve, reject) => {
        stream.pipeline(streamRecv, streamWriter, (err) => {
            if (err) {

                //不完整檔須刪除, 否則殘留部分內容會被當成已下載之檔案; 刪除失敗不影響reject(重試會以寫入模式覆蓋)
                try {
                    fs.unlinkSync(fp)
                }
                catch (e) {}

                reject(err)
                return
            }
            resolve(fp)
        })
    })
}

//classifyFailure, send 之最終失敗值: 伺服器回傳值(業務錯誤)原樣交出; 本地失敗(axios、fs、解析)取可讀訊息
//why 判準採反向(非 Error 即伺服器回傳值): callApiCore 於伺服器回傳業務錯誤(如 'invalid func'、'permission denied', 或應用端 handler 之 reject 值)時是 reject 伺服器給的值本體而非 axios 錯誤物件;
//本地失敗一律為 Error 實例, 而經序列化自伺服器回來之值結構上不可能是 Error 實例, 故非 Error 者不論形狀(字串、物件、數字、陣列、空字串、null)皆原樣交出; 不可用形狀白名單, 外部應用端之拒絕值列不完
//訊息: 優先取 HTTP 之 statusText(如 Payload Too Large), 無者經 getErrorMessage(帳本 R10)。以 isestr 判定而非 ||: 空 reason-phrase 之 statusText 為空字串, || 會落到 response.data ——
//nodejs 串流下載時那是 IncomingMessage 物件(B 卷 B10); 且不再交出 stack: 原以 get(res,'stack') 兜底, 把整段本機 stack 當成呼叫端可見之錯誤值(A 卷 §①-1.3(e))
//Network Error 除可能是網路斷線之外, 可能被瀏覽器外掛封鎖阻擋, 亦可能因硬碟空間不足無法下載被瀏覽器拒絕
function classifyFailure(res) {
    if (!(res instanceof Error)) {
        return res
    }
    let statusText = get(res, 'response.statusText')
    let data = isestr(statusText) ? statusText : getErrorMessage(res)
    if (!isestr(data)) {
        data = 'Can not connect to server.'
    }
    if (data === 'Network Error') {
        data = `Network Error. Make sure your space of hard drive is large enough or blocking by browser plugins.`
    }
    return data
}


/**
 * 建立Hapi使用者(Node.js與Browser)端物件
 *
 * @class
 * @param {Object} opt 輸入設定參數物件
 * @param {String} [opt.url='http://localhost:8080'] 輸入Hapi伺服器網址，預設為'http://localhost:8080'
 * @param {String} [opt.apiName='api'] 輸入API名稱字串，預設'api'
 * @param {Function} [opt.getToken=()=>''] 輸入取得使用者token的回調函數，預設()=>''。可回傳字串或promise；回undefined或null視為未帶token(送出空token，不送字面之undefined)。**每一次請求嘗試各呼叫一次**(含重試，故一次execute為1+retryMain次)，使重試帶當下之token；瀏覽器下載管理器路徑(downloadByManager=true)於取檔名之請求外，另於導覽至下載網址前再呼叫一次，故為(1+retryDownload)+1次(該次拋錯時download以錯誤拒絕並發一則error事件；此時伺服器已因取檔名之請求觸發過一次download事件而沒有下載發生)；快取與否由應用端自行決定
 * @param {String} [opt.tokenType='Bearer'] 輸入token類型字串，預設'Bearer'
 * @param {Integer} [opt.sizeSlice=1024*1024] 輸入切片上傳檔案之切片檔案大小整數，單位為Byte，預設為1024*1024。須與伺服器之sizeSlice一致，伺服器以其sizeSlice為單一切片請求上限並據以判定切片是否完整，不一致時upload會於check-total-hash階段以sizeSlice mismatch訊息終止。須為安全整數，Infinity與超出安全範圍者視為無效取預設
 * @param {Integer} [opt.timeout=5*60*1000] 輸入最長等待時間整數，單位ms，預設為5*60*1000、為5分鐘。交予axios之timeout：於nodejs為socket閒置逾時（有資料往來即不計時），於瀏覽器為XHR之**整個請求**上限（含本體傳輸時間，故瀏覽器以blob模式下載或execute傳輸大檔時須依檔案大小與頻寬調大或給0）；0為不逾時；須為安全整數，Infinity與超出安全範圍者視為無效取預設；另受計時器上限2147483647約束，超過者亦取預設。不可用Infinity或超大數字表示不逾時(axios會於請求送出前即拋錯，超大數字則因計時器溢位而立即逾時)，不逾時請給0
 * @param {Integer} [opt.retryMain=3] 輸入主要控制器傳輸失敗重試次數整數，預設為3。凡失敗皆重試（含伺服器不穩、傳輸不穩、狀態不穩如permission denied與應用端reject），僅可證明不需重試之錯誤除外：伺服器標示retryable為false之參數檢核類錯誤，與HTTP 413。須為安全整數，Infinity與超出安全範圍者視為無效取預設；上限為20，超過者截為20（退避延遲為指數成長，次數無上限會使單次等待成長至數小時乃至溢位計時器）
 * @param {Integer} [opt.retryUpload=10] 輸入切片上傳檔案傳輸失敗重試次數整數，預設為10。重試範圍同retryMain，為每一次請求(含合併輪詢中之每一條查詢)之重試次數，非整個upload之總上限；合併完成後應用端upload事件拒絕時，依重試原則持續輪詢直到應用端接受為止。須為安全整數，Infinity與超出安全範圍者視為無效取預設；上限為20，超過者截為20
 * @param {Integer} [opt.retryDownload=2] 輸入下載檔案傳輸失敗重試次數整數，預設為2。重試範圍同retryMain；瀏覽器以下載管理器下載(downloadByManager=true)時僅涵蓋取檔名之請求，實際下載交由瀏覽器不在此重試範圍。須為安全整數，Infinity與超出安全範圍者視為無效取預設；上限為20，超過者截為20
 * @returns {Object} 回傳事件物件，可使用函數execute、upload、download，可監聽事件error。**監聽器須為同步函數，不可為async函數、亦不可回傳promise**：事件派發依EventEmitter規範丟棄監聽器之回傳值，其rejection無人觀察，於nodejs即unhandledRejection而使行程崩潰。upload之input可為Blob、File、ArrayBuffer、ArrayBufferView(以位元組計)或字串(以UTF-8位元組計)，其餘以錯誤拒絕並發error事件。**error事件之契約：每一次請求嘗試失敗恰發一則**(execute、upload、download皆同；不分傳輸層失敗如連不上、逾時、HTTP 413或5xx，與伺服器回之業務錯誤如permission denied、應用端拒絕、合併失敗)，故一次呼叫最多發1+重試次數則；入口即拒絕者(輸入不支援、無法序列化、未給fdDownload)一則。upload之合併輪詢依設計持續至應用端接受為止，長時間斷線時每一輪查詢皆各自重試並各發事件，事件數因此無上界(與「重試導致等待久」同為刻意)，不需要者可不註冊error監聽器
 * @example
 *
 * import path from 'path'
 * import fs from 'fs'
 * import _ from 'lodash-es'
 * import w from 'wsemi'
 * import WConverhpClient from './src/WConverhpClient.mjs'
 *
 * let ms = []
 *
 * let opt = {
 *     url: 'http://localhost:8080',
 *     apiName: 'api',
 *     getToken: () => {
 *         return 'token-for-test'
 *     },
 * }
 *
 * //new
 * let wo = new WConverhpClient(opt)
 *
 * wo.on('error', (err) => {
 *     console.log(`error`, err)
 * })
 *
 * function downloadLargeFile() {
 *     let core = async() => {
 *
 *         await wo.download('id-for-file',
 *             function ({ prog, p, m }) {
 *                 // console.log('client web: download: prog', prog, p, m)
 *                 if (m === 'download') {
 *                     console.log('client web: download: prog', prog)
 *                 }
 *             },
 *             {
 *                 fdDownload: './', //於nodejs環境才能提供
 *             })
 *             .then(function(res) {
 *                 console.log('client web: download: then', res)
 *                 ms.push({ 'download output': res })
 *             })
 *             .catch(function (err) {
 *                 console.log('client web: download: catch', err)
 *             })
 *
 *         console.log('ms', ms)
 *
 *     }
 *     core()
 * }
 *
 * downloadLargeFile()
 *
 */
function WConverhpClient(opt) {

    //_url
    let _url = get(opt, 'url')
    if (!isestr(_url)) {
        _url = 'http://localhost:8080'
    }

    //apiName
    let apiName = get(opt, 'apiName')
    if (!isestr(apiName)) {
        apiName = 'api'
    }

    //url
    let url = ''
    if (strright(_url, 1) === '/') {
        url = _url + apiName
    }
    else {
        url = _url + '/' + apiName
    }

    //getToken
    let getToken = get(opt, 'getToken', null)
    if (!isfun(getToken)) {
        getToken = () => {
            return ''
        }
    }

    //tokenType
    let tokenType = get(opt, 'tokenType')
    if (!isestr(tokenType)) {
        tokenType = 'Bearer'
    }

    //maxTimer, node計時器以32位元帶號整數表達, 超過即溢位: axios之timeout給2**31實測不是等24.9日而是20ms即以「timeout of 2147483648ms exceeded」拒絕;
    //故凡進入計時器之毫秒值皆須以此為上限, 超過者視為無效而取預設(與Infinity同處置), 不採截斷: 要表達「不逾時」另有正式語意(timeout為0), 給超大數字屬誤用
    let maxTimer = 2147483647 //2**31-1

    //maxRetryTimes, 重試次數上限
    //why: 退避延遲為指數成長且以「第nToPeak次達到maxDelay」校準(見callApi), 次數若無上限則延遲隨之無界 ——
    //實測第20次單次等待16小時, 第27次起更超過32位元計時器上限而溢位成1ms, 退避反而塌陷為熱迴圈打伺服器.
    //本上限與callApi之延遲封頂成對: 上限擋住次數, 封頂擋住單次等待, 兩者缺一皆會使另一者失效
    let maxRetryTimes = 20

    //optSafe, 數值選項一律以wsemi之安全整數模式檢核: 其預設(寬鬆)對Infinity與超出安全整數者皆回true,
    //而Infinity會使切片數算成0(sizeSlice)、axios於送出前即拋錯(timeout)、重試次數終止條件永不成立(retry); 超出安全整數者則使伺服器端建構同步拋錯
    let optSafe = { useLimitSafe: true }

    //sizeSlice, 檢核與正規化須成對: ispint亦接受數字字串('1048576'), 而sizeSlice會與伺服器回傳者以!==比較(見sendDataSlice),
    //未正規化時字串與數值即判為mismatch而使上傳整個失敗, 縱使兩端組態實為相同值
    let sizeSlice = get(opt, 'sizeSlice')
    if (!ispint(sizeSlice, optSafe)) {
        sizeSlice = 1024 * 1024 //1m
    }
    sizeSlice = cint(sizeSlice)

    //timeout, 0為不逾時(axios語意); 交予計時器故另受maxTimer約束
    let timeout = get(opt, 'timeout')
    if (!isp0int(timeout, optSafe) || cint(timeout) > maxTimer) {
        timeout = 5 * 60 * 1000 //5min
    }
    timeout = cint(timeout)

    //retryMain
    let retryMain = get(opt, 'retryMain')
    if (!isp0int(retryMain, optSafe)) {
        retryMain = 3
    }
    retryMain = Math.min(cint(retryMain), maxRetryTimes) //超過上限者截為上限而非取預設: 取預設會減少重試次數, 而呼叫端給大值之意圖正是要多重試

    //retryUpload
    let retryUpload = get(opt, 'retryUpload')
    if (!isp0int(retryUpload, optSafe)) {
        retryUpload = 10
    }
    retryUpload = Math.min(cint(retryUpload), maxRetryTimes) //超過上限者截為上限而非取預設: 取預設會減少重試次數, 而呼叫端給大值之意圖正是要多重試

    //retryDownload
    let retryDownload = get(opt, 'retryDownload')
    if (!isp0int(retryDownload, optSafe)) {
        retryDownload = 2
    }
    retryDownload = Math.min(cint(retryDownload), maxRetryTimes) //超過上限者截為上限而非取預設: 取預設會減少重試次數, 而呼叫端給大值之意圖正是要多重試

    //env
    let env = isWindow() ? 'browser' : 'nodejs'
    // console.log('env', env)

    //ev, 原生eventemitter3(wsemi 1.8.91起evem不再包裝監聽器, 其語意完全遵循EventEmitter規範)
    let ev = evem()

    //evEmit, 於呼叫端之堆疊上派發, 交由wsemi之evEmit(其為「直接ev.emit並以try攔截」之單一擁有者)
    //why 不以setTimeout脫勾: setTimeout會開一個沒有呼叫者之堆疊, 監聽器之同步拋錯於該處即為uncaughtException,
    //於nodejs殺整個行程(瀏覽器則為console錯誤), 且呼叫端無論如何try都攔不到
    //why 不處理async監聽器: emit依EventEmitter規範丟棄監聽器之回傳值, 其rejection無人觀察; 見建構函數之JSDoc
    //client之事件僅error且不帶pm, 故無funSettle; 其error監聽器出錯者由wsemi之通報路徑走console.error留痕, 不再重發避免遞迴
    let evEmit = (name, ...args) => {
        return evEmitBase(ev, name, args, {
            tag: 'w-converhp-client',
        })
    }

    //symNoRetry, 標記「可證明不需重試」之錯誤: 伺服器於error封包標示retryable為false(參數檢核類, 結果僅由請求內容決定), 或HTTP 413(本體超過伺服器上限, 上限為伺服器建構參數, 重送同一本體必同一結果且每次重送整包)
    //以Symbol為鍵避免與伺服器回傳之任意值撞名; 僅於send內部流轉, 交予呼叫端前解包, 呼叫端仍收到原始error值; 其餘(permission denied、應用端reject、斷線等)皆屬狀態不穩, 依重試原則照常重試
    let symNoRetry = Symbol('noRetry')
    let isNoRetry = (msg) => {
        return (isobj(msg) && msg[symNoRetry] === true) || get(msg, 'response.status') === 413
    }
    let unwrapNoRetry = (msg) => {
        return (isobj(msg) && msg[symNoRetry] === true) ? msg.msg : msg
    }

    //fetchToken, 取當下 token 之唯一擁有者: 應用端之 getToken 可回值或 promise; undefined / null 視為未帶 token
    //why 單一擁有者: 第十輪 F11 於 callApiCore 內補了「每次嘗試重取 + undefined 不送字面」, 而瀏覽器下載管理器路徑(downloadBrowser)另有一份手寫之取 token 且未套 ——
    //getToken 回 undefined 時 URL 帶 token=undefined, 伺服器 isestr('undefined') 為真而以 Bearer undefined 交 verifyConn(同一規則兩站點只套一處)
    //拋錯或 reject 原樣向外拋, 由呼叫處決定其為該次嘗試之失敗(callApiCore, 進重試)或入口失敗(downloadBrowser, 一則事件 + 拒絕)
    let fetchToken = async() => {
        let token = getToken()
        if (ispm(token)) {
            token = await token
        }
        if (token === undefined || token === null) {
            token = ''
        }
        return token
    }

    //wrapNoRetry, 伺服器標示 retryable 為 false 之錯誤以 symNoRetry 包裝, 交由 callApi 中止重試並解包; 不發事件(事件由 attemptFailed 唯一擁有)
    //why 原本之 serverError 兼做「發事件」: 它只涵蓋業務錯誤(封包 / 標頭 / 合併查詢), 傳輸失敗 0 則 —— 同一個「這次嘗試失敗了」兩種處置(第十一輪 N3)
    let wrapNoRetry = (msg, retryable) => {
        if (retryable === false) {
            return { [symNoRetry]: true, msg }
        }
        return msg
    }

    //attemptFailed, 「一次嘗試失敗」之 error 事件唯一擁有者(帳本 R5 client 側): 不分傳輸(連不上、逾時、413、5xx)、業務(伺服器錯誤封包 / Return-Type:error / 合併查詢之 state:error)、
    //封包解析、getToken 拋錯, 每次嘗試恰一則。呼叫點只有兩個: callApi 之重試迴圈(每次 fun(s) 回 error)與 checkMerging(其 HTTP 請求成功而本體 state 為 error, 不經迴圈; 第十輪 F6 之站點)
    //why: 原本只有業務錯誤經 serverError 發事件, 傳輸失敗 0 則(實測第十一輪 N3: 連不上、413 皆 0 則), 應用端完全觀察不到斷線; send 之 catch 只在不可達之分支發事件且值為物件。
    //對標: socket.io-client 之 connect_error 不論傳輸方式、每次嘗試皆發出
    //事件值經 classifyFailure, 與最終拒絕值同一算法: 非 Error 者(伺服器回傳值)原樣; Error 者取可讀訊息(HTTP statusText 優先, 如 413 為 Payload Too Large; 帳本 R10)
    //合併輪詢無限(JSDoc 明載持續輪詢直到應用端接受), 故長時間斷線之 upload() 會持續產生事件(每輪最多 1+retryUpload 則, 速率受退避約束); 為「重試導致等待久」同族之刻意, 已於 JSDoc 明載(B 卷 B1)
    let attemptFailed = (msg) => {
        evEmit('error', classifyFailure(unwrapNoRetry(msg)))
    }

    //getUrlUse
    let getUrlUse = (type) => {

        //urlUse
        let urlUse = ''
        if (type === 'basic') {
            urlUse = `${url}/main`
        }
        else if (type === 'upload-controller') {
            urlUse = `${url}/ulctr`
        }
        else if (type === 'slice') {
            urlUse = `${url}/slc`
        }
        else if (type === 'download-get-filename') {
            urlUse = `${url}/dwgfn`
        }
        else if (type === 'download-get') {
            urlUse = `${url}/dwgf`
        }
        else if (type === 'download') {
            urlUse = `${url}/dw`
        }
        else {
            throw new Error(`invalid type[${type}]`)
        }

        return urlUse
    }

    //res2u8arr
    let res2u8arr = async(bb) => {
        //blob(in browser) or buffer(in nodejs) to u8a
        let u8a
        if (env === 'browser') {
            u8a = await blob2u8arr(bb)
        }
        else {
            u8a = new Uint8Array(bb)
        }
        return u8a
    }

    //u8arr2bb
    let u8arr2bb = (u8a) => {
        //u8a to blob(in browser) or buffer(in nodejs)
        let bb
        if (env === 'browser') {
            bb = new Blob([u8a.buffer])
        }
        else { //nodejs
            bb = Buffer.from(u8a)
        }
        return bb
    }

    //send
    let send = async(type, pkg, opt = {}) => {

        //headers
        let headers = get(opt, 'headers')
        if (!isobj(headers)) {
            headers = {}
        }
        // console.log('headers', headers)

        //dataType
        let dataType = get(opt, 'dataType', '')
        if (dataType !== 'blob' && dataType !== 'json') {
            dataType = 'blob'
        }
        // console.log('dataType', dataType)

        //cbProgress
        let cbProgress = get(opt, 'cbProgress')
        if (!isfun(cbProgress)) {
            cbProgress = () => {}
        }

        //cbProgressSafe, 交予axios之onUploadProgress/onDownloadProgress專用
        //why: 該兩個回呼由axios於其自己的堆疊上呼叫(axios/lib/helpers/progressEventReducer.js), 不在本函數之try涵蓋範圍內,
        //其同步拋錯直接成為uncaughtException而**殺掉整個node行程**(實測tmp/probe_r9_verify.mjs第3節);
        //而server側對應用端監聽器之拋錯早已由evEmit攔截並承諾「不會使伺服器行程崩潰」—— 同型能力只保護了一邊
        //sendDataSlice內之直接呼叫(cbProgressSlice/cbProgressMerge)不套用: 其落在呼叫鏈之promise內, 拋錯使該次promise reject而非殺行程
        //只報首次: 進度回呼於單次請求內會觸發數十至數百次, 逐次通報會把error通道灌爆; 「本次請求之進度回呼壞了」為一個事實, 故一則
        let bCbProgressErr = false
        let cbProgressSafe = (msg) => {
            try {
                cbProgress(msg)
            }
            catch (err) {
                if (!bCbProgressErr) {
                    bCbProgressErr = true
                    evEmit('error', `cbProgress error: ${getErrorMessage(err)}`)
                }
            }
        }

        //retry
        let retry = get(opt, 'retry')
        if (!isp0int(retry)) {
            retry = 1
        }

        //urlUse
        let urlUse = getUrlUse(type)

        //pm
        let pm = genPm()

        //dd, ct
        let dd = null
        let ct = {}
        if (dataType === 'blob') {

            //set ct
            ct = {
                'Content-Type': 'application/octet-stream',
            }

            //set dd
            dd = pkg

        }
        else if (dataType === 'json') {
            //axios預設會將物件自動轉換為JSON, 此處指定Content-Type且強制轉, 避免可能問題

            //set ct
            ct = {
                'Content-Type': 'application/json',
            }

            //JSON.stringify 須在 try 內: 呼叫端之 fileId 等含 BigInt 或循環參照時會拋, 原本於 try 外而以原生 TypeError 拒絕且 0 則事件,
            //同形狀之 execute 則為明確訊息 + 1 則(實測第十輪 A10); 屬 client 自身參數決定之失敗, 不進重試
            try {
                dd = JSON.stringify(pkg)
            }
            catch (err) {
                let msg = `input can not be serialized: ${getErrorMessage(err)}`
                evEmit('error', msg)
                return Promise.reject(msg)
            }
        }
        // console.log('dd', dd)

        //rt
        let rt = null
        if (env === 'nodejs') {
            if (type === 'download') {
                rt = 'stream' //nodejs download模式採用stream接收
            }
            else {
                rt = 'arraybuffer' //nodejs下沒有blob, 只能設定'json', 'arraybuffer', 'document', 'json', 'text', 'stream'
            }
        }
        else {
            if (type === 'download') {
                rt = 'blob' //瀏覽器使用blob下載
            }
            else {
                rt = 'blob' //瀏覽器使用blob取得資料
            }
        }
        // console.log('rt', rt)

        //downloadStream, 下載回應之處置: 以標頭協定(Return-Type / Return-Msg / Return-Retryable)判成敗, 成功者瀏覽器交出 Blob、nodejs 經 saveStreamToFile 落檔
        //離開前一律排空對端串流(drainResponse): 錯誤封包早返、落檔前置失敗(路徑逸出、symlink、mkdir)原本皆未排空(第十一輪 N8、B9、A2)
        let downloadStream = async(res) => {

            //returnType, returnMsg
            let returnType = get(res, `headers['return-type']`, '')
            let returnMsg = get(res, `headers['return-msg']`, '')

            //check, 伺服器於標頭標示Return-Retryable為false者為可證明不需重試之錯誤(下載路徑只讀標頭不解析本體; 瀏覽器跨域時若該標頭未被曝露則讀不到, 退回照常重試)
            if (returnType === 'error') {
                drainResponse(res)
                let returnRetryable = get(res, `headers['return-retryable']`, '')
                return Promise.reject(wrapNoRetry(returnMsg, returnRetryable !== 'false')) //事件由 callApi 之 attemptFailed 發
            }

            //filename, 自 Content-Disposition 解碼並淨化(見 decodeFilenameFromHeader)
            let filename = decodeFilenameFromHeader(get(res, `headers['content-disposition']`, ''))

            //streamRecv
            let streamRecv = get(res, 'data')

            //browser通過axios使用blob接收時會自動把串流接收並組合成blob, 此時streamRecv已是blob
            if (env === 'browser') {
                return { filename, bb: streamRecv }
            }

            //nodejs, 落檔(見 saveStreamToFile); 任何失敗皆先排空對端串流再向外拋(進入 send 之重試: 傳輸不穩須重試, 前提是失敗要被偵測到)
            try {
                return await saveStreamToFile(streamRecv, get(opt, 'fdDownload', ''), filename)
            }
            catch (err) {
                drainResponse(res)
                throw err
            }
        }

        //s
        let s = {
            method: 'POST',
            url: urlUse,
            data: dd,
            headers: {}, //於每次嘗試由 callApiCore 組裝(含每次重取之 token)
            timeout,
            maxContentLength: Infinity, //1024 * 1024 * 1024, Infinity //axios於nodejs中會限制內容大小故需改為無限
            maxBodyLength: Infinity, //1024 * 1024 * 1024, Infinity //axios於nodejs中會限制內容大小故需改為無限
            // decompress: true, //axios於nodejs中預設為true
            responseType: rt,
            onUploadProgress: function(ev) {
                //console.log('onUploadProgress', ev)

                //r
                let r = 0
                let loaded = ev.loaded
                let total = ev.total
                if (ispint(total)) {
                    r = (loaded * 100) / total
                }

                //cbProgress, 須經cbProgressSafe: 本回呼由axios於其自己之堆疊上呼叫, 拋錯即uncaughtException(見上方說明)
                cbProgressSafe({ prog: Math.floor(r), p: loaded, m: 'upload' })

            },
            onDownloadProgress: function (ev) {
                // console.log('onDownloadProgress', ev)

                //r
                let r = 0
                let loaded = ev.loaded
                // let total = ev.srcElement.getResponseHeader('Content-length') //若需要得知下載進度, 需於伺服器回傳時提供Content-length
                let total = ev.total
                if (ispint(total)) {
                    r = (loaded * 100) / total
                }

                //cbProgress, 須經cbProgressSafe: 本回呼由axios於其自己之堆疊上呼叫, 拋錯即uncaughtException(見上方說明)
                cbProgressSafe({ prog: Math.floor(r), p: loaded, m: 'download' })

            },
        }
        // console.log('s', s)

        //callApiCore, 處理axios成功then時訊息, catch時直接向外傳遞
        let callApiCore = async() => {

            //token, 每次嘗試重取(見 fetchToken), 拋錯或 reject 即為本次嘗試之失敗而進入重試
            //why: 原本於重試迴圈外只取一次 —— 重試沿用同一個 token, 「token 已過期、應用端之 getToken 已換發新 token」一類之 permission denied 其重試永遠無效;
            //而權限屬非同步系統、permission denied 須重試(專案重試原則), 重試要有意義就得帶上當下之 token。業界作法同: token 更新後以新 token 重送(axios-auth-refresh)
            //另 getToken 拋錯原本不重試, 與「凡請求失敗一律重試」不一致; getToken 之呼叫次數因此為 1+重試次數, 快取由應用端決定
            let token = await fetchToken()
            s.headers = {
                Authorization: `${tokenType} ${token}`,
                ...ct,
                ...headers,
            }

            //axios, catch時直接向外傳遞
            let res = await axios(s)

            //check, download時直接轉由downloadStream處理res, catch時直接向外傳遞
            if (type === 'download') {
                return await downloadStream(res)
            }

            //bb
            let bb = get(res, 'data')
            // console.log('bb', bb)

            //res2u8arr, catch時直接向外傳遞
            let u8a = await res2u8arr(bb)
            // console.log('u8a', u8a)

            //u8arr2obj, 以嚴格模式取狀態: 封包損毀(截斷、被中間層改寫)與「伺服器真的回了空物件」在寬鬆模式下都是{}, 分不出來也講不清楚
            let rd = u8arr2obj(u8a, { returnWithStateAndMsg: true })
            if (get(rd, 'state') !== 'success') {
                return Promise.reject(`invalid packet from server: ${get(rd, 'msg', 'unknown error')}`) //屬傳輸不穩, 依重試原則不標示不重試; 事件由 callApi 之 attemptFailed 發
            }
            let data = rd.msg
            // console.log('data', data)

            //check
            if (!iseobj(data)) {
                return Promise.reject(`data is not an effective object`)
            }

            //分離伺服器資料的success或error
            if (haskey(data, 'success')) {
                return Promise.resolve(data.success)
            }
            else if (haskey(data, 'error')) {
                return Promise.reject(wrapNoRetry(data.error, data.retryable)) //伺服器標示retryable為false者為可證明不需重試之錯誤(見wrapNoRetry); 事件由 attemptFailed 發
            }
            else {
                return Promise.reject(`data does not contain success or error`)
            }

        }

        //callApi, 處理callApiCore失敗catch時retry
        let callApi = async() => {

            //pmConvertResolve
            let fun = pmConvertResolve(callApiCore)

            //fun
            let r = await fun(s)
            // console.log('r', r)

            //while, 退避曲線見src/retryBackoff.mjs(其自有封頂, 使延遲不隨retry次數無界成長)
            let n = 0
            while (r.state === 'error') {

                //attemptFailed, 每次嘗試失敗恰一則事件(唯一擁有者, 見其說明)
                attemptFailed(r.msg)

                //check, 可證明不需重試者直接中止, 減少無效重試(413每次都重送整包本體)
                if (isNoRetry(r.msg)) {
                    break
                }

                //add
                n += 1

                //check
                if (n > retry) {
                    break
                }

                //delay
                let t = retryDelay(n)
                console.log(`wait ${dig(t / 1000, 1)}(second) to retry...`)
                await delay(t)

                //retry
                console.log(`retry n=${n}...`)
                r = await fun(s)
                // console.log(`retry n=${n} done`)

            }

            if (r.state === 'success') {
                return r.msg
            }
            else {
                return Promise.reject(unwrapNoRetry(r.msg)) //解包後呼叫端收到原始error值
            }
        }

        //callApi, 最終失敗值經 classifyFailure(伺服器回傳值原樣, 本地失敗取可讀訊息); 事件已於重試迴圈內逐次發出(attemptFailed), 此處不再發
        await callApi()
            .then((res) => {
                pm.resolve(res)
            })
            .catch((res) => {
                pm.reject(classifyFailure(res))
            })

        return pm
    }

    //sendPkg
    let sendPkg = async(type, data, cbProgress) => {
        //主要為中心化控制器使用, 通過execute進行上下傳數據

        //bb
        let bb = null
        try {

            //obj2u8arr, 以嚴格模式取狀態: 呼叫端給之input若含BigInt或循環參照, 寬鬆模式回空封包而伺服器會收到空物件並照常觸發execute事件,
            //呼叫端只會拿到不知所云之結果; 於此提早以明確訊息拒絕, 不送出
            let re = obj2u8arr(data, { returnWithStateAndMsg: true })
            if (get(re, 'state') !== 'success') {
                let msg = `input can not be serialized: ${get(re, 'msg', 'unknown error')}`
                evEmit('error', msg)
                return Promise.reject(msg)
            }
            let u8a = re.msg
            // console.log('u8a', u8a)

            //u8a to blob(in browser) or buffer(in nodejs)
            bb = u8arr2bb(u8a)
            // console.log('bb', bb)

        }
        catch (err) {
            return Promise.reject(err)
        }

        //send
        let res = await send(type, bb, { dataType: 'blob', retry: retryMain, cbProgress })

        return res
    }

    //calcHash
    let calcHash = async(inp) => {

        //bb, 一律包成 Blob 供 getFileXxHash 使用: 原本瀏覽器端直接交出 inp, 非 Blob 之位元組視圖即被 getFileXxHash 拒絕; Blob 包 Blob 不複製內容
        let bb = new Blob([inp])

        //hash
        let hash = await getFileXxHash(bb)

        return hash
    }

    //sendDataSlice
    let sendDataSlice = async(fileTotalName, bb, cbProgress) => {

        //cbProgress, 與send內同一道防呆: 本函數直接呼叫cbProgress(不經send), 故須自行給預設
        //why: send已對其opt.cbProgress補預設, 故execute與download省略cbProgress皆正常, 唯獨upload會於首片上傳完成時拋
        //「cbProgress is not a function」—— 三個公開方法對同一個選用參數行為不一致
        if (!isfun(cbProgress)) {
            cbProgress = () => {}
        }

        //cbProgress之保護: 進度回呼為**通知通道**, 其失敗不得決定上傳之成敗
        //why: 同一個cbProgress原有三種下場 —— 切片進度拋錯使該次promise reject(上傳失敗)、
        //bAllHash路徑拋錯亦使上傳失敗、而合併完成通知拋錯時例外沿.then傳到checkMerging之.catch(() => {})被吞掉,
        //pm遂**永不settle**, upload()永久懸置且0則事件、0行console(實測: 前者142ms reject, 後者12000ms未settle)
        //收斂為一種下場: 一律不影響結果, 只留一則error事件(與send內之cbProgressSafe同一規則, 見帳本R13)
        //只報首次: 切片進度於單次上傳內會觸發chunkTotal次, 逐次通報會把error通道灌爆
        let bCbProgErr = false
        let cbProgressRaw = cbProgress
        cbProgress = (msg) => {
            try {
                cbProgressRaw(msg)
            }
            catch (err) {
                if (!bCbProgErr) {
                    bCbProgErr = true
                    evEmit('error', `cbProgress error: ${getErrorMessage(err)}`)
                }
            }
        }

        //n, 輸入已由 upload 入口正規化為 Blob(含 File)或位元組視圖(見 normalizeUploadInput), 故大小只有兩種取法
        //why: 原本以 bb.size、bb.length 依序猜 —— ArrayBuffer 兩者皆無而取 1(雜湊卻以整個 ArrayBuffer 計, 應用端以 success 收到 1 byte),
        //多位元組型陣列之 length 為元素數而切出之位元組為其倍數(實測第十輪 D2)
        //nodejs用fs讀有檔案大小上限, 除非改傳入檔名用stream讀, 否則無法支援超大檔
        let n = cint(bb.byteLength !== undefined ? bb.byteLength : bb.size)
        // console.log('n', n)

        //fileTotalSize, 如實(空輸入即 0)
        //why: 原以 n = 1 假報大小以使切片數不為 0 —— 而伺服器去重以 fileSize === stats.size 比對, 1 !== 0 使空檔永不去重、每次皆重走切片與合併(第十一輪 N5);
        //切片數之下限另以 chunkTotal 表達
        let fileTotalSize = n

        //chunkTotal, 空輸入亦須送一片(0 byte)使伺服器有物可合併
        let chunkTotal = Math.max(1, Math.ceil(fileTotalSize / sizeSlice))
        // console.log('chunkTotal', chunkTotal)

        //progCount, progWeightSlice
        let progCount = 0
        let progWeightSlice = 0.99 //上傳階段進度使用99%
        // let progWeightMerge = 0.01 //合併階段進度使用1%

        //cbProgressSlice, 以累積機制計算進度, 累積片數配合總切片數量即可算出進度, 故不須輸入msg
        let cbProgressSlice = () => {
            progCount++
            let r = progCount / chunkTotal
            let prog = r * progWeightSlice * 100
            let psiz = r * fileTotalSize
            cbProgress({ prog, p: psiz, m: 'upload' })
        }

        //cbProgressMerge
        let cbProgressMerge = (msg) => {
            let perc = msg.prog
            let dir = msg.m
            if (dir === 'download' && perc === 100) {
                cbProgress({ prog: 100, p: fileTotalSize, m: 'upload' })
            }
        }

        //fileTotalHash
        // console.log(`calc hash for fileTotalSize[${fileTotalSize}]...`)
        let fileTotalHash = await calcHash(bb)
        // console.log(`calc hash for fileTotalSize[${fileTotalSize}] done`, fileTotalHash)

        //send check-total-hash
        // console.log(`send check-total-hash...`)
        let resUpCkt = await send('upload-controller', { mode: 'check-total-hash', fileHash: fileTotalHash, filename: fileTotalName, fileSize: fileTotalSize }, { dataType: 'json', retry: retryUpload })
        // console.log('resUpCkt', resUpCkt)
        //bAllHash: false:
        //  resUpCkt {
        //    path: 'uploadTemp\\2429b7ef08ce6ba9',
        //    bAllExist: false,
        //    bAllSize: false,
        //    bAllHash: false,
        //    bSls: true,
        //    slks: [
        //       0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11,
        //    ]
        //  }
        //bAllHash: true:
        //  resUpCkt {
        //    path: 'uploadTemp\\2429b7ef08ce6ba9',
        //    bAllExist: false,
        //    bAllSize: false,
        //    bAllHash: false,
        //    bSls: true,
        //    slks: [
        //       0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11,
        //    ],
        //    msg: {procUpload處理後的ro}
        //  }

        //check
        if (resUpCkt.bAllHash) {
            // console.log('已有上傳大檔')

            //cbProgressMerge
            cbProgressMerge({ prog: 100, m: 'download' }) //觸發上傳完畢後之下載回應, 故m須為download

            //resMg, 須回傳msg(也就是procUpload處理後的ro)
            let resMg = resUpCkt.msg

            return resMg
        }

        //check, 前後端sizeSlice須一致: 伺服器/slc以其sizeSlice為單次請求上限(超過即413), 且以切片檔大小是否等於sizeSlice判定切片完整(不等則永遠無法續傳),
        //故於此提早以明確訊息終止, 否則前端只會收到Payload Too Large而無從得知是組態不符; 舊版伺服器不回傳sizeSlice, 略過檢查以維持相容
        if (ispint(resUpCkt.sizeSlice) && resUpCkt.sizeSlice !== sizeSlice) {
            let msg = `sizeSlice mismatch: client[${sizeSlice}] and server[${resUpCkt.sizeSlice}] must be equal`
            evEmit('error', msg)
            return Promise.reject(msg)
        }

        //針對伺服器上已有切片檔案計算hash與比對
        if (resUpCkt.bSls) {
            // console.log('receive slks...', resUpCkt.slks[0], size(resUpCkt.slks))

            //fileSliceHashs
            let fileSliceHashs = []
            // let n = Math.max(resUpCkt.slks.length, 1)
            // let nr = Math.floor(n / 100)
            for (let k = 0; k < size(resUpCkt.slks); k++) {
                // if (k % nr === 0) {
                //     console.log(`calc hash for slices`, round(k / resUpCkt.slks.length * 100, 1), '%')
                // }

                //i
                let i = resUpCkt.slks[k]

                //start
                let start = i * sizeSlice

                //end
                let end = Math.min(start + sizeSlice, fileTotalSize)

                //chunk
                let chunk = bb.slice(start, end)

                //fileSliceHash
                let fileSliceHash = await calcHash(chunk)
                // console.log('fileSliceHash', fileSliceHash)

                //push
                fileSliceHashs.push({
                    i,
                    h: fileSliceHash,
                })

            }
            // console.log('fileSliceHashs', fileSliceHashs)

            //send check-slices-hash
            // console.log(`send check-slices-hash...`)
            let resUpCks = await send('upload-controller', { mode: 'check-slices-hash', fileHash: fileTotalHash, fileSliceHashs }, { dataType: 'json', retry: retryUpload })
            // console.log('resUpCks', resUpCks)
            // resUpCks {
            //   slks: [
            //      0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11,
            //     12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
            //     24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35,
            //     36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47,
            //     48, 49, 50, 51, 52, 53
            //   ]
            // }

            //update, 伺服器針對各切片計算hash與比對, 回傳resUpCks.slks代表hash一致的切片編號, 非一致hash的切片則須重傳, 尚未傳切片亦須繼續傳
            resUpCkt.slks = resUpCks.slks

        }

        //packageId
        let packageId = fileTotalHash
        // console.log('packageId', packageId)

        //upload slice
        // console.log(`upload slice...`)
        for (let i = 0; i < chunkTotal; i++) {

            //check
            if (resUpCkt.slks.indexOf(i) >= 0) {
                // console.log('已有上傳切片檔')
                cbProgressSlice() //直接觸發更新進度
                continue
            }

            //start
            let start = i * sizeSlice

            //end
            let end = Math.min(start + sizeSlice, fileTotalSize)

            //chunk
            let chunk = bb.slice(start, end)

            //hd
            let hd = { //用header傳key與value時, key不分大小寫, 故使用kebabCase
                'chunk-index': i,
                'chunk-total': chunkTotal,
                'package-id': packageId,
            }

            //send slice
            await send('slice', chunk, {
                headers: hd,
                dataType: 'blob',
                cbProgress: (msg) => {
                    // console.log('cbProgress', msg)
                    // let perc = msg.prog
                    // let dir = msg.m
                    // if (dir === 'upload' && perc === 100) {
                    // }
                },
                retry: retryUpload,
            })
            // console.log('resSl', resSl)

            //cbProgressSlice, 因其內有累加progCount, 實際代表是須成功傳輸後才能計算與回應外部進度, 故不能直接用於send的opt.cbProgress
            cbProgressSlice()

        }

        //send merge-slices-push
        // console.log(`send merge-slices-push...`)
        let resUpMgp = await send('upload-controller', { mode: 'merge-slices-push', fileHash: fileTotalHash, chunkTotal }, { dataType: 'json', retry: retryUpload })
        // console.log('resUpMgp', resUpMgp)

        //checkMerging
        let checkMerging = () => {
            let pm = genPm()

            //queueId
            let queueId = resUpMgp.queueId
            // console.log('queueId', queueId)

            //bBusy, 同一時間只允許一條查詢(含其重試鏈)在途
            //why: setInterval每2秒固定觸發, 前一次send若仍在retryUpload之退避重試中(伺服器回錯誤封包或斷線皆會進入重試)即再發一條, 多條重試鏈會疊加同時打伺服器,
            //每條鏈的每次重試都使伺服器重新觸發應用端upload事件(實測預設設定下12秒內觸發16次且遞增), 屬重試資源之多重濫用;
            //序列化後重試本身不變(每條send仍依retryUpload重試), 斷線續輪詢之設計亦不變, 只是前一條未結束前不再開新的一條
            let bBusy = false

            let t = setInterval(() => {

                //check
                if (bBusy) {
                    return
                }
                bBusy = true

                //send merge-slices-get
                // console.log(`send merge-slices-get...`)
                send('upload-controller', { mode: 'merge-slices-get', fileHash: fileTotalHash, filename: fileTotalName, queueId }, { dataType: 'json', retry: retryUpload })
                    .then((res) => {
                        // console.log('res', res)
                        // res => {
                        //   queueId,
                        //   state,
                        //   filename,
                        //   path,
                        //   msg: ...
                        // }

                        //check
                        if (res.state === 'success') {

                            //clearInterval
                            clearInterval(t)

                            //resolve, state為'success'時提取msg回傳
                            //settle須排在通知應用端之前(帳本R10之結構層): 原本 cbProgressMerge 排在前面, 而它會呼叫應用端之 cbProgress ——
                            //該回呼拋錯時, 例外沿 .then 傳到下方之 .catch(() => {}) 被吞掉, pm 遂**永不 settle**, upload() 永久懸置且 0 則事件、0 行 console
                            //(實測: 切片進度回呼拋錯為 142ms reject, 而合併完成回呼拋錯為 12000ms 未 settle —— 同一個 cbProgress 兩種下場)
                            pm.resolve(res.msg)

                            //cbProgressMerge
                            cbProgressMerge({ prog: 100, m: 'download' }) //觸發上傳完畢後之下載回應, 故m須為download

                        }
                        else if (res.state === 'error') {
                            // console.log('merge-slices-get error', res)

                            //clearInterval
                            clearInterval(t)

                            //reject, state為'error'時會於msg提供錯誤訊息; 為伺服器回之業務錯誤(HTTP 請求本身成功, 不經 callApi 之迴圈), 於此發事件(見 attemptFailed; 第十輪 F6 之站點)
                            attemptFailed(res.msg)
                            pm.reject(res.msg)

                        }

                    })
                    .catch(() => {
                        // console.log('merge-slices-get catch')
                        //可能發生網路斷訊錯誤, 不clearInterval, 持續輪循測試合併大檔之狀態; 此處不可console.log, 斷線期間每2秒會印一次
                    })
                    .finally(() => {
                        bBusy = false //本條查詢(含其重試鏈)已結束, 下一個tick才可再發
                    })

            }, 2000)

            return pm
        }

        //checkMerging
        let resMg = await checkMerging()
        // console.log('resMg', resMg)

        // console.log(`upload slice done`)
        return resMg
    }

    //execute
    let execute = async(func, input, cbProgress) => {

        //msg
        let msg = {
            // _mode: mode,
            // clientId,
            func,
            input,
        }

        //sendPkg
        let state = ''
        let res = null
        await sendPkg('basic', msg, cbProgress)
            .then((msg) => {
                // console.log('msg', msg)

                //check, 若為字串為錯誤訊息
                if (isestr(msg)) {
                    state = 'error'
                    res = msg
                    return
                }

                //check, 若為非物件為非預期錯誤
                if (!iseobj(msg)) {
                    console.log('msg is not an effective object', msg)
                    state = 'error'
                    res = 'msg is not an effective object'
                    return
                }

                //check, 若不存在output為非預期錯誤, msg格式為{func,input,output}但input會刪除
                if (!haskey(msg, 'output')) {
                    console.log('invalid msg.output', msg)
                    state = 'error'
                    res = 'invalid msg.output'
                    return
                }

                state = 'success'
                res = msg.output
            })
            .catch((msg) => {
                state = 'error'
                res = msg
            })

        //check
        if (state === '') {
            // console.log('invalid state', r)
            evEmit('error', `invalid state`)
            return Promise.reject('invalid state')
        }

        //check
        if (state === 'error') {
            // console.log('send data error', r)
            // evEmit('error', res) //一般錯誤會嘗試n次, 每次也都會emit, 故此處不再基於已知state='error'時再emit
            return Promise.reject(res)
        }

        return res
    }

    //upload
    let upload = async(filename, input, cbProgress) => {

        //bb, 輸入之正規化(見 normalizeUploadInput); 不支援者於入口拒絕, 不進入任何請求與重試(與 download 之 fdDownload 同一作法)
        let bb = normalizeUploadInput(input)
        if (bb === null) {
            let msg = `invalid input for upload: must be a Blob, File, ArrayBuffer, ArrayBufferView or string`
            evEmit('error', msg)
            return Promise.reject(msg)
        }

        return sendDataSlice(filename, bb, cbProgress)
    }

    //downloadNodejs
    let downloadNodejs = async(fileId, cbProgress, opt = {}) => {

        //check, fdDownload為nodejs下載之落地資料夾, 未給即必然失敗, 故於入口拒絕
        //why: 原無此檢核, 未給時直到downloadStream才以 fs.mkdirSync('') 拋 ENOENT(實測 tmp/probe_r9_hostile.mjs 之 E1),
        //而該處位於send之重試鏈內, 於是要重試retryDownload次(預設2, 含1.0s與1.78s退避)才失敗, 且訊息為ENOENT ——
        //呼叫端不會知道是自己沒給參數。本錯誤僅由client自身參數決定, 屬「可證明不需重試」, 於入口終止不進重試鏈
        //(同帳本R9: 公開方法之選用參數, 凡有直接使用之處, 該處須自行補預設或檢核; 原僅盤點cbProgress)
        let fdDownload = get(opt, 'fdDownload', '')
        if (!isestr(fdDownload)) {
            let msg = `invalid fdDownload for download in nodejs`
            evEmit('error', msg)
            return Promise.reject(msg)
        }

        //send download
        let msg = { fileId }
        let resMg = await send('download', msg, { ...opt, dataType: 'json', retry: retryDownload, cbProgress })
        // console.log('resMg', resMg)

        return resMg
    }

    //downloadBrowser
    let downloadBrowser = async(fileId, cbProgress, opt = {}) => {
        //交由瀏覽器下載與管理故無法監聽進度, 不使用cbProgress

        //downloadByManager
        let downloadByManager = get(opt, 'downloadByManager')
        if (!isbol(downloadByManager)) {
            downloadByManager = true
        }
        // console.log('downloadByManager', downloadByManager)

        if (downloadByManager) {
            //由瀏覽器的下載管理器下載, 使用get+stream

            //send download-get-filename
            let msg = { fileId }
            let resMg = await send('download-get-filename', msg, { dataType: 'json', retry: retryDownload })
            // console.log('resMg', resMg)

            //filename
            let filename = get(resMg, 'filename', '')
            // console.log('filename', filename)

            //token, 供組 URL(本路徑之下載由瀏覽器執行, token 只能走 query string); 經 fetchToken 取當下值
            //why 於 dwgfn 成功後才取: 此 token 是**下一個請求**(瀏覽器導覽至 /dwgf)要用的, 取值點須貼著使用點 ——
            //原本於 dwgfn 之前取, 中間隔了 dwgfn 之 1+retryDownload 次嘗試與其退避延遲(可達數秒), 短效 token 之應用端交給瀏覽器的是過期值(A 卷 §③-3.2)
            //拋錯屬入口失敗(不在 send 之重試鏈內), 一則事件 + 拒絕, 不原樣逸出; 處置留在呼叫點而不包進 fetchToken(另一呼叫點之處置為進重試, 兩者不同)
            let token = ''
            try {
                token = await fetchToken()
            }
            catch (err) {
                let msgErr = `getToken error: ${getErrorMessage(err)}`
                evEmit('error', msgErr)
                return Promise.reject(msgErr)
            }
            // console.log('token', token)

            //urlUse
            let urlUse = getUrlUse('download-get')
            // console.log('urlUse', urlUse)

            //url, fileId與token皆須encodeURIComponent: 含&或#會截斷query(#更會連token一起丟), 含+會被伺服器解析為空白(base64型token常見),
            //其他路由的token走Authorization header不受影響, 唯獨此處走query string
            let url = `${urlUse}?fileId=${encodeURIComponent(fileId)}&token=${encodeURIComponent(token)}`
            // console.log('url', url)

            //透過a元素打url下載, 讓瀏覽器認定為直接下載模式, 由瀏覽器展示下載進度與排入正在下載清單
            let a = document.createElement('a')
            a.href = url
            a.download = filename
            a.click()

            return filename
        }
        else {
            //通過axios下載得到blob, 回傳檔案名稱與blob供後續處理

            //send download
            let msg = { fileId }
            let resMg = await send('download', msg, { ...opt, dataType: 'json', retry: retryDownload, cbProgress })
            // console.log('resMg', resMg)

            return resMg
        }

    }

    //download
    let download = async(fileId, cbProgress, opt = {}) => {
        if (env === 'browser') {
            return downloadBrowser(fileId, cbProgress, opt)
        }
        else {
            return downloadNodejs(fileId, cbProgress, opt)
        }
    }

    //save
    ev.execute = execute
    ev.upload = upload
    ev.download = download

    return ev
}


export default WConverhpClient
