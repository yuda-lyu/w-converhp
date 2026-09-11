import path from 'path'
import fs from 'fs'
import get from 'lodash-es/get.js'
import size from 'lodash-es/size.js'
import isp0int from 'wsemi/src/isp0int.mjs'
import cint from 'wsemi/src/cint.mjs'
import getFileXxHash from 'wsemi/src/getFileXxHash.mjs'
import isSafeId from './isSafeId.mjs'


let checkSlicesHash = async(fileSliceHashs, fileHash, pathUploadTemp) => {

    //check, fileHash會參與路徑組裝, 須為安全識別字(英數字)
    if (!isSafeId(fileHash)) {
        let r = {
            error: 'invalid fileHash',
        }
        return r
    }

    //check, 須為陣列
    //why: 下方以其長度為迴圈上界, 原未確認即使用 —— 請求本體 {"length":1e9} 使請求懸置、worker 空轉; JSON 之 1e999 解為 Infinity 則迴圈永不結束,
    //請求中止後 worker 仍永久佔用一核(本 worker 於函數 settle 後才 terminate)(實測第十輪 D4/A3)
    if (!Array.isArray(fileSliceHashs)) {
        let r = {
            error: 'invalid fileSliceHashs',
        }
        return r
    }

    //check, 前端須檢核, 若之前已回應無切片, 就不能再調用檢測切片hash的API
    if (size(fileSliceHashs) === 0) {
        let r = {
            error: 'no fileSliceHashs',
        }
        return r
    }

    //idsExist, 暫存夾內本檔實存之切片索引
    //why 工作量上界取自實際資料而非請求: 原逐筆 readFileSync + 雜湊且不去重, 合法形狀之重複索引 3000 筆(本體 48KB)即耗時 7s 且線性成長(實測第十輪 A4);
    //改為只處理「合法索引 ∈ 實存切片 ∧ 未處理過」者, 雜湊次數之上限為實存切片數, 其餘各筆僅為集合查詢
    //索引須為正規寫法(String(cint(s)) === s): 伺服器寫入切片時已以 cint 正規化, 非正規寫法者(如 00)不會是本套件所產
    //資料夾不在或不可讀即拋: 與 checkTotalHash 對同一失敗之處置一致(由路由層之 internal 收為一則事件 + 不含路徑之 check-slices-hash failed);
    //原本吞掉而回 {slks:[]}, 前端遂重傳全部切片後才於 /slc 逐片以寫入失敗告終(第十一輪 N11)
    let pfx = `${fileHash}_`
    let names = fs.readdirSync(pathUploadTemp)
    let idsExist = new Set()
    for (let name of names) {
        if (!name.startsWith(pfx)) {
            continue
        }
        let s = name.slice(pfx.length)
        if (isp0int(s) && String(cint(s)) === s) {
            idsExist.add(cint(s))
        }
    }

    //slksCfm, 已確定hash值一致的切片
    let slksCfm = []
    let idsDone = new Set()
    for (let k = 0; k < fileSliceHashs.length; k++) {

        //v
        let v = fileSliceHashs[k]

        //check, 切片索引須為非負整數, 否則不視為已確認(略過), 避免非法值參與路徑組裝
        let i = get(v, 'i')
        if (!isp0int(i)) {
            continue
        }
        i = cint(i)

        //check, 須為實存切片且未處理過
        if (!idsExist.has(i) || idsDone.has(i)) {
            continue
        }
        idsDone.add(i)

        //_pathFile
        let _pathFile = path.resolve(pathUploadTemp, `${fileHash}_${i}`)

        //_fileHash, 讀取失敗(如與合併並發而切片已被逐片刪除)視為未確認而略過, 不可拋: 例外訊息含伺服器絕對路徑, 會隨error回應外洩至前端
        let _fileHash = ''
        try {
            _fileHash = await getFileXxHash(new Blob([fs.readFileSync(_pathFile)])) //計算切片因檔案很小, 直接用getFileXxHash速度比較快
        }
        catch (err) {
            continue
        }

        //check
        if (get(v, 'h') === _fileHash) {
            slksCfm.push(i)
        }

    }

    //r
    let r = {
        slks: slksCfm,
    }

    return r
}


export default checkSlicesHash
