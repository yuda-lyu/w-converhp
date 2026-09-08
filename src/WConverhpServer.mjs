import path from 'path'
import fs from 'fs'
import stream from 'stream'
import Hapi from '@hapi/hapi'
import Inert from '@hapi/inert' //提供靜態檔案
import get from 'lodash-es/get.js'
import isNumber from 'lodash-es/isNumber.js'
import genPm from 'wsemi/src/genPm.mjs'
import evem from 'wsemi/src/evem.mjs'
import iseobj from 'wsemi/src/iseobj.mjs'
import isestr from 'wsemi/src/isestr.mjs'
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
import encodeRfc5987 from './encodeRfc5987.mjs'
import mmg from './managerMergeSlices.mjs'
// import checkTotalHash from './checkTotalHash.mjs'
import checkTotalHash from './checkTotalHash.wk.umd.js'
// import checkSlicesHash from './checkSlicesHash.mjs'
import checkSlicesHash from './checkSlicesHash.wk.umd.js'


//回傳前端stream時(POST或GET皆可), 前端會須等stream傳完才能判斷是否為大檔或錯誤訊息, 此會導致若回傳超大檔, 會需要對超大檔進行解析會有記憶體上限問題, 故需要通過header提供基本成功或失敗訊息, 讓前端能進行解析判斷
//回傳前端(nodejs)時, 針對超大檔, 只能用POST並用stream回傳
//回傳前端(browser)時, 針對超大檔, 可用POST並用stream回傳但還要處理進度條, 若要交由瀏覽器下載器處理, 只能用GET並用stream回傳, 且前端只能用window.location.href或a.href+a.click()下載


/**
 * 建立Hapi伺服器
 *
 * @class
 * @param {Object} [opt={}] 輸入設定物件，預設{}
 * @param {Integer} [opt.port=8080] 輸入Hapi伺服器所在port正整數，預設8080。埠被占用等啟動失敗時不拋出，以error事件通知
 * @param {Boolean} [opt.useInert=true] 輸入是否提供瀏覽pathStaticFiles資料夾內檔案之布林值，預設true
 * @param {String} [opt.pathStaticFiles='dist'] 輸入當useInert=true時提供瀏覽資料夾字串，預設'dist'
 * @param {String} [opt.pathUploadTemp='./uploadTemp'] 輸入暫時存放切片上傳檔案資料夾字串，預設'./uploadTemp'
 * @param {String} [opt.apiName='api'] 輸入API名稱字串，預設'api'
 * @param {String} [opt.tokenType='Bearer'] 輸入token類型字串，預設'Bearer'
 * @param {Integer} [opt.sizeSlice=1024*1024] 輸入切片上傳檔案之切片檔案大小整數，單位為Byte，預設為1024*1024。須與前端之sizeSlice一致，伺服器以此為單一切片請求(/slc)之本體上限並據以判定切片是否完整，check-total-hash會回傳此值供前端比對，不一致時前端upload會以sizeSlice mismatch訊息終止
 * @param {Integer} [opt.sizeMsg=100*1024*1024] 輸入單次請求本體大小上限整數，單位為Byte，預設為100*1024*1024。適用於除切片上傳(/slc)外之各API(/main、/ulctr、/dwgfn、/dw)，此類請求須將整個本體讀入記憶體，超過上限會回應413且不觸發事件；切片上傳之單次請求上限為sizeSlice，大檔案總大小不受此限制，請改用upload
 * @param {Function} [opt.verifyConn=()=>{return true}] 輸入呼叫API時檢測函數，預設()=>{return true}
 * @param {Array} [opt.corsOrigins=['*']] 輸入允許跨域網域陣列，若給予['*']代表允許全部，預設['*']。回應一律以Access-Control-Expose-Headers曝露Return-Type、Return-Msg、Return-Retryable、Content-Disposition四個標頭，使前端(browser)與API不同源時download仍可讀取成敗與檔名
 * @param {Integer} [opt.delayForSlice=100] 輸入切片上傳檔案API用延遲響應時間，單位ms，預設100
 * @param {Boolean} [opt.serverHapi=null] 輸入外部提供Hapi伺服器物件，預設null。外部提供者須自行於其routes.cors設定additionalExposedHeaders含Return-Type、Return-Msg、Return-Retryable、Content-Disposition，否則前端(browser)與API不同源時download會失效
 * @returns {Object} 回傳事件物件，可監聽事件execute、upload、download、handler、error。監聽器同步拋錯或async reject皆由套件攔截：以error事件通知，該請求以錯誤回應，不會使伺服器行程崩潰
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

    //port
    let port = get(opt, 'port')
    if (!ispint(port)) {
        port = 8080
    }

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
    if (!fsIsFolder(pathUploadTemp)) {
        fsCreateFolder(pathUploadTemp)
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

    //sizeSlice
    let sizeSlice = get(opt, 'sizeSlice')
    if (!ispint(sizeSlice)) {
        sizeSlice = 1024 * 1024 //1m
    }

    //sizeMsg, 單次請求本體上限, 適用於除切片(/slc)外之各API(/main、/ulctr、/dwgfn、/dw)
    //why: 此類請求須整包讀入記憶體再反序列化(/main實測記憶體約為本體5至6倍), 上限若給到遠超RAM之值(原為1tb), 單一請求即可令整個行程OOM;
    //切片(/slc)為串流直接落地不緩衝, 其單次上限為sizeSlice; 大檔本就應走切片上傳, 總大小不受此限制
    let sizeMsg = get(opt, 'sizeMsg')
    if (!ispint(sizeMsg)) {
        sizeMsg = 100 * 1024 * 1024 //100m
    }

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

    //delayForSlice
    let delayForSlice = get(opt, 'delayForSlice', '')
    if (!isp0int(delayForSlice)) {
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

    //ee, 採wsemi evem之safe型: 應用端監聽器同步拋錯或async reject一律攔截, 事件為setTimeout派發, 不攔截即為uncaughtException/unhandledRejection, 整個伺服器行程會崩潰;
    //不採其預設政策(取args[0].pm), 本套件之pm為execute/upload/download事件之最後一個參數, 故自訂funGetListenerError: 一併reject使前端收到回應而非永久懸置; 細節(含stack)僅以error事件通知應用端, 回前端不含細節
    let ee = evem({
        type: 'safe',
        funGetListenerError: (name, err, args) => {
            console.log(`listener of event[${name}] error`, err)
            if (name !== 'error') { //error事件之監聽器出錯不再發error事件, 避免無限遞迴
                eeEmit('error', `listener of event[${name}] error: ${get(err, 'message', err)}`)
            }
            let pm = args[args.length - 1]
            if (ispm(pm)) {
                pm.reject(`listener of event[${name}] error`)
            }
        },
    })

    //eeEmit
    let eeEmit = (name, ...args) => {
        setTimeout(() => {
            ee.emit(name, ...args)
        }, 1)
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
            console.log(`verifyConn error for apiType[${get(inp, 'apiType', '')}]`, err) //使用err.message會過於簡化, 另外要開啟顯示err供debug
            eeEmit('error', `verifyConn error for apiType[${get(inp, 'apiType', '')}]: ${get(err, 'message', err)}`)
            m = false
        }
        return m === true
    }

    //procDeal
    async function procDeal(data) {

        //pm, pmm
        let pm = genPm()
        let pmm = genPm()

        //重新處理回傳結果
        pmm
            .then((output) => {

                //add output, 監聽器以pm.resolve()不帶值結束時output為undefined, 序列化(obj2u8arr)會把值為undefined之鍵整個省略, 前端收不到output鍵即判為畸形封包而拒絕(invalid msg.output);
                //故正規化為null, 此為序列化傳輸能表達之極限, 前端收到null而非錯誤; 舊版前端亦相容(null有鍵)
                data['output'] = (output === undefined) ? null : output

                //delete input, 因input可能很大故回傳數據不包含原input
                delete data['input']

                pm.resolve(data)
            })
            .catch((err) => {
                pm.reject(err)
            })

        if (true) {

            //func
            let func = get(data, 'func', '')

            //input
            let input = get(data, 'input', null)

            //execute 執行
            eeEmit('execute', func, input, pmm) //emit至外部處理, 藉由pmm取得外部結束狀態

        }

        return pm
    }

    //procUpload
    async function procUpload(input) {
        // console.log('procUpload', input)

        //pm, pmm
        let pm = genPm()
        let pmm = genPm()

        //重新處理回傳結果
        pmm
            .then((output) => {

                //resolve
                pm.resolve(output)

            })
            .catch((err) => {
                pm.reject(err)
            })

        if (true) {

            //upload, 上傳檔案
            eeEmit('upload', input, pmm) //emit至外部處理, 藉由pmm取得外部結束狀態

        }

        return pm
    }

    //procDownload
    async function procDownload(input) {
        // console.log('procDownload', input)

        //pm, pmm
        let pm = genPm()
        let pmm = genPm()

        //重新處理回傳結果
        pmm
            .then((output) => {

                //resolve
                pm.resolve(output)

            })
            .catch((err) => {
                pm.reject(err)
            })

        if (true) {

            //download, 下載檔案
            eeEmit('download', input, pmm) //emit至外部處理, 藉由pmm取得外部結束狀態

        }

        return pm
    }

    //responseU8aStream
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
        if (isestr(returnMsg)) {
            r.header('Return-Msg', returnMsg)
        }

        return r
    }

    //responseU8aStreamWithError
    function responseU8aStreamWithError(res, msg, opt = {}) {

        //check
        if (!isestr(msg)) {
            console.log('msg', msg)
            console.log(`msg is not an effective string, set msg=''`)
            msg = ''
        }

        //retryable, 預設true; 給false者限「可證明不需重試」之錯誤: 結果僅由client自行建構之請求內容(mode、fileHash、chunkTotal、chunkIndex、packageId、fileId)決定, 重送同一請求必得同一結果;
        //凡涉及權限(permission denied)、應用端reject、應用端回傳形狀不合、磁碟、網路者皆為狀態不穩, 不得標示, 依重試原則由前端照常重試
        //標示同時置於封包(供execute/upload/dwgfn之本體解析)與標頭Return-Retryable(供download之串流路徑, 該路徑只讀標頭不解析本體)
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
        // console.log('download u8aOut', u8aOut)

        //str2b64
        // msg = str2b64(msg) //預期程式內調用皆為英文, 不須轉base64來支援中文

        //r
        let r = responseU8aStream(res, u8aOut, { returnType: 'error', returnMsg: msg })
        if (retryable === false) {
            r.header('Return-Retryable', 'false')
        }

        return r
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

            //headers
            let headers = get(req, 'headers')
            headers = iseobj(headers) ? headers : ''
            // console.log('headers', headers)

            //query
            let query = get(req, 'query')
            query = iseobj(query) ? query : ''
            // console.log('query', query)

            //authorization
            let authorization = get(headers, 'authorization', '')
            authorization = isestr(authorization) ? authorization : ''

            //check
            if (true) {

                //checkConn
                let m = await checkConn({ apiType: 'main', authorization, query, headers, req })

                //check
                if (m !== true) {
                    return responseU8aStreamWithError(res, 'permission denied')
                }

            }

            //eeEmit
            eeEmit('handler', {
                api: 'apiMain',
                headers,
                query,
            })

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
                    eeEmit('error', `receive payload error: ${err.message}`)
                    pm.reject(`receive payload error: ${err.message}`)
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

            //u8arr2obj
            let inp = u8arr2obj(u8aInp)
            // console.log('inp', inp)

            //procDeal
            let out = {}
            let returnType = ''
            let returnMsg = ''
            await procDeal(inp)
                .then((res) => {
                    out.success = res
                    returnType = 'success'
                    returnMsg = 'need to parse'
                })
                .catch((err) => {
                    out.error = err
                    returnType = 'error'
                    returnMsg = 'need to parse'
                })
            // console.log('out', out)

            //u8aOut
            let u8aOut = obj2u8arr(out)
            // console.log('u8aOut', u8aOut)

            return responseU8aStream(res, u8aOut, { returnType, returnMsg })
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
            },
            timeout: {
                server: false, //關閉伺服器超時
                socket: false, //關閉socket超時
            },
        },
        handler: async function (req, res) {
            // console.log(req, res)
            // console.log('payload', req.payload)

            //headers
            let headers = get(req, 'headers')
            headers = iseobj(headers) ? headers : ''
            // console.log('headers', headers)

            //query
            let query = get(req, 'query')
            query = iseobj(query) ? query : ''
            // console.log('query', query)

            //authorization
            let authorization = get(headers, 'authorization', '')
            authorization = isestr(authorization) ? authorization : ''

            //check
            if (true) {

                //checkConn
                let m = await checkConn({ apiType: 'upload-controller', authorization, query, headers, req })

                //check
                if (m !== true) {
                    return responseU8aStreamWithError(res, 'permission denied')
                }

            }

            //eeEmit
            eeEmit('handler', {
                api: 'apiUploadCheck',
                headers,
                query,
            })

            //mode, 從payload接收
            let mode = get(req, 'payload.mode', '')

            //check
            if (mode !== 'check-total-hash' && mode !== 'check-slices-hash' && mode !== 'merge-slices-push' && mode !== 'merge-slices-get') {
                // console.log('invalid mode in payload')
                return responseU8aStreamWithError(res, `invalid mode[${mode}] in payload`, { retryable: false })
            }

            //fileHash, 從payload接收
            let fileHash = get(req, 'payload.fileHash', '')
            // console.log(mode, 'fileHash', fileHash)

            //check, fileHash會參與pathUploadTemp下之路徑組裝, 須為安全識別字(英數字), 否則可 ../ 逸出資料夾
            if (!isSafeId(fileHash)) {
                // console.log('invalid fileHash in payload')
                return responseU8aStreamWithError(res, 'invalid fileHash in payload', { retryable: false })
            }

            //chunkTotal, 從payload接收, 僅merge-slices-push使用
            //check, chunkTotal決定mergeSlices配置路徑陣列之長度, 須為正整數; 巨大值另由mergeSlices逐片確認存在(缺片即停)兜底, 不會依此值無上限配置而耗盡記憶體
            let chunkTotal = get(req, 'payload.chunkTotal', '')
            if (mode === 'merge-slices-push') {
                if (!ispint(chunkTotal)) {
                    // console.log('invalid chunkTotal in payload')
                    return responseU8aStreamWithError(res, 'invalid chunkTotal in payload', { retryable: false })
                }
                chunkTotal = cint(chunkTotal)
            }

            //procCore
            let procCore = async() => {
                let out = null
                if (mode === 'check-total-hash') {

                    //filename, 從payload接收
                    let filename = get(req, 'payload.filename', '')
                    // console.log(mode, 'filename', filename)

                    //fileSize, 從payload接收
                    let fileSize = get(req, 'payload.fileSize', '')
                    // console.log(mode, 'fileSize', fileSize)

                    //checkTotalHash
                    out = await checkTotalHash(fileSize, sizeSlice, fileHash, pathUploadTemp)
                    // console.log(mode, 'out', out)

                    //check, 因合併大檔後可能非預期中斷而重傳, 每次偵測有合併完成大檔, 就得調用procUpload讓伺服器攔截函數處理
                    if (out.bAllHash) {

                        //ri
                        let ri = {
                            from: 'check-total-hash',
                            filename,
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
                    out = await checkSlicesHash(fileSliceHashs, fileHash, pathUploadTemp)
                    // console.log(mode, 'out', out)

                }
                else if (mode === 'merge-slices-push') {

                    //mmg.push, chunkTotal已於上方檢核為正整數
                    let queueId = mmg.push(fileHash, chunkTotal, pathUploadTemp)

                    //out
                    out = {
                        queueId,
                    }

                }
                else if (mode === 'merge-slices-get') {

                    //filename, 從payload接收
                    let filename = get(req, 'payload.filename', '')
                    // console.log(mode, 'filename', filename)

                    //queueId, 從payload接收
                    let queueId = get(req, 'payload.queueId', '')
                    // console.log(mode, 'queueId', queueId)

                    //mmg.get
                    let r = mmg.get(queueId, pathUploadTemp)

                    //out, r.path為伺服器絕對路徑, 僅供下方procUpload使用, 不回傳前端
                    out = {
                        state: r.state,
                        msg: r.msg, //state為'error'時會於msg提供錯誤訊息(不含伺服器路徑與底層細節)
                        queueId,
                        filename,
                    }

                    //check, 失敗細節(含伺服器路徑)僅以error事件通知應用端, 不回傳前端
                    if (r.state === 'error' && isestr(r.reason)) {
                        eeEmit('error', `merge slices failed for fileHash[${fileHash}]: ${r.reason}`)
                    }

                    //check
                    if (r.state === 'success') {

                        //ri
                        let ri = {
                            from: 'merge-slices-get',
                            filename,
                            path: r.path, //r.path使用path.resolve為絕對路徑
                        }

                        //procUpload, 偵測有合併完成大檔, 得調用procUpload讓伺服器攔截函數處理
                        // console.log('procUpload start')
                        let ro = await procUpload(ri)
                        // console.log('procUpload done', ro)

                        //out merge, ro為附加至msg, 前端偵測state為'success'時, 才提取msg使用
                        out = {
                            ...out, //state為'success'時out.msg為空字串, 故可直接被ro複寫uot.msg
                            msg: ro,
                        }

                    }

                }
                // console.log('out', out)

                return out
            }

            //procCore
            let out = {}
            let returnType = ''
            let returnMsg = ''
            await procCore()
                .then((res) => {
                    out.success = res
                    returnType = 'success'
                    returnMsg = 'need to parse'
                })
                .catch((err) => {
                    out.error = err
                    returnType = 'error'
                    returnMsg = 'need to parse'
                })
            // console.log('out', out)

            //u8aOut
            let u8aOut = obj2u8arr(out)
            // console.log('u8aOut', u8aOut)

            return responseU8aStream(res, u8aOut, { returnType, returnMsg })
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

            //headers
            let headers = get(req, 'headers')
            headers = iseobj(headers) ? headers : ''
            // console.log('headers', headers)

            //query
            let query = get(req, 'query')
            query = iseobj(query) ? query : ''
            // console.log('query', query)

            //authorization
            let authorization = get(headers, 'authorization', '')
            authorization = isestr(authorization) ? authorization : ''

            //check
            if (true) {

                //checkConn
                let m = await checkConn({ apiType: 'upload-slice', authorization, query, headers, req })

                //check
                if (m !== true) {
                    return responseU8aStreamWithError(res, 'permission denied')
                }

            }

            //eeEmit
            eeEmit('handler', {
                api: 'apiUploadSlice',
                headers,
                query,
            })

            //chunkIndex, chunkTotal, packageId, 從headers接收
            let chunkIndex = get(headers, 'chunk-index', '')
            let chunkTotal = get(headers, 'chunk-total', '')
            let packageId = get(headers, 'package-id', '')

            //check
            if (!isp0int(chunkIndex)) {
                // console.log('invalid chunkIndex in headers')
                return responseU8aStreamWithError(res, 'invalid chunkIndex in headers', { retryable: false })
            }
            chunkIndex = cint(chunkIndex)
            if (!isp0int(chunkTotal)) {
                // console.log('invalid chunkTotal in headers')
                return responseU8aStreamWithError(res, 'invalid chunkTotal in headers', { retryable: false })
            }
            chunkTotal = cint(chunkTotal)
            if (!isSafeId(packageId)) { //packageId會參與切片檔路徑組裝, 須為安全識別字(英數字), 否則可 ../ 逸出資料夾
                // console.log('invalid packageId in headers')
                return responseU8aStreamWithError(res, 'invalid packageId in headers', { retryable: false })
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
                streamWrite.on('error', (err) => {
                    if (bWriteErr || bOver || bAbort) {
                        return
                    }
                    bWriteErr = true
                    req.payload.unpipe(streamWrite)
                    req.payload.resume() //持續讀完剩餘本體, 使錯誤回應能回到前端
                    console.log(`apiUploadSlice streamWrite chunk[${chunkIndex + 1}/${chunkTotal}] of packageId[${packageId}] err`, err)
                    eeEmit('error', `write chunk[${chunkIndex + 1}/${chunkTotal}] of packageId[${packageId}] error: ${err.message}`)
                    pm.reject(`write chunk[${chunkIndex + 1}/${chunkTotal}] of packageId[${packageId}] error`)
                })
                streamWrite.on('close', () => {
                    if (bOver || bWriteErr || bAbort) {
                        fsDeleteFile(pathFileChunk) //待fd關閉(close)後才刪, 否則Windows下會EBUSY; 檔案不存在視為成功且不拋錯; 寫入失敗與中斷者亦清除殘留之不完整切片
                    }
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

                    //check, 超限者於此reject, 由handler回413
                    if (bOver) {
                        pm.reject('payload too large')
                        return
                    }

                    //setTimeout, 切片上傳添加延遲處理, 避免佔滿伺服器CPU與流量
                    setTimeout(() => {
                        pm.resolve(`chunk[${chunkIndex + 1}/${chunkTotal}] of packageId[${packageId}] done`)
                    }, delayForSlice)

                })

                //onAbort, 源串流出錯(如aborted/ECONNRESET)或未end即close皆為中斷, 只處理一次: 關閉寫入fd(其close會刪除不完整切片)、emit一則error事件、reject;
                //已正常end或已由寫入失敗路徑處置者不再處理; 超限(bOver)排空中斷線者仍須reject使handler結束(413已無法送達, 但不可懸置)
                let onAbort = (msg) => {
                    if (bAbort || bEnded || bWriteErr) {
                        return
                    }
                    bAbort = true
                    streamWrite.destroy()
                    eeEmit('error', `receive chunk[${chunkIndex + 1}/${chunkTotal}] of packageId[${packageId}] error: ${msg}`)
                    pm.reject(`receive chunk[${chunkIndex + 1}/${chunkTotal}] of packageId[${packageId}] error: ${msg}`)
                }

                //error
                req.payload.on('error', (err) => {
                    console.log(`apiUploadSlice req.payload chunk[${chunkIndex + 1}/${chunkTotal}] of packageId[${packageId}] err`, err) //使用err.message會過於簡化, 另外要開啟顯示err供debug
                    onAbort(err.message)
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
            },
            timeout: {
                server: false, //關閉伺服器超時
                socket: false, //關閉socket超時
            },
        },
        handler: async function (req, res) {
            // console.log(req, res)
            // console.log('payload', req.payload)

            //headers
            let headers = get(req, 'headers')
            headers = iseobj(headers) ? headers : ''
            // console.log('headers', headers)

            //query
            let query = get(req, 'query')
            query = iseobj(query) ? query : ''
            // console.log('query', query)

            //authorization
            let authorization = get(headers, 'authorization', '')
            authorization = isestr(authorization) ? authorization : ''

            //check
            if (true) {

                //checkConn
                let m = await checkConn({ apiType: 'download-get-filename', authorization, query, headers, req })

                //check
                if (m !== true) {
                    return responseU8aStreamWithError(res, 'permission denied')
                }

            }

            //eeEmit
            eeEmit('handler', {
                api: 'apiDownloadGetFilename',
                headers,
                query,
            })

            //fileId, 從payload接收
            let fileId = get(req, 'payload.fileId', '')
            // console.log('fileId', fileId)

            //check
            if (!isestr(fileId)) {
                // console.log('invalid fileId in payload')
                return responseU8aStreamWithError(res, 'invalid fileId in payload', { retryable: false })
            }

            //token, 自authorization提取供外部download事件進行授權檢查
            let token = isestr(authorization) ? authorization.slice(cstr(tokenType).length + 1) : ''

            //inp
            let inp = { fileId, token }

            //procDownload
            let out = {}
            let returnType = ''
            let returnMsg = ''
            await procDownload(inp)
                .then((res) => {
                    out.success = res
                    returnType = 'success'
                    returnMsg = 'need to parse'
                })
                .catch((err) => {
                    out.error = err
                    returnType = 'error'
                    returnMsg = 'need to parse'
                })
            // console.log('out', out)

            //r
            let r = get(out, 'success')

            //streamRead
            let streamRead = get(r, 'streamRead')

            //destroy, 不提供stream故須預先destroy
            try {
                streamRead.destroy()
            }
            catch (err) {}

            //filename
            let filename = get(r, 'filename')
            if (!isestr(filename)) {
                //已於前面destroy
                return responseU8aStreamWithError(res, 'invalid filename')
            }

            //重新提供out
            out = {
                success: {
                    filename,
                },
            }

            //u8aOut
            let u8aOut = obj2u8arr(out)
            // console.log('u8aOut', u8aOut)

            return responseU8aStream(res, u8aOut, { returnType, returnMsg })
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
        },
        handler: async function (req, res) {
            // console.log(req, res)
            // console.log('payload', req.payload)

            //headers
            let headers = get(req, 'headers')
            headers = iseobj(headers) ? headers : ''
            // console.log('headers', headers)

            //query
            let query = get(req, 'query')
            query = iseobj(query) ? query : ''
            // console.log('query', query)

            //token
            let token = get(query, 'token', '')
            token = isestr(token) ? token : ''
            // console.log('token', token)

            //authorization
            let authorization = ''
            if (isestr(token)) {
                authorization = `${tokenType} ${token}`
            }

            //check
            if (true) {

                //checkConn
                let m = await checkConn({ apiType: 'download-get-file', authorization, query, headers, req })

                //check
                if (m !== true) {
                    return responseU8aStreamWithError(res, 'permission denied')
                }

            }

            //eeEmit
            eeEmit('handler', {
                api: 'apiDownloadGetFile',
                headers,
                query,
            })

            //fileId
            let fileId = get(query, 'fileId', '')
            fileId = isestr(fileId) ? fileId : ''
            // console.log('fileId', fileId)

            //check
            if (!isestr(fileId)) {
                // console.log('invalid fileId in query')
                return responseU8aStreamWithError(res, 'invalid fileId in query', { retryable: false })
            }

            //inp, token供外部download事件進行授權檢查
            let inp = { fileId, token }

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
                return responseU8aStreamWithError(res, `can not get file from fileId`)
            }

            //r
            let r = get(out, 'success')

            //streamRead
            let streamRead = get(r, 'streamRead')

            //fileSize
            let fileSize = get(r, 'fileSize')
            if (!isNumber(fileSize)) {
                try {
                    streamRead.destroy() //提供stream前發生錯誤, 得強制destroy
                }
                catch (err) {}
                return responseU8aStreamWithError(res, 'invalid fileSize')
            }
            // fileSize = cstr(fileSize)

            //fileType
            let fileType = get(r, 'fileType')
            if (!isestr(fileType)) {
                try {
                    streamRead.destroy() //提供stream前發生錯誤, 得強制destroy
                }
                catch (err) {}
                return responseU8aStreamWithError(res, 'invalid fileType')
            }
            fileType = cstr(fileType)

            //filename, 應用端有給則以 RFC 6266 之 filename*(值為 RFC 5987 percent-encoding)回傳, 使瀏覽器不論頁面與 API 是否同源皆以此命名並強制下載(attachment)
            //why: 瀏覽器只對同源 URL 採用 <a download> 之檔名, 跨來源時忽略而以 URL 末段(dwgf)命名, 可直接顯示之型別(txt/圖片/pdf)更會改為導頁而非下載;
            //以往不給此標頭之理由(中文於 filename="..." 須 base64, chrome 檔名因而變 base64)是舊寫法之限制, filename* 由瀏覽器直接還原 UTF-8;
            //同源時標頭與 <a download> 為同一檔名, 行為不變. 未給 filename 者維持不帶標頭(向後相容), 由 <a download> 或 URL 命名
            let filename = get(r, 'filename')

            //rr
            let rr = res.response(streamRead)
                .type(fileType)
                .header('Content-Length', fileSize)
            if (isestr(filename)) {
                rr.header('Content-Disposition', `attachment; filename*=UTF-8''${encodeRfc5987(filename)}`)
            }

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
            },
            timeout: {
                server: false, //關閉伺服器超時
                socket: false, //關閉socket超時
            },
        },
        handler: async function (req, res) {
            // console.log(req, res)
            // console.log('payload', req.payload)

            //headers
            let headers = get(req, 'headers')
            headers = iseobj(headers) ? headers : ''
            // console.log('headers', headers)

            //query
            let query = get(req, 'query')
            query = iseobj(query) ? query : ''
            // console.log('query', query)

            //authorization
            let authorization = get(headers, 'authorization', '')
            authorization = isestr(authorization) ? authorization : ''

            //check
            if (true) {

                //checkConn
                let m = await checkConn({ apiType: 'download', authorization, query, headers, req })

                //check
                if (m !== true) {
                    return responseU8aStreamWithError(res, 'permission denied')
                }

            }

            //eeEmit
            eeEmit('handler', {
                api: 'apiDownload',
                headers,
                query,
            })

            //fileId, 從payload接收
            let fileId = get(req, 'payload.fileId', '')
            // console.log('fileId', fileId)

            //check
            if (!isestr(fileId)) {
                // console.log('invalid fileId in payload')
                return responseU8aStreamWithError(res, 'invalid fileId in payload', { retryable: false })
            }

            //token, 自authorization提取供外部download事件進行授權檢查
            let token = isestr(authorization) ? authorization.slice(cstr(tokenType).length + 1) : ''

            //inp
            let inp = { fileId, token }

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
                return responseU8aStreamWithError(res, `can not get file from fileId`)
            }

            //r
            let r = get(out, 'success')

            //streamRead
            let streamRead = get(r, 'streamRead')

            //filename
            let filename = get(r, 'filename')
            if (!isestr(filename)) {
                try {
                    streamRead.destroy() //提供stream前發生錯誤, 得強制destroy
                }
                catch (err) {}
                return responseU8aStreamWithError(res, 'invalid filename')
            }
            filename = str2b64(filename) //headers內對中文支援度不佳須用base64傳

            //fileSize
            let fileSize = get(r, 'fileSize')
            if (!isNumber(fileSize)) {
                try {
                    streamRead.destroy() //提供stream前發生錯誤, 得強制destroy
                }
                catch (err) {}
                return responseU8aStreamWithError(res, 'invalid fileSize')
            }
            // fileSize = cstr(fileSize)

            //fileType
            let fileType = get(r, 'fileType')
            if (!isestr(fileType)) {
                try {
                    streamRead.destroy() //提供stream前發生錯誤, 得強制destroy
                }
                catch (err) {}
                return responseU8aStreamWithError(res, 'invalid fileType')
            }
            fileType = cstr(fileType)

            return res.response(streamRead)
                .type(fileType)
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
    if (get(opt, 'serverHapi')) {
        // server.route([apiMain, apiUploadCheck, apiUploadSlice, apiUploadSliceMerge, apiDownloadGetFilename, apiDownloadGetFile, apiDownload])
        server.route([apiMain, apiUploadCheck, apiUploadSlice, apiDownloadGetFilename, apiDownloadGetFile, apiDownload])
    }
    else {
        startServer()
            .catch((err) => {
                //埠被占用(EADDRINUSE)等啟動失敗須攔截: 未await之promise被reject即為unhandledRejection, 整個行程會崩潰且應用端無從得知; 改以error事件通知, 由應用端決定處置
                console.log(`start server error`, err)
                eeEmit('error', `start server error: ${get(err, 'message', err)}`)
            })
    }

    //stop
    let stop = () => {
        server.stop()
    }

    //save
    ee.stop = stop

    return ee
}


export default WConverhpServer
