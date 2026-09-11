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
export let downloadRoutes = {

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
        //fields, 本路由會讀取之應用端回傳欄位
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
        fields: ['streamRead', 'filename', 'fileSize', 'fileType'],
        //filename 對本路由為選用: 未給則不帶 Content-Disposition, 由 <a download> 或 URL 命名(向後相容,
        //見 src/WConverhpServer.mjs 之 /dwgf filename 註解). 這是三路由唯一之欄位必要性差異, 故寫成資料
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


//downloadRouteKeys, 取下載路由軸之成員清單
//excludes 之鍵為要排除之成員、值為排除理由; 理由不可省 —— 少測一個成員必須講得出為什麼,
//且成員名打錯時直接拋錯(而非靜默少跑一輪)
export let downloadRouteKeys = (excludes = {}) => {
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
export let downloadRouteKeysRequiring = (field) => {
    return Object.keys(downloadRoutes).filter((k) => downloadRoutes[k].requiredFields.includes(field))
}


//downloadRouteKeysNotRequiring, 取不以指定欄位為必要之成員
//與 downloadRouteKeysRequiring 成對, 使「另一半成員的應然」也有地方可斷言, 而不是留白
export let downloadRouteKeysNotRequiring = (field) => {
    return Object.keys(downloadRoutes).filter((k) => !downloadRoutes[k].requiredFields.includes(field))
}


//downloadRouteKeysByBody, 取回應本體形式為指定值之成員
//stream 為交付檔案本體者(受 Content-Length 與串流形狀之契約約束), json 為只回封包者
export let downloadRouteKeysByBody = (body) => {
    let ks = Object.keys(downloadRoutes).filter((k) => downloadRoutes[k].body === body)
    if (ks.length === 0) {
        throw new Error(`downloadRouteKeysByBody: 無任何路由之本體形式為[${body}]`)
    }
    return ks
}


//downloadRouteKeysByStage, 取會走到指定來源階段之成員
//用於只對「真的會走到該階段」的路由列舉(如 pipeline 建立階段對 /dwgfn 不成立)
export let downloadRouteKeysByStage = (stage) => {
    let ks = Object.keys(downloadRoutes).filter((k) => downloadRoutes[k].stages.includes(stage))
    if (ks.length === 0) {
        throw new Error(`downloadRouteKeysByStage: 無任何路由走到階段[${stage}]`)
    }
    return ks
}


//downloadErrorStatus, 取某下載路由於某種錯誤之 HTTP 狀態碼
//kind: permission(verifyConn 未通過)、param(請求參數錯誤, 可證明不需重試)、app(應用端拒絕或無監聽器)、output(應用端交出之內容不合契約)
//why 寫成軸上的資料: 三路由對錯誤狀態碼之差異是契約(見 errorStatus 之註解), 不是某個測試檔之例外; 各檔取自此處而不各自手寫 200 或 404
export let downloadErrorStatus = (route, kind) => {
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
export let fetchDownload = async(port, route, fileId, opt = {}) => {

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
