import path from 'path' //native lib要用動態import加載
import fs from 'fs' //native lib要用動態import加載
import isestr from 'wsemi/src/isestr.mjs'
import fsIsFile from 'wsemi/src/fsIsFile.mjs'
import fsDeleteFile from 'wsemi/src/fsDeleteFile.mjs'


let mergeFiles = async (pathUploadTemp, packageId, chunkTotal, filename) => {
    let errTemp = ''

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
    // console.log(`merge filename[${filename}] done`)

    //check
    if (isestr(errTemp)) {
        return Promise.reject(errTemp)
    }

    //r
    let r = {
        // message: `Merged filename[${filename}] successfully`,
        filename,
        path: pathFileMerge,
    }

    return r
}

export default mergeFiles
