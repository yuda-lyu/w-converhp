import path from 'path'
import fsMergeFiles from 'wsemi/src/fsMergeFiles.mjs'


let mergeFiles = async (pathUploadTemp, packageId, chunkTotal, filename) => {

    //fpsIn
    let fpsIn = []
    for (let i = 0; i < chunkTotal; i++) {
        let fpIn = path.join(pathUploadTemp, `${packageId}_${i}`)
        // console.log('fpIn', fpIn)
        fpsIn.push(fpIn)
    }
    // console.log('fpsIn', fpsIn)

    //fpOut
    let fpOut = path.join(pathUploadTemp, packageId)
    // console.log('fpOut', fpOut)

    //fsMergeFiles
    let r = await fsMergeFiles(filename, fpsIn, fpOut)
    // console.log('r', r)

    return r
}

export default mergeFiles
