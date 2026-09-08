import path from 'path'
import fs from 'fs'
import fsIsFile from 'wsemi/src/fsIsFile.mjs'
import fsMergeFiles from 'wsemi/src/fsMergeFiles.mjs'


let mergeSlices = async (fileHash, chunkTotal, pathUploadTemp) => {

    //fpsIn
    let fpsIn = []
    for (let i = 0; i < chunkTotal; i++) {
        let fpIn = path.resolve(pathUploadTemp, `${fileHash}_${i}`)
        // console.log('fpIn', fpIn)

        //check, 逐片確認存在, 缺片即停: chunkTotal來自前端, 若先依其值配置全部路徑再交fsMergeFiles逐片檢查, 巨大值會於此耗盡記憶體使整個行程崩潰;
        //缺片本就會於fsMergeFiles失敗, 於此提前失敗結果相同(訊息格式亦相同), 陣列長度改由實際存在之切片數決定
        if (!fsIsFile(fpIn)) {
            throw new Error(`fpIn[${fpIn}] is not a file`)
        }

        fpsIn.push(fpIn)
    }
    // console.log('fpsIn', fpsIn)

    //fpOut
    let fpOut = path.resolve(pathUploadTemp, fileHash)
    // console.log('fpOut', fpOut)

    //mergeSlices
    let r = await fsMergeFiles(fpsIn, fpOut)
    // console.log('r', r)

    //writeFileSync, 因可能合併大檔, 故於合併結束後才輸出無內容之.done檔案, 可供外部輪循偵測.done檔是否存在, 藉此判識合併大檔任務是否完成
    fs.writeFileSync(`${fpOut}.done`, '', 'utf8')

    return r
}

export default mergeSlices
