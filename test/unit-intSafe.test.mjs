import assert from 'assert'
import isp0int from 'wsemi/src/isp0int.mjs'
import ispint from 'wsemi/src/ispint.mjs'


/**
 * unit: 數值選項須以 wsemi 之安全整數模式(opt.useLimitSafe)檢核, 而非預設之寬鬆模式
 *
 * wsemi 之 isp0int/ispint 預設以 cint 轉換後判定, 對 Infinity 回 true(cint(Infinity) 得 1.797e308),
 * 對「有限但超出安全整數範圍」者(如 Number.MAX_SAFE_INTEGER+1、1e21)亦回 true; 而這些值會使各 sink 失敗:
 *   Number.MAX_SAFE_INTEGER+1 交給 hapi 之 payload.maxBytes 會以「must be a safe number」於伺服器建構時同步拋錯;
 *   1e21 交給 Content-Length 時其字串形式為 '1e+21', 不合 HTTP 之 1*DIGIT 語法, 連線懸置且無回應標頭.
 * 故本套件之各數值選項一律帶 { useLimitSafe: true }; 預設模式須維持寬鬆, 以免影響套件內其他刻意寬鬆之呼叫點
 * (請求參數 chunkIndex/chunkTotal 之 Infinity 已裁定不修: 其後果僅為名稱異常之切片檔, 無路徑逸出亦無巨量配置)
 *
 * 各 sink 另有值域上限(計時器 2^31-1、TCP port 65535), 由呼叫端另行限制, 不在述詞範圍, 由 api-optionsRange 涵蓋
 */
describe('unit-intSafe', function() {

    //optSafe, 與 src 內各數值選項所用者一致
    let optSafe = { useLimitSafe: true }

    //cases, [值, isp0int 之期望, ispint 之期望, 說明]
    let cases = [
        [0, true, false, '0 為非負整數但非正整數'],
        [3, true, true, '一般正整數'],
        ['3', true, true, '數字字串(維持 wsemi 既有相容性)'],
        [1, true, true, '1'],
        [1000000, true, true, '一般大數'],
        [Number.MAX_SAFE_INTEGER, true, true, '安全整數上界須通過'],

        [Infinity, false, false, 'Infinity 須擋下(寬鬆模式回 true)'],
        [-Infinity, false, false, '-Infinity'],
        [NaN, false, false, 'NaN'],
        [Number.MAX_SAFE_INTEGER + 1, false, false, '超出安全整數上界須擋下'],
        [1e21, false, false, '1e21 為有限整數但超出安全範圍, 且字串形式帶指數記號'],
        [2 ** 53, false, false, '2^53 超出安全整數上界'],
        [1e30, false, false, '1e30'],
        ['1e999', false, false, '溢位為 Infinity 之數字字串'],

        [-1, false, false, '負整數'],
        [1.5, false, false, '小數'],
        [-0.5, false, false, '負小數'],
        ['abc', false, false, '非數字字串'],
        ['', false, false, '空字串'],
        [null, false, false, 'null'],
        [undefined, false, false, 'undefined'],
        [{}, false, false, '物件'],
        [[], false, false, '陣列'],
        [true, false, false, '布林'],
    ]

    it('isp0int 帶 useLimitSafe 時須僅接受安全非負整數', function() {
        for (let [v, expP0, , note] of cases) {
            assert.strict.deepEqual(isp0int(v, optSafe), expP0, `isp0int(${String(v)}) ${note}`)
        }
    })

    it('ispint 帶 useLimitSafe 時須僅接受安全正整數', function() {
        for (let [v, , expP, note] of cases) {
            assert.strict.deepEqual(ispint(v, optSafe), expP, `ispint(${String(v)}) ${note}`)
        }
    })

    it('關鍵分辨案例: 有限但超出安全整數範圍者於寬鬆模式會被放行, 帶 useLimitSafe 才擋得下', function() {
        for (let v of [Number.MAX_SAFE_INTEGER + 1, 1e21, 2 ** 53]) {
            //此類值 Number.isFinite 與 Number.isInteger 皆為 true, 故僅檢核「有限」並不足夠
            assert.strict.deepEqual(Number.isFinite(v), true, `${v} 確為有限`)
            assert.strict.deepEqual(Number.isInteger(v), true, `${v} 確為整數`)
            assert.strict.deepEqual(isp0int(v), true, `${v} 於寬鬆模式確被放行`)
            assert.strict.deepEqual(isp0int(v, optSafe), false, `但 isp0int(${v}, useLimitSafe) 須為 false`)
            assert.strict.deepEqual(ispint(v, optSafe), false, `但 ispint(${v}, useLimitSafe) 須為 false`)
        }
    })

    it('預設模式須維持寬鬆, 不得因本套件之需求而改變(套件內請求參數仍依賴之)', function() {
        for (let v of [Infinity, Number.MAX_SAFE_INTEGER + 1, 1e21]) {
            assert.strict.deepEqual(isp0int(v), true, `isp0int(${v}) 預設須為 true`)
            assert.strict.deepEqual(ispint(v), true, `ispint(${v}) 預設須為 true`)
        }
    })

})
