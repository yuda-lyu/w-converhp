import path from 'path'
import fs from 'fs'
import each from 'lodash-es/each.js'
import size from 'lodash-es/size.js'
import last from 'lodash-es/last.js'
import sep from 'wsemi/src/sep.mjs'
import isnum from 'wsemi/src/isnum.mjs'
import isp0int from 'wsemi/src/isp0int.mjs'
import cint from 'wsemi/src/cint.mjs'
import fsIsFile from 'wsemi/src/fsIsFile.mjs'
import fsGetFilesInFolder from 'wsemi/src/fsGetFilesInFolder.mjs'
import fsGetFileXxHash from 'wsemi/src/fsGetFileXxHash.mjs'


let checkTotalHash = async (fileSize, sizeSlice, fileHash, pathUploadTemp) => {

    //pathFile
    let pathFile = path.join(pathUploadTemp, fileHash)
    // console.log('pathFile', pathFile)

    //bAllExist, 確認完整檔是否存在
    let bAllExist = false
    if (true) {
        // console.log(`check exist for pathFile[${pathFile}]...`)

        bAllExist = fsIsFile(pathFile)

        // console.log(`check exist for pathFile[${pathFile}] done`, bAllExist)
    }

    //check
    if (!isnum(fileSize)) {
        // console.log('invalid fileSize in payload')
        let r = {
            error: 'invalid fileSize in payload',
        }
        return r
    }

    //bAllSize, 確認完整檔大小是否一致
    let bAllSize = false
    if (bAllExist) {
        // console.log(`check size for pathFile[${pathFile}]...`)

        //_fileSize
        let _fileSize = -1
        try {
            let stats = fs.statSync(pathFile)
            _fileSize = stats.size
        }
        catch (err) {
            // console.log(err)
        }

        //bAllSize
        bAllSize = fileSize === _fileSize

        // console.log(`check size for pathFile[${pathFile}] done`, bAllSize)
    }

    //bAllHash, 確認完整檔hash值是否一致
    let bAllHash = false
    if (bAllExist && bAllSize) {
        // console.log(`check hash for pathFile[${pathFile}]...`)

        //bAllHash
        await fsGetFileXxHash(pathFile)
            .then((_fileHash) => {
                bAllHash = fileHash === _fileHash
            })
            .catch((err) => {
                console.log(`fsIsFile(pathFile)`, pathFile, fsIsFile(pathFile))
                console.log(err)
                bAllHash = false
            })

        // console.log(`check hash for pathFile[${pathFile}] done`, bAllHash)
    }

    //slks, 若完整檔hash值不一致, 則紀錄各切片滿足切片大小時之代號(chunkIndex)
    let slks = []
    if (!bAllHash) { //

        //vfps
        let vfps = fsGetFilesInFolder(pathUploadTemp)
        // console.log('vfps', vfps)

        each(vfps, (v) => {

            //b1
            let b1 = (v.name).indexOf(`${fileHash}_`) >= 0

            //b2
            let b2 = false
            try {
                let stats = fs.statSync(v.path)
                b2 = stats.size === sizeSlice
            }
            catch (err) {
                console.log(err)
            }

            //b
            let b = b1 && b2

            //check
            if (b) {
                let s = sep(v.name, `${fileHash}_`)
                let i = last(s)
                if (!isp0int(i)) {
                    console.log('v.name', v.name)
                    console.log('s', s)
                    throw new Error(`can not parse index in v.name[${v.name}]`)
                }
                i = cint(i)
                slks.push(i)
            }

        })

    }
    // console.log('slks', slks)

    //bSls, 若完整檔hash值不一致, 則計算是否有任一切片有滿足切片大小
    let bSls = size(slks) > 0
    // console.log('bSls', bSls)

    //r
    let r = {
        path: pathFile,
        bAllExist,
        bAllSize,
        bAllHash,
        bSls,
        slks,
    }

    return r
}


export default checkTotalHash
