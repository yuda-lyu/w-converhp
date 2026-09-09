import assert from 'assert'
import fs from 'fs'
import path from 'path'
import w from 'wsemi'
import u8arr2obj from 'wsemi/src/u8arr2obj.mjs'
import WConverhpServer from '../src/WConverhpServer.mjs'


/**
 * api: 三條下載路由對同一種應用端失敗之回應訊息與 error 事件次數須一致
 *
 * 修正前 /dwgfn 缺 haskey(out,'error') 之早返, 使應用端拒絕落入下方之形狀檢核, 造成兩個問題:
 *   (1) 回前端之訊息為 'invalid filename' 而非另兩路由之 'can not get file from fileId' —— 同一失敗三路由兩種說法, 且訊息誤導(應用端明明是拒絕, 不是沒給檔名)
 *   (2) 應用端形狀錯誤(缺 filename)時 /dw 發一則 error 事件而 /dwgfn 發 0 則 —— 瀏覽器下載管理器路徑必先走 /dwgfn, 該模式下應用端少掉唯一的伺服器端觀測訊號
 * 而「只在 invalid filename 分支補一則 eeEmit」是不安全的修法: 監聽器同步拋錯時 safe emitter 已先發過一則,
 * 補發即成同一請求兩則. 故修法為複製 /dw 之控制流(先分流拒絕, 形狀檢核只處理「真的 resolve 了但形狀不對」)
 */
describe('api-downloadEvents', function() {

    let port = 8219 //同時test故得要不同port
    let pathUploadTemp = './test/_tmp/uploadTemp-api-downloadEvents'
    let fpSrc = path.resolve('test/1mb.7z')
    let sizeSrc = fs.statSync(fpSrc).size
    let wsv = null
    let errs = []

    before(async function() {

        wsv = new WConverhpServer({
            port,
            apiName: 'api',
            useInert: false,
            pathUploadTemp,
            verifyConn: async({ authorization }) => {
                return w.isestr(w.strdelleft(authorization, 7))
            },
        })
        wsv.on('download', (input, pm) => {
            let id = input.fileId
            let base = { filename: 'x.bin', fileSize: sizeSrc, fileType: 'application/octet-stream' }
            if (id === 'ok') {
                pm.resolve({ ...base, streamRead: fs.createReadStream(fpSrc) })
            }
            else if (id === 'reject') {
                pm.reject('app rejected')
            }
            else if (id === 'no-filename') {
                pm.resolve({ streamRead: fs.createReadStream(fpSrc), fileSize: sizeSrc, fileType: 'application/octet-stream' })
            }
            else if (id === 'resolve-null') {
                pm.resolve(null)
            }
            else if (id === 'listener-throw') {
                throw new Error('listener boom')
            }
            else {
                pm.reject('invalid fileId')
            }
        })
        wsv.on('error', (e) => errs.push(String(e)))
        wsv.on('handler', () => {})

        await w.delay(1000) //待伺服器啟動

    })

    after(function() {
        wsv.stop()
        try {
            fs.rmSync(pathUploadTemp, { recursive: true, force: true })
        }
        catch (err) {}
    })

    let call = async(route, fileId) => {
        let r = null
        if (route === 'dw') {
            r = await fetch(`http://127.0.0.1:${port}/api/dw`, { method: 'POST', headers: { 'Authorization': 'Bearer t', 'Content-Type': 'application/json' }, body: JSON.stringify({ fileId }) })
        }
        else if (route === 'dwgfn') {
            r = await fetch(`http://127.0.0.1:${port}/api/dwgfn`, { method: 'POST', headers: { 'Authorization': 'Bearer t', 'Content-Type': 'application/json' }, body: JSON.stringify({ fileId }) })
        }
        else {
            r = await fetch(`http://127.0.0.1:${port}/api/dwgf?fileId=${encodeURIComponent(fileId)}&token=t`)
        }
        let buf = Buffer.from(await r.arrayBuffer())
        let rt = r.headers.get('return-type')
        return { status: r.status, returnType: rt, error: rt === 'error' ? u8arr2obj(new Uint8Array(buf)).error : undefined }
    }

    //probe, 取某路由某案例之回應與 error 事件數
    let probe = async(route, fileId) => {
        errs = []
        let r = await call(route, fileId)
        await w.delay(200) //eeEmit 為 setTimeout 發送
        return { ...r, nErrs: errs.length, errs: [...errs] }
    }

    it('應用端 reject 時, 三路由之錯誤訊息須一致為 can not get file from fileId(修正前 /dwgfn 回 invalid filename)', async function() {
        this.timeout(20000)
        for (let route of ['dw', 'dwgf', 'dwgfn']) {
            let r = await probe(route, 'reject')
            assert.strict.deepEqual(r.returnType, 'error', `${route}: ${JSON.stringify(r)}`)
            assert.strict.deepEqual(r.error, 'can not get file from fileId', `${route}: ${JSON.stringify(r)}`)
        }
    })

    it('應用端 reject 時, 三路由之 error 事件皆須為 0 則(此為既有對稱行為, 不得因本次修正而改變)', async function() {
        this.timeout(20000)
        for (let route of ['dw', 'dwgf', 'dwgfn']) {
            let r = await probe(route, 'reject')
            assert.strict.deepEqual(r.nErrs, 0, `${route}: ${JSON.stringify(r)}`)
        }
    })

    it('應用端形狀錯誤(缺 filename)時, /dwgfn 與 /dw 皆須發恰好一則 error 事件(修正前 /dwgfn 為 0 則)', async function() {
        this.timeout(20000)
        for (let route of ['dwgfn', 'dw']) {
            let r = await probe(route, 'no-filename')
            assert.strict.deepEqual(r.error, 'invalid filename', `${route}: ${JSON.stringify(r)}`)
            assert.strict.deepEqual(r.nErrs, 1, `${route}: ${JSON.stringify(r)}`)
            assert.strict.deepEqual(r.errs[0].includes('download fileId[no-filename]'), true, r.errs[0])
        }
    })

    it('應用端 resolve 非物件時, /dwgfn 須發恰好一則 error 事件', async function() {
        this.timeout(20000)
        let r = await probe('dwgfn', 'resolve-null')
        assert.strict.deepEqual(r.error, 'invalid filename', JSON.stringify(r))
        assert.strict.deepEqual(r.nErrs, 1, JSON.stringify(r))
    })

    it('監聽器同步拋錯時, 三路由皆須恰好一則 error 事件, 不得因補發而變兩則', async function() {
        this.timeout(20000)
        for (let route of ['dw', 'dwgf', 'dwgfn']) {
            let r = await probe(route, 'listener-throw')
            assert.strict.deepEqual(r.error, 'can not get file from fileId', `${route}: ${JSON.stringify(r)}`)
            assert.strict.deepEqual(r.nErrs, 1, `${route}: ${JSON.stringify(r)} errs=${JSON.stringify(r.errs)}`)
            assert.strict.deepEqual(r.errs[0].includes('listener of event[download] error'), true, r.errs[0])
        }
    })

    it('對照組: 正常下載三路由皆不發 error 事件', async function() {
        this.timeout(20000)
        for (let route of ['dw', 'dwgf', 'dwgfn']) {
            let r = await probe(route, 'ok')
            assert.strict.deepEqual(r.nErrs, 0, `${route}: ${JSON.stringify(r)}`)
        }
    })

})
