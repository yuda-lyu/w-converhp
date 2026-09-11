/**
 * 六路由之差異表(單一來源)
 *
 * 供 WConverhpServer 之路由前置(ctxOf / admit)、錯誤回覆(replyOf)與下載欄位檢核(readOutput)查表;
 * 亦供 test/unit-routeSpec.test.mjs 與測試端之路由軸(test/api-axes.mjs)逐欄對照 —— 兩端各自一份, 不互相 import, 不一致即紅
 *
 * why 寫成表而非散在各路由之參數列(第十一輪 G6, 兩份複審一致): 差異(apiType 字面、handler 事件之 api 字面、authorization 之來源、錯誤狀態碼、下載欄位之讀取與檢核順序)
 * 原本手寫展開於六條路由之 40 處同型片段, 每加一條規則就得寫六遍而漏其一(第十輪 A5/A6/A9/F10 各改 3–6 處; 第十一輪 N2/N4 皆為「同一規則第二站點沒套」)。
 * 表上少一欄由測試直接對表斷言, 比數 grep 命中數有分辨力
 *
 * 欄位:
 *   apiType: verifyConn 所見之 apiType(對外契約)
 *   api: handler 事件所見之 api(對外契約)
 *   authFrom: 應用端所見之 authorization 來源 —— 'header' 為請求標頭原樣, token 為確認授權方案前綴相符後切出者(帳本 R15);
 *             'query' 為由 query 之 token 合成 `<tokenType> <token>`(/dwgf 之下載由瀏覽器導覽, 無標頭可用; 合成為刻意, 使應用端 verifyConn 於六路由所見同一形狀)
 *   statusOf: 各種錯誤之 HTTP 狀態碼 —— permission(verifyConn 未通過)、param(請求參數錯誤, 可證明不需重試, 另標示 retryable:false)、app(應用端拒絕或無人接聽)、
 *             output(應用端交出之內容不合契約)、packet(請求本體無法解析)、internal(套件內部失敗, 如回應無法序列化)。
 *             五路由由 JS 解析回應, 一律 200 並以 Return-Type 與錯誤封包表達(帳本 R6); /dwgf 之唯一消費者為瀏覽器下載管理器(只看狀態碼), 以非 2xx 表達(R6 之例外, 第十輪 A9)
 *   fields: 下載路由讀取與檢核應用端回傳欄位之**順序**(契約: 多重形狀錯誤時回哪一個訊息由此決定, 三路由各不相同, test/api-characterization.test.mjs 鎖住);
 *           optional 者判定不通過且判定本身未拋錯時視為未給
 */
let st200 = { permission: 200, param: 200, app: 200, output: 200, packet: 200, internal: 200 }

let routeSpec = {
    main: {
        apiType: 'main',
        api: 'apiMain',
        authFrom: 'header',
        statusOf: st200,
    },
    ulctr: {
        apiType: 'upload-controller',
        api: 'apiUploadCheck',
        authFrom: 'header',
        statusOf: st200,
    },
    slc: {
        apiType: 'upload-slice',
        api: 'apiUploadSlice',
        authFrom: 'header',
        statusOf: st200,
    },
    dwgfn: {
        apiType: 'download-get-filename',
        api: 'apiDownloadGetFilename',
        authFrom: 'header',
        statusOf: st200,
        fields: [{ name: 'streamRead' }, { name: 'filename' }],
    },
    dwgf: {
        apiType: 'download-get-file',
        api: 'apiDownloadGetFile',
        authFrom: 'query',
        statusOf: { permission: 403, param: 400, app: 404, output: 500, packet: 500, internal: 500 },
        fields: [{ name: 'streamRead' }, { name: 'fileSize' }, { name: 'fileType' }, { name: 'filename', optional: true }],
    },
    dw: {
        apiType: 'download',
        api: 'apiDownload',
        authFrom: 'header',
        statusOf: st200,
        fields: [{ name: 'streamRead' }, { name: 'filename' }, { name: 'fileSize' }, { name: 'fileType' }],
    },
}


export default routeSpec
