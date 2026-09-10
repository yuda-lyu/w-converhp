import assert from 'assert'
import fs from 'fs'
import w from 'wsemi'
import WConverhpServer from '../src/WConverhpServer.mjs'
import WConverhpClient from '../src/WConverhpClient.mjs'


/**
 * api: 數值選項給數字字串時之檢核與正規化須成對(帳本 R4)
 *
 * 述詞 isp0int/ispint 之 useLimitSafe 仍接受數字字串('1048576' 為 true, 與 isValidFileSize 同一契約),
 * 故凡以述詞檢核者皆須另以 cint 正規化, 否則其 sink 若用 === / !== 比較即出錯。
 *
 * 修正前之具體後果: 伺服器以 sizeSlice:'1048576' 建構時, 該值原樣回傳給 client,
 * 而 client 之 sendDataSlice 以 `resUpCkt.sizeSlice !== sizeSlice` 比對 ——
 * 兩端組態實為同一個值, 卻因一邊是字串一邊是數值而判為 mismatch, **整個上傳被拒絕**。
 * 此為 fileSize/cint 那條規則(帳本 R4)的同型未套站點。
 */
describe('api-optionsNumericString', function() {

    let port = 8226 //同時test故得要不同port
    let pathUploadTemp = './test/_tmp/uploadTemp-api-optionsNumericString'
    let url = `http://127.0.0.1:${port}`
    let sizeSlice = 1024 * 1024
    let wsv = null
    let errs = []
    let uploaded = []

    before(async function() {
        this.timeout(20000)

        //伺服器之數值選項全部給數字字串, 須與給數值時行為完全相同
        wsv = new WConverhpServer({
            port: `${port}`,
            apiName: 'api',
            useInert: false,
            pathUploadTemp,
            sizeSlice: `${sizeSlice}`,
            sizeMsg: `${100 * 1024 * 1024}`,
            delayForSlice: '10',
            verifyConn: async({ authorization }) => {
                return w.isestr(w.strdelleft(authorization, 7))
            },
        })
        wsv.on('upload', (input, pm) => {
            uploaded.push({ path: input.path, size: fs.statSync(input.path).size })
            pm.resolve({ n: fs.statSync(input.path).size })
        })
        wsv.on('execute', (func, input, pm) => {
            pm.resolve({ echo: input })
        })
        wsv.on('error', (e) => errs.push(String(e)))
        wsv.on('handler', () => {})

        await w.delay(1200) //待伺服器啟動

    })

    after(function() {
        wsv.stop()
        try {
            fs.rmSync(pathUploadTemp, { recursive: true, force: true })
        }
        catch (err) {}
    })

    it('伺服器 port 給數字字串時須正常啟動並服務(execute 可完成)', async function() {
        this.timeout(20000)
        let wo = new WConverhpClient({ url, apiName: 'api', getToken: () => 't', retryMain: 0 })
        wo.on('error', () => {})
        let r = await wo.execute('any', { a: 1 })
        assert.strict.deepEqual(r, { echo: { a: 1 } })
    })

    it('兩端 sizeSlice 皆給數字字串時, 上傳須成功(修正前伺服器回報字串, client 以 !== 比對而回 sizeSlice mismatch)', async function() {
        this.timeout(60000)
        errs = []
        uploaded = []
        let wo = new WConverhpClient({ url, apiName: 'api', getToken: () => 't', sizeSlice: `${sizeSlice}`, retryUpload: 0 })
        wo.on('error', () => {})
        let buf = Buffer.alloc(3000, 7)
        let r = await wo.upload('x.bin', buf)
        assert.strict.deepEqual(r, { n: 3000 }, `${JSON.stringify(r)} errs=${JSON.stringify(errs)}`)
        assert.strict.deepEqual(uploaded.length, 1)
        assert.strict.deepEqual(uploaded[0].size, 3000)
    })

    it('伺服器給數字字串而 client 給數值時, 上傳仍須成功(混用亦不得判為 mismatch)', async function() {
        this.timeout(60000)
        errs = []
        uploaded = []
        let wo = new WConverhpClient({ url, apiName: 'api', getToken: () => 't', sizeSlice, retryUpload: 0 })
        wo.on('error', () => {})
        let buf = Buffer.alloc(2500, 3)
        let r = await wo.upload('y.bin', buf)
        assert.strict.deepEqual(r, { n: 2500 }, `${JSON.stringify(r)} errs=${JSON.stringify(errs)}`)
        assert.strict.deepEqual(uploaded[0].size, 2500)
    })

    it('三個公開方法省略選用之 cbProgress 時行為須一致(修正前唯獨 upload 拋 cbProgress is not a function)', async function() {
        //why: send 已對其 opt.cbProgress 補預設, 故 execute 與 download 省略時皆正常;
        //sendDataSlice 直接呼叫 cbProgress 而未補預設, upload 於首片完成時即拋 TypeError —— 同一道防呆兩處寫了一處
        this.timeout(60000)
        let wo = new WConverhpClient({ url, apiName: 'api', getToken: () => 't', sizeSlice, retryMain: 0, retryUpload: 0 })
        wo.on('error', () => {})
        assert.strict.deepEqual(await wo.execute('any', { a: 2 }), { echo: { a: 2 } })
        assert.strict.deepEqual(await wo.upload('nocb.bin', Buffer.alloc(1500, 9)), { n: 1500 })
    })

    it('對照組: 兩端 sizeSlice 真的不同時, 仍須以 sizeSlice mismatch 拒絕(修正不得把該檢核一起關掉)', async function() {
        this.timeout(60000)
        errs = []
        let wo = new WConverhpClient({ url, apiName: 'api', getToken: () => 't', sizeSlice: 512 * 1024, retryUpload: 0 })
        wo.on('error', () => {})
        let buf = Buffer.alloc(2000, 1)
        let r = await wo.upload('z.bin', buf).then(() => 'resolved').catch((msg) => String(msg))
        assert.strict.deepEqual(r.includes('sizeSlice mismatch'), true, r)
    })

})
