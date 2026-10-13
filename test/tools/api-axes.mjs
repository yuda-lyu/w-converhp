import w from 'wsemi'
import u8arr2obj from 'wsemi/src/u8arr2obj.mjs'


/**
 * 測試用之軸與成員(fixture)
 *
 * 為何需要這個檔:
 * 「下載路由」是一條軸, 但它的成員清單原本手寫在五個測試檔內, 且各檔不一致 ——
 *   api-downloadShape / api-sourceTraps / api-downloadFraming  只跑 ['dw', 'dwgf']
 *   api-downloadEvents                                          跑 ['dw', 'dwgf', 'dwgfn']
 * 少掉的那個成員不是被裁定不測, 而是**沒有人記得它也在這條軸上** —— #23 與 #32 都落在這條接縫上:
 * 規則套到 /dw 與 /dwgf, /dwgfn 因為不在該檔的陣列裡而整個掉出視野, 且測試照樣全綠。
 *
 * 本檔把軸與成員變成**測試的輸入資料**:
 *   - 成員全集只有一份(downloadRoutes), 新增路由時只改這裡, 所有以此軸列舉的測試自動涵蓋到
 *   - 要少測一個成員, 必須以 downloadRouteKeys({ 成員: '理由' }) 明講理由, 不能靠不寫進陣列
 *   - 請求形狀(哪個 method、參數放 query 還是 body)也只有一份, 原本五個檔各手寫一份
 *
 * 機械化保護見 test/unit-axisCoverage.test.mjs。
 */


//downloadRoutes, 下載路由軸之成員全集
//每個成員宣告其請求形狀、回應本體形式、會走到之來源階段、會讀取之應用端欄位 ——
//「這個成員為何不適用某條測試」因此成為資料, 而非某個檔案裡的一句註解或一段空白
let downloadRoutes = {

    dw: {
        key: 'dw',
        title: 'POST /api/dw',
        //requestOf, 本路由之請求形狀
        requestOf: (port, fileId) => {
            return {
                url: `http://127.0.0.1:${port}/api/dw`,
                init: {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer t',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ fileId }),
                },
            }
        },
        //body, 回應本體之形式: stream 為串流或二進位本體, json 為 JSON 封包
        body: 'stream',
        //stages, 本路由會走到之下載來源階段(對應 src/buildDownloadSource.mjs 之階段名)
        stages: ['field', 'identify', 'state', 'pipeline', 'materialize'],
        //fields, 本路由會讀取之應用端回傳欄位; **順序即讀取與檢核之順序**(契約, 三路由各不相同, 見 src/routeSpec.mjs 與 test/unit-routeSpec.test.mjs 之對照)
        fields: ['streamRead', 'filename', 'fileSize', 'fileType'],
        //requiredFields, 缺少即視為應用端形狀錯誤之欄位(fields 之子集)
        requiredFields: ['streamRead', 'filename', 'fileSize', 'fileType'],
        //errorStatus, 各種錯誤之 HTTP 狀態碼: 本路由由 JS 解析回應, 錯誤一律 200 並以 Return-Type: error 與錯誤封包表達(帳本 R6)
        errorStatus: { permission: 200, param: 200, app: 200, output: 200 },
    },

    dwgf: {
        key: 'dwgf',
        title: 'GET /api/dwgf',
        requestOf: (port, fileId) => {
            return {
                url: `http://127.0.0.1:${port}/api/dwgf?fileId=${encodeURIComponent(fileId)}&token=t`,
                init: {
                    method: 'GET',
                    headers: {},
                },
            }
        },
        body: 'stream',
        stages: ['field', 'identify', 'state', 'pipeline', 'materialize'],
        //fields 之順序即本路由讀取與檢核之順序(契約: 多重形狀錯誤時回哪一個訊息由此決定, api-characterization 鎖住); 本路由與 /dw 不同, 原本此處誤寫成與 /dw 相同之順序(第十一輪 B2)
        fields: ['streamRead', 'fileSize', 'fileType', 'filename'],
        //filename 對本路由為選用: 未給則仍以 Content-Disposition: attachment 交付(無 filename*), 由 <a download> 或 URL 命名
        //(見 src/WConverhpServer.mjs 之 /dwgf filename 註解). 這是三路由唯一之欄位必要性差異, 故寫成資料
        requiredFields: ['streamRead', 'fileSize', 'fileType'],
        //errorStatus, 本路由之唯一消費者為瀏覽器下載管理器(只看狀態碼), 錯誤以非 2xx 表達, 使其顯示下載失敗而不把錯誤封包存成檔案(帳本 R6 之例外, 第十輪 A9)
        //本體封包與 Return-Type/Return-Msg 標頭仍同其他路由
        errorStatus: { permission: 403, param: 400, app: 404, output: 500 },
    },

    dwgfn: {
        key: 'dwgfn',
        title: 'POST /api/dwgfn',
        requestOf: (port, fileId) => {
            return {
                url: `http://127.0.0.1:${port}/api/dwgfn`,
                init: {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer t',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ fileId }),
                },
            }
        },
        //dwgfn 只取檔名回 JSON, 取得後即銷毀應用端串流, 不建 pipeline 亦不具體化
        body: 'json',
        stages: ['field'],
        fields: ['streamRead', 'filename'],
        requiredFields: ['streamRead', 'filename'],
        errorStatus: { permission: 200, param: 200, app: 200, output: 200 },
    },

}


//allRoutes, 六路由軸(供「同一種失敗 × 六路由」之行為表, 見 test/api-errorEventOnce.test.mjs)
//  apiType: verifyConn 所見之 apiType; api: handler 事件所見之 api; authFrom: 應用端所見之 authorization 來源(header 原樣 / query 之 token 由套件合成為 `<tokenType> <token>`, 第十一輪 B4)
//  parse: 本體是否由 hapi 解析(為 true 者其解析失敗須回套件錯誤封包, 第十一輪 A1; /main 為 parse:false 自行解碼亦同); appEvent: 本路由之 requestOf 直接觸發之應用端事件(無者為 null)
//  event: 本路由所服務之應用端事件(與 src/routeSpec.mjs 之 event 對照); 該事件無人接聽時請求須立即終結而不得產生副作用(第十二輪)。
//         與 appEvent 語意不同而並存: /ulctr 之 requestOf(check-slices-hash)與 /slc 不派發 upload(appEvent 為 null), 但兩者皆服務 upload 而受閘門約束
//  errorStatus: 各種錯誤之 HTTP 狀態碼(同 downloadRoutes); requestOf(port, scn): 正常形狀之請求, scn 為交予應用端之 func / fileId(以之決定應用端行為); malformedOf(port): 本體無法解析之請求(不適用者為 null)
let st200 = { permission: 200, param: 200, app: 200, output: 200, packet: 200 }
let jsonInit = (body) => ({ method: 'POST', headers: { 'Authorization': 'Bearer t', 'Content-Type': 'application/json' }, body })
let octetInit = (body, extraHeaders = {}) => ({ method: 'POST', headers: { 'Authorization': 'Bearer t', 'Content-Type': 'application/octet-stream', ...extraHeaders }, body })
let allRoutes = {
    main: {
        key: 'main',
        apiType: 'main',
        api: 'apiMain',
        event: 'execute',
        authFrom: 'header',
        parse: false,
        appEvent: 'execute',
        errorStatus: st200,
        requestOf: (port, scn) => ({ url: `http://127.0.0.1:${port}/api/main`, init: octetInit(Buffer.from(w.obj2u8arr({ func: scn, input: {} }))) }),
        malformedOf: (port) => ({ url: `http://127.0.0.1:${port}/api/main`, init: octetInit(Buffer.from('not a packet')) }),
    },
    ulctr: {
        key: 'ulctr',
        apiType: 'upload-controller',
        api: 'apiUploadCheck',
        event: 'upload',
        authFrom: 'header',
        parse: true,
        appEvent: null,
        errorStatus: st200,
        requestOf: (port) => ({ url: `http://127.0.0.1:${port}/api/ulctr`, init: jsonInit(JSON.stringify({ mode: 'check-slices-hash', fileHash: 'abcdef0123456789', fileSliceHashs: [{ i: 0, h: 'x' }] })) }),
        malformedOf: (port) => ({ url: `http://127.0.0.1:${port}/api/ulctr`, init: jsonInit('{"mode":"check-slices-hash",') }),
    },
    slc: {
        key: 'slc',
        apiType: 'upload-slice',
        api: 'apiUploadSlice',
        event: 'upload',
        authFrom: 'header',
        parse: false,
        appEvent: null,
        errorStatus: st200,
        requestOf: (port) => ({ url: `http://127.0.0.1:${port}/api/slc`, init: octetInit(Buffer.alloc(16, 1), { 'chunk-index': '0', 'chunk-total': '1', 'package-id': 'net01' }) }),
        malformedOf: () => null,
    },
    dwgfn: {
        key: 'dwgfn',
        apiType: 'download-get-filename',
        api: 'apiDownloadGetFilename',
        event: 'download',
        authFrom: 'header',
        parse: true,
        appEvent: 'download',
        errorStatus: st200,
        requestOf: (port, scn) => ({ url: `http://127.0.0.1:${port}/api/dwgfn`, init: jsonInit(JSON.stringify({ fileId: scn })) }),
        malformedOf: (port) => ({ url: `http://127.0.0.1:${port}/api/dwgfn`, init: jsonInit('{"fileId":') }),
    },
    dwgf: {
        key: 'dwgf',
        apiType: 'download-get-file',
        api: 'apiDownloadGetFile',
        event: 'download',
        authFrom: 'query',
        parse: false,
        appEvent: 'download',
        errorStatus: { permission: 403, param: 400, app: 404, output: 500, packet: 500 },
        requestOf: (port, scn) => ({ url: `http://127.0.0.1:${port}/api/dwgf?fileId=${encodeURIComponent(scn)}&token=t`, init: { method: 'GET', headers: {} } }),
        malformedOf: () => null,
    },
    dw: {
        key: 'dw',
        apiType: 'download',
        api: 'apiDownload',
        event: 'download',
        authFrom: 'header',
        parse: true,
        appEvent: 'download',
        errorStatus: st200,
        requestOf: (port, scn) => ({ url: `http://127.0.0.1:${port}/api/dw`, init: jsonInit(JSON.stringify({ fileId: scn })) }),
        malformedOf: (port) => ({ url: `http://127.0.0.1:${port}/api/dw`, init: jsonInit('{"fileId":') }),
    },
}


//ulctrModes, /ulctr 之 mode 軸之成員全集(第十二輪, 帳本 R8 / R12)
//  gated: upload 無接聽者時是否於任何副作用前即被擋(上傳管線受理新工作之請求); 不擋者以 why 寫明理由(要少測或不擋須講得出為什麼)
//  payloadOf(fileHash, queueId): 該模式之最小合法請求本體
let ulctrModes = {
    'check-total-hash': {
        gated: true,
        payloadOf: (fileHash) => ({ mode: 'check-total-hash', fileHash, filename: 'a.bin', fileSize: 16 }),
    },
    'check-slices-hash': {
        gated: true,
        payloadOf: (fileHash) => ({ mode: 'check-slices-hash', fileHash, fileSliceHashs: [{ i: 0, h: 'x' }] }),
    },
    'merge-slices-push': {
        gated: true,
        payloadOf: (fileHash) => ({ mode: 'merge-slices-push', fileHash, chunkTotal: 1 }),
    },
    'merge-slices-get': {
        gated: false,
        why: '已承接工作之查詢、結果回放與狀態復原: S3 之儲存結果回放不呼叫應用端(重送冪等), S2 在途消費由同隊列共用, 需派發者由 callApp 於派發點判定',
        payloadOf: (fileHash, queueId) => ({ mode: 'merge-slices-get', fileHash, filename: 'a.bin', queueId }),
    },
}


//downloadRouteKeys, 取下載路由軸之成員清單
//excludes 之鍵為要排除之成員、值為排除理由; 理由不可省 —— 少測一個成員必須講得出為什麼,
//且成員名打錯時直接拋錯(而非靜默少跑一輪)
let downloadRouteKeys = (excludes = {}) => {
    let ks = Object.keys(downloadRoutes)
    let exKeys = Object.keys(excludes)
    for (let k of exKeys) {
        if (!ks.includes(k)) {
            throw new Error(`downloadRouteKeys: 排除項[${k}]不是下載路由軸之成員(全集: ${ks.join(', ')})`)
        }
        let reason = excludes[k]
        if (typeof reason !== 'string' || reason.trim() === '') {
            throw new Error(`downloadRouteKeys: 排除項[${k}]未附理由`)
        }
    }
    return ks.filter((k) => !exKeys.includes(k))
}


//downloadRouteKeysRequiring, 取以指定欄位為必要之成員; excluded 為互補集
//用於「缺某欄位即為形狀錯誤」這類測試 —— 哪些路由適用由軸上的 requiredFields 決定, 不由各檔手寫
let downloadRouteKeysRequiring = (field) => {
    return Object.keys(downloadRoutes).filter((k) => downloadRoutes[k].requiredFields.includes(field))
}


//downloadRouteKeysNotRequiring, 取不以指定欄位為必要之成員
//與 downloadRouteKeysRequiring 成對, 使「另一半成員的應然」也有地方可斷言, 而不是留白
let downloadRouteKeysNotRequiring = (field) => {
    return Object.keys(downloadRoutes).filter((k) => !downloadRoutes[k].requiredFields.includes(field))
}


//downloadRouteKeysByBody, 取回應本體形式為指定值之成員
//stream 為交付檔案本體者(受 Content-Length 與串流形狀之契約約束), json 為只回封包者
let downloadRouteKeysByBody = (body) => {
    let ks = Object.keys(downloadRoutes).filter((k) => downloadRoutes[k].body === body)
    if (ks.length === 0) {
        throw new Error(`downloadRouteKeysByBody: 無任何路由之本體形式為[${body}]`)
    }
    return ks
}


//downloadRouteKeysByStage, 取會走到指定來源階段之成員
//用於只對「真的會走到該階段」的路由列舉(如 pipeline 建立階段對 /dwgfn 不成立)
let downloadRouteKeysByStage = (stage) => {
    let ks = Object.keys(downloadRoutes).filter((k) => downloadRoutes[k].stages.includes(stage))
    if (ks.length === 0) {
        throw new Error(`downloadRouteKeysByStage: 無任何路由走到階段[${stage}]`)
    }
    return ks
}


//downloadErrorStatus, 取某下載路由於某種錯誤之 HTTP 狀態碼
//kind: permission(verifyConn 未通過)、param(請求參數錯誤, 可證明不需重試)、app(應用端拒絕或無監聽器)、output(應用端交出之內容不合契約)
//why 寫成軸上的資料: 三路由對錯誤狀態碼之差異是契約(見 errorStatus 之註解), 不是某個測試檔之例外; 各檔取自此處而不各自手寫 200 或 404
let downloadErrorStatus = (route, kind) => {
    let df = downloadRoutes[route]
    if (!df) {
        throw new Error(`downloadErrorStatus: [${route}]不是下載路由軸之成員`)
    }
    if (!Object.prototype.hasOwnProperty.call(df.errorStatus, kind)) {
        throw new Error(`downloadErrorStatus: 錯誤種類[${kind}]不存在(可用: ${Object.keys(df.errorStatus).join(', ')})`)
    }
    return df.errorStatus[kind]
}


//fetchDownload, 打某下載路由並取回應之標頭與本體
//原本五個測試檔各自手寫一份請求組裝與回應拆解, 差異(有無 Accept-Encoding、有無逾時、text 之長度上限)
//是各檔需求不同而非路由不同, 故收斂為同一個函數加選項
let fetchDownload = async(port, route, fileId, opt = {}) => {

    let df = downloadRoutes[route]
    if (!df) {
        throw new Error(`fetchDownload: [${route}]不是下載路由軸之成員`)
    }

    let { url, init } = df.requestOf(port, fileId)

    //method, 允許覆寫以測 HEAD
    if (opt.method) {
        init.method = opt.method
    }

    //range, 測 Range 標頭之處理
    if (opt.range) {
        init.headers.Range = opt.range
    }

    //acceptEncoding, 重現 axios 與瀏覽器之預設行為(壓縮會使 hapi 刪除 Content-Length)
    if (opt.acceptEncoding) {
        init.headers['Accept-Encoding'] = opt.acceptEncoding
    }

    //timeoutMs, 用於偵測懸置(逾時視為 hang 而非測試失敗, 使「懸置」成為可斷言之觀察值)
    let ac = null
    let tm = null
    if (opt.timeoutMs) {
        ac = new AbortController()
        init.signal = ac.signal
        tm = setTimeout(() => ac.abort(), opt.timeoutMs)
    }

    let textLimit = opt.textLimit !== undefined ? opt.textLimit : 4096

    try {

        let r = await fetch(url, init)
        let buf = Buffer.from(await r.arrayBuffer())
        let rt = r.headers.get('return-type')

        //settleMs, eeEmit 為 setTimeout 派發, 需等待才數得到事件
        if (opt.settleMs) {
            await w.delay(opt.settleMs)
        }

        return {
            status: r.status,
            returnType: rt,
            returnMsg: r.headers.get('return-msg'),
            retryable: r.headers.get('return-retryable'),
            contentLength: r.headers.get('content-length'),
            contentEncoding: r.headers.get('content-encoding'),
            contentType: r.headers.get('content-type'),
            contentRange: r.headers.get('content-range'),
            contentDisposition: r.headers.get('content-disposition'),
            bytes: buf.length,
            text: buf.length <= textLimit ? buf.toString('utf8') : null,
            error: rt === 'error' ? u8arr2obj(new Uint8Array(buf)).error : undefined,
        }

    }
    catch (err) {
        return { hang: true, msg: err.message }
    }
    finally {
        if (tm !== null) {
            clearTimeout(tm)
        }
    }

}


//rejectShapes, 外來拒絕值之形狀軸(2026-10-14, 帳本 R8 之延伸、R29): 伺服器轉交之應用端拒絕值與 getToken 之拒絕值共用
//成員由契約與判定站點推導, 不由已知缺陷推導(經驗 E1): 契約「非 Error 者不論形狀皆原樣交出」(client 之 classifyFailure)→ 原始型別、空字串、陣列、物件;
//每個曾以值之形狀判定結局之站點 → 其觸發形狀(why 註明站點)。新增以形狀判定之站點時, 其觸發形狀須同時加入本軸
//value 為工廠, 每次呼叫產生新值(使斷言之 deepEqual 不因共用參照而失真)
let rejectShapes = {
    str: { value: () => 'plain string', why: '最常見之拒絕值' },
    emptyStr: { value: () => '', why: '空字串: 須與「被吞成空字串」以事件數區分' },
    num: { value: () => 404, why: '數字' },
    zero: { value: () => 0, why: 'falsy 之數字' },
    falsy: { value: () => false, why: 'falsy 之布林' },
    nul: { value: () => null, why: 'null(undefined 經伺服器正規化為 null, 屬 codec 之界, 見帳本已知限制 L2)' },
    arr: { value: () => ['a', 'b'], why: '陣列' },
    obj: { value: () => ({ code: 1, msg: '中文' }), why: '一般物件' },
    cancelled: { value: () => ({ reason: 'cancelled', code: 7 }), why: 'wsemi 取消家族之形狀: 修正前 pmConvertResolve 判為第三態, 以空字串結束、0 則、不重試' },
    cancelledBare: { value: () => ({ reason: 'cancelled' }), why: '同上, 只有 reason 一欄' },
    status413: { value: () => ({ response: { status: 413 } }), why: 'axios 413 之形狀: 修正前 isNoRetry 對任意值讀 response.status 而判為不需重試' },
    status413Msg: { value: () => ({ response: { status: 413 }, msg: 'upstream too large' }), why: '同上, 帶其他欄位' },
}

//rejectShapesCodec, 經伺服器 codec 之後才成形之成員: 觸發面是「抵達前端時之形狀」, 不是應用端寫下之形狀(JSON.stringify 先套 toJSON)
//value 為應用端交出之值之工廠, arrive 為前端應收到之值
let rejectShapesCodec = {
    toJSONCancelled: {
        value: () => {
            return {
                toJSON() {
                    return { reason: 'cancelled', code: 9 }
                },
            }
        },
        arrive: { reason: 'cancelled', code: 9 },
        why: '應用端之值不是取消形狀, 經 codec 後成為取消形狀',
    },
}

//rejectSequences, 嘗試序列軸: 應用端逐次之結局(第 k 次嘗試之形狀); 'ok' 代表該次 resolve
//應然由契約推得: 每次嘗試失敗恰一則事件、照常重試至成功或次數用盡(CLAUDE.md 之 failTwice 契約: 前兩次 reject、第三次 resolve, client 須最終成功)
let rejectSequences = {
    failTwiceCancelled: { seq: [{ reason: 'cancelled', code: 1 }, { reason: 'cancelled', code: 2 }, 'ok'], why: 'failTwice 契約以取消形狀實作' },
    cancelledMiddle: { seq: ['boom', { reason: 'cancelled', code: 2 }, 'ok'], why: '取消形狀出現在中間之嘗試' },
    cancelledThenFail: { seq: ['boom', 'boom2', { reason: 'cancelled', code: 3 }, 'boom4'], why: '取消形狀之後仍須重試, 最終拒絕值為最後一次之值' },
}

//hostileShapes, 惡意值之工廠: 每次呼叫產生一組新值(已撤銷之 Proxy 除參照比對外不可做任何操作)
//只用於不經 codec 之值(getToken 之拒絕值); 伺服端之應用端拒絕值經 codec 後必為錯誤封包, 另見 test/api-hostileErrorValues.test.mjs
let hostileShapes = () => {
    let rv = Proxy.revocable({}, {})
    rv.revoke()
    let reasonGetterThrows = {}
    Object.defineProperty(reasonGetterThrows, 'reason', {
        get() {
            throw new Error('reason getter boom')
        },
    })
    let toStringTagThrows = {}
    Object.defineProperty(toStringTagThrows, Symbol.toStringTag, {
        get() {
            throw new Error('toStringTag boom')
        },
    })
    let responseGetterThrows = {}
    Object.defineProperty(responseGetterThrows, 'response', {
        get() {
            throw new Error('response getter boom')
        },
    })
    return {
        revokedProxy: rv.proxy, //修正前: pmConvertResolve 讀 reason 拋錯 → 永不 settle + 未處理之 rejection
        reasonGetterThrows, //同上
        toStringTagThrows, //修正前: unwrapNoRetry 之 isobj 拋錯 → 0 則、不重試、值被換成訊息
        responseGetterThrows, //修正前: isNoRetry 讀 response.status 拋錯 → 1 則、不重試
    }
}


//r, 本檔對測試提供之軸與工具(各成員之用途; 全部皆有實際取用者, 見帳本 R23)
//  downloadRoutes                 下載三路由之成員全集與其請求形狀、欄位順序、錯誤狀態碼
//  allRoutes                      六路由之成員全集(含 apiType、handler 之 api、所服務之事件、authorization 來源、可否解析之本體)
//  ulctrModes                     /ulctr 之 mode 全集與其「無接聽者時是否被擋」(不擋者附理由)
//  downloadRouteKeys(excludes)    取下載路由之成員清單; 少測一個須以理由排除
//  downloadRouteKeysRequiring     取以某欄位為必要之成員; NotRequiring 為其互補集
//  downloadRouteKeysByBody        依回應本體形式取成員(stream 或 json)
//  downloadRouteKeysByStage       依會走到之下載來源階段取成員
//  downloadErrorStatus(route,kind) 取某路由於某種錯誤之 HTTP 狀態碼
//  fetchDownload(port,route,...)  依軸上之請求形狀打該路由並取回標頭與本體
//  rejectShapes                   外來拒絕值之形狀軸(伺服器轉交之應用端值、getToken 之值; 帳本 R8 延伸、R29)
//  rejectShapesCodec              經伺服器 codec 之後才成形之拒絕值(toJSON)
//  rejectSequences                嘗試序列軸(第 k 次嘗試之結局)
//  hostileShapes()                惡意值之工廠(getToken 之拒絕值)
let r = {
    downloadRoutes,
    allRoutes,
    ulctrModes,
    downloadRouteKeys,
    downloadRouteKeysRequiring,
    downloadRouteKeysNotRequiring,
    downloadRouteKeysByBody,
    downloadRouteKeysByStage,
    downloadErrorStatus,
    fetchDownload,
    rejectShapes,
    rejectShapesCodec,
    rejectSequences,
    hostileShapes,
}


export default r
