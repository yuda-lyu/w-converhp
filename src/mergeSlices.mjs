import path from 'path'
import fsIsFile from 'wsemi/src/fsIsFile.mjs'
import fsMergeFiles from 'wsemi/src/fsMergeFiles.mjs'
import fsGetFileXxHash from 'wsemi/src/fsGetFileXxHash.mjs'


//mergeSlices, 於 worker 內執行: 把切片依序合併至 fpOut(暫存名), 並回傳合併檔之雜湊
//why 不寫 .done、不寫至合併檔之正式名: 合併狀態載體(合併檔之正式名、.done、.error)一律由 managerMergeSlices 單一擁有,
//  其不變式為「.done 存在 ⇒ 合併檔之雜湊 = fileHash」; 本函數原本合併完即寫 .done, 是第二個寫入者且不核對內容 ——
//  用戶端送錯內容或他請求截斷切片時, 錯檔照樣被證明為完成(第十輪 D2、表三 i)
//why 雜湊於 worker 內計算: 整檔順序讀為 CPU 與 I/O 密集, 不佔主執行緒(實測 1GB 之合併約 +0.5s)
let mergeSlices = async (fileHash, chunkTotal, pathUploadTemp, fpOut) => {

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

    //mergeSlices
    let r = await fsMergeFiles(fpsIn, fpOut)
    // console.log('r', r)

    //hash, 供 managerMergeSlices 核對後才決定是否證明為完成
    let hash = await fsGetFileXxHash(fpOut)

    return {
        ...r,
        hash,
    }
}

export default mergeSlices
