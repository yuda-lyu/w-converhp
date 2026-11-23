/**
 * 假後端(測試共用層, 不帶 .test. 中綴): 對任何 POST 回固定之本套件封包, 模擬「回應形狀不合」之後端
 *
 * 用途: 真實之 WConverhpServer 恆回有 output 鍵之封包, 逼不出 client 之 `invalid msg.output`、`msg is not an effective object` 等診斷;
 * 以本假後端回 `obj`(經 wsemi 之 obj2u8arr 編碼, 與真伺服器同一封包格式)即可。api 測試與 e2e 測試共用(同一 helper 只定義一次)。
 * 瀏覽器端(跨來源)須 cors: true: 回 CORS 標頭並回應預檢(OPTIONS)。
 */
import http from 'http'
import w from 'wsemi'


/**
 * 啟動假後端
 *
 * @param {Object} opt 輸入設定物件
 * @param {Integer} opt.port 輸入監聽埠(呼叫端自 test/tools/ports.mjs 取得)
 * @param {String} [opt.host='127.0.0.1'] 輸入監聽位址
 * @param {Object} opt.obj 輸入要編碼為回應封包之物件, 如 { success: { func: 'f' } }
 * @param {Boolean} [opt.cors=false] 輸入是否回 CORS 標頭與預檢, 瀏覽器端跨來源時須為 true
 * @returns {Promise<Object>} 回傳 { setObj(obj), close() }: setObj 更換其後回應之封包, close 關閉(含閒置連線)
 */
async function startFakeApi({ port, host = '127.0.0.1', obj, cors = false }) {
    let packet = Buffer.from(w.obj2u8arr(obj))
    let hdCors = {}
    if (cors) {
        hdCors = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'authorization, content-type',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
        }
    }
    let srv = http.createServer((req, res) => {
        if (req.method === 'OPTIONS') {
            res.writeHead(204, hdCors)
            res.end()
            return
        }
        req.resume()
        req.on('end', () => {
            res.writeHead(200, { 'Content-Type': 'application/octet-stream', ...hdCors })
            res.end(packet)
        })
    })
    await new Promise((resolve) => srv.listen(port, host, resolve))
    let setObj = (o) => {
        packet = Buffer.from(w.obj2u8arr(o))
    }
    let close = () => {
        return new Promise((resolve) => {
            srv.close(resolve)
            srv.closeAllConnections()
        })
    }
    return { setObj, close }
}


let r = {
    startFakeApi,
}


export default r
