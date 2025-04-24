import path from 'path'
import get from 'lodash-es/get.js'
import now2strp from 'wsemi/src/now2strp.mjs'
import genID from 'wsemi/src/genID.mjs'
import sep from 'wsemi/src/sep.mjs'
import isestr from 'wsemi/src/isestr.mjs'
import fsIsFile from 'wsemi/src/fsIsFile.mjs'
import fsDeleteFile from 'wsemi/src/fsDeleteFile.mjs'
// import mergeSlices from './mergeSlices.mjs'
import mergeSlices from './mergeSlices.wk.umd.js'


//qPush
let qPush = (fileHash, chunkTotal, pathUploadTemp) => {

    //id, 使用fileHash代表不用佇列儲存, 通過id即可解析反查
    let id = `${now2strp()}|${genID(6)}|${fileHash}`

    //setTimeout, 脫勾觸發
    setTimeout(() => {
        mergeSlices(fileHash, chunkTotal, pathUploadTemp)
            .catch((err) => {
                console.log(err)
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

    //fileHash
    let s = sep(id, '|')
    let fileHash = get(s, 2, '')
    if (!isestr(fileHash)) {
        errTemp = `can not find fileHash in id[${id}]`
        console.log(errTemp)
        return {
            state: 'error',
            msg: errTemp,
            path: '',
        }
    }

    //fp
    let fp = path.resolve(pathUploadTemp, fileHash)
    // console.log('fp', fp)

    //fpd
    let fpd = path.resolve(pathUploadTemp, `${fileHash}.done`)
    // console.log('fpd', fpd)

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
