import assert from 'assert'
import fs from 'fs'
import routeSpec from '../src/routeSpec.mjs'
import axes from './tools/api-axes.mjs'

let { allRoutes, downloadRoutes, ulctrModes } = axes


/**
 * unit: src 側之路由差異表(src/routeSpec.mjs)與測試端之路由軸(test/api-axes.mjs)須逐欄一致
 *
 * why 兩端各一份而非共用: 測試軸是契約之翻譯(帳本 R8), src 表是實作之查表; 若測試直接 import src 表, 順序寫錯時兩邊一起錯而全綠。
 * 兩份各自手寫、於此對照, 任一邊改了而另一邊沒改即紅 —— 這正是第十一輪 B2 所指之缺口(api-axes 之 /dwgf fields 順序原本與源碼不一致而無人發現)
 */
describe('unit-routeSpec', function() {

    let keys = ['main', 'ulctr', 'slc', 'dwgfn', 'dwgf', 'dw']

    it('六路由之鍵集合一致, 且每列皆有 apiType / api / authFrom / statusOf(六種 kind 皆有值)', function() {
        assert.strict.deepEqual(Object.keys(routeSpec).sort(), [...keys].sort())
        assert.strict.deepEqual(Object.keys(allRoutes).sort(), [...keys].sort())
        for (let k of keys) {
            let s = routeSpec[k]
            assert.strict.deepEqual(typeof s.apiType, 'string', k)
            assert.strict.deepEqual(typeof s.api, 'string', k)
            assert.strict.deepEqual(['header', 'query'].includes(s.authFrom), true, k)
            assert.strict.deepEqual(Object.keys(s.statusOf).sort(), ['app', 'internal', 'output', 'packet', 'param', 'permission'], k)
        }
    })

    it('apiType、api、event、authFrom 與各種錯誤之狀態碼, src 表與測試軸逐欄相同', function() {
        for (let k of keys) {
            let s = routeSpec[k]
            let a = allRoutes[k]
            assert.strict.deepEqual(s.apiType, a.apiType, k)
            assert.strict.deepEqual(s.api, a.api, k)
            assert.strict.deepEqual(s.event, a.event, `${k}: 所服務之事件(閘門與派發之依據)`)
            assert.strict.deepEqual(s.authFrom, a.authFrom, k)
            for (let kind of Object.keys(a.errorStatus)) {
                assert.strict.deepEqual(s.statusOf[kind], a.errorStatus[kind], `${k}.${kind}`)
            }
        }
    })

    it('下載三路由之欄位讀取與檢核順序(fields)與軸上之 fields 相同, 選用欄位恰為軸上 requiredFields 之補集', function() {
        for (let k of Object.keys(downloadRoutes)) {
            let s = routeSpec[k]
            let d = downloadRoutes[k]
            assert.strict.deepEqual(s.fields.map((f) => f.name), d.fields, `${k}: 順序為契約`)
            let optional = s.fields.filter((f) => f.optional === true).map((f) => f.name)
            let notRequired = d.fields.filter((f) => !d.requiredFields.includes(f))
            assert.strict.deepEqual(optional, notRequired, k)
            assert.strict.deepEqual(s.fields[0].name, 'streamRead', `${k}: streamRead 須排在首位(後續欄位拋錯時串流已在套件手上, 須可清理)`)
        }
        for (let k of ['main', 'ulctr', 'slc']) {
            assert.strict.deepEqual(routeSpec[k].fields, undefined, `${k}: 非下載路由不得有 fields`)
        }
    })

    it('/ulctr 之 mode 軸與 src 一致: 軸之成員全集等於 handler 合法 mode 之字面; 軸上不擋者恰為 src 閘門之豁免字面(第十二輪)', function() {
        //src 之 mode 字面只存在於 handler 之合法性檢核與閘門豁免兩處(非表), 故以原始碼文字對照, 使軸與實作任一邊改了而另一邊沒改即紅
        let src = fs.readFileSync('src/WConverhpServer.mjs', 'utf8')
        let mValid = src.match(/if \(mode !== '([a-z-]+)' && mode !== '([a-z-]+)' && mode !== '([a-z-]+)' && mode !== '([a-z-]+)'\)/)
        assert.strict.deepEqual(mValid !== null, true, '找不到 /ulctr 之 mode 合法性檢核')
        assert.strict.deepEqual(mValid.slice(1).sort(), Object.keys(ulctrModes).sort())
        let exempt = [...src.matchAll(/if \(mode !== '([a-z-]+)'\) \{\r?\n\s+let refused = requireListener\(spec, reply\)/g)].map((m) => m[1])
        assert.strict.deepEqual(exempt, Object.keys(ulctrModes).filter((m) => ulctrModes[m].gated === false), '閘門豁免之 mode 須與軸上 gated:false 者相同')
        for (let m of Object.keys(ulctrModes)) {
            if (ulctrModes[m].gated === false) {
                assert.strict.deepEqual(typeof ulctrModes[m].why === 'string' && ulctrModes[m].why.trim() !== '', true, `${m}: 不擋者須附理由`)
            }
        }
    })

})
