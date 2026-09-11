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
 * 建立Hapi使用者(Node.js與Browser)端物件
 *
 * @class
 * @param {Object} opt 輸入設定參數物件
 * @param {String} [opt.url='http://localhost:8080'] 輸入Hapi伺服器網址，預設為'http://localhost:8080'
 * @param {String} [opt.apiName='api'] 輸入API名稱字串，預設'api'
 * @param {Function} [opt.getToken=()=>''] 輸入取得使用者token的回調函數，預設()=>''
 * @param {String} [opt.tokenType='Bearer'] 輸入token類型字串，預設'Bearer'
 * @param {Integer} [opt.sizeSlice=1024*1024] 輸入切片上傳檔案之切片檔案大小整數，單位為Byte，預設為1024*1024。須與伺服器之sizeSlice一致，伺服器以其sizeSlice為單一切片請求上限並據以判定切片是否完整，不一致時upload會於check-total-hash階段以sizeSlice mismatch訊息終止。須為安全整數，Infinity與超出安全範圍者視為無效取預設
 * @param {Integer} [opt.timeout=5*60*1000] 輸入最長等待時間整數，單位ms，預設為5*60*1000、為5分鐘。為axios之閒置逾時，0為不逾時；須為安全整數，Infinity與超出安全範圍者視為無效取預設；另受計時器上限2147483647約束，超過者亦取預設。不可用Infinity或超大數字表示不逾時(axios會於請求送出前即拋錯，超大數字則因計時器溢位而立即逾時)，不逾時請給0
 * @param {Integer} [opt.retryMain=3] 輸入主要控制器傳輸失敗重試次數整數，預設為3。凡失敗皆重試（含伺服器不穩、傳輸不穩、狀態不穩如permission denied與應用端reject），僅可證明不需重試之錯誤除外：伺服器標示retryable為false之參數檢核類錯誤，與HTTP 413。須為安全整數，Infinity與超出安全範圍者視為無效取預設；上限為20，超過者截為20（退避延遲為指數成長，次數無上限會使單次等待成長至數小時乃至溢位計時器）
 * @param {Integer} [opt.retryUpload=10] 輸入切片上傳檔案傳輸失敗重試次數整數，預設為10。重試範圍同retryMain，為每一次請求(含合併輪詢中之每一條查詢)之重試次數，非整個upload之總上限；合併完成後應用端upload事件拒絕時，依重試原則持續輪詢直到應用端接受為止。須為安全整數，Infinity與超出安全範圍者視為無效取預設；上限為20，超過者截為20
 * @param {Integer} [opt.retryDownload=2] 輸入下載檔案傳輸失敗重試次數整數，預設為2。重試範圍同retryMain；瀏覽器以下載管理器下載(downloadByManager=true)時僅涵蓋取檔名之請求，實際下載交由瀏覽器不在此重試範圍。須為安全整數，Infinity與超出安全範圍者視為無效取預設；上限為20，超過者截為20
 * @returns {Object} 回傳事件物件，可使用函數execute、upload、download，可監聽事件error。**監聽器須為同步函數，不可為async函數、亦不可回傳promise**：事件派發依EventEmitter規範丟棄監聽器之回傳值，其rejection無人觀察，於nodejs即unhandledRejection而使行程崩潰
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

            dd = JSON.stringify(pkg)
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

        //token
        let token = getToken()
        if (ispm(token)) {
            token = await token
        }

        //getFilenameByHeader
        let getFilenameByHeader = (contentDisposition) => {
            let fn = 'unknow'
            try {
                let reg = /filename="(.+?)"/
                let matches = reg.exec(contentDisposition)
                fn = matches ? matches[1] : 'unknown'
            }
            catch (err) {}
            return fn
        }

        //downloadStream
        let downloadStream = async(res) => {
            // console.log('res.headers', res.headers)

            //pm
            let pm = genPm()

            //returnType
            let returnType = get(res, `headers['return-type']`, '')
            // console.log('returnType', returnType)

            //returnMsg
            let returnMsg = get(res, `headers['return-msg']`, '')
            // console.log('returnMsg', returnMsg)

            //check, 伺服器於標頭標示Return-Retryable為false者為可證明不需重試之錯誤(下載路徑只讀標頭不解析本體; 瀏覽器跨域時若該標頭未被曝露則讀不到, 退回照常重試)
            if (returnType === 'error') {
                let returnRetryable = get(res, `headers['return-retryable']`, '')
                if (returnRetryable === 'false') {
                    pm.reject({ [symNoRetry]: true, msg: returnMsg })
                    return pm
                }
                pm.reject(returnMsg)
                return pm
            }

            //contentDisposition
            let contentDisposition = get(res, `headers['content-disposition']`, '')
            // console.log('contentDisposition', contentDisposition)

            //filename
            let filename = getFilenameByHeader(contentDisposition)
            filename = b642str(filename) //headers內對中文支援度不佳須用base64傳, 此處解析提取後須反轉

            //sanitizeFilename, 檔名來自伺服器不可信: 只取最末路徑段並去除非法字元(含可逸出之Windows磁碟機相對路徑 C:x)與保留裝置名,
            //否則nodejs端存檔會逸出fdDownload(瀏覽器與curl對Content-Disposition皆做同等處理)
            filename = sanitizeFilename(filename)
            // console.log('filename', filename)

            //streamRecv
            let streamRecv = get(res, 'data')
            // console.log(env, 'streamRecv', streamRecv)

            if (env === 'browser') {

                //browser通過axios使用blob接收時會自動把串流接收並組合成blob, 此時streamRecv已是blob
                pm.resolve({
                    filename,
                    bb: streamRecv,
                })

            }
            else {

                //nodejs通過fs與stream接收檔案, 串流出錯由pipeline回報, 此處try catch為攔截其他非串流程式碼錯誤(路徑判定、mkdir、lstat)
                try {

                    //path, fs, stream, 使用動態import供nodejs使用, 須用變數字串給予載入套件, 否則用於前端時會被webpack偵測而報錯
                    let cImPath = 'path'
                    let cImFs = 'fs'
                    let cImStream = 'stream'
                    let path = await import(cImPath)
                    let fs = await import(cImFs)
                    let stream = await import(cImStream)

                    //fdDownload, 只有nodejs下載才使用fdDownload
                    let fdDownload = get(opt, 'fdDownload', '')
                    fs.mkdirSync(fdDownload, { recursive: true }) //須使用mkdirSync, 不要用fsIsFolder與fsCreateFolder避免編譯
                    // console.log('fdDownload', fdDownload)

                    //fp
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
                    // console.log('fp', fp)

                    //streamWriter
                    let streamWriter = fs.createWriteStream(fp)

                    //pipeline, 不用streamRecv.pipe(streamWriter): .pipe()不會因源串流出錯或中途斷線而關閉目的串流, 伺服器串流中途失敗時finish永不發生,
                    //本promise永不settle(axios之timeout只涵蓋到回應標頭, 不涵蓋串流本體)、寫入fd開啟、殘留部分檔; pipeline對源與目的任一方出錯或提前關閉皆銷毀雙方並回報,
                    //使失敗能reject而進入send之重試(傳輸不穩須重試, 前提是失敗要被偵測到)
                    stream.pipeline(streamRecv, streamWriter, (err) => {
                        if (err) {

                            //不完整檔須刪除, 否則殘留部分內容會被當成已下載之檔案; 刪除失敗不影響reject(重試會以寫入模式覆蓋)
                            try {
                                fs.unlinkSync(fp)
                            }
                            catch (e) {}

                            pm.reject(err)
                            return
                        }
                        pm.resolve(fp)
                    })

                }
                catch (err) {
                    pm.reject(err)
                }

            }

            return pm
        }

        //s
        let s = {
            method: 'POST',
            url: urlUse,
            data: dd,
            headers: {
                Authorization: `${tokenType} ${token}`,
                ...ct,
                ...headers,
            },
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
                let msg = `invalid packet from server: ${get(rd, 'msg', 'unknown error')}`
                evEmit('error', msg)
                return Promise.reject(msg) //屬傳輸不穩, 依重試原則不標示不重試
            }
            let data = rd.msg
            // console.log('data', data)

            //check
            if (!iseobj(data)) {
                evEmit('error', `data is not an effective object`)
                return Promise.reject(`data is not an effective object`)
            }

            //分離伺服器資料的success或error
            if (haskey(data, 'success')) {
                return Promise.resolve(data.success)
            }
            else if (haskey(data, 'error')) {
                evEmit('error', data.error)

                //check, 伺服器標示retryable為false者為可證明不需重試之錯誤, 以symNoRetry包裝交由callApi中止重試並解包
                if (data.retryable === false) {
                    return Promise.reject({ [symNoRetry]: true, msg: data.error })
                }

                return Promise.reject(data.error)
            }
            else {
                evEmit('error', `data does not contain success or error`)
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

            //while, 退避曲線見src/retryDelay.mjs(其自有封頂, 使延遲不隨retry次數無界成長)
            let n = 0
            while (r.state === 'error') {

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

        //callApi
        await callApi()
            .then((res) => {
                pm.resolve(res)
            })
            .catch(async(res) => {
                // console.log('axios catch', res.toJSON())
                //Network Error除可能是網路斷線之外, 可能被瀏覽器外掛封鎖阻擋, 亦可能因硬碟空間不足無法下載被瀏覽器拒絕

                //data
                let data = null

                //check, callApiCore於伺服器回傳業務錯誤(如'invalid func'、'permission denied', 或應用端handler之reject值)時,
                //是reject伺服器給的值本體而非axios錯誤物件, 故須先攔截並原樣向外傳遞, 否則下方各get皆取不到值而誤判為無法連線
                //判準採反向: 本地失敗(axios、fs、解析)一律為Error實例, 而經序列化自伺服器回來之值結構上不可能是Error實例,
                //故非Error者即為伺服器回傳值, 不論其形狀(字串、物件、數字、陣列、空字串、null)皆原樣交出; 不可用形狀白名單, 外部應用端之拒絕值列不完
                if (!(res instanceof Error)) {
                    // console.log('res is a value returned by server', res)
                    data = res
                }
                else {

                    //statusText, err
                    let statusText = get(res, 'response.statusText') || get(res, 'message')
                    let err = get(res, 'response.data') || get(res, 'stack')
                    // console.log(`get(res, 'response.statusText')`, get(res, 'response.statusText'))
                    // console.log(`get(res, 'message')`, get(res, 'message'))
                    // console.log(`get(res, 'response.data')`, get(res, 'response.data'))
                    // console.log(`get(res, 'stack')`, get(res, 'stack'))

                    if (statusText) {
                        // console.log('statusText', statusText)
                        data = statusText
                    }
                    else if (err) {
                        // console.log('err', err)
                        data = err
                    }
                    else {
                        try {
                            res = res.toJSON()
                        }
                        catch (err) {}
                        // console.log('err', res)
                        evEmit('error', res)
                        data = 'Can not connect to server.'
                    }
                    if (data === 'Network Error') {
                        data = `Network Error. Make sure your space of hard drive is large enough or blocking by browser plugins.`
                    }

                }
                // console.log('data', data)

                pm.reject(data)
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

        //bb
        let bb = null
        if (env === 'browser') {
            bb = inp
        }
        else {
            //於nodejs時, 因尚無法提供檔名上傳, 故會是readFileSync讀入的buffer, 再轉成new Blob([buffer]), 供getFileXxHash使用
            bb = new Blob([inp])
        }

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

        //n
        let n = 0
        if (n === 0) {
            try {
                n = bb.size //for Blob
                n = cint(n)
            }
            catch (err) {}
        }
        if (n === 0) {
            try {
                n = bb.length //for ArrayBuffer //nodejs用fs讀有檔案大小上限, 除非改傳入檔名用stream讀, 否則無法支援超大檔
                n = cint(n)
            }
            catch (err) {}
        }
        if (n === 0) {
            // evEmit('error', `can not get size of bb`)
            // return Promise.reject(`can not get size of bb`)
            n = 1 //最小給1, 使能支援無大小檔案上傳
        }
        // console.log('n', n)

        //fileTotalSize
        let fileTotalSize = n

        //chunkTotal
        let chunkTotal = Math.ceil(fileTotalSize / sizeSlice)
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

                            //reject, state為'error'時會於msg提供錯誤訊息
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
    let upload = (filename, input, cbProgress) => {

        //bb
        let bb = input

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

            //token
            let token = getToken()
            if (ispm(token)) {
                token = await token
            }
            // console.log('token', token)

            //send download-get-filename
            let msg = { fileId }
            let resMg = await send('download-get-filename', msg, { dataType: 'json', retry: retryDownload })
            // console.log('resMg', resMg)

            //filename
            let filename = get(resMg, 'filename', '')
            // console.log('filename', filename)

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
