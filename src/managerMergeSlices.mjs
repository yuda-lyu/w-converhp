import path from 'path'
import fs from 'fs'
import get from 'lodash-es/get.js'
import now2strp from 'wsemi/src/now2strp.mjs'
import genID from 'wsemi/src/genID.mjs'
import sep from 'wsemi/src/sep.mjs'
import isestr from 'wsemi/src/isestr.mjs'
import fsIsFile from 'wsemi/src/fsIsFile.mjs'
import fsDeleteFile from 'wsemi/src/fsDeleteFile.mjs'
import isSafeId from './isSafeId.mjs'
// import mergeSlices from './mergeSlices.mjs'
import mergeSlices from './mergeSlices.wk.umd.js'


//merging, 合併進行中之合併檔路徑集合(記憶體內), 供qPush避免重入; 以路徑為鍵使同行程內多個伺服器實例(不同pathUploadTemp)互不影響; 行程重啟即清空, 已完成者另由.done判定
let merging = new Set()

//qPush
let qPush = (fileHash, chunkTotal, pathUploadTemp) => {

    //id, 使用fileHash代表不用佇列儲存, 通過id即可解析反查
    let id = `${now2strp()}|${genID(6)}|${fileHash}`

    //fp, fpd, fpe, 合併檔、成功態.done、失敗態.error
    let fp = path.resolve(pathUploadTemp, fileHash)
    let fpd = path.resolve(pathUploadTemp, `${fileHash}.done`)
    let fpe = path.resolve(pathUploadTemp, `${fileHash}.error`)

    //check, 重入保護: 同一合併檔已在合併中即不再啟動
    //why: 合併以寫入模式開啟輸出檔, 第二次合併開檔當下就把第一次的結果截斷, 且切片已被第一次合併逐片刪除, 第二次必於第零片失敗而寫.error,
    //使已完成或進行中的合併被回報為失敗並需整檔重傳; 觸發路徑為push之回應遺失後client重試, 或同檔並發上傳。直接回傳id, 由get走既有判定
    if (merging.has(fp)) {
        return id
    }

    //check, 已完成(合併檔與.done同時存在且無失敗態)亦不再啟動, 理由同上; 有失敗態則屬失敗後補傳再push之正規路徑, 須重新合併
    let bErr = fsIsFile(fpe)
    if (!bErr && fsIsFile(fp) && fsIsFile(fpd)) {
        return id
    }

    //清除前一次合併殘留之失敗態, 否則本次重新合併會被舊的失敗態誤判
    if (bErr) {
        fsDeleteFile(fpe)
    }

    //merging, 於脫勾前即登記, 使同一tick內之重複push亦被擋下
    merging.add(fp)

    //setTimeout, 脫勾觸發
    setTimeout(() => {
        mergeSlices(fileHash, chunkTotal, pathUploadTemp)
            .catch((err) => {
                console.log(err)

                //失敗須落地為.error, 否則.done永不出現, qGet只能回merging, 前端會無止境等待一件不會發生的事
                let msg = isestr(err) ? err : get(err, 'message', String(err))
                try {
                    fs.writeFileSync(fpe, msg, 'utf8')
                }
                catch (e) {
                    console.log(`can not write ${fpe}`, e)
                }

            })
            .finally(() => {
                merging.delete(fp) //合併結束(不論成敗)才解除, 期間之重複push皆為no-op; 成功者之後由.done擋, 失敗者之後由.error路徑重新合併
            })
    }, 1)

    return id
}

//qGet
let qGet = (id, pathUploadTemp) => {
    let errTemp = ''

    //check
    if (!isestr(id)) {
        errTemp = `invalid id[${id}]`
        console.log(errTemp)
        return {
            state: 'error',
            msg: errTemp,
            path: '',
        }
    }

    //fileHash, 自前端回傳之id解析, 會參與路徑組裝, 須為安全識別字(英數字), 否則可 ../ 逸出資料夾
    let s = sep(id, '|')
    let fileHash = get(s, 2, '')
    if (!isSafeId(fileHash)) {
        errTemp = `invalid fileHash in id[${id}]`
        console.log(errTemp)
        return {
            state: 'error',
            msg: 'invalid queueId', //不回傳細節
            reason: errTemp,
            path: '',
        }
    }

    //fp
    let fp = path.resolve(pathUploadTemp, fileHash)
    // console.log('fp', fp)

    //fpd
    let fpd = path.resolve(pathUploadTemp, `${fileHash}.done`)
    // console.log('fpd', fpd)

    //fpe, 合併失敗態, 先於成功態判定: 有失敗態即回error並附原因, 讓前端能終止輪詢
    let fpe = path.resolve(pathUploadTemp, `${fileHash}.error`)
    if (fsIsFile(fpe)) {
        let msg = ''
        try {
            msg = fs.readFileSync(fpe, 'utf8')
        }
        catch (e) {}
        return {
            state: 'error',
            msg: 'merge slices failed', //不含路徑與底層細節(底層訊息含伺服器絕對路徑), 細節置於reason供伺服器端以error事件通知應用端
            reason: msg,
            path: fp,
        }
    }

    //bfp, bfpd, b
    let bfp = fsIsFile(fp)
    let bfpd = fsIsFile(fpd)
    let b = bfp && bfpd //記得要同時偵測fp與fpd, 否則有些已經移動fp但fpd忘記刪, 就會造成誤判

    //check, 若有.done檔但沒合併檔, 就代表合併檔已被處理或移動, .done檔須自動刪除
    if (!bfp && bfpd) {
        fsDeleteFile(fpd)
    }

    //check, 若已經完成任務, 且外部調用get取得完成訊息, 則可自動刪除.done檔, 但因不能保證合併後有完成再處理動作, 例如移動至處理資料夾再處理, 故保留.done檔
    if (b) {
        // fsDeleteFile(fpd)
    }

    return {
        state: b ? 'success' : 'merging',
        msg: '',
        path: fp,
    }
}

let r = {
    push: qPush,
    get: qGet,
}


export default r
