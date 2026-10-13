import assert from 'assert'
import fs from 'fs'
import routeSpec from '../src/routeSpec.mjs'


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

    //readCode, 讀原始碼並去除**區塊註解(JSDoc)與整行註解**, 避免註解內之說明範例被計入站點
    //why 第十一輪加剝區塊註解: 原本只剝行註解, 而 JSDoc 內與盤點正規式同形之表達式會被當成真站點。
    //同一成因在本輪連中兩次 —— canonProtocolValue 之 JSDoc 使 R3 由 9 變 10、isValidFileSize 之 JSDoc 使 R1b 多一個 buf.length;
    //併檔時尤其明顯(原檔不在掃描清單內故從未被計入)。第一次以改措辭治標, 再犯即改為治本: 先剝 /* */ 再剝行註解
    let readCode = (fp) => {
        return fs.readFileSync(fp, 'utf8')
            .replace(/\/\*[\s\S]*?\*\//g, '')
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
    }

    //sect, 取 server 內某函式之區段(自其定義起至下一個頂層 function 定義前)
    //why: 第十一輪把九個「只被 server 使用且無獨立單元測試」之模組併入 server(帳本 R20 之判準:
    //唯有重要且需獨立測試之函數、或多檔共用之函數才獨立成檔)。原本以「檔」為錨之各條, 改以「函式區段」為錨 ——
    //本檔各條規則約束的是**那一段邏輯**, 與它住在哪個檔無關; 錨點跟著搬即可, 不得因此放寬斷言
    let sect = (fnName) => {
        let i = src.server.indexOf(`function ${fnName}(`)
        if (i < 0) {
            return ''
        }
        let rest = src.server.slice(i)
        let j = rest.slice(1).search(/\nfunction \w+\(/)
        return j < 0 ? rest : rest.slice(0, j + 1)
    }

    //outside, 取 server 內扣除指定函式區段後之其餘部分(供「此邏輯不得出現於他處」之斷言)
    let outside = (fnName) => {
        let s = sect(fnName)
        return s === '' ? src.server : src.server.split(s).join('')
    }

    //hint, 站點數變動時之處置指引(直接寫在斷言訊息裡, 使下一個人不必回頭翻文件)
    let hint = '站點數與 CLAUDE.md 之「規則帳本」一節不符。處置: 先跑 node tmp/measure_sites.mjs 取得現況清單, 更新 CLAUDE.md 之「規則帳本」一節之該條站點表與狀態欄, 再更新本檔期望值; 回報時附該條之重掃輸出。'

    it('R1 應用端可控值之屬性讀取: handler 內不得再直接讀取應用端回傳物件之欄位', function() {
        //#32 之修正: 三個 download handler 之欄位擷取全部改走 readDownloadFields(其內以 attempt 逐欄收斂)
        //若此數不為 0, 代表有 handler 又開始直接讀 —— 那正是 #32 復發之形狀
        //第十一輪: encodeOut 併入 server 後其內之 get(r, 'state') / get(r, 'msg') 會命中本樣式, 但那個 r 是**編碼器之回傳值**而非應用端物件,
        //屬假陽性, 故扣除該函式區段; 本條要擋的是「路由層直接讀應用端交出之 r」
        let n = countAll(outside('encodeOut'), /get\(r, '/g)
        assert.strict.deepEqual(n, 0, `R1a ${hint}`)
    })

    it('R1 下載來源之觸碰(辨識/狀態/pipeline/具體化)須全部位於 buildDownloadSource 之區段內', function() {
        let re = /streamRead instanceof|streamRead\.readableObjectMode|streamRead\.destroyed|streamRead\.readableEnded|Buffer\.isBuffer\(streamRead\)|buf\.length|stream\.pipeline\(streamRead/g

        //buildDownloadSource 以外(路由與其餘函式)不得再有任何來源觸碰
        assert.strict.deepEqual(countAll(outside('buildDownloadSource'), re), 0, `R1b(buildDownloadSource 以外) ${hint}`)

        //buildDownloadSource 內共 9 個觸碰點
        assert.strict.deepEqual(countAll(sect('buildDownloadSource'), re), 9, `R1b(buildDownloadSource) ${hint}`)
    })

    it('R1 每個觸碰階段皆須包在 attempt 內: buildDownloadSource 三段 + readDownloadFields 一段', function() {
        //三段分別為 identify streamRead / setup pipeline / materialize streamRead
        assert.strict.deepEqual(countAll(sect('buildDownloadSource'), /attempt\(/g), 3, `R1c(buildDownloadSource) ${hint}`)
        assert.strict.deepEqual(countAll(sect('readDownloadFields'), /attempt\(/g), 1, `R1c(readDownloadFields) ${hint}`)

        //三個階段名稱須存在, 使 error 事件之訊息可辨識是哪一階段失敗
        for (let stage of ['identify streamRead', 'setup pipeline', 'materialize streamRead']) {
            assert.strict.deepEqual(sect('buildDownloadSource').includes(stage), true, `缺少階段名稱[${stage}]`)
        }
    })

    it('R1 已套之清理站點: destroyStreamRead 與 hasPipe 之屬性讀取須在 try 內', function() {
        //兩者自第十一輪起併入其唯一呼叫者 WConverhpServer(帳本 R20);
        //本條鎖的是「屬性讀取在 try 內」這件事, 與它住在哪個檔無關, 故錨點改取各自之函式區段
        let d = sect('destroyStreamRead')
        assert.strict.deepEqual(d !== '', true, 'server 內找不到 destroyStreamRead')
        assert.strict.deepEqual(d.indexOf('try') < d.indexOf('isfun(v.pipe)'), true, 'destroyStreamRead 之 try 須包住屬性讀取(第四輪 #31 之修正)')

        let h = sect('hasPipe')
        assert.strict.deepEqual(h !== '', true, 'server 內找不到 hasPipe')
        assert.strict.deepEqual(h.indexOf('try') < h.indexOf('isfun(v.pipe)'), true, 'hasPipe 之 try 須包住屬性讀取')
    })

    it('R2 寫入回應標頭之站點須為 14(路由 8 + 併入之 responseU8aStream / WithError 共 6)', function() {
        let re = /\.header\('|\.type\(/g
        assert.strict.deepEqual(countAll(src.server, re), 14, `R2 ${hint}`)
    })

    it('R2 Return-Msg 須經值域檢核: 訊息可回顯請求端可控字串, 不合法者須略過該標頭而非使回應失敗(#25)', function() {
        let s = sect('responseU8aStream')
        assert.strict.deepEqual(s.includes('isValidHeaderValue'), true, 'responseU8aStream 須以 isValidHeaderValue 檢核 Return-Msg')
        //檢核須與送出成對: 出現在同一個 if 條件內
        assert.strict.deepEqual(/isValidHeaderValue\('Return-Msg', returnMsg\)[\s\S]{0,80}Return-Msg/.test(s), true, '檢核須與 header 送出成對')
    })

    it('R3 codec 呼叫: 總 9 站點, 嚴格 7, 寬鬆 2 —— 且兩個寬鬆者皆為刻意不套(本條缺口為 0)', function() {
        let re = /(obj2u8arr|u8arr2obj)\([^)]*\)/g
        let all = []
        for (let k of ['server', 'client', 'mmg']) { //第十一輪: encodeOut 與 responsePacket 已併入 server
            for (let h of (src[k].match(re) || [])) {
                all.push({ k, strict: h.includes('returnWithStateAndMsg') })
            }
        }
        assert.strict.deepEqual(all.length, 9, `R3 總站點數 ${hint}`)
        assert.strict.deepEqual(all.filter((v) => v.strict).length, 7, `R3 嚴格站點數 ${hint}`)

        //寬鬆之 2 個皆為刻意不套: /slc 之編碼(內容為套件自產字串)、responseU8aStreamWithError(最終退路, 其自身失敗無處可退; 第十一輪起併入 responseU8aStream 同檔)
        //#26 之 /main 請求解碼已於本輪改為嚴格
        let looseByFile = {}
        for (let v of all) {
            if (!v.strict) {
                looseByFile[v.k] = (looseByFile[v.k] || 0) + 1
            }
        }
        //第十一輪: responsePacket 併入 server, 故兩個寬鬆站點皆落在 server(/slc 之編碼、responseU8aStreamWithError 之最終退路)
        assert.strict.deepEqual(looseByFile, { server: 2 }, `R3 寬鬆站點之分佈 ${hint}`)
        assert.strict.deepEqual(countAll(sect('responseU8aStreamWithError'), /obj2u8arr\(out\)/g), 1, `R3 最終退路之寬鬆編碼須在 responseU8aStreamWithError 內 ${hint}`)
    })

    it('R4 數值述詞: 總 21 站點, 安全模式 11', function() {
        //第九輪 +1: checkTotalHash 之 fileSize 由 isnum 改為 isp0int 之安全模式(R4b 之未登記站點, 見帳本)
        //第十輪 +1: checkSlicesHash 以實存切片檔名建索引集合之 isp0int(s) —— 刻意寬鬆(對象為本套件自產之檔名段, 另以 String(cint(s)) === s 要求正規寫法)
        let re = /(isp0int|ispint)\([^)]*\)/g
        let n = 0
        let nSafe = 0
        for (let k of ['server', 'client', 'csh', 'cth']) { //第十一輪: isValidFileSize 與 validDownloadField 皆已併入 server
            let hits = src[k].match(re) || []
            n += hits.length
            nSafe += hits.filter((v) => v.includes('optSafe') || v.includes('useLimitSafe')).length
        }
        assert.strict.deepEqual(n, 21, `R4 總站點數 ${hint}`)
        assert.strict.deepEqual(nSafe, 11, `R4 安全模式站點數 ${hint}(10 個刻意寬鬆者之理由見 CLAUDE_rulebook.md 之 R4)`)
    })

    it('R4 fileSize 之檢核與正規化須成對: isValidFileSize 採 isp0int 故接受數字字串, 須以 cint 轉換 —— 下載欄位之判定只由 readOutput 呼叫 validDownloadField, 而 /dwgf 與 /dw 之 fields 皆含 fileSize', function() {
        //why: fileSize 會以 === 與實際位元組數比較(buf.length !== fileSize、計數串流之 n !== fileSize),
        //字串未經 cint 會使長度正確之下載反被判為 fileSize mismatch
        //第十輪: 判定與正規化收歸 validDownloadField(判定本身會觸碰應用端值而須在 attempt 內, 見帳本 R1), 兩路由不再各自手寫
        //第十一輪: 呼叫者收斂為 readOutput 一處(擁有者鎖), 「哪些路由會驗 fileSize」改由 src/routeSpec.mjs 之 fields 表達(與 test/api-axes.mjs 對照, 見 unit-routeSpec); 行為面由 api-sourceTraps / api-downloadShape 逐路由驗
        //第十一輪: validDownloadField 併入 server, 故全檔為「定義 1 + 呼叫 1」共 2; 呼叫者仍須恰為 readOutput 一處
        assert.strict.deepEqual(countAll(src.server, /validDownloadField\(/g), 2, `R4 validDownloadField 須為定義 1 + 呼叫 1 ${hint}`)
        assert.strict.deepEqual(countAll(src.server, /function validDownloadField\(/g), 1, `R4 validDownloadField 之定義須恰一處 ${hint}`)
        assert.strict.deepEqual(countAll(src.server, /vv = validDownloadField\(/g), 1, `R4 validDownloadField 之呼叫者須恰為 readOutput 一處 ${hint}`)
        assert.strict.deepEqual(countAll(readCode('src/routeSpec.mjs'), /\{ name: 'fileSize' \}/g), 2, `R4 /dwgf 與 /dw 之 fields 皆須含 fileSize ${hint}`)
        //第十一輪: isValidFileSize 併入 server, 全檔為「定義 1 + validDownloadField 內之呼叫 1」共 2;
        //本條要擋的是「路由層自行判定 fileSize」, 故扣除該兩個函式區段後須為 0(併入不得使本條放寬)
        assert.strict.deepEqual(countAll(src.server, /isValidFileSize\(/g), 2, `R4 isValidFileSize 須為定義 1 + 呼叫 1 ${hint}`)
        let restFs = src.server.split(sect('isValidFileSize')).join('').split(sect('validDownloadField')).join('')
        assert.strict.deepEqual(countAll(restFs, /isValidFileSize\(/g), 0, `R4 路由層不得自行判定 fileSize(須經 validDownloadField) ${hint}`)
        //第十一輪: isValidFileSize 與 validDownloadField 皆併入 server, 錨點改取函式區段; 定義與呼叫各鎖一次
        let v = sect('validDownloadField') + sect('isValidFileSize')
        assert.strict.deepEqual(countAll(v, /function isValidFileSize\(v\)/g), 1, `R4 validDownloadField 內須有 isValidFileSize 之唯一定義 ${hint}`)
        assert.strict.deepEqual(countAll(v, /!isValidFileSize\(v\)/g), 1, `R4 validDownloadField 須以 isValidFileSize 判定 ${hint}`)
        assert.strict.deepEqual(countAll(v, /isp0int\(v, \{ useLimitSafe: true \}\)/g), 1, `R4 isValidFileSize 須採 isp0int 之安全模式 ${hint}`)
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

    it('R10 取因表達式一律經 getErrorMessage: 禁用寫法須為 0, 站點須為 29', function() {
        //why: err 為應用端 throw/reject 之任意值, 其 message 可為拋錯之 getter、toString 可拋錯。
        //以 err.message / get(err,'message',err) / String(err) 組訊息, 即於 catch 內再拋 —— 保護層自身失效。
        //實測後果: verifyConn 為此形狀 → 裸 HTTP 500 + 0 則事件; 監聽器為此形狀 → 請求永久懸置。
        //分辨力見 test/api-hostileErrorValues.test.mjs(修正前 5 failing)
        //第十一輪: attempt / buildDownloadSource / encodeOut / readDownloadFields / responsePacket 五者皆已併入 server(帳本 R20)
        let fps = [
            'src/WConverhpServer.mjs',
            'src/WConverhpClient.mjs',
            'src/managerMergeSlices.mjs',
        ]
        //第十一輪: 錨點加入 res —— client 之 send 原以 get(res, 'stack') 兜底把整段本機 stack 當成呼叫端可見之錯誤值, 變數叫 res 而躲過本正規式(A 卷 §①-1.4)
        let reBad = /get\((err|e|res), '(message|stack)'|\b(err|e|res)\.(message|stack)\b|String\((err|e|res)\)/g
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
        //第十一輪 28 → 30: server 之 failPayload +1、readOutput 統一三路由之欄位失敗訊息(取代 /dwgf 與 /dw 之 fileSize 樣板, −1);
        //client 之 classifyFailure +1(取代 get(res,'stack'); attemptFailed 之事件值亦經之)、downloadBrowser 之 getToken 拋錯 +1; 本數為總量鎖(帳本維護提示), 禁用寫法為 0 那條才是擁有者鎖
        //2026-10-13(前端中止, 帳本 R27)30 → 29: client 之兩處 cbProgress 保護(send 之 cbProgressSafe、sendDataSlice 之包裝)收斂為呼叫層級之 ctx.wrapProgress 一處(−1)
        assert.strict.deepEqual(nGood, 29, `R10 站點數 ${hint}`)
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
        let ca = sect('callApp') //第十一輪: callApp 併入 server(帳本 R20), 錨點改取函式區段
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

    it('R11 以 timer 脫勾派發僅限建構期: evEmitDelay 之 4 個呼叫站點皆須位於路由定義之外', function() {
        //why: 建構期之失敗事件須脫勾, 因應用端於 new 回傳後才有機會註冊監聽器(實測 tmp/probe_r8_defer.mjs);
        //其餘派發站點皆於請求進來後才觸發, 脫勾對其毫無作用而只帶來「堆疊被切斷」之代價
        //第十輪 1 → 3: 暫存資料夾建立失敗、外部 serverHapi 之路由註冊失敗(與啟動失敗同為建構期失敗)。
        //第十二輪 3 → 4: 曝露與存取控制選項有給而無效(帳本 R26)—— 訊息集中於 errsOpt, 以單一迴圈派發(一選項一則); 迴圈本身即一個建構期站點, 其位置同受下方斷言約束
        //刻意不以一個包裝函數把站點數維持為 1: 那會使本條鎖住的變成「包裝函數存在」, 而日後在請求路徑呼叫該包裝函數不會紅(第十輪兩份外部複審指出)
        //故直接斷言**每一個**站點之位置: 不得落在 apiMain 至 startServer 之間(六條路由之定義)
        assert.strict.deepEqual(countAll(src.server, /evEmitDelay\('/g), 4, `R11 evEmitDelay 之呼叫站點數 ${hint}`)
        let iA = src.server.indexOf('let apiMain = {')
        let iZ = src.server.indexOf('async function startServer')
        assert.strict.deepEqual(iA > 0 && iZ > iA, true, '找不到路由定義之起訖標記')
        let i = -1
        while ((i = src.server.indexOf(`evEmitDelay('`, i + 1)) >= 0) {
            assert.strict.deepEqual(i < iA || i > iZ, true, `R11 evEmitDelay 出現於路由定義內(位置 ${i}), 請求期之事件不得脫勾派發`)
        }
        assert.strict.deepEqual(countAll(src.client, /evEmitDelay\(/g), 0, `R11 client 無建構期事件, 不應有脫勾派發 ${hint}`)
    })

    it('R12 應用端呼叫須有接聽者: 判定之唯一擁有者為 noListenerOf; 上傳管線之閘門須排在副作用之前(位置鎖); 閘門之事件名與派發之事件字面一致', function() {
        //why 位置鎖而非計數鎖(第十二輪 A 卷 ③-3、B 卷 ③-2、C 卷 ③-5): 「恰 N 處」擋不住「閘門排錯行」——
        //把 /slc 之閘門移到 createWriteStream 之後計數不變, 卻成了先開檔(寫入模式即截斷既有切片)再拒絕
        //本檔之 readCode 保留每行之 \r(專案檔案為 CRLF), 跨行比對一律用 \r?\n(帳本經驗 E5)

        //擁有者: listenerCount 全檔恰一處且在 noListenerOf 內; callApp 經之
        assert.strict.deepEqual(countAll(src.server, /listenerCount\(/g), 1, `R12 listenerCount 之呼叫須恰為 1 ${hint}`)
        assert.strict.deepEqual(sect('noListenerOf').includes('listenerCount('), true, 'R12 listenerCount 須位於 noListenerOf 內')
        assert.strict.deepEqual(sect('callApp').includes('noListenerOf(ev, name)'), true, 'R12 callApp 須經 noListenerOf 判定')

        //requireListener: 經 noListenerOf 並以 spec.event 為事件名; 先組回覆再通報(帳本 R10 之結構層)
        let iDef = src.server.indexOf('let requireListener = (spec, reply) => {')
        assert.strict.deepEqual(iDef > 0, true, '找不到 requireListener 之定義')
        let rest = src.server.slice(iDef)
        let body = rest.slice(0, rest.search(/\r?\n {4}\}\r?\n/))
        assert.strict.deepEqual(body.includes('noListenerOf(ev, spec.event)'), true, 'R12 requireListener 須經 noListenerOf 且以 spec.event 為事件名')
        let iApp = body.indexOf('reply.app(msg)')
        let iEmit = body.indexOf(`evEmit('error', msg)`)
        assert.strict.deepEqual(iApp > 0 && iEmit > 0 && iApp < iEmit, true, 'R12 requireListener: reply.app 須早於 error 事件(非做不可之事排在回報之前)')

        //位置鎖: /slc 之閘門早於開啟寫入串流; /ulctr 之閘門位於「merge-slices-get 以外」之條件內且早於 procCore(worker 與合併)
        let routeOf = (a, b) => src.server.slice(src.server.indexOf(a), src.server.indexOf(b))
        let slc = routeOf('let apiUploadSlice = {', 'let apiDownloadGetFilename = {')
        let iGateSlc = slc.indexOf('requireListener(spec, reply)')
        let iOpen = slc.indexOf('fs.createWriteStream(')
        assert.strict.deepEqual(iGateSlc > 0 && iOpen > 0 && iGateSlc < iOpen, true, 'R12 /slc: 閘門須早於開啟寫入串流')
        let ulctr = routeOf('let apiUploadCheck = {', 'let apiUploadSlice = {')
        let iGateUl = ulctr.search(/if \(mode !== 'merge-slices-get'\) \{\r?\n\s+let refused = requireListener\(spec, reply\)/)
        let iCore = ulctr.indexOf('let procCore = async')
        assert.strict.deepEqual(iGateUl > 0 && iCore > 0 && iGateUl < iCore, true, 'R12 /ulctr: 閘門須位於 merge-slices-get 以外之條件內且早於 procCore')
        assert.strict.deepEqual(countAll(src.server, /requireListener\(spec, reply\)/g), 2, 'R12 閘門之呼叫站點須恰為 /slc 與 /ulctr 兩處')

        //一致性: 閘門之事件名(routeSpec.event)與派發之事件字面(procDeal / procUpload / procDownload 之 procApp 第一參數)為同一事實之兩份來源(第十二輪 B 卷 ③-D5)
        let lit = (fn) => {
            let m = src.server.match(new RegExp(`async function ${fn}\\([^)]*\\) \\{\\r?\\n\\s+return procApp\\('(\\w+)'`))
            return m ? m[1] : ''
        }
        assert.strict.deepEqual(lit('procDeal'), routeSpec.main.event, 'R12 /main 派發之事件須等於 routeSpec.main.event')
        assert.strict.deepEqual(lit('procUpload'), routeSpec.ulctr.event, 'R12 /ulctr 派發之事件須等於 routeSpec.ulctr.event')
        assert.strict.deepEqual(lit('procUpload'), routeSpec.slc.event, 'R12 /slc 之閘門事件須等於上傳管線派發之事件')
        for (let k of ['dwgfn', 'dwgf', 'dw']) {
            assert.strict.deepEqual(lit('procDownload'), routeSpec[k].event, `R12 /${k} 派發之事件須等於 routeSpec.${k}.event`)
        }
        assert.strict.deepEqual(routeOf('let apiMain = {', 'let apiUploadCheck = {').includes('procDeal('), true, 'R12 /main 須經 procDeal 派發')
        assert.strict.deepEqual(ulctr.includes('procUpload('), true, 'R12 /ulctr 須經 procUpload 派發')
    })

    it('R11 監聽器須為同步之契約須寫在建構函數之 JSDoc 內', function() {
        //why: 此為對外契約(不支援 async 監聽器), 未寫進 JSDoc 者等於沒有裁定
        for (let fp of ['src/WConverhpServer.mjs', 'src/WConverhpClient.mjs']) {
            let doc = fs.readFileSync(fp, 'utf8')
            assert.strict.deepEqual(doc.includes('監聽器須為同步函數'), true, `${fp} 之 JSDoc 缺少「監聽器須為同步」之契約`)
        }
    })

    it('R5 error 事件發送站點(總量, 帳本維護提示): server 26(即時 21 + 建構期脫勾 4 + 監聽器出錯之通報 1)、client 10(呼叫層級之 ctx.emit 9 + 入口之 evEmit 1)', function() {
        //其中建構期之 start server error 走 evEmitDelay(見 R11), 監聽器出錯之通報則於形狀轉接器 funEmitOfPkg 內發出
        //第九輪 23 → 26: procApp 之「無人接聽」通報 ×1(R12)、stop 之停止失敗通報 ×1(R11 之建構期同族)、
        ///dwgfn 之 filename 正規化失敗 ×1(R3: 協定鍵內之值亦會靜默消失)
        //第十輪 26 → 28: procApp 之輸出為 function/symbol ×1、/ulctr 之 internal ×1、/dwgf 之 filename 判定拋錯 ×1, 而 /dwgfn 之 filename 兩處判定併為一處 −1
        //第十一輪 28 → 19: 三路由之下載欄位失敗(9 處)收斂為 readOutput 之 2 處、三路由之「回應無法序列化」(3 處)收斂為 replyPacket 之 1 處, 另 failPayload +1
        //client 13 → 10: serverError 之 emit、callApiCore 三個解析失敗分支、send 之 catch 共 5 處收斂為 attemptFailed 1 處, 另 downloadBrowser 之 getToken 拋錯 +1
        //第十二輪 19 → 21: 上傳管線之接聽者閘門 requireListener ×1(R12 之延伸)、/main 於 admit 期間已中斷之補判 ×1(/slc 之同一補判走既有 onAbort 而不新增站點);
        //建構期脫勾 3 → 4: 曝露與存取控制選項有給而無效之 errsOpt 派發迴圈(R26)
        //總量只能偵測「有人增刪了一處」, 偵測不到「同一次失敗發了兩則」或「某條路由漏了處置」—— 行為面由 test/api-errorEventOnce.test.mjs(失敗種類 × 六路由)與 api-clientAttemptEvents 鎖(B 卷 §③-3.6)
        assert.strict.deepEqual(countAll(src.server, /evEmit\('error'/g), 21, `R5 即時派發之站點數 ${hint}`)
        assert.strict.deepEqual(countAll(src.server, /evEmitDelay\('error'/g), 4, `R5 建構期脫勾派發之站點數 ${hint}`)
        assert.strict.deepEqual(countAll(src.server, /ev\.emit\('error'/g), 1, `R5 監聽器出錯之通報站點數 ${hint}`)
        //2026-10-13(前端中止, 帳本 R27): client 之 error 事件改由呼叫層級之 ctx.emit 發出(中止後不發), 只有入口之 `invalid opt.signal` 仍為 evEmit(其時尚無中止範圍);
        //站點 10 → 10: +1(invalid opt.signal)、−1(兩處 cbProgress 保護收斂為 ctx.wrapProgress 一處, 同 R10)。原規劃之 10 → 11 未計入該收斂
        assert.strict.deepEqual(countAll(src.client, /(?:evEmit|ctx\.emit)\('error'/g), 10, `R5 client 之站點數 ${hint}`)
    })

    it('R28 測試建構伺服器一律給 pathUploadTemp(落 test/_tmp/<案名>/), 不得取預設值而於 repo 根建立 uploadTemp/', function() {
        //why: 伺服器之 pathUploadTemp 預設為 ./uploadTemp(cwd 為 repo 根), 建構即建立該資料夾; run02、run03 盤點有 9 檔取預設 ——
        //其一(api-uploadLargeFile)每跑一次留一個合併結果檔(.ro), 已累積 117 個; 其餘 8 檔不上傳, 只是每次重建 repo 根之空資料夾
        let files = [
            ...fs.readdirSync('test').filter((n) => n.endsWith('.mjs')).map((n) => `test/${n}`),
            ...fs.readdirSync('test/tools').filter((n) => n.endsWith('.mjs')).map((n) => `test/tools/${n}`),
        ]

        //enclosed, 自開括號(或開大括號)起以配對取出其內文(含跨行)
        let enclosed = (s, iOpen, open, close) => {
            let depth = 0
            for (let i = iOpen; i < s.length; i++) {
                if (s[i] === open) {
                    depth += 1
                }
                else if (s[i] === close) {
                    depth -= 1
                    if (depth === 0) {
                        return s.slice(iOpen + 1, i)
                    }
                }
            }
            return null
        }

        //objOf, 參數為識別字時(如 new WConverhpServer(opt)), 取同檔內在該呼叫之前最近一次 `let <識別字> = {` 之物件內文
        let objOf = (s, id, iBefore) => {
            let iLast = -1
            for (let m of s.matchAll(new RegExp(`let ${id} = \\{`, 'g'))) {
                if (m.index < iBefore) {
                    iLast = m.index + m[0].length - 1
                }
            }
            return iLast < 0 ? null : enclosed(s, iLast, '{', '}')
        }

        let n = 0
        let bad = []
        for (let fp of files) {
            let s = readCode(fp)
            for (let m of s.matchAll(/new WConverhpServer\(|(?<!function )startServer\(/g)) {
                //test/tools/e2e-setup.mjs 之 startServer 以 `...opt` 轉交, 由其呼叫端各自給(呼叫端皆在本掃描內)
                if (fp === 'test/tools/e2e-setup.mjs' && m[0].startsWith('new ')) {
                    continue
                }
                n += 1
                let a = enclosed(s, m.index + m[0].length - 1, '(', ')')
                let id = /^\s*([A-Za-z_$][\w$]*)\s*$/.exec(a || '')
                let body = id ? objOf(s, id[1], m.index) : a
                if (body === null || !/\bpathUploadTemp\b/.test(body)) {
                    bad.push(`${fp}:${s.slice(0, m.index).split('\n').length}`)
                }
            }
        }
        assert.strict.deepEqual(n >= 70, true, `R28 建構站點只掃到 ${n} 個(掃描失效?)`)
        assert.strict.deepEqual(bad, [], `R28 以下建構站點未給 pathUploadTemp(將於 repo 根建立 uploadTemp/): ${bad.join(', ')}`)
    })

    it('R27 一次公開呼叫對外之全部輸出經其 ctx 之出口; 公開 promise 與中止競速(前端中止之單一擁有者)', function() {
        //why: 前端原無「一次公開呼叫」之範圍概念, error 事件、cbProgress、console 訊息、getToken 散在各站點直接呼叫。
        //run01 之模擬 v1 逐等待點判中止, 獨立複審找出之四個缺口(中止後仍呼叫 cbProgress、仍發 error、於續行窗口以值 resolve、仍呼叫 getToken)全是「下一個沒寫到之站點」。
        //本條鎖住兩個擁有者: ①入口(openCall → ctx.run 之入口競速)②出口(ctx.emit / ctx.log / ctx.wrapProgress / ctx.callApp)。
        //日後新增之對外輸出若繞過 ctx(直接 evEmit('error'、console.log、呼叫 fetchToken、自行包裝 cbProgress), 本條即紅; 行為面由 test/api-clientAbort.test.mjs 與 test/e2e-abort.test.mjs 鎖
        let c = src.client
        let iCtx = c.indexOf('let genCallCtx = (scope) => {')
        let iOpen = c.indexOf('let openCall = (opt) => {')
        let iAfterOpen = c.indexOf('let symNoRetry = Symbol(', iOpen)
        assert.strict.deepEqual(iCtx > 0 && iOpen > iCtx && iAfterOpen > iOpen, true, 'R27 找不到 genCallCtx 與 openCall 之定義(或順序改變)')

        //ctx 只由入口建立: genCallCtx 定義 1 + openCall 內呼叫 1; 三個公開方法皆經 openCall, 皆以 ctx.run 執行本體(download 依環境兩分支)
        assert.strict.deepEqual(countAll(c, /genCallCtx\(/g), 1, 'R27 genCallCtx 只得於 openCall 內呼叫一次(ctx 由入口建立)')
        assert.strict.deepEqual(countAll(c, /openCall\(opt\)/g), 3, 'R27 execute、upload、download 皆須經 openCall')
        assert.strict.deepEqual(countAll(c, /ctx\.run\(/g), 4, 'R27 公開方法之本體須經 ctx.run(入口競速): execute 1、upload 1、download 2')
        for (let sig of ['let execute = async(func, input, cbProgress, opt = {}) => {', 'let upload = async(filename, input, cbProgress, opt = {}) => {', 'let download = async(fileId, cbProgress, opt = {}) => {']) {
            assert.strict.deepEqual(c.includes(sig), true, `R27 公開方法之簽章須含 opt: ${sig}`)
        }

        //error 事件: 直接 evEmit('error' 只得於 openCall 內一處(invalid opt.signal, 其時尚無範圍); 其餘一律 ctx.emit
        assert.strict.deepEqual(countAll(c, /evEmit\('error'/g), 1, 'R27 client 直接 evEmit(\'error\' 只得一處')
        let iE = c.indexOf(`evEmit('error'`)
        assert.strict.deepEqual(iE > iOpen && iE < iAfterOpen, true, 'R27 唯一之直接 evEmit(\'error\' 須位於 openCall 內')

        //console 訊息: console.log 只得於 ctx.log 之實作內一處
        assert.strict.deepEqual(countAll(c, /console\.log\(/g), 1, 'R27 client 之 console.log 只得於 ctx.log 內一處')
        let iL = c.indexOf('console.log(')
        assert.strict.deepEqual(iL > iCtx && iL < iOpen, true, 'R27 唯一之 console.log 須位於 genCallCtx 內')

        //getToken: fetchToken 之呼叫皆經 ctx.callApp(已中止即不呼叫)
        assert.strict.deepEqual(countAll(c, /fetchToken\(\)/g), 2, 'R27 fetchToken 之呼叫點須為 2(callApiCore、downloadBrowser 管理器路徑)')
        assert.strict.deepEqual(countAll(c, /ctx\.callApp\(\(\) => fetchToken\(\)\)/g), 2, 'R27 fetchToken 須經 ctx.callApp 呼叫')

        //cbProgress: 保護只由 ctx.wrapProgress 擁有(send 與 sendDataSlice 各包一次), 不得再自行手寫保護
        assert.strict.deepEqual(countAll(c, /ctx\.wrapProgress\(/g), 2, 'R27 cbProgress 須經 ctx.wrapProgress(send、sendDataSlice 各一)')
        assert.strict.deepEqual(countAll(c, /isfun\(cbProgress\)|cbProgressRaw|bCbProgressErr|bCbProgErr/g), 0, 'R27 不得於 ctx.wrapProgress 以外自行補預設或手寫進度保護')
        let iSds = c.indexOf('let sendDataSlice = async(ctx, ')
        let iWrap = c.indexOf('cbProgress = ctx.wrapProgress(cbProgress)', iSds)
        let iFirstCall = c.indexOf('cbProgress({', iSds)
        assert.strict.deepEqual(iSds > 0 && iWrap > iSds && iWrap < iFirstCall, true, 'R27 sendDataSlice 須於第一次呼叫 cbProgress 之前即經 ctx.wrapProgress')

        //ctx 明傳: attemptFailed 之兩呼叫點、各內部函式之第一參數
        assert.strict.deepEqual(countAll(c, /attemptFailed\(ctx, /g), 2, 'R27 attemptFailed 須以 ctx 明傳')
        for (let sig of ['let send = async(ctx, type, pkg, opt = {}) => {', 'let sendPkg = async(ctx, type, data, cbProgress) => {', 'let sendDataSlice = async(ctx, fileTotalName, bb, cbProgress) => {', 'let checkMerging = (ctx) => {', 'let downloadNodejs = async(ctx, ', 'let downloadBrowser = async(ctx, ']) {
            assert.strict.deepEqual(c.includes(sig), true, `R27 ctx 須明傳: ${sig}`)
        }

        //釋放資源之最佳化(非正確性之來源, 但須存在): 交 axios 之 signal、可中止之退避、合併輪詢之 onAbort
        assert.strict.deepEqual(countAll(c, /signal: ctx\.scope\.signal/g), 1, 'R27 axios 組態須帶本呼叫之 signal')
        assert.strict.deepEqual(countAll(c, /await ctx\.scope\.delay\(t\)/g), 1, 'R27 退避須可被中止')
        assert.strict.deepEqual(countAll(c, /[^.\w]delay\(/g), 0, 'R27 不得使用不可中止之 delay')
        assert.strict.deepEqual(countAll(c, /ctx\.scope\.onAbort\(/g), 1, 'R27 合併輪詢須於中止時停止')

        //nodejs 下載之落檔: 已中止者不建檔、建檔後之中止於 abort() 之同步期間即刪不完整檔(拒絕當下即無殘檔; 「取消後立刻重下載」時不截斷、不刪到新檔)
        assert.strict.deepEqual(c.includes(`saveStreamToFile(streamRecv, get(opt, 'fdDownload', ''), filename, ctx.scope)`), true, 'R27 nodejs 落檔須帶本呼叫之中止範圍')
        let iSave = c.indexOf('async function saveStreamToFile(')
        let iChk = c.indexOf('scope.isAborted()', iSave)
        let iCreate = c.indexOf('fs.createWriteStream(fp)', iSave)
        let iReg = c.indexOf('scope.onAbort(', iSave)
        assert.strict.deepEqual(iSave > 0 && iChk > iSave && iChk < iCreate && iReg > iCreate, true, 'R27 saveStreamToFile 須於建檔前判中止、建檔後註冊中止時之刪除')

        //下載管理器: 交給瀏覽器(a.click())不可撤銷, 須於取得 token 之後、交出之前判中止(入口競速只決定 promise 之結局, 擋不住已觸發之下載)
        let iDb = c.indexOf('let downloadBrowser = async(ctx, ')
        let iTok = c.indexOf('ctx.callApp(() => fetchToken())', iDb)
        let iClick = c.indexOf('a.click()', iDb)
        let iPre = c.lastIndexOf('if (ctx.scope.isAborted())', iClick)
        assert.strict.deepEqual(iDb > 0 && iTok > iDb && iPre > iTok && iPre < iClick, true, 'R27 downloadBrowser 須於取 token 之後、a.click() 之前判中止')

        //中止範圍之單一擁有者為 src/abortScope.mjs(帳本 R20 之 B: 有獨立單元測試)
        assert.strict.deepEqual(c.includes(`import wAbortScope from './abortScope.mjs'`), true, 'R27 client 須自 src/abortScope.mjs 取得中止範圍')
        assert.strict.deepEqual(countAll(c, /new AbortController\(|addEventListener\('abort'/g), 0, 'R27 client 不得自行建立 AbortController 或掛 abort 監聽(由 abortScope 擁有)')
    })

    it('R5 擁有者鎖(有分辨力者): 六路由之 verifyConn 與 handler 事件只由 admit 發; client「一次嘗試失敗」之事件只由 attemptFailed 發, 呼叫點恰為 callApi 迴圈與 checkMerging', function() {
        //why 擁有者鎖而非總量鎖: 數字若是「擁有者的個數」就鎖, 若是「站點的總量」就降級為帳本維護提示(B 卷 §③-3.6, 帳本維護規則第 6 條)
        assert.strict.deepEqual(countAll(src.server, /checkConn\(/g), 2, 'R5 checkConn 須只有定義與 admit 內之唯一呼叫, 路由不得直接呼叫')
        assert.strict.deepEqual(countAll(src.server, /evEmit\('handler'/g), 1, 'R5 handler 事件須只由 admit 發(權限未通過即不發)')
        assert.strict.deepEqual(countAll(src.server, /admit\(req, ctx, spec, reply\)/g), 6, 'R5 六路由皆須經 admit')
        assert.strict.deepEqual(countAll(src.server, /ctxOf\(req, spec\)/g), 6, 'R5 六路由之請求脈絡皆須經 ctxOf')
        assert.strict.deepEqual(countAll(src.server, /replyOf\(res, spec\)/g), 6, 'R5 六路由之錯誤回覆器皆須經 replyOf')
        assert.strict.deepEqual(countAll(src.server, /readOutput\(/g), 3, 'R5 三條下載路由之欄位處置皆須經 readOutput(擁有者)')
        assert.strict.deepEqual(countAll(src.server, /replyPacket\(/g), 3, 'R5 控制封包之收尾須經 replyPacket(/main、/ulctr、/dwgfn)')
        assert.strict.deepEqual(src.client.includes('let attemptFailed = ('), true, 'R5 client 找不到 attemptFailed 之定義')
        assert.strict.deepEqual(countAll(src.client, /attemptFailed\(/g), 2, 'R5 client 之 attemptFailed 呼叫點: callApi 之重試迴圈、checkMerging 之 state:error 各 1')
        assert.strict.deepEqual(src.client.includes('serverError'), false, 'R5 client 之 serverError 已由 wrapNoRetry(包裝)與 attemptFailed(事件)取代, 不得再出現(否則同一事實兩個擁有者)')
    })

    it('R17 回前端之錯誤訊息不得含伺服器路徑與底層細節: /ulctr 之內部呼叫一律經 internal', function() {
        //why: 內部例外(worker、合併佇列)之訊息常含伺服器絕對路徑; 原本原樣進入錯誤封包 —— 暫存資料夾不在時前端收到
        //`Error: fd[<伺服器絕對路徑>] is not a folder` 且伺服器 0 則事件(實測第十輪 A11/N5)。internal 使細節只進 error 事件
        assert.strict.deepEqual(countAll(src.server, /(?<!\.)internal\('/g), 3, `R17 internal 之站點數(check total hash、check slices hash、push merge task; 不計 reply.internal) ${hint}`)
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
        //第十二輪: 補 R19–R26(原清單只到 R18, R19–R25 缺頁不會紅 —— 與上述第十輪之教訓同型, B 卷 ③-6)
        //2026-10-13: 補 R27(前端中止之單一擁有者)
        for (let r of ['### R1 ', '### R2 ', '### R3 ', '### R4 ', '### R4b ', '### R4c ', '### R5 ', '### R6 ', '### R7 ', '### R8 ', '### R9 ', '### R10 ', '### R11 ', '### R12 ', '### R13 ', '### R14 ', '### R15 ', '### R16 ', '### R17 ', '### R18 ', '### R19 ', '### R20 ', '### R21 ', '### R22 ', '### R23 ', '### R24 ', '### R25 ', '### R26 ', '### R27 ', '### R28 ']) {
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
