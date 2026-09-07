import assert from 'assert'
import crypto from 'crypto'
import w from 'wsemi'
import WConverhpServer from '../src/WConverhpServer.mjs'
import WConverhpClient from '../src/WConverhpClient.mjs'


describe('api-executeProgress', function() {

    let port = 8185 //同時test故得要不同port
    let url = `http://localhost:${port}`
    let apiName = 'myapi' //測試自訂apiName
    let wsv = null

    //md5, 用於驗證資料往返內容一致
    let md5 = (u8a) => {
        return crypto.createHash('md5').update(Buffer.from(u8a)).digest('hex')
    }

    //recorder, 收集進度事件並提供檢核
    let mkRecorder = () => {
        let evs = []
        let cb = (msg) => {
            evs.push(msg)
        }
        let pick = (m) => {
            return evs.filter((v) => v.m === m)
        }
        let isMonotonic = (arr) => {
            for (let i = 1; i < arr.length; i++) {
                if (arr[i].prog < arr[i - 1].prog) {
                    return false
                }
            }
            return true
        }
        return { evs, cb, pick, isMonotonic }
    }

    before(async function() {

        let opt = {
            port,
            apiName,
            pathStaticFiles: '.',
            verifyConn: async({ authorization }) => {
                let token = w.strdelleft(authorization, 7) //刪除Bearer
                return w.isestr(token)
            },
        }

        //new
        wsv = new WConverhpServer(opt)

        wsv.on('execute', (func, input, pm) => {

            if (func === 'echo') {
                //原樣回傳u8a, 供驗證上下行內容一致
                pm.resolve({ u8a: input.u8a })
            }
            else if (func === 'noInput') {
                pm.resolve({ ok: true, hasInput: w.iseobj(input) })
            }
            else {
                pm.reject('invalid func')
            }

        })
        wsv.on('error', () => {})
        wsv.on('handler', () => {})

        await w.delay(1000) //待伺服器啟動

    })

    after(function() {
        wsv.stop()
    })

    //mkClient
    let mkClient = (o = {}) => {
        return new WConverhpClient({
            url,
            apiName,
            getToken: () => 'token-for-test',
            ...o,
        })
    }

    it('2MB資料往返後內容須完全一致(自訂apiName亦須可用)', async function() {
        let wo = mkClient()
        wo.on('error', () => {})

        //u8a, 造2MB可辨識資料
        let n = 2 * 1024 * 1024
        let u8a = new Uint8Array(n)
        for (let i = 0; i < n; i++) {
            u8a[i] = i % 251
        }
        let hashSend = md5(u8a)

        let r = await wo.execute('echo', { u8a }, () => {})

        //伺服器回傳之u8a須與送出者相同
        let u8aRecv = new Uint8Array(Object.values(r.u8a))
        assert.strict.deepEqual(u8aRecv.length, n)
        assert.strict.deepEqual(md5(u8aRecv), hashSend)
    })

    it('execute須回報上傳與下載兩階段進度, 且皆單調遞增至100', async function() {
        let wo = mkClient()
        wo.on('error', () => {})

        let rec = mkRecorder()
        let n = 2 * 1024 * 1024
        let u8a = new Uint8Array(n)
        await wo.execute('echo', { u8a }, rec.cb)

        let ups = rec.pick('upload')
        let dws = rec.pick('download')

        //兩階段皆須有事件
        assert.strict.deepEqual(ups.length > 0, true)
        assert.strict.deepEqual(dws.length > 0, true)

        //m僅允許upload與download
        let ms = [...new Set(rec.evs.map((v) => v.m))].sort()
        assert.strict.deepEqual(ms, ['download', 'upload'])

        //單調遞增
        assert.strict.deepEqual(rec.isMonotonic(ups), true)
        assert.strict.deepEqual(rec.isMonotonic(dws), true)

        //末值須為100
        assert.strict.deepEqual(ups[ups.length - 1].prog, 100)
        assert.strict.deepEqual(dws[dws.length - 1].prog, 100)

        //p須為數值且末值大於0
        assert.strict.deepEqual(rec.evs.every((v) => w.isnum(v.p)), true)
        assert.strict.deepEqual(ups[ups.length - 1].p > 0, true)
    })

    it('getToken回傳Promise時亦須可正常呼叫', async function() {
        let wo = mkClient({
            getToken: async() => {
                await w.delay(50)
                return 'token-for-test'
            },
        })
        wo.on('error', () => {})
        let r = await wo.execute('noInput', {}, () => {})
        assert.strict.deepEqual(r.ok, true)
    })

    it('空input亦須可正常呼叫', async function() {
        let wo = mkClient()
        wo.on('error', () => {})
        let r = await wo.execute('noInput', {}, () => {})
        assert.strict.deepEqual(r, { ok: true, hasInput: false })
    })

})
