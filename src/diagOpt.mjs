/**
 * 讀使用端之診斷輸出設定(logDetail、funLog), 回傳只含此兩鍵之純物件
 *
 * 規格〈診斷輸出與遮罩〉D1: 診斷輸出之出口一律用 wsemi 之 getDiag, 本套件不另寫等價實作; 本函數只負責「由使用端之建構選項取出 getDiag 所讀之兩個鍵」,
 * 使 getDiag(本套件之出口)與 wsemi 之 evEmit(監聽器拋錯之通報, 其 opt 亦讀此兩鍵)讀到同一組設定(帳本 R33 之單一擁有者)。
 * 各鍵各自 try 讀取: 選項物件為不可讀之值(已撤銷之 Proxy、拋錯之 getter)時視為未給, 不使建構子拋錯(與 getDiag 對 opt 之處置一致)。
 *
 * @param {Object} [opt={}] 輸入使用端之建構選項, 預設{}
 * @returns {Object} 回傳 { logDetail, funLog }(未給或讀取失敗者為 undefined)
 */
function pickDiagOpt(opt) {
    let r = {}
    for (let k of ['logDetail', 'funLog']) {
        try {
            r[k] = opt[k]
        }
        catch (err) {
            r[k] = undefined
        }
    }
    return r
}


export default pickDiagOpt
