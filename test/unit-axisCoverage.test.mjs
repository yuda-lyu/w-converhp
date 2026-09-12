import assert from 'assert'
import fs from 'fs'
import path from 'path'
import axes from './api-axes.mjs'

let { downloadRoutes, downloadRouteKeys, downloadRouteKeysByBody, downloadRouteKeysByStage, downloadRouteKeysRequiring, downloadRouteKeysNotRequiring } = axes


/**
 * unit: 軸之覆蓋(對應 test/api-axes.mjs)
 *
 * 為何需要這個檔:
 * 「下載路由」原本是一條沒有名字的軸 —— 成員清單手寫在五個測試檔內, 且各檔不一致
 * (三個檔跑 ['dw', 'dwgf'], 一個檔跑三個成員)。少掉的成員不是被裁定不測, 而是沒有人記得它也在這條軸上;
 * #23 與 #32 都落在這條接縫上, 而測試照樣全綠 —— 因為每個檔案都「跑完了自己陣列裡的每一個成員」。
 *
 * 本檔把「軸的完整性」變成可執行的斷言:
 *   1. 軸自身的資料須自洽(requiredFields 為 fields 之子集, 請求形狀對得上路由路徑)
 *   2. 測試檔不得再手寫路由字面陣列 —— 少測一個成員只能經 downloadRouteKeys({ 成員: '理由' }) 表達
 *   3. 全套測試對此軸之覆蓋聯集須等於成員全集 —— 任何成員完全沒有人測時本檔轉紅
 *
 * 第 3 條是關鍵: 各檔可以合理地只測子集(如只驗交付本體之契約), 但**子集的聯集必須是全集**;
 * 這正是原本沒有任何地方在檢查的那件事。
 */
describe('unit-axisCoverage', function() {

    let fdTest = 'test'

    //testFiles, 會實際打伺服器之測試檔(api- 與 e2e-); unit- 不起 server 故不參與覆蓋計算, 本檔自身亦不計入
    let testFiles = fs.readdirSync(fdTest)
        .filter((v) => v.endsWith('.test.mjs'))
        .filter((v) => v.startsWith('api-') || v.startsWith('e2e-'))
        .map((v) => path.join(fdTest, v))

    //readCode, 讀原始碼並去除整行註解(避免註解內之範例字串被計入)
    let readCode = (fp) => {
        return fs.readFileSync(fp, 'utf8')
            .split('\n')
            .filter((line) => !/^\s*\/\//.test(line))
            .join('\n')
    }

    let allKeys = Object.keys(downloadRoutes)

    it('軸之成員資料須自洽: requiredFields 為 fields 之子集, 且每個成員皆宣告階段與本體形式', function() {
        for (let k of allKeys) {
            let d = downloadRoutes[k]
            assert.strict.deepEqual(d.key, k, `成員[${k}]之 key 與鍵名不符`)
            assert.strict.deepEqual(['stream', 'json'].includes(d.body), true, `成員[${k}]之 body 須為 stream 或 json`)
            assert.strict.deepEqual(d.stages.includes('field'), true, `成員[${k}]須至少走到 field 階段`)
            assert.strict.deepEqual(d.fields.length > 0, true, `成員[${k}]未宣告 fields`)
            for (let f of d.requiredFields) {
                assert.strict.deepEqual(d.fields.includes(f), true, `成員[${k}]之必要欄位[${f}]不在其 fields 內`)
            }
        }
    })

    it('軸之請求形狀須對得上路由路徑, 且回傳可直接交給 fetch', function() {
        for (let k of allKeys) {
            let { url, init } = downloadRoutes[k].requestOf(9999, 'id-1')
            assert.strict.deepEqual(url.includes(`/api/${k}`), true, `成員[${k}]之 url 不含其路由路徑: ${url}`)
            assert.strict.deepEqual(['GET', 'POST'].includes(init.method), true, `成員[${k}]之 method 異常: ${init.method}`)
            assert.strict.deepEqual(typeof init.headers, 'object', `成員[${k}]未給 headers`)
        }
    })

    it('排除成員須附理由, 且成員名打錯須直接拋錯(不得靜默少跑一輪)', function() {
        assert.strict.deepEqual(downloadRouteKeys(), allKeys)
        assert.strict.deepEqual(downloadRouteKeys({ dwgfn: '有理由' }), allKeys.filter((v) => v !== 'dwgfn'))
        assert.throws(() => downloadRouteKeys({ dwgfn: '' }), /未附理由/)
        assert.throws(() => downloadRouteKeys({ dwgfn: null }), /未附理由/)
        assert.throws(() => downloadRouteKeys({ dwXX: '有理由' }), /不是下載路由軸之成員/)
    })

    it('測試檔不得再手寫路由字面陣列: 少測一個成員只能經 downloadRouteKeys 之理由表達', function() {
        //此正規式抓的是 ['dw', 'dwgf'] 這種把軸的成員抄一份到檔案裡的寫法
        let re = /\[\s*'(dw|dwgf|dwgfn)'\s*,\s*'(dw|dwgf|dwgfn)'/g
        let bad = []
        for (let fp of testFiles) {
            let hits = readCode(fp).match(re)
            if (hits !== null) {
                bad.push(`${fp}: ${hits.join(' / ')}`)
            }
        }
        assert.strict.deepEqual(bad, [], `以下測試檔手寫了下載路由之成員陣列, 應改取自 test/api-axes.mjs:\n${bad.join('\n')}`)
    })

    it('全套測試對下載路由軸之覆蓋聯集須等於成員全集', function() {

        //helpers, 由測試檔內之呼叫還原其列舉到的成員 —— 直接呼叫真正的 helper, 不另寫一份推導
        let helpers = [
            { re: /downloadRouteKeys\(\s*\{([^}]*)\}\s*\)/g, of: (arg) => downloadRouteKeys(Object.fromEntries([...arg.matchAll(/(\w+)\s*:/g)].map((m) => [m[1], 'x']))) },
            { re: /downloadRouteKeys\(\s*\)/g, of: () => downloadRouteKeys() },
            { re: /downloadRouteKeysByBody\(\s*'([^']+)'\s*\)/g, of: (a) => downloadRouteKeysByBody(a) },
            { re: /downloadRouteKeysByStage\(\s*'([^']+)'\s*\)/g, of: (a) => downloadRouteKeysByStage(a) },
            { re: /downloadRouteKeysRequiring\(\s*'([^']+)'\s*\)/g, of: (a) => downloadRouteKeysRequiring(a) },
            { re: /downloadRouteKeysNotRequiring\(\s*'([^']+)'\s*\)/g, of: (a) => downloadRouteKeysNotRequiring(a) },
        ]

        //coveredBy, 每個成員被哪些測試檔觸及
        let coveredBy = {}
        for (let k of allKeys) {
            coveredBy[k] = []
        }
        let mark = (k, fp) => {
            if (coveredBy[k] !== undefined && !coveredBy[k].includes(fp)) {
                coveredBy[k].push(fp)
            }
        }

        for (let fp of testFiles) {
            let code = readCode(fp)

            //經 helper 列舉者
            for (let h of helpers) {
                for (let m of code.matchAll(h.re)) {
                    for (let k of h.of(m[1])) {
                        mark(k, fp)
                    }
                }
            }

            //單一路由之直接呼叫(如 call('dwgfn', ...)、fetchDownload(port, 'dw', ...))
            for (let m of code.matchAll(/(?:call|probe|expectTrapped)\(\s*'(dw|dwgf|dwgfn)'/g)) {
                mark(m[1], fp)
            }
            for (let m of code.matchAll(/fetchDownload\([^,]+,\s*'(dw|dwgf|dwgfn)'/g)) {
                mark(m[1], fp)
            }

            //以原始 socket 或手寫 URL 打路由者(CORS、maxBytes、raw HEAD 等不便經 fetchDownload 表達之情境)
            for (let k of allKeys) {
                if (new RegExp(`/api/${k}(\\?|\`|'|"|\\s)`).test(code)) {
                    mark(k, fp)
                }
            }

        }

        let uncovered = allKeys.filter((k) => coveredBy[k].length === 0)
        assert.strict.deepEqual(uncovered, [], `下載路由軸有成員完全沒有測試觸及: ${uncovered.join(', ')}`)

        //每個成員至少須有兩個檔案觸及 —— 只有一個檔案覆蓋時, 該檔一旦被改窄就整個成員掉出視野而無人察覺
        let thin = allKeys.filter((k) => coveredBy[k].length < 2)
        assert.strict.deepEqual(thin, [], `下載路由軸有成員只被單一測試檔觸及: ${thin.map((k) => `${k}(${coveredBy[k].join(', ')})`).join('; ')}`)

    })

})
