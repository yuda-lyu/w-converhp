import path from 'path'
import fs from 'fs'
import fsMergeFiles from 'wsemi/src/fsMergeFiles.mjs'


let mergeSlices = async (fileHash, chunkTotal, pathUploadTemp) => {

    //fpsIn
    let fpsIn = []
    for (let i = 0; i < chunkTotal; i++) {
        let fpIn = path.join(pathUploadTemp, `${fileHash}_${i}`)
        // console.log('fpIn', fpIn)
        fpsIn.push(fpIn)
    }
    // console.log('fpsIn', fpsIn)

    //fpOut
    let fpOut = path.join(pathUploadTemp, fileHash)
    // console.log('fpOut', fpOut)

    //mergeSlices
    let r = await fsMergeFiles(fileHash, fpsIn, fpOut)
    // console.log('r', r)

    //writeFileSync, 因可能合併大檔, 故於合併結束後才輸出無內容之.done檔案, 可供外部輪循偵測.done檔是否存在, 藉此判識合併大檔任務是否完成
    fs.writeFileSync(`${fpOut}.done`, '', 'utf8')

    return r
}

export default mergeSlices
