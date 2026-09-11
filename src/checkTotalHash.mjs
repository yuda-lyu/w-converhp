import path from 'path'
import fs from 'fs'
import each from 'lodash-es/each.js'
import size from 'lodash-es/size.js'
import last from 'lodash-es/last.js'
import sep from 'wsemi/src/sep.mjs'
import isp0int from 'wsemi/src/isp0int.mjs'
import cint from 'wsemi/src/cint.mjs'
import fsIsFile from 'wsemi/src/fsIsFile.mjs'
import fsGetFilesInFolder from 'wsemi/src/fsGetFilesInFolder.mjs'
import fsGetFileXxHash from 'wsemi/src/fsGetFileXxHash.mjs'


let checkTotalHash = async (fileSize, sizeSlice, fileHash, pathUploadTemp) => {

    //pathFile
    let pathFile = path.resolve(pathUploadTemp, fileHash)
    // console.log('pathFile', pathFile)

    //bAllExist, 確認完整檔是否存在
    let bAllExist = false
    if (true) {
        // console.log(`check exist for pathFile[${pathFile}]...`)

        bAllExist = fsIsFile(pathFile)

        // console.log(`check exist for pathFile[${pathFile}] done`, bAllExist)
    }

    //check, 檢核與正規化須成對(見帳本R4b)
    //why: 原以isnum檢核, 其接受數字字串('1048576'為true)、負數與小數; 而下方以 fileSize === _fileSize 與 fs.statSync().size 比較,
    //數字字串於嚴格相等下恆為false → bAllSize恆假 → bAllHash恆假 → **整檔去重路徑靜默失效, 已上傳過之大檔每次重傳**
    //改採與isValidFileSize同一述詞(isp0int之安全模式), 使值域與本套件其他處一致, 再以cint正規化後才可用於嚴格相等
    if (!isp0int(fileSize, { useLimitSafe: true })) {
        // console.log('invalid fileSize in payload')
        let r = {
            error: 'invalid fileSize in payload',
        }
        return r
    }
    fileSize = cint(fileSize)

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
            //若是有檔案被佔用或鎖定、移動、被刪除等, 可能觸發EPERM: operation not permitted
            console.log(`check total file size: fs.statSync(pathFile)`, pathFile, err)
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
    if (!bAllHash) {

        //vfps
        let vfps = fsGetFilesInFolder(pathUploadTemp)
        // console.log('vfps', vfps)

        each(vfps, (v) => {

            //b1, 須為startsWith而非indexOf(...)>=0: 後者使 <其他前綴><fileHash>_<n> 亦命中,
            //而下方以 sep(v.name, `${fileHash}_`) 取末段解析索引時會把它當成本檔之切片
            let b1 = (v.name).startsWith(`${fileHash}_`)

            //b2
            let b2 = false
            try {
                let stats = fs.statSync(v.path)
                b2 = stats.size === sizeSlice
            }
            catch (err) {
                //若是有檔案被佔用或鎖定、移動、被刪除等, 可能觸發EPERM: operation not permitted
                console.log(`check each file size: fs.statSync(pathFile)`, v.path, err)
            }

            //b
            let b = b1 && b2

            //check
            if (b) {
                let s = sep(v.name, `${fileHash}_`)
                let i = last(s)

                //check, 解析不出索引者略過而非拋錯
                //why: 原為 throw, 而同一函數之上方對「fileSize非法」是回 { error } —— 同一函數內兩種失敗兩種處置(對稱破缺, 見帳本R6);
                //且該例外會逸出至路由層, 使整個 check-total-hash 失敗。暫存夾內出現非本套件所產之同前綴檔案不應使去重整個中止,
                //略過即可(與 checkSlicesHash.mjs:43 對非法切片索引之 continue 一致)
                if (!isp0int(i)) {
                    console.log(`skip file[${v.name}]: can not parse chunk index`)
                    return
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
