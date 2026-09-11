import assert from 'assert'
import fs from 'fs'
import path from 'path'
import w from 'wsemi'
import mmg from '../src/managerMergeSlices.mjs'


/**
 * unit: 合併狀態載體之不變式「.done 存在 ⇒ 合併檔之雜湊 = fileHash」之世代重置
 *
 * 缺陷(第十輪 D1, tmp/probe_r10_stale.mjs): .done 不隨新一代合併失效。
 * 同一檔案曾合併完成並被應用端移走(S4, .done 留下)→ 使用者依訊息重新上傳 → 新一代合併途中行程中止(合併檔寫一半),
 * 重啟後 qGet 見「合併檔 + .done」即判 S2 而消費殘檔(實測殘檔 100000 / 完整 300000 以 success 交出);
 * 補傳切片後重推亦被 qPush 判為已完成而 no-op —— 此後該檔每次上傳皆交出殘檔。
 *
 * 行程中止無法於單元測試中穩定重現, 故本檔驗的是**使該狀態不可達之不變式**:
 * 開始新一代合併之 push 回傳時, 上一代之 .done 須已不存在(合併以 setTimeout 脫勾, await push 回來時必尚未開始, 故判定確定)。
 * 端對端之中止重現見驗收探針 tmp/probe_r10_crash.mjs。
 */
describe('unit-mergeGeneration', function() {
    this.timeout(30000)

    let fd = path.resolve('./test/_tmp/unit-mergeGeneration')

    let full = Buffer.alloc(200000)
    for (let i = 0; i < full.length; i++) {
        full[i] = (i * 17) % 256
    }

    before(function() {
        fs.rmSync(fd, { recursive: true, force: true })
        fs.mkdirSync(fd, { recursive: true })
    })

    it('S4 後重新上傳而開始新一代合併時, push 回傳當下上一代之 .done 須已被清除(修正前殘留)', async function() {
        let h = await w.getFileXxHash(new Blob([full]))
        let fp = path.resolve(fd, h)
        fs.writeFileSync(`${fp}.done`, '', 'utf8') //上一代之 .done(合併檔已被應用端移走)
        fs.writeFileSync(`${fp}_0`, full) //新一代之完整切片

        let id = await mmg.push(h, 1, fd)
        assert.strict.deepEqual(w.isestr(id), true)
        assert.strict.deepEqual(fs.existsSync(`${fp}.done`), false, '新一代合併開始前, 上一代之 .done 須已失效, 否則合併中止後殘檔會被當成已完成')

        //對照: 新一代合併完成後 .done 須重新出現, 且合併檔完整
        let t0 = Date.now()
        while (!fs.existsSync(`${fp}.done`) && Date.now() - t0 < 10000) {
            await w.delay(50)
        }
        assert.strict.deepEqual(fs.existsSync(`${fp}.done`), true, '新一代合併完成後須寫 .done')
        assert.strict.deepEqual(fs.statSync(fp).size, full.length)
    })

})
