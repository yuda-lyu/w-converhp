import assert from 'assert'
import fs from 'fs'
import path from 'path'
import w from 'wsemi'
import WConverhpServer from '../src/WConverhpServer.mjs'
import WConverhpClient from '../src/WConverhpClient.mjs'
import axes from './tools/api-axes.mjs'
import wPorts from './tools/ports.mjs'

let { portOf } = wPorts

let { ulctrModes } = axes


/**
 * api: 應用端未註冊 upload 監聽器時, 上傳管線受理新工作之請求須於產生任何副作用前即以錯誤封包終結(規則帳本 R12 之延伸, 第十二輪)
 *
 * 修正前之徵狀(讀碼 + 實測, 見 tmp/r12-全盤.md 表 A1、A5 與 tmp/r12-複審彙整.md):
 *   /slc 寫入切片檔並回 success、0 則事件 —— verifyConn 未給(預設全放行)時任何匿名請求皆可寫入 pathUploadTemp, 且不用上傳者永遠不會清理
 *   /ulctr check-total-hash、check-slices-hash 回 success; merge-slices-push 受理合併, 切片不存在時亦寫一個 <fileHash>.error
 *   官方 client 之 upload() 因此把整檔傳完、合併完(留下合併檔與 .done), 才於 merge-slices-get 失敗並依設計無限輪詢
 * 而 /main 與三條下載路由早已於派發前判定(R12 第九輪), 上傳管線為同一規則之未套站點。
 *
 * 本檔之軸: 上傳管線之入口(/slc, 與 /ulctr 之 mode, 成員取自 test/tools/api-axes.mjs 之 ulctrModes, 遵 R8)× upload 接聽狀態(無 / 有 / 有 → 移除 / once 已消費);
 * 另含合併佇列在途消費之跨實例隔離(第十二輪 C 卷 ①-1)與官方 client upload() 之端對端。
 * merge-slices-get 刻意不經閘門(已承接工作之查詢、結果回放與狀態復原), 本檔以 S0、S2、S3、once 在途、損毀 .ro 各格鎖住其既有判定,
 * 防止閘門被擴大到整條 /ulctr(以「閘門擴及 merge-slices-get」之變異驗紅)。
 *
 * 無接聽者之夾具伺服器刻意註冊 execute 與 download、唯獨不註冊 upload: 使「閘門查錯事件名」不靠訊息字串亦會被抓到(第十二輪 A 卷 ③-6)
 */
describe('api-uploadNoListener', function() {
    this.timeout(60000)

    let portA = portOf('api-uploadNoListener') //無 upload 接聽者
    let portB = portOf('api-uploadNoListener', 1) //有 upload 接聽者(各對照組), 案例內視需要移除再還原
    let portC = portOf('api-uploadNoListener', 2) //第二實例(在途消費之跨實例隔離)
    let fdA = path.resolve('./test/_tmp/uploadTemp-api-uploadNoListener-a')
    let fdB = path.resolve('./test/_tmp/uploadTemp-api-uploadNoListener-b')
    let fdC = path.resolve('./test/_tmp/uploadTemp-api-uploadNoListener-c')
    let sizeSlice = 1024
    let msgNoListener = 'no listener for event[upload]'
    let wsvA = null
    let wsvB = null
    let wsvC = null
    let errsA = []
    let errsB = []
    let errsC = []

    //nUploadB, onUploadB, B 之正規接聽者
    let nUploadB = 0
    let onUploadB = (input, pm) => {
        nUploadB += 1
        pm.resolve({ n: nUploadB })
    }

    //tracked, 伺服器建立之寫入串流(用於斷言 /slc 被擋時根本未開檔: 先開檔再拒絕會截斷既有切片)
    let tracked = []
    let _cws = fs.createWriteStream

    before(async function() {
        for (let fd of [fdA, fdB, fdC]) {
            fs.rmSync(fd, { recursive: true, force: true })
        }
        fs.createWriteStream = function(...args) {
            let ws = _cws.apply(this, args)
            tracked.push(String(args[0]))
            return ws
        }
        wsvA = new WConverhpServer({ port: portA, useInert: false, pathUploadTemp: fdA, sizeSlice })
        wsvA.on('error', (e) => errsA.push(String(e)))
        wsvA.on('execute', (func, input, pm) => pm.resolve({ ok: 1 }))
        wsvA.on('download', (input, pm) => pm.reject('no file'))
        wsvB = new WConverhpServer({ port: portB, useInert: false, pathUploadTemp: fdB, sizeSlice })
        wsvB.on('error', (e) => errsB.push(String(e)))
        wsvB.on('upload', onUploadB)
        wsvC = new WConverhpServer({ port: portC, useInert: false, pathUploadTemp: fdC, sizeSlice })
        wsvC.on('error', (e) => errsC.push(String(e)))
        await w.delay(800)
    })

    after(async function() {
        fs.createWriteStream = _cws
        await wsvA.stop()
        await wsvB.stop()
        await wsvC.stop()
        for (let fd of [fdA, fdB, fdC]) {
            fs.rmSync(fd, { recursive: true, force: true })
        }
    })

    //files, 暫存夾內之檔名(排序), 供「無任何新檔」之斷言
    let files = (fd) => {
        return fs.existsSync(fd) ? fs.readdirSync(fd).sort() : []
    }

    //parse, 解析本套件之 octet-stream 回應
    let parse = async(r) => {
        let o = w.u8arr2obj(new Uint8Array(Buffer.from(await r.arrayBuffer())))
        return { status: r.status, returnType: r.headers.get('return-type'), body: o }
    }

    //slc, 送一個切片
    let slc = async(port, buf, chunkIndex, chunkTotal, packageId) => {
        let r = await fetch(`http://127.0.0.1:${port}/api/slc`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer t', 'Content-Type': 'application/octet-stream', 'chunk-index': String(chunkIndex), 'chunk-total': String(chunkTotal), 'package-id': packageId },
            body: buf,
        })
        return await parse(r)
    }

    //ulctr, 送一個控制請求
    let ulctr = async(port, payload) => {
        let r = await fetch(`http://127.0.0.1:${port}/api/ulctr`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer t', 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        })
        return await parse(r)
    }

    //waitFile, 等檔案出現(合併於脫勾後以 worker 進行)
    let waitFile = async(fp, limit = 20000) => {
        let t0 = Date.now()
        while (Date.now() - t0 < limit) {
            if (fs.existsSync(fp)) {
                return true
            }
            await w.delay(50)
        }
        return false
    }

    //uploadMerged, 以真實請求走到「已合併、未消費」(S2 之前置): 切片 → push → 等 .done; 須於有接聽者時呼叫(否則被閘門擋)
    //以真實操作構造狀態而非靜態構造(帳本經驗 E16)
    let uploadMerged = async(port, fd, seed) => {
        let parts = [Buffer.alloc(sizeSlice, seed), Buffer.alloc(sizeSlice, seed + 1), Buffer.alloc(100, seed + 2)]
        let fileHash = await w.getFileXxHash(new Blob([Buffer.concat(parts)]))
        for (let i = 0; i < parts.length; i++) {
            let rs = await slc(port, parts[i], i, parts.length, fileHash)
            assert.strict.deepEqual(rs.returnType, 'success', `前置 slice ${i}: ${JSON.stringify(rs)}`)
        }
        let rp = await ulctr(port, { ...ulctrModes['merge-slices-push'].payloadOf(fileHash), chunkTotal: parts.length })
        let queueId = rp.body.success && rp.body.success.queueId
        assert.strict.deepEqual(w.isestr(queueId), true, `前置 push: ${JSON.stringify(rp)}`)
        assert.strict.deepEqual(await waitFile(path.resolve(fd, `${fileHash}.done`)), true, '前置: 合併須完成')
        return { fileHash, queueId }
    }

    //get, merge-slices-get
    let get = async(port, fileHash, queueId) => {
        return await ulctr(port, ulctrModes['merge-slices-get'].payloadOf(fileHash, queueId))
    }

    //assertRefused, 被閘門擋下之觀察值: HTTP 200 + Return-Type error + 錯誤封包為無人接聽(不標示不重試) + 恰一則同訊息之事件(帳本 R5)
    let assertRefused = (r, errs, label) => {
        assert.strict.deepEqual(r.status, 200, `${label}: ${JSON.stringify(r)}`)
        assert.strict.deepEqual(r.returnType, 'error', `${label}: ${JSON.stringify(r)}`)
        assert.strict.deepEqual(r.body.error, msgNoListener, `${label}: ${JSON.stringify(r)}`)
        assert.strict.deepEqual(r.body.retryable, undefined, `${label}: 接聽者可能稍後註冊, 屬狀態不穩, 不得標示不重試`)
        assert.strict.deepEqual(errs, [msgNoListener], `${label}: 事件須恰一則, 實得 ${JSON.stringify(errs)}`)
    }

    it('/slc: 無接聽者時不得開檔(既有切片之內容不變、0 次 createWriteStream)、暫存夾無變化, 回無人接聽之錯誤封包且恰一則事件(修正前落檔並回 success)', async function() {
        //既有切片之內容哨兵: 若實作先開檔(寫入模式即截斷)再拒絕, 只看檔名清單驗不出
        fs.mkdirSync(fdA, { recursive: true })
        let fpSentinel = path.resolve(fdA, 'nolsn01_0')
        fs.writeFileSync(fpSentinel, 'SENTINEL', 'utf8')
        let fs0 = files(fdA)
        errsA.length = 0
        tracked.length = 0
        let r = await slc(portA, Buffer.alloc(16, 1), 0, 1, 'nolsn01')
        await w.delay(300)
        assert.strict.deepEqual(tracked, [], '不得開啟任何寫入串流')
        assert.strict.deepEqual(fs.readFileSync(fpSentinel, 'utf8'), 'SENTINEL', '既有切片之內容不得被改動')
        assert.strict.deepEqual(files(fdA), fs0, '暫存夾不得有任何變化')
        assertRefused(r, errsA, '/slc')
    })

    it('/ulctr 受理新工作之各 mode(成員取自 ulctrModes 之 gated): 無接聽者時暫存夾無變化(含 push 不產生 .error), 回無人接聽之錯誤封包且恰一則事件(修正前回 success)', async function() {
        let modes = Object.keys(ulctrModes).filter((m) => ulctrModes[m].gated)
        assert.strict.deepEqual(modes.length >= 3, true, `前提: 受閘門約束之 mode 須至少三個, 實得 ${modes.join(',')}`)
        for (let m of modes) {
            let fs0 = files(fdA)
            errsA.length = 0
            let r = await ulctr(portA, ulctrModes[m].payloadOf('abcdef0123456789'))
            await w.delay(1000) //合併於脫勾後以 worker 進行, 修正前之 .error 於回應之後才出現, 須等足再驗(B 卷 ①-10)
            assert.strict.deepEqual(files(fdA), fs0, `${m}: 暫存夾不得有任何變化`)
            assertRefused(r, errsA, m)
        }
    })

    it('merge-slices-get 不經閘門(S0): 無接聽者時查詢不存在之任務仍回原本之 no merge task', async function() {
        //fileHash 刻意與上一案例不同: 修正前上一案例之 push 會留下 .error 而使本格落到 S5, 與閘門無關
        errsA.length = 0
        let r = await get(portA, 'fedcba9876543210', '20261013000000|abcdef|fedcba9876543210')
        await w.delay(200)
        assert.strict.deepEqual(r.returnType, 'success', JSON.stringify(r))
        assert.strict.deepEqual(r.body.success.state, 'error', JSON.stringify(r))
        assert.strict.deepEqual(r.body.success.msg, 'no merge task', JSON.stringify(r))
        assert.strict.deepEqual(errsA.length, 1, JSON.stringify(errsA))
        assert.strict.deepEqual(errsA[0].includes(msgNoListener), false, `不得被判為無人接聽: ${errsA[0]}`)
    })

    it('對照組: 有接聽者時 /slc 照常落檔並回 success, 且無任何事件', async function() {
        errsB.length = 0
        let r = await slc(portB, Buffer.alloc(16, 2), 0, 1, 'lsn01')
        await w.delay(200)
        assert.strict.deepEqual(r.returnType, 'success', JSON.stringify(r))
        assert.strict.deepEqual(fs.readFileSync(path.resolve(fdB, 'lsn01_0')).length, 16)
        assert.strict.deepEqual(errsB, [])
    })

    it('merge-slices-get S2 × 無接聽者: 合併完成而接聽者已移除時, 每次查詢各回錯誤封包且恰一則事件、不寫 .ro、不懸置; 補註冊後可正常消費(由 callApp 於派發點判定)', async function() {
        let { fileHash, queueId } = await uploadMerged(portB, fdB, 30)
        wsvB.off('upload', onUploadB)
        try {
            for (let k = 0; k < 2; k++) {
                errsB.length = 0
                let r = await get(portB, fileHash, queueId)
                await w.delay(200)
                assertRefused(r, errsB, `S2 第 ${k + 1} 次`)
                assert.strict.deepEqual(files(fdB).some((v) => v.startsWith(`${fileHash}.q`)), false, '不得寫 .ro')
            }
        }
        finally {
            wsvB.on('upload', onUploadB)
        }
        errsB.length = 0
        let r2 = await get(portB, fileHash, queueId)
        assert.strict.deepEqual(r2.body.success && r2.body.success.state, 'success', `補註冊後須可消費: ${JSON.stringify(r2)}`)
        assert.strict.deepEqual(errsB, [])
    })

    it('merge-slices-get 在途共用 × once 已消費: 首次查詢派發後 once 接聽者即不存在, 同一隊列之併發查詢仍須共用在途結果而成功(正向對照)', async function() {
        let { fileHash, queueId } = await uploadMerged(portB, fdB, 40)
        wsvB.off('upload', onUploadB)
        try {
            wsvB.once('upload', (input, pm) => {
                setTimeout(() => pm.resolve({ once: true }), 600) //在途 600ms
            })
            errsB.length = 0
            let p1 = get(portB, fileHash, queueId)
            await w.delay(150) //待第一個查詢已派發(once 已消費, listenerCount 為 0)
            assert.strict.deepEqual(wsvB.listenerCount('upload'), 0, '前提: once 已消費')
            let p2 = get(portB, fileHash, queueId)
            let [r1, r2] = await Promise.all([p1, p2])
            assert.strict.deepEqual(r1.body.success && r1.body.success.msg, { once: true }, JSON.stringify(r1))
            assert.strict.deepEqual(r2.body.success && r2.body.success.msg, { once: true }, `第二個查詢須共用在途結果: ${JSON.stringify(r2)}`)
            assert.strict.deepEqual(errsB, [])
        }
        finally {
            wsvB.on('upload', onUploadB)
        }
    })

    it('S3 回放: 應用端已消費之上傳, 移除接聽者後以同一 queueId 重送須回同一結果、不呼叫應用端、無事件; 其後之 push 須被擋; .ro 損毀時降為 S2 而回無人接聽(兩件失敗各一則)', async function() {
        let { fileHash, queueId } = await uploadMerged(portB, fdB, 50)
        let nBefore = nUploadB
        let first = await get(portB, fileHash, queueId)
        assert.strict.deepEqual(first.body.success && first.body.success.state, 'success', JSON.stringify(first))
        assert.strict.deepEqual(nUploadB, nBefore + 1)

        wsvB.off('upload', onUploadB)
        try {
            assert.strict.deepEqual(wsvB.listenerCount('upload'), 0, '前提: 接聽者須已移除')

            //重送: 須回儲存之同一結果
            errsB.length = 0
            let again = await get(portB, fileHash, queueId)
            await w.delay(200)
            assert.strict.deepEqual(again.returnType, 'success', `S3 回放不得被擋: ${JSON.stringify(again)}`)
            assert.strict.deepEqual(again.body.success.state, 'success', JSON.stringify(again))
            assert.strict.deepEqual(again.body.success.msg, first.body.success.msg, '回放須得與首次相同之結果')
            assert.strict.deepEqual(nUploadB, nBefore + 1, '回放不得再呼叫應用端')
            assert.strict.deepEqual(errsB, [], `回放不得發事件: ${JSON.stringify(errsB)}`)

            //曾註冊後移除: 之後之 push 須被擋(修正前會驗證既有合併檔並回 queueId)
            let fs0 = files(fdB)
            errsB.length = 0
            let rp2 = await ulctr(portB, { ...ulctrModes['merge-slices-push'].payloadOf(fileHash), chunkTotal: 3 })
            await w.delay(1000)
            assert.strict.deepEqual(files(fdB), fs0, 'push(接聽者已移除): 暫存夾不得有任何變化')
            assertRefused(rp2, errsB, 'push(接聽者已移除)')

            //.ro 損毀: S3 不成立而降為 S2, 無接聽者 → 錯誤封包; 「儲存結果損毀」與「無人接聽」為兩件不同失敗, 各一則(帳本 R5)
            let ro = files(fdB).find((v) => v.startsWith(`${fileHash}.q`) && v.endsWith('.ro'))
            assert.strict.deepEqual(w.isestr(ro), true, '前提: 須有 .ro')
            fs.writeFileSync(path.resolve(fdB, ro), Buffer.from([1, 2, 3, 4]))
            errsB.length = 0
            let rc = await get(portB, fileHash, queueId)
            await w.delay(200)
            assert.strict.deepEqual(rc.body.error, msgNoListener, JSON.stringify(rc))
            assert.strict.deepEqual(errsB.length, 2, JSON.stringify(errsB))
            assert.strict.deepEqual(errsB[0].includes('corrupted'), true, errsB[0])
            assert.strict.deepEqual(errsB[1], msgNoListener)
        }
        finally {
            wsvB.on('upload', onUploadB)
        }
    })

    it('在途消費之跨實例隔離: 他實例(不同暫存夾、無接聽者)以本實例在途之 queueId 查詢, 不得取得本實例之結果(修正前共用在途 promise 而回本實例之應用端結果)', async function() {
        //前置: 同一檔分別於 B、C 合併完成(兩暫存夾皆有該 fileHash 之合併檔與 .done)
        let seed = 60
        let { fileHash, queueId: qB } = await uploadMerged(portB, fdB, seed)
        let onUploadC = (input, pm) => pm.resolve({ from: 'C' })
        wsvC.on('upload', onUploadC)
        await uploadMerged(portC, fdC, seed)
        wsvC.off('upload', onUploadC)

        //B: 改為慢接聽者使消費在途
        wsvB.off('upload', onUploadB)
        try {
            wsvB.on('upload', (input, pm) => {
                setTimeout(() => pm.resolve({ secret: 'belongs to B' }), 800)
            })
            let pB = get(portB, fileHash, qB)
            await w.delay(200) //待 B 之消費已在途
            errsC.length = 0
            let rC = await get(portC, fileHash, qB)
            await w.delay(200)
            assert.strict.deepEqual(rC.body.success && rC.body.success.msg, undefined, `C 不得取得 B 之結果: ${JSON.stringify(rC)}`)
            assert.strict.deepEqual(rC.body.error, msgNoListener, `C 無接聽者, 須回無人接聽: ${JSON.stringify(rC)}`)
            assert.strict.deepEqual(errsC, [msgNoListener])
            let rB = await pB
            assert.strict.deepEqual(rB.body.success && rB.body.success.msg, { secret: 'belongs to B' }, '對照: B 自己之查詢照常')
        }
        finally {
            wsvB.removeAllListeners('upload')
            wsvB.on('upload', onUploadB)
        }
    })

    it('官方 client 之 upload(): 無接聽者時於第一個請求(check-total-hash)即收到錯誤, 不傳任何資料(修正前傳完整檔、留下合併檔與 .done 後無限輪詢)', async function() {
        //本格排在檔末: 修正前 client 之合併輪詢(setInterval)無取消 API, 會持續打同一埠而污染其後之案例(B 卷 ③-3)
        let wc = new WConverhpClient({ url: `http://127.0.0.1:${portA}`, sizeSlice, retryUpload: 0, retryMain: 0 })
        let cerrs = []
        wc.on('error', (e) => cerrs.push(String(e)))
        let fs0 = files(fdA)
        errsA.length = 0
        let r = await Promise.race([
            wc.upload('a.bin', Buffer.alloc(sizeSlice * 3, 3), () => {}).then((v) => ({ value: v }), (e) => ({ reason: e })),
            w.delay(15000).then(() => ({ timeout: true })),
        ])
        assert.strict.deepEqual(r.timeout, undefined, 'upload() 不得懸置(修正前傳完切片後無限輪詢)')
        assert.strict.deepEqual(files(fdA), fs0, '暫存夾不得有任何新檔(修正前留下合併檔與 .done)')
        assert.strict.deepEqual(r.value, undefined, `upload() 不得成功: ${JSON.stringify(r)}`)
        assert.strict.deepEqual(String(r.reason).includes(msgNoListener), true, `拒絕原因須為無人接聽: ${String(r.reason)}`)
        assert.strict.deepEqual(errsA, [msgNoListener], `retryUpload 為 0 時伺服器恰收一個請求、發一則事件: ${JSON.stringify(errsA)}`)
        assert.strict.deepEqual(cerrs.length, 1, `client 之一次嘗試失敗恰一則事件: ${JSON.stringify(cerrs)}`)
    })

})
