import path from 'path'
import fs from 'fs'
import get from 'lodash-es/get.js'
import size from 'lodash-es/size.js'
import now2strp from 'wsemi/src/now2strp.mjs'
import genID from 'wsemi/src/genID.mjs'
import sep from 'wsemi/src/sep.mjs'
import isestr from 'wsemi/src/isestr.mjs'
import getErrorMessage from 'wsemi/src/getErrorMessage.mjs'
import isfun from 'wsemi/src/isfun.mjs'
import isobj from 'wsemi/src/isobj.mjs'
import haskey from 'wsemi/src/haskey.mjs'
import fsIsFile from 'wsemi/src/fsIsFile.mjs'
import fsDeleteFile from 'wsemi/src/fsDeleteFile.mjs'
import fsGetFileXxHash from 'wsemi/src/fsGetFileXxHash.mjs'
import obj2u8arr from 'wsemi/src/obj2u8arr.mjs'
import u8arr2obj from 'wsemi/src/u8arr2obj.mjs'
import isSafeId from './isSafeId.mjs'
// import mergeSlices from './mergeSlices.mjs'
import mergeSlices from './mergeSlices.wk.umd.js'


//合併佇列之狀態空間: 以 fileHash 為合併任務, 以 queueId(一次 push 所發)為隊列, 一次 upload 對應一個隊列
//  磁碟(pathUploadTemp 下, 皆以 fileHash 為名):
//    fp  合併檔
//    fpd <fileHash>.done  合併完成, 由合併程序寫入, 內容為空
//    fpe <fileHash>.error 合併失敗, 內容為原因
//    fpr <fileHash>.q<隊列>.ro  本隊列已消費(應用端 upload 事件已成功處理)之結果, 內容為 obj2u8arr({ ro })
//  記憶體: merging(合併或驗證進行中之 fp), consuming(消費進行中之 queueId → promise); 行程重啟即清空, 磁碟狀態不受影響
//  qGet 依下列順序判定, 每一狀態皆有終結或進行中之明確回答, 不存在「永遠 merging」:
//    S3 fpr 在                 → success(儲存之結果), 不再呼叫應用端: 回應遺失後重送、逾時重送、遲到重送皆得與首次相同之結果(冪等)
//    S5 fpe 在                 → error 'merge slices failed'(終結; 補傳後 push 會清 fpe 重新合併)
//    S1 merging 有 fp          → merging(進行中)
//    S7/S6 fp 在、fpd 不在     → 以 fileHash(即整檔 xxhash)驗證 fp: 一致(合併完成後寫 fpd 前中止)→ 補寫 fpd 轉 S2; 不一致(合併中中止之殘檔)→ 寫 fpe 轉 S5
//    S2 fp 在、fpd 在          → 消費: 呼叫應用端(同一 queueId 之併發查詢共用同一次呼叫), 成功即寫 fpr 並回 success; 應用端拒絕原樣向外拋且不寫 fpr(依重試原則由前端重送再呼叫)
//    S4 fp 不在、fpd 在        → error 'merged file already consumed'(終結; 合併檔已被其他隊列消費後由應用端移走, 本隊列無儲存結果, 前端須重新上傳)
//    S0 皆不在                 → error 'no merge task'(終結; 從未 push, 或產物已被清除)
//  fpd 與 fpr 為狀態載體, qGet 不刪除; 新一次合併(fp 不在或合併失敗後補傳)由合併程序重寫 fpd, fpr 保留供舊隊列之遲到重送
//  另一入口 check-total-hash(整檔已存在之去重路徑)每次 upload 皆呼叫應用端, 為刻意設計, 不在本佇列狀態內

//merging, 合併或驗證進行中之合併檔路徑集合(記憶體內), 供 qPush 避免重入、qGet 回 merging; 以路徑為鍵使同行程內多個伺服器實例(不同 pathUploadTemp)互不影響
let merging = new Set()

//consuming, 消費進行中之 queueId → promise, 使同一隊列之併發查詢(client 逾時重送而前一請求仍在應用端處理中)共用同一次應用端呼叫, 不多重觸發
let consuming = new Map()

//getPaths
let getPaths = (fileHash, pathUploadTemp, seg = '') => {
    let fp = path.resolve(pathUploadTemp, fileHash)
    let r = {
        fp,
        fpd: `${fp}.done`,
        fpe: `${fp}.error`,
        fpr: isestr(seg) ? `${fp}.q${seg}.ro` : '', //以 .q 而非 _ 接續, 否則 checkTotalHash 掃描 <fileHash>_ 時會將其當切片解析索引而拋錯
    }
    return r
}

//verifyMerged, fp 在而 fpd 不在(非合併中)時之驗證: fileHash 即整檔 xxhash, 一致即為合併完成後寫 fpd 前中止, 補寫 fpd; 不一致即為合併中中止之殘檔, 寫 fpe 使其終結
//期間標記 merging 使併發查詢回 merging、併發 push 為 no-op; 驗證本身出錯(暫時性 fs 錯誤)不寫 fpe, 回 error 由下次 push 重試
let verifyMerged = async(fileHash, ps) => {
    merging.add(ps.fp)
    try {
        let h = await fsGetFileXxHash(ps.fp)
        if (h === fileHash) {
            fs.writeFileSync(ps.fpd, '', 'utf8')
            return { state: 'done' }
        }
        let msg = `merged file[${ps.fp}] is incomplete: hash[${h}] != fileHash[${fileHash}], merge was interrupted`
        try {
            fs.writeFileSync(ps.fpe, msg, 'utf8')
        }
        catch (e) {
            console.log(`can not write ${ps.fpe}`, e)
        }
        return { state: 'error', reason: msg }
    }
    catch (err) {
        return { state: 'error', reason: `verify merged file[${ps.fp}] error: ${getErrorMessage(err)}` }
    }
    finally {
        merging.delete(ps.fp)
    }
}

//readStored, 讀取本隊列儲存之結果; 讀取或解析失敗視為未儲存並記錄, 交由後續狀態判定(落到 S2 重新消費)
//why(須用嚴格模式且要求自有 ro 鍵): 寬鬆之 u8arr2obj 對壞封包回 {} 而不報錯, 再經 get(o,'ro',null) 就成了「一個值為 null 的成功結果」——
//實測(第五輪複審)隨機壞包、缺 ro 鍵之封包、二進位區截尾三種情形, 皆回 state success 且 msg 為 null 或截短之值, 應用端 upload 呼叫數為 0,
//亦即壞掉的 .ro 不但被當成成功, 還「擋住」了本可正常進行的重新消費, 使應用端永遠拿不到真結果
let readStored = (ps, funLog) => {
    try {
        let u8a = new Uint8Array(fs.readFileSync(ps.fpr))

        //check, 嚴格模式取狀態: 封包損毀者視為未儲存
        let rd = u8arr2obj(u8a, { returnWithStateAndMsg: true })
        if (get(rd, 'state') !== 'success') {
            funLog(`stored result ${ps.fpr} is corrupted, treat as not stored: ${get(rd, 'msg', 'unknown error')}`)
            return { ok: false }
        }

        //check, 須為物件且自有 ro 鍵: 缺鍵者代表寫入時序列化已失真, 不可當成「結果為 null」
        let o = rd.msg
        if (!isobj(o) || !haskey(o, 'ro')) {
            funLog(`stored result ${ps.fpr} has no own 'ro' key, treat as not stored`)
            return { ok: false }
        }

        return { ok: true, ro: o.ro }
    }
    catch (err) {
        funLog(`can not read stored result ${ps.fpr}: ${getErrorMessage(err)}`)
        return { ok: false }
    }
}

//consume, S2 之消費: 同一 queueId 併發共用同一次呼叫; 應用端結果 undefined 正規化為 null(序列化無法表達 undefined, 首次回應與重送回應須一致);
//成功即儲存, 儲存失敗只記錄(應用端已處理, 仍回 success; 之後重送會再呼叫應用端); 應用端拒絕原樣向外拋, 不儲存
let consume = (id, ps, funConsume, funLog) => {
    let pm = consuming.get(id)
    if (pm) {
        return pm
    }
    pm = Promise.resolve()
        .then(() => {
            return funConsume(ps.fp)
        })
        .then((ro) => {
            ro = (ro === undefined) ? null : ro
            try {

                //check, 應用端結果須能序列化才可儲存: 不能者(如含BigInt或循環參照)寬鬆模式會落地成解不出ro鍵之空封包,
                //使首次回應為原值、重送回應變成null —— 同一queueId兩種結果, 破壞本檔之「重送得同一結果」保證.
                //故序列化失敗時不落地; 之後重送會依S2再呼叫一次應用端(與儲存失敗同一處置), 至少結果一致.
                //此處刻意不記錄: 同一個「應用端結果無法序列化」之失敗, 外層組回應時亦會偵測到並發一則error事件,
                //兩層各報一次即同一失敗兩則事件(與/slc曾修過之情形同型), 故由外層唯一持有此失敗之回報
                let re = obj2u8arr({ ro }, { returnWithStateAndMsg: true })
                if (get(re, 'state') !== 'success') {
                    return ro
                }

                fs.writeFileSync(ps.fpr, Buffer.from(re.msg))

                //canonical, 回傳「解回之值」而非原物件
                //why: 原本落地一次(鍵為ro)、外層組回應時又序列化一次(鍵為msg), 帶toJSON或有狀態getter之結果會被呼叫兩次且兩次結果可不同 ——
                //實測首次回應得seq=2而重送得seq=1, 同一queueId兩種結果. 改回傳解回之canonical值後, 首次與重送必然相同, 且toJSON只執行一次
                let rd = u8arr2obj(re.msg, { returnWithStateAndMsg: true })
                if (get(rd, 'state') === 'success' && isobj(rd.msg) && haskey(rd.msg, 'ro')) {
                    return rd.msg.ro
                }
            }
            catch (err) {
                funLog(`can not store consumed result to ${ps.fpr}: ${getErrorMessage(err)}`)
            }
            return ro
        })
        .finally(() => {
            consuming.delete(id)
        })
    consuming.set(id, pm)
    return pm
}

//qPush
let qPush = async(fileHash, chunkTotal, pathUploadTemp) => {

    //id, 使用fileHash代表不用佇列儲存, 通過id即可解析反查; 前兩段(日期、亂數)與fileHash皆為英數, 亦作為本隊列結果檔之命名
    let id = `${now2strp()}|${genID(6)}|${fileHash}`

    //ps
    let ps = getPaths(fileHash, pathUploadTemp)

    //check, 重入保護: 同一合併檔已在合併(或驗證)中即不再啟動
    //why: 合併以寫入模式開啟輸出檔, 第二次合併開檔當下就把第一次的結果截斷, 且切片已被第一次合併逐片刪除, 第二次必於第零片失敗而寫.error,
    //使已完成或進行中的合併被回報為失敗並需整檔重傳; 觸發路徑為push之回應遺失後client重試, 或同檔並發上傳。直接回傳id, 由get走既有判定
    if (merging.has(ps.fp)) {
        return id
    }

    //bErr, bfp, bfpd
    let bErr = fsIsFile(ps.fpe)
    let bfp = fsIsFile(ps.fp)
    let bfpd = fsIsFile(ps.fpd)

    //check, 已完成(合併檔與.done同時存在且無失敗態)亦不再啟動, 理由同上; 有失敗態則屬失敗後補傳再push之正規路徑, 須重新合併
    if (!bErr && bfp && bfpd) {
        return id
    }

    //check, 合併檔在而.done不在(非合併中, S7/S6): 先驗證, 完整者補.done即完成(切片已被前次合併刪除, 重新合併必因缺片失敗, 反使完整檔被誤報失敗而整檔重傳);
    //殘檔者驗證會寫.error, 續走下方失敗後重新合併(切片齊全即成功, 不齊則以缺片失敗寫.error, 由前端補傳後再push)
    if (!bErr && bfp && !bfpd) {
        let vr = await verifyMerged(fileHash, ps)
        if (vr.state === 'done') {
            return id
        }
        bErr = fsIsFile(ps.fpe)
    }

    //清除前一次合併殘留之失敗態, 否則本次重新合併會被舊的失敗態誤判
    if (bErr) {
        fsDeleteFile(ps.fpe)
    }

    //merging, 於脫勾前即登記, 使同一tick內之重複push亦被擋下
    merging.add(ps.fp)

    //setTimeout, 脫勾觸發
    setTimeout(() => {
        mergeSlices(fileHash, chunkTotal, pathUploadTemp)
            .catch((err) => {
                console.log(err)

                //失敗須落地為.error, 否則.done永不出現, qGet只能回merging, 前端會無止境等待一件不會發生的事
                let msg = getErrorMessage(err) //字串型之err由getErrorMessage之階0原樣回傳, 無須另行分支
                try {
                    fs.writeFileSync(ps.fpe, msg, 'utf8')
                }
                catch (e) {
                    console.log(`can not write ${ps.fpe}`, e)
                }

            })
            .finally(() => {
                merging.delete(ps.fp) //合併結束(不論成敗)才解除, 期間之重複push皆為no-op; 成功者之後由.done擋, 失敗者之後由.error路徑重新合併
            })
    }, 1)

    return id
}

//qGet, 依檔頭狀態表判定; opt.funConsume為(fp)=>Promise<ro>, 由伺服器提供以呼叫應用端upload事件, 其拒絕原樣向外拋; opt.funLog為記錄函數(儲存/讀取結果失敗等非致命事件)
let qGet = async(id, pathUploadTemp, opt = {}) => {
    let errTemp = ''

    //funConsume, funLog
    let funConsume = get(opt, 'funConsume')
    let funLog = get(opt, 'funLog')
    if (!isfun(funLog)) {
        funLog = (msg) => {
            console.log(msg)
        }
    }

    //check
    if (!isestr(id)) {
        errTemp = `invalid id[${id}]`
        console.log(errTemp)
        return {
            state: 'error',
            msg: errTemp,
            path: '',
        }
    }

    //s, 自前端回傳之id解析為[日期, 亂數, fileHash]; 三段皆會參與路徑組裝(fileHash為合併檔名, 前兩段為本隊列結果檔名), 須皆為安全識別字(英數字), 否則可 ../ 逸出資料夾
    let s = sep(id, '|')
    let seg0 = get(s, 0, '')
    let seg1 = get(s, 1, '')
    let fileHash = get(s, 2, '')
    if (size(s) !== 3 || !isSafeId(seg0) || !isSafeId(seg1) || !isSafeId(fileHash)) {
        errTemp = `invalid queueId[${id}]`
        console.log(errTemp)
        return {
            state: 'error',
            msg: 'invalid queueId', //不回傳細節
            reason: errTemp,
            path: '',
        }
    }

    //ps
    let ps = getPaths(fileHash, pathUploadTemp, `${seg0}${seg1}`)

    //S3, 本隊列已消費: 直接回儲存之結果, 不再呼叫應用端(冪等); 優先於其他一切狀態(同fileHash之後續合併失敗或進行中皆不影響本隊列已完成之事實)
    if (fsIsFile(ps.fpr)) {
        let rs = readStored(ps, funLog)
        if (rs.ok) {
            return {
                state: 'success',
                msg: rs.ro,
                path: ps.fp,
                from: 'stored',
            }
        }
    }

    //S5, 合併失敗態, 先於成功態判定: 有失敗態即回error並附原因, 讓前端能終止輪詢
    if (fsIsFile(ps.fpe)) {
        let msg = ''
        try {
            msg = fs.readFileSync(ps.fpe, 'utf8')
        }
        catch (e) {}
        return {
            state: 'error',
            msg: 'merge slices failed', //不含路徑與底層細節(底層訊息含伺服器絕對路徑), 細節置於reason供伺服器端以error事件通知應用端
            reason: msg,
            path: ps.fp,
        }
    }

    //S1, 合併或驗證進行中
    if (merging.has(ps.fp)) {
        return {
            state: 'merging',
            msg: '',
            path: ps.fp,
        }
    }

    //bfp, bfpd
    let bfp = fsIsFile(ps.fp)
    let bfpd = fsIsFile(ps.fpd)

    //S7/S6, 合併檔在而.done不在(非合併中): 驗證, 一致補.done轉S2, 不一致寫.error轉S5(終結, 不得永遠merging)
    if (bfp && !bfpd) {
        let vr = await verifyMerged(fileHash, ps)
        if (vr.state !== 'done') {
            return {
                state: 'error',
                msg: 'merge slices failed',
                reason: vr.reason,
                path: ps.fp,
            }
        }
        bfpd = true
    }

    //S2, 已合併未被本隊列消費: 消費
    if (bfp && bfpd) {
        if (!isfun(funConsume)) {
            return { //未提供消費函數(內部測試用)時維持舊回傳形狀
                state: 'success',
                msg: '',
                path: ps.fp,
            }
        }
        let ro = await consume(id, ps, funConsume, funLog) //應用端拒絕於此向外拋
        return {
            state: 'success',
            msg: ro,
            path: ps.fp,
            from: 'consumed',
        }
    }

    //S4, .done在而合併檔不在且本隊列無儲存結果: 合併檔已被其他隊列消費後由應用端移走(或本隊列首次消費時結果未能儲存), 本隊列無法再取得結果, 終結
    if (!bfp && bfpd) {
        return {
            state: 'error',
            msg: 'merged file already consumed',
            reason: `merged file[${ps.fp}] no longer exists and no stored result for queueId[${id}]`,
            path: ps.fp,
        }
    }

    //S0, 無此合併任務: 從未push, 或產物已被清除; 終結
    return {
        state: 'error',
        msg: 'no merge task',
        reason: `no merge task for fileHash[${fileHash}] (never pushed, or artifacts removed)`,
        path: ps.fp,
    }
}

let r = {
    push: qPush,
    get: qGet,
}


export default r
