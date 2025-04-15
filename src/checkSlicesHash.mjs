import path from 'path'
import fs from 'fs'
import size from 'lodash-es/size.js'
import fsIsFile from 'wsemi/src/fsIsFile.mjs'
import getFileXxHash from 'wsemi/src/getFileXxHash.mjs'


let checkSlicesHash = async(fileSliceHashs, fileHash, pathUploadTemp) => {

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

        //_pathFile
        let _pathFile = path.join(pathUploadTemp, `${fileHash}_${v.i}`)
        // console.log('_pathFile', _pathFile)

        //_fileHash
        let _fileHash = ''
        // await calcFileHash(_pathFile)
        await getFileXxHash(new Blob([fs.readFileSync(_pathFile)])) //計算切片因檔案很小, 直接用getFileXxHash速度比較快
            .then((res) => {
                _fileHash = res
            })
            .catch((err) => {
                console.log(err)
                console.log(`fsIsFile(_pathFile)`, _pathFile, fsIsFile(_pathFile))
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
