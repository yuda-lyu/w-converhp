import assert from 'assert'
import routeSpec from '../src/routeSpec.mjs'
import { allRoutes, downloadRoutes } from './api-axes.mjs'


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

    it('apiType、api、authFrom 與各種錯誤之狀態碼, src 表與測試軸逐欄相同', function() {
        for (let k of keys) {
            let s = routeSpec[k]
            let a = allRoutes[k]
            assert.strict.deepEqual(s.apiType, a.apiType, k)
            assert.strict.deepEqual(s.api, a.api, k)
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

})
