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

    //bAllExist
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

    //bAllSize
    let bAllSize = false
    if (bAllExist) {
        // console.log(`check size for pathFile[${pathFile}]...`)

        //_fileSize
        let stats = fs.statSync(pathFile)
        let _fileSize = stats.size

        //bAllSize
        bAllSize = fileSize === _fileSize

        // console.log(`check size for pathFile[${pathFile}] done`, bAllSize)
    }

    //bAllHash
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

    //vfps
    let vfps = fsGetFilesInFolder(pathUploadTemp)
    // console.log('vfps', vfps)

    //slks
    let slks = []
    if (true) {
        each(vfps, (v) => {
            let b1 = (v.name).indexOf(`${fileHash}_`) >= 0
            let stats = fs.statSync(v.path)
            let b2 = stats.size === sizeSlice
            let b = b1 && b2
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

    //bSls
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
