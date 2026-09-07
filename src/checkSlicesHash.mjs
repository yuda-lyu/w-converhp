import path from 'path'
import fs from 'fs'
import get from 'lodash-es/get.js'
import size from 'lodash-es/size.js'
import isp0int from 'wsemi/src/isp0int.mjs'
import fsIsFile from 'wsemi/src/fsIsFile.mjs'
import getFileXxHash from 'wsemi/src/getFileXxHash.mjs'
import isSafeId from './isSafeId.mjs'


let checkSlicesHash = async(fileSliceHashs, fileHash, pathUploadTemp) => {

    //check, fileHash會參與路徑組裝, 須為安全識別字(英數字)
    if (!isSafeId(fileHash)) {
        let r = {
            error: 'invalid fileHash',
        }
        return r
    }

    //check, 前端須檢核, 若之前已回應無切片, 就不能再調用檢測切片hash的API
    if (size(fileSliceHashs) === 0) {
        let r = {
            error: 'no fileSliceHashs',
        }
        return r
    }

    //slksCfm, 已確定hash值一致的切片
    // console.log(`check hash for slices fileHash[${fileHash}]...`, fileSliceHashs[0], size(fileSliceHashs))
    let slksCfm = []
    // let n = Math.max(fileSliceHashs.length, 1)
    // let nr = Math.floor(n / 100)
    for (let k = 0; k < fileSliceHashs.length; k++) {
        // if (k % nr === 0) {
        //     console.log(`calc hash for slices`, (k / fileSliceHashs.length * 100).toFixed(1), '%')
        // }

        //v
        let v = fileSliceHashs[k]

        //check, 切片索引須為非負整數, 否則不視為已確認(略過), 避免非法值參與路徑組裝
        if (!isp0int(get(v, 'i'))) {
            continue
        }

        //_pathFile
        let _pathFile = path.resolve(pathUploadTemp, `${fileHash}_${v.i}`)
        // console.log('_pathFile', _pathFile)

        //check, 切片不存在即視為未確認(略過), 不可讓readFileSync拋錯: 其ENOENT訊息含伺服器絕對路徑, 會隨error回應外洩至前端
        if (!fsIsFile(_pathFile)) {
            continue
        }

        //_fileHash
        let _fileHash = ''
        // await calcFileHash(_pathFile)
        await getFileXxHash(new Blob([fs.readFileSync(_pathFile)])) //計算切片因檔案很小, 直接用getFileXxHash速度比較快
            .then((res) => {
                _fileHash = res
            })
            .catch((err) => {
                console.log(`fsIsFile(_pathFile)`, _pathFile, fsIsFile(_pathFile))
                console.log(err)
            })
        // console.log('_fileHash', _fileHash)

        //check
        if (v.h === _fileHash) {
            slksCfm.push(v.i)
        }
        // else {
        //     console.log(`hash is not equal`, `hash(front)`, v.h, `hash(backend)`, _fileHash)
        // }

    }
    // console.log(`check hash for slices fileHash[${fileHash}] done`, slksCfm[0], size(slksCfm))

    //r
    let r = {
        slks: slksCfm,
    }

    return r
}


export default checkSlicesHash
