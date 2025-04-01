import path from 'path'
import fs from 'fs'
import genPm from 'wsemi/src/genPm.mjs'
import isestr from 'wsemi/src/isestr.mjs'
import fsIsFile from 'wsemi/src/fsIsFile.mjs'
import fsDeleteFile from 'wsemi/src/fsDeleteFile.mjs'


let mergeFiles = async (pathUploadTemp, packageId, chunkTotal, filename) => {
    let errTemp = ''

    let pm = genPm()

    //pathFileMerge
    let pathFileMerge = path.join(pathUploadTemp, packageId)
    // console.log('pathFileMerge', pathFileMerge)

    //fileStream
    let fileStream = fs.createWriteStream(pathFileMerge)
    // console.log(`merge filename[${filename}] start`)

    //使用try catch攔截，使stream能完整創造與結束
    try {
        for (let i = 0; i < chunkTotal; i++) {
            // console.log(`merge ${i + 1}/${chunkTotal}`)

            //chunkIndex
            let chunkIndex = i

            //pathFileChunk
            let pathFileChunk = path.join(pathUploadTemp, `${packageId}_${chunkIndex}`)

            //check
            if (!fsIsFile(pathFileChunk)) {
                // console.log(`pathFileChunk[${pathFileChunk}] is not a file`)
                throw new Error(`missing chunk ${i} of filename[${filename}]`)
            }

            // console.log(`merging chunk[${chunkIndex + 1}/${chunkTotal}]...`)

            //chunkData
            let chunkData = fs.readFileSync(pathFileChunk)

            //write
            fileStream.write(chunkData)

            //fsDeleteFile
            fsDeleteFile(pathFileChunk)

            // console.log(`merge chunk[${chunkIndex + 1}/${chunkTotal}] done`)
        }
    }
    catch (err) {
        errTemp = err.message
    }

    //end
    fileStream.end()

    //error
    fileStream.on('error', (err) => {
        errTemp = err.message
    })

    //finish, end之後檔案未必完成寫入, 得要監聽finish才能確定寫入檔案完成
    fileStream.on('finish', () => {
        // console.log(`merge filename[${filename}] end`)

        //check
        if (isestr(errTemp)) {

            //reject
            pm.reject(errTemp)

        }
        else {

            //r
            let r = {
                filename,
                path: pathFileMerge,
            }
            // let s = fs.statSync(pathFileMerge)
            // console.log('s.size', s.size)

            //resolve
            pm.resolve(r)

        }

    })

    return pm
}

export default mergeFiles
