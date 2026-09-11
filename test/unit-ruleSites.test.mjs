import assert from 'assert'
import fs from 'fs'


/**
 * unit: 規則層站點清單(對應專案根目錄之 CLAUDE.md 之「規則帳本」一節)
 *
 * 為何需要這個檔:
 * 五輪審計中, #26/#34/#35 是同一條規則(codec 呼叫須取狀態)的三個站點, 卻被編成三個缺陷編號、分兩輪「發現」;
 * #29/#30/#32 則是修正範圍取自被投訴點名的站點, 而非規則所屬的類別。
 * 根因是「缺陷帳本以站點為單位, 規則不進帳本」—— 於是下一次仍然只修被點名的那一處。
 *
 * 本檔的職責不是判斷對錯, 而是**鎖住站點清單**:
 *   - 新增了一個站點卻沒登記 → 紅(這正是要擋的失誤)
 *   - 修好了一個站點 → 也會紅, 此時應更新 CLAUDE.md 之「規則帳本」一節與本檔之期望值, 並於回報附重掃輸出
 * 因此本檔之期望值**必須由量測產生**(node tmp/measure_sites.mjs), 不可憑記憶填寫。
 *
 * 盤點基準日: 2026-09-09(#32 修正後)
 */
describe('unit-ruleSites', function() {

    //readCode, 讀原始碼並去除整行註解(避免註解內之範例字串被計入站點)
    let readCode = (fp) => {
        return fs.readFileSync(fp, 'utf8')
            .split('\n')
            .filter((line) => !/^\s*\/\//.test(line))
            .join('\n')
    }

    //countAll, 計算正規式之全部命中數(同一行多個命中亦分別計算)
    let countAll = (s, re) => {
        let m = s.match(re)
        return m === null ? 0 : m.length
    }

    let src = {
        server: readCode('src/WConverhpServer.mjs'),
        client: readCode('src/WConverhpClient.mjs'),
        mmg: readCode('src/managerMergeSlices.mjs'),
        csh: readCode('src/checkSlicesHash.mjs'),
        cth: readCode('src/checkTotalHash.mjs'),
        buildDownloadSource: readCode('src/buildDownloadSource.mjs'),
        readDownloadFields: readCode('src/readDownloadFields.mjs'),
        encodeOut: readCode('src/encodeOut.mjs'),
        isValidFileSize: readCode('src/isValidFileSize.mjs'),
        responseU8aStream: readCode('src/responseU8aStream.mjs'),
        responseU8aStreamWithError: readCode('src/responseU8aStreamWithError.mjs'),
    }

    //hint, 站點數變動時之處置指引(直接寫在斷言訊息裡, 使下一個人不必回頭翻文件)
    let hint = '站點數與 CLAUDE.md 之「規則帳本」一節不符。處置: 先跑 node tmp/measure_sites.mjs 取得現況清單, 更新 CLAUDE.md 之「規則帳本」一節之該條站點表與狀態欄, 再更新本檔期望值; 回報時附該條之重掃輸出。'

    it('R1 應用端可控值之屬性讀取: handler 內不得再直接讀取應用端回傳物件之欄位', function() {
        //#32 之修正: 三個 download handler 之欄位擷取全部改走 readDownloadFields(其內以 attempt 逐欄收斂)
        //若此數不為 0, 代表有 handler 又開始直接讀 —— 那正是 #32 復發之形狀
        let n = countAll(src.server, /get\(r, '/g)
        assert.strict.deepEqual(n, 0, `R1a ${hint}`)
    })

    it('R1 下載來源之觸碰(辨識/狀態/pipeline/具體化)須全部位於 buildDownloadSource 內', function() {
        let re = /streamRead instanceof|streamRead\.readableObjectMode|streamRead\.destroyed|streamRead\.readableEnded|Buffer\.isBuffer\(streamRead\)|buf\.length|stream\.pipeline\(streamRead/g

        //server 內不得再有任何來源觸碰
        assert.strict.deepEqual(countAll(src.server, re), 0, `R1b(server) ${hint}`)

        //buildDownloadSource 內共 9 個觸碰點
        assert.strict.deepEqual(countAll(src.buildDownloadSource, re), 9, `R1b(buildDownloadSource) ${hint}`)
    })

    it('R1 每個觸碰階段皆須包在 attempt 內: buildDownloadSource 三段 + readDownloadFields 一段', function() {
        //三段分別為 identify streamRead / setup pipeline / materialize streamRead
        assert.strict.deepEqual(countAll(src.buildDownloadSource, /attempt\(/g), 3, `R1c(buildDownloadSource) ${hint}`)
        assert.strict.deepEqual(countAll(src.readDownloadFields, /attempt\(/g), 1, `R1c(readDownloadFields) ${hint}`)

        //三個階段名稱須存在, 使 error 事件之訊息可辨識是哪一階段失敗
        for (let stage of ['identify streamRead', 'setup pipeline', 'materialize streamRead']) {
            assert.strict.deepEqual(src.buildDownloadSource.includes(stage), true, `缺少階段名稱[${stage}]`)
        }
    })

    it('R1 已套之清理站點: destroyStreamRead 與 hasPipe 之屬性讀取須在 try 內', function() {
        let d = readCode('src/destroyStreamRead.mjs')
        assert.strict.deepEqual(d.indexOf('try') < d.indexOf('isfun(v.pipe)'), true, 'destroyStreamRead 之 try 須包住屬性讀取(第四輪 #31 之修正)')

        let h = readCode('src/hasPipe.mjs')
        assert.strict.deepEqual(h.indexOf('try') < h.indexOf('isfun(v.pipe)'), true, 'hasPipe 之 try 須包住屬性讀取')
    })

    it('R2 寫入回應標頭之站點須為 14(server 8 + responseU8aStream 5 + responseU8aStreamWithError 1)', function() {
        let re = /\.header\('|\.type\(/g
        let n = 0
        for (let k of ['server', 'responseU8aStream', 'responseU8aStreamWithError']) {
            n += countAll(src[k], re)
        }
        assert.strict.deepEqual(n, 14, `R2 ${hint}`)
    })

    it('R2 Return-Msg 須經值域檢核: 訊息可回顯請求端可控字串, 不合法者須略過該標頭而非使回應失敗(#25)', function() {
        let s = src.responseU8aStream
        assert.strict.deepEqual(s.includes('isValidHeaderValue'), true, 'responseU8aStream 須以 isValidHeaderValue 檢核 Return-Msg')
        //檢核須與送出成對: 出現在同一個 if 條件內
        assert.strict.deepEqual(/isValidHeaderValue\('Return-Msg', returnMsg\)[\s\S]{0,80}Return-Msg/.test(s), true, '檢核須與 header 送出成對')
    })

    it('R3 codec 呼叫: 總 9 站點, 嚴格 7, 寬鬆 2 —— 且兩個寬鬆者皆為刻意不套(本條缺口為 0)', function() {
        let re = /(obj2u8arr|u8arr2obj)\([^)]*\)/g
        let all = []
        for (let k of ['server', 'client', 'mmg', 'encodeOut', 'responseU8aStreamWithError']) {
            for (let h of (src[k].match(re) || [])) {
                all.push({ k, strict: h.includes('returnWithStateAndMsg') })
            }
        }
        assert.strict.deepEqual(all.length, 9, `R3 總站點數 ${hint}`)
        assert.strict.deepEqual(all.filter((v) => v.strict).length, 7, `R3 嚴格站點數 ${hint}`)

        //寬鬆之 2 個皆為刻意不套: /slc 之編碼(內容為套件自產字串)、responseU8aStreamWithError(最終退路, 其自身失敗無處可退)
        //#26 之 /main 請求解碼已於本輪改為嚴格
        let looseByFile = {}
        for (let v of all) {
            if (!v.strict) {
                looseByFile[v.k] = (looseByFile[v.k] || 0) + 1
            }
        }
        assert.strict.deepEqual(looseByFile, { server: 1, responseU8aStreamWithError: 1 }, `R3 寬鬆站點之分佈 ${hint}`)
    })

    it('R4 數值述詞: 總 21 站點, 安全模式 11', function() {
        //第九輪 +1: checkTotalHash 之 fileSize 由 isnum 改為 isp0int 之安全模式(R4b 之未登記站點, 見帳本)
        //第十輪 +1: checkSlicesHash 以實存切片檔名建索引集合之 isp0int(s) —— 刻意寬鬆(對象為本套件自產之檔名段, 另以 String(cint(s)) === s 要求正規寫法)
        let re = /(isp0int|ispint)\([^)]*\)/g
        let n = 0
        let nSafe = 0
        for (let k of ['server', 'client', 'csh', 'cth', 'isValidFileSize']) {
            let hits = src[k].match(re) || []
            n += hits.length
            nSafe += hits.filter((v) => v.includes('optSafe') || v.includes('useLimitSafe')).length
        }
        assert.strict.deepEqual(n, 21, `R4 總站點數 ${hint}`)
        assert.strict.deepEqual(nSafe, 11, `R4 安全模式站點數 ${hint}(10 個刻意寬鬆者之理由見 CLAUDE_rulebook.md 之 R4)`)
    })

    it('R4 fileSize 之檢核與正規化須成對: isValidFileSize 採 isp0int 故接受數字字串, 須以 cint 轉換 —— 兩條下載路由皆經 validDownloadField', function() {
        //why: fileSize 會以 === 與實際位元組數比較(buf.length !== fileSize、計數串流之 n !== fileSize),
        //字串未經 cint 會使長度正確之下載反被判為 fileSize mismatch
        //第十輪: 判定與正規化收歸 validDownloadField(判定本身會觸碰應用端值而須在 attempt 內, 見帳本 R1), 兩路由不再各自手寫
        assert.strict.deepEqual(countAll(src.server, /validDownloadField\('fileSize'/g), 2, `R4 /dwgf 與 /dw 須各經一次 validDownloadField('fileSize') ${hint}`)
        assert.strict.deepEqual(countAll(src.server, /isValidFileSize\(/g), 0, `R4 server 不得再自行判定 fileSize(須經 validDownloadField) ${hint}`)
        let v = readCode('src/validDownloadField.mjs')
        assert.strict.deepEqual(countAll(v, /isValidFileSize\(v\)/g), 1, `R4 validDownloadField 須以 isValidFileSize 判定 ${hint}`)
        assert.strict.deepEqual(countAll(v, /value: cint\(v\)/g), 1, `R4 validDownloadField 須以 cint 正規化 ${hint}`)
    })

    //stripCode, 去除整行註解、JSDoc 與行尾註解(不動 http:// 之雙斜線), 供「禁用寫法」類之掃描使用
    //why: R10 之禁用樣式(err.message 等)正好會出現在「說明為何不用該寫法」的註解裡, 不去除即為假陽性
    //note: 須以 /\r?\n/ 分行 —— 本專案檔案為 CRLF, 只以 '\n' 分行會使每行尾端留 \r,
    //而 JS 之 . 不跨行終止符, 行尾註解之正規式因 $ 錨不到而整條失效(此處踩過一次)
    let stripCode = (fp) => {
        return fs.readFileSync(fp, 'utf8')
            .split(/\r?\n/)
            .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
            .map((line) => line.replace(/([^:])\/\/.*$/, '$1'))
            .join('\n')
    }

    it('R10 取因表達式一律經 getErrorMessage: 禁用寫法須為 0, 站點須為 28', function() {
        //why: err 為應用端 throw/reject 之任意值, 其 message 可為拋錯之 getter、toString 可拋錯。
        //以 err.message / get(err,'message',err) / String(err) 組訊息, 即於 catch 內再拋 —— 保護層自身失效。
        //實測後果: verifyConn 為此形狀 → 裸 HTTP 500 + 0 則事件; 監聽器為此形狀 → 請求永久懸置。
        //分辨力見 test/api-hostileErrorValues.test.mjs(修正前 5 failing)
        let fps = [
            'src/WConverhpServer.mjs',
            'src/WConverhpClient.mjs',
            'src/managerMergeSlices.mjs',
            'src/buildDownloadSource.mjs',
            'src/attempt.mjs',
            'src/encodeOut.mjs',
            'src/readDownloadFields.mjs',
            'src/responseU8aStream.mjs',
            'src/responseU8aStreamWithError.mjs',
        ]
        let reBad = /get\((err|e), 'message'|\b(err|e)\.(message|stack)\b|String\((err|e)\)/g
        let nBad = 0
        let nGood = 0
        let bad = []
        for (let fp of fps) {
            let c = stripCode(fp)
            let hits = c.match(reBad) || []
            if (hits.length > 0) {
                bad.push(`${fp}: ${hits.join(' / ')}`)
            }
            nBad += hits.length
            nGood += countAll(c, /getErrorMessage\(/g)
        }
        assert.strict.deepEqual(nBad, 0, `R10 出現禁用之取因寫法[${bad.join(' ; ')}]。${hint}`)
        //第九輪 14 → 19: server 之 invalid fileSize 樣板 ×2(應用端值不可直接進樣板)、server 之 stop ×1、
        //client 之 cbProgressSafe ×1(axios 進度回呼)、client 之 sendDataSlice 進度回呼保護 ×1
        //第十輪 19 → 28: server 之請求端值進樣板 ×3(/main 解碼本體、func、mode)、建構期失敗 ×2(暫存資料夾、外部 serverHapi 之路由註冊)、
        ///ulctr 之 internal ×1; managerMergeSlices 之 removeStateFile ×1 與 invalid queueId 樣板 ×1; client 之 send 之 JSON 序列化 ×1
        assert.strict.deepEqual(nGood, 28, `R10 站點數 ${hint}`)
    })

    it('R10 之擴充: 請求端之任意 JSON 值不得直接進樣板', function() {
        //why: 不需 getter —— JSON.parse 產物之自有屬性 toString 為非函數值時, 樣板求值即拋 Cannot convert object to primitive value;
        //帳本 R10 原記「JSON.parse 產物結構上不可能帶拋錯 getter, 列刻意不套」為假(實測第十輪 D3: /ulctr 之 {"mode":{"toString":1}} → 裸 HTTP 500 + 0 則事件)
        //分辨力見 test/api-hostileRequestJson.test.mjs(其軸成員自原始碼掃出)
        let s = stripCode('src/WConverhpServer.mjs')
        for (let re of [/invalid mode\[\$\{mode\}\]/g, /\$\{get\(inp, 'func'/g, /\$\{get\(rdInp, 'msg'/g]) {
            assert.strict.deepEqual(countAll(s, re), 0, `R10 請求端值直接進樣板: ${re}`)
        }
        let m = stripCode('src/managerMergeSlices.mjs')
        assert.strict.deepEqual(countAll(m, /invalid id\[\$\{id\}\]/g), 0, 'R10 managerMergeSlices 之 queueId 直接進樣板')
    })

    it('R10 之結構層: 保護函數內「非做不可」之事須排在回報之前', function() {
        //why: 取值層(getErrorMessage 契約上不拋錯)是一道防線, 但保護函數內若還有其他會拋錯之步驟,
        //排在其後之 settle 仍會被跳過。故唯一「非做不可」之事須排在回報之前, 使失效在結構上不可能
        let c = readCode('src/WConverhpServer.mjs')

        //其一, 事件派發之 settle —— 該順序已由 wsemi 之 evEmit 擁有並明載「不得對調」, 本套件之責任是**把 funSettle 傳進去**
        //  wsemi 明載其不猜測 pm 之位置(本套件之 pm 為事件之最後一個參數), 不傳即等於沒有 settle, 監聽器出錯時該請求懸置
        assert.strict.deepEqual(c.includes('funSettle:'), true, 'R10 server 之 evEmit 須傳入 funSettle, 否則監聽器出錯時請求會懸置')
        assert.strict.deepEqual(c.includes('pm.reject(`listener of event['), true, 'R10 funSettle 內須 reject 該次請求之 pm')

        //其二, checkConn 之授權結果 —— 此順序仍由本套件擁有
        let iM = c.indexOf('m = false')
        let iEmitV = c.indexOf(`evEmit('error', \`verifyConn error for apiType[`)
        assert.strict.deepEqual(iM > 0 && iEmitV > 0, true, '找不到 checkConn 之兩個標記')
        assert.strict.deepEqual(iM < iEmitV, true, 'checkConn: m = false 須早於 error 事件之發送(否則組訊息拋錯即逸出成裸 500)')

        //其三, callApp 之「無人接聽」—— 第九輪新增之站點
        //  pm.reject 為此處唯一「非做不可」之事; funError 會走到應用端之 error 監聽器, 其若拋錯而排在前面, 該次請求就永遠不會被 settle
        //  —— 那正是 callApp 存在所要防止的懸置(本模組初版即犯此錯, 由外部複審指出)
        let ca = readCode('src/callApp.mjs')
        let iReject = ca.indexOf('pm.reject(msg)')
        let iFunErr = ca.indexOf('funError(msg)')
        assert.strict.deepEqual(iReject > 0 && iFunErr > 0, true, '找不到 callApp 之兩個標記')
        assert.strict.deepEqual(iReject < iFunErr, true, 'callApp: pm.reject 須早於 funError(否則 error 監聽器拋錯時該請求永久懸置)')

        //其四, sendDataSlice 之合併完成 —— 第九輪新增之站點
        //  原本 cbProgressMerge(呼叫應用端之 cbProgress)排在 pm.resolve 之前, 其拋錯被 checkMerging 之 .catch(() => {}) 吞掉,
        //  pm 遂永不 settle, upload() 永久懸置(實測 12000ms 未 settle、0 則事件)
        let cl = readCode('src/WConverhpClient.mjs')
        let iResolveMsg = cl.indexOf('pm.resolve(res.msg)')
        let iMerge = cl.indexOf(`cbProgressMerge({ prog: 100, m: 'download' }) //觸發上傳完畢後之下載回應`, iResolveMsg)
        assert.strict.deepEqual(iResolveMsg > 0 && iMerge > 0, true, '找不到 sendDataSlice 之兩個標記')
        assert.strict.deepEqual(iResolveMsg < iMerge, true, 'checkMerging: pm.resolve 須早於 cbProgressMerge(否則應用端進度回呼拋錯時 upload() 永久懸置)')
    })

    it('R11 派發一律交由 wsemi 之 evEmit / evEmitDelay', function() {
        //why: 其為「於呼叫端堆疊上直接 ev.emit 並以 try 攔截」之單一擁有者, 且把本套件所需之紀律
        //(settle 排在通報之前、通報自身包 try 並留痕、脫勾後仍於新堆疊內攔截、ms 夾至計時器上限)寫成明文契約。
        //自行手寫等於把同一條規則寫第二遍 —— 而規則寫兩遍正是本帳本各條重複出現之形狀
        assert.strict.deepEqual(countAll(src.server, /evEmitBase\(/g), 1, `R11 server 之派發擁有者須恰為 1 ${hint}`)
        assert.strict.deepEqual(countAll(src.client, /evEmitBase\(/g), 1, `R11 client 之派發擁有者須恰為 1 ${hint}`)
        assert.strict.deepEqual(countAll(src.server, /evEmitDelayBase\(/g), 1, `R11 server 之脫勾派發擁有者須恰為 1 ${hint}`)
    })

    it('R11 ev.emit 僅得出現於形狀轉接器內', function() {
        //why: wsemi 之通報形狀為 { fun, name, msg, args } 物件, 而本套件 error 事件之對外契約為字串訊息,
        //故須以 funEmit 轉換; 該轉換是 ev.emit 的**唯一**正當用途。其餘任何直接 ev.emit 皆為繞過派發擁有者
        assert.strict.deepEqual(src.server.includes('function funEmitOfPkg('), true, 'R11 找不到形狀轉接器 funEmitOfPkg')
        assert.strict.deepEqual(countAll(src.server, /ev\.emit\(/g), 2, `R11 server 之 ev.emit 須恰為 2(皆於 funEmitOfPkg 內) ${hint}`)
        assert.strict.deepEqual(countAll(src.client, /ev\.emit\(/g), 0, `R11 client 無形狀轉接需求, 不得直接 ev.emit ${hint}`)
    })

    it('R11 以 timer 脫勾派發僅限建構期: evEmitDelay 之 3 個呼叫站點皆須位於路由定義之外', function() {
        //why: 建構期之失敗事件須脫勾, 因應用端於 new 回傳後才有機會註冊監聽器(實測 tmp/probe_r8_defer.mjs);
        //其餘派發站點皆於請求進來後才觸發, 脫勾對其毫無作用而只帶來「堆疊被切斷」之代價
        //第十輪 1 → 3: 暫存資料夾建立失敗、外部 serverHapi 之路由註冊失敗(與啟動失敗同為建構期失敗)。
        //刻意不以一個包裝函數把站點數維持為 1: 那會使本條鎖住的變成「包裝函數存在」, 而日後在請求路徑呼叫該包裝函數不會紅(第十輪兩份外部複審指出)
        //故直接斷言**每一個**站點之位置: 不得落在 apiMain 至 startServer 之間(六條路由之定義)
        assert.strict.deepEqual(countAll(src.server, /evEmitDelay\('/g), 3, `R11 evEmitDelay 之呼叫站點數 ${hint}`)
        let iA = src.server.indexOf('let apiMain = {')
        let iZ = src.server.indexOf('async function startServer')
        assert.strict.deepEqual(iA > 0 && iZ > iA, true, '找不到路由定義之起訖標記')
        let i = -1
        while ((i = src.server.indexOf(`evEmitDelay('`, i + 1)) >= 0) {
            assert.strict.deepEqual(i < iA || i > iZ, true, `R11 evEmitDelay 出現於路由定義內(位置 ${i}), 請求期之事件不得脫勾派發`)
        }
        assert.strict.deepEqual(countAll(src.client, /evEmitDelay\(/g), 0, `R11 client 無建構期事件, 不應有脫勾派發 ${hint}`)
    })

    it('R11 監聽器須為同步之契約須寫在建構函數之 JSDoc 內', function() {
        //why: 此為對外契約(不支援 async 監聽器), 未寫進 JSDoc 者等於沒有裁定
        for (let fp of ['src/WConverhpServer.mjs', 'src/WConverhpClient.mjs']) {
            let doc = fs.readFileSync(fp, 'utf8')
            assert.strict.deepEqual(doc.includes('監聽器須為同步函數'), true, `${fp} 之 JSDoc 缺少「監聽器須為同步」之契約`)
        }
    })

    it('R5 error 事件發送站點: server 32(即時 28 + 建構期脫勾 3 + 監聽器出錯之通報 1)、client 13', function() {
        //其中建構期之 start server error 走 evEmitDelay(見 R11), 監聽器出錯之通報則於形狀轉接器 funEmitOfPkg 內發出
        //第九輪 23 → 26: procApp 之「無人接聽」通報 ×1(R12)、stop 之停止失敗通報 ×1(R11 之建構期同族)、
        ///dwgfn 之 filename 正規化失敗 ×1(R3: 協定鍵內之值亦會靜默消失)
        //第十輪 26 → 28: procApp 之輸出為 function/symbol ×1、/ulctr 之 internal ×1、/dwgf 之 filename 判定拋錯 ×1, 而 /dwgfn 之 filename 兩處判定併為一處 −1
        //第十輪另納入 client(帳本 R5 原只盤點 server, 而本輪 D6 之缺口正在 client): 以 serverError 為「伺服器回業務錯誤」之唯一處置
        assert.strict.deepEqual(countAll(src.server, /evEmit\('error'/g), 28, `R5 即時派發之站點數 ${hint}`)
        assert.strict.deepEqual(countAll(src.server, /evEmitDelay\('error'/g), 3, `R5 建構期脫勾派發之站點數 ${hint}`)
        assert.strict.deepEqual(countAll(src.client, /evEmit\('error'/g), 13, `R5 client 之站點數 ${hint}`)
        assert.strict.deepEqual(src.client.includes('let serverError = ('), true, 'R5 client 找不到 serverError 之定義')
        assert.strict.deepEqual(countAll(src.client, /serverError\(/g), 3, `R5 client 之 serverError 呼叫站點: callApiCore、downloadStream、checkMerging 各 1 ${hint}`)
        assert.strict.deepEqual(countAll(src.server, /ev\.emit\('error'/g), 1, `R5 監聽器出錯之通報站點數 ${hint}`)
    })

    it('R17 回前端之錯誤訊息不得含伺服器路徑與底層細節: /ulctr 之內部呼叫一律經 internal', function() {
        //why: 內部例外(worker、合併佇列)之訊息常含伺服器絕對路徑; 原本原樣進入錯誤封包 —— 暫存資料夾不在時前端收到
        //`Error: fd[<伺服器絕對路徑>] is not a folder` 且伺服器 0 則事件(實測第十輪 A11/N5)。internal 使細節只進 error 事件
        assert.strict.deepEqual(countAll(src.server, /internal\('/g), 3, `R17 internal 之站點數(check total hash、check slices hash、push merge task) ${hint}`)
        assert.strict.deepEqual(countAll(src.server, /await (checkTotalHash|checkSlicesHash|mmg\.push)\(/g), 0, `R17 不得繞過 internal 直接 await 內部呼叫 ${hint}`)
    })

    it('R18 完成標記須證明其所指之內容: .done 之寫入者只在 managerMergeSlices, 正式名只由 rename 產生, 新一代合併前舊標記失效', function() {
        //why: 原本 worker 合併完即寫 .done(不核對雜湊), 且新一代合併不清除舊 .done ——
        //上一代 .done 殘留 + 本代合併中行程中止, 重啟後殘檔以 success 交出(實測 134217728 bytes 之檔交出 3342336 bytes, 第十輪 D1)
        //行為面之保護見 test/unit-mergeGeneration.test.mjs 與 test/api-uploadMergeIntegrity.test.mjs; 本條鎖住結構
        let ms = readCode('src/mergeSlices.mjs')
        assert.strict.deepEqual(countAll(ms, /writeFileSync/g), 0, `R18 worker 不得寫任何狀態標記 ${hint}`)
        assert.strict.deepEqual(countAll(ms, /fsGetFileXxHash\(fpOut\)/g), 1, `R18 worker 須回傳合併檔之雜湊供核對 ${hint}`)
        assert.strict.deepEqual(countAll(src.mmg, /writeFileSync\(ps\.fpd/g), 2, `R18 .done 之寫入者須恰為 2(合併後核對相符、verifyMerged 驗證相符) ${hint}`)
        assert.strict.deepEqual(countAll(src.mmg, /renameSync\(ps\.fpm, ps\.fp\)/g), 1, `R18 合併檔之正式名須只由 rename 產生 ${hint}`)
        assert.strict.deepEqual(countAll(src.mmg, /removeStateFile\(ps\.fpd\)/g), 1, `R18 新一代合併前須使舊 .done 失效 ${hint}`)
        let iHash = src.mmg.indexOf('if (h !== fileHash)')
        let iRename = src.mmg.indexOf('fs.renameSync(ps.fpm, ps.fp)')
        let iDone = src.mmg.indexOf(`fs.writeFileSync(ps.fpd, '', 'utf8')`, iRename)
        assert.strict.deepEqual(iHash > 0 && iHash < iRename && iRename < iDone, true, 'R18 順序須為: 核對雜湊 → rename → 寫 .done')
    })

    it('CLAUDE_rulebook.md 須存在且涵蓋本檔之全部規則', function() {
        //帳本自 2026-09-10 起獨立為 CLAUDE_rulebook.md(原位於 CLAUDE.md 之「規則帳本」一節);
        //CLAUDE.md 只留工作規則與指向兩個附檔之說明, 執行經驗另於 CLAUDE_experience.md
        //第十輪: 原清單只列 R1–R7, R8 以後之規則(本檔亦有其斷言)缺頁不會紅 —— 清單範圍比本檔所鎖之規則窄(帳本 R4b 之教訓同型)
        let doc = fs.readFileSync('CLAUDE_rulebook.md', 'utf8')
        assert.strict.deepEqual(doc.includes('# 規則帳本'), true, 'CLAUDE_rulebook.md 缺少標題')
        for (let r of ['### R1 ', '### R2 ', '### R3 ', '### R4 ', '### R4b ', '### R4c ', '### R5 ', '### R6 ', '### R7 ', '### R8 ', '### R9 ', '### R10 ', '### R11 ', '### R12 ', '### R13 ', '### R14 ', '### R15 ', '### R16 ', '### R17 ', '### R18 ']) {
            assert.strict.deepEqual(doc.includes(r), true, `CLAUDE_rulebook.md 缺少 ${r.trim()}`)
        }
        assert.strict.deepEqual(doc.split('**盤點指令**').length - 1 >= 4, true, 'CLAUDE_rulebook.md 之盤點指令數不足')
    })

    it('CLAUDE.md 須指向 CLAUDE_rulebook.md 與 CLAUDE_experience.md', function() {
        //why: 三檔分工(工作規則 / 規則帳本 / 執行經驗)只有 CLAUDE.md 會被自動載入,
        //指標斷了等於另兩檔不存在 —— 而那正是「承諾由別處兌現卻無訊號」之同型(見 CLAUDE_experience.md 之 E15)
        let doc = fs.readFileSync('CLAUDE.md', 'utf8')
        assert.strict.deepEqual(doc.includes('CLAUDE_rulebook.md'), true, 'CLAUDE.md 未指向 CLAUDE_rulebook.md')
        assert.strict.deepEqual(doc.includes('CLAUDE_experience.md'), true, 'CLAUDE.md 未指向 CLAUDE_experience.md')
    })

})
