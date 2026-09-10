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

    it('R4 數值述詞: 總 19 站點, 安全模式 10', function() {
        let re = /(isp0int|ispint)\([^)]*\)/g
        let n = 0
        let nSafe = 0
        for (let k of ['server', 'client', 'csh', 'cth', 'isValidFileSize']) {
            let hits = src[k].match(re) || []
            n += hits.length
            nSafe += hits.filter((v) => v.includes('optSafe') || v.includes('useLimitSafe')).length
        }
        assert.strict.deepEqual(n, 19, `R4 總站點數 ${hint}`)
        assert.strict.deepEqual(nSafe, 10, `R4 安全模式站點數 ${hint}(9 個刻意寬鬆者之理由見 CLAUDE.md 之「規則帳本」R4)`)
    })

    it('R4 fileSize 之檢核與正規化須成對: isValidFileSize 採 isp0int 故接受數字字串, 呼叫端須以 cint 轉換', function() {
        //why: fileSize 會以 === 與實際位元組數比較(buf.length !== fileSize、計數串流之 n !== fileSize),
        //字串未經 cint 會使長度正確之下載反被判為 fileSize mismatch
        let n = countAll(src.server, /fileSize = cint\(fileSize\)/g)
        assert.strict.deepEqual(n, 2, `R4 之 cint 正規化須於 /dwgf 與 /dw 兩處各一 ${hint}`)
    })

    it('R5 error 事件發送站點須為 25', function() {
        //25 = 24 + #26 修正時於 /main 新增之「請求封包無效」事件
        let n = countAll(src.server, /eeEmit\('error'/g)
        assert.strict.deepEqual(n, 25, `R5 ${hint}`)
    })

    it('CLAUDE.md 之「規則帳本」一節須存在且涵蓋本檔之全部規則', function() {
        let doc = fs.readFileSync('CLAUDE.md', 'utf8')
        assert.strict.deepEqual(doc.includes('## 規則帳本'), true, 'CLAUDE.md 缺少「規則帳本」一節之標題')
        for (let r of ['### R1 ', '### R2 ', '### R3 ', '### R4 ', '### R5 ', '### R6 ', '### R7 ']) {
            assert.strict.deepEqual(doc.includes(r), true, `CLAUDE.md 之「規則帳本」一節缺少 ${r.trim()}`)
        }
        assert.strict.deepEqual(doc.split('**盤點指令**').length - 1 >= 4, true, 'CLAUDE.md 之「規則帳本」一節之盤點指令數不足')
    })

})
