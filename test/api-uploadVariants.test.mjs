import assert from 'assert'
import fs from 'fs'
import crypto from 'crypto'
import w from 'wsemi'
import WConverhpServer from '../src/WConverhpServer.mjs'
import WConverhpClient from '../src/WConverhpClient.mjs'


describe('api-uploadVariants', function() {

    let port = 8186 //同時test故得要不同port
    let url = `http://localhost:${port}`
    let pathUploadTemp = './test/_tmp/uploadTemp-api-uploadVariants' //各測試檔須用不同暫存資料夾, 避免parallel互相干擾; 須置於 test/_tmp(已 gitignore), 置於專案根目錄時測試進行中 commit 會把暫存檔收進版本庫
    let sizeSlice = 64 * 1024 //縮小切片, 使小檔亦能造出多切片情境
    let wsv = null

    //rsv, 記錄伺服器端收到的上傳結果
    let rsv = []

    //md5
    let md5 = (u8a) => {
        return crypto.createHash('md5').update(Buffer.from(u8a)).digest('hex')
    }

    //mkU8a, 造可辨識內容
    let mkU8a = (n, seed) => {
        let u8a = new Uint8Array(n)
        for (let i = 0; i < n; i++) {
            u8a[i] = (i + seed) % 251
        }
        return u8a
    }

    //recorder
    let mkRecorder = () => {
        let evs = []
        let cb = (msg) => {
            evs.push(msg)
        }
        return { evs, cb }
    }

    before(async function() {

        let opt = {
            port,
            apiName: 'api',
            pathStaticFiles: '.',
            pathUploadTemp,
            sizeSlice, //伺服器與前端之sizeSlice須一致, 否則切片索引對不上
            verifyConn: async({ authorization }) => {
                let token = w.strdelleft(authorization, 7) //刪除Bearer
                return w.isestr(token)
            },
        }

        //new
        wsv = new WConverhpServer(opt)

        wsv.on('upload', (input, pm) => {
            try {

                //讀取合併後檔案, 記錄其內容雜湊供比對
                //注意: 此處不刪除檔案, 因重複上傳去重測試須依賴伺服器已存在該檔
                let b = fs.readFileSync(input.path)

                rsv.push({
                    from: input.from,
                    filename: input.filename,
                    size: b.length,
                    hash: md5(b),
                })

                pm.resolve({ filename: input.filename, size: b.length })
            }
            catch (err) {
                pm.reject('upload error')
            }
        })
        wsv.on('error', () => {})
        wsv.on('handler', () => {})

        await w.delay(1000) //待伺服器啟動

    })

    after(function() {
        wsv.stop()
        try {
            fs.rmSync(pathUploadTemp, { recursive: true, force: true }) //清除本測試之暫存資料夾
        }
        catch (err) {}
    })

    //mkClient
    let mkClient = (o = {}) => {
        return new WConverhpClient({
            url,
            apiName: 'api',
            sizeSlice,
            getToken: () => 'token-for-test',
            ...o,
        })
    }

    it('單一切片(小於sizeSlice)上傳後, 伺服器所得內容須與來源一致', async function() {
        let wo = mkClient()
        wo.on('error', () => {})

        let u8a = mkU8a(10 * 1024, 3) //10KB, 小於64KB故僅1片
        let n0 = rsv.length
        let r = await wo.upload('small.bin', u8a, () => {})

        assert.strict.deepEqual(rsv.length, n0 + 1)
        let last = rsv[rsv.length - 1]
        assert.strict.deepEqual(last.size, u8a.length)
        assert.strict.deepEqual(last.hash, md5(u8a))
        assert.strict.deepEqual(r.filename, 'small.bin')
    })

    it('多切片(大於sizeSlice)上傳後, 伺服器所得內容須與來源一致', async function() {
        let wo = mkClient()
        wo.on('error', () => {})

        let u8a = mkU8a(sizeSlice * 5 + 123, 7) //5片多一點, 確保切片與合併路徑被走到
        let n0 = rsv.length
        await wo.upload('multi.bin', u8a, () => {})

        assert.strict.deepEqual(rsv.length, n0 + 1)
        let last = rsv[rsv.length - 1]
        assert.strict.deepEqual(last.size, u8a.length)
        assert.strict.deepEqual(last.hash, md5(u8a))
        assert.strict.deepEqual(last.from, 'merge-slices-get')
    })

    it('上傳進度須單調遞增至100且m皆為upload', async function() {
        let wo = mkClient()
        wo.on('error', () => {})

        let rec = mkRecorder()
        let u8a = mkU8a(sizeSlice * 4, 11)
        await wo.upload('prog.bin', u8a, rec.cb)

        //須有事件
        assert.strict.deepEqual(rec.evs.length > 0, true)

        //m皆為upload
        assert.strict.deepEqual([...new Set(rec.evs.map((v) => v.m))], ['upload'])

        //單調遞增
        let bMono = true
        for (let i = 1; i < rec.evs.length; i++) {
            if (rec.evs[i].prog < rec.evs[i - 1].prog) {
                bMono = false
            }
        }
        assert.strict.deepEqual(bMono, true)

        //末值須為100
        assert.strict.deepEqual(rec.evs[rec.evs.length - 1].prog, 100)

        //p須為數值
        assert.strict.deepEqual(rec.evs.every((v) => w.isnum(v.p)), true)
    })

    it('中文檔名上傳須可正常處理', async function() {
        let wo = mkClient()
        wo.on('error', () => {})

        let u8a = mkU8a(sizeSlice * 2, 13)
        let r = await wo.upload('中文檔名-測試.bin', u8a, () => {})

        let last = rsv[rsv.length - 1]
        assert.strict.deepEqual(last.filename, '中文檔名-測試.bin')
        assert.strict.deepEqual(last.hash, md5(u8a))
        assert.strict.deepEqual(r.filename, '中文檔名-測試.bin')
    })

    it('重複上傳相同內容時, 伺服器須以既有檔案去重且回傳相同結果', async function() {
        let wo = mkClient()
        wo.on('error', () => {})

        let u8a = mkU8a(sizeSlice * 3, 17)

        //第1次
        let r1 = await wo.upload('dup.bin', u8a, () => {})
        let a1 = rsv[rsv.length - 1]

        //第2次, 內容相同, 伺服器應偵測hash一致而直接回傳
        let r2 = await wo.upload('dup.bin', u8a, () => {})
        let a2 = rsv[rsv.length - 1]

        assert.strict.deepEqual(a1.hash, md5(u8a))
        assert.strict.deepEqual(a2.hash, md5(u8a))
        assert.strict.deepEqual(a2.from, 'check-total-hash') //第2次應走去重路徑
        assert.strict.deepEqual(r1.size, r2.size)
    })

    it('0-byte 檔案上傳後, 伺服器所得須為 0-byte 且雜湊與空內容一致, 進度末值須為100', async function() {
        let wo = mkClient()
        wo.on('error', () => {})

        let rec = mkRecorder()
        let u8a = new Uint8Array(0)
        let n0 = rsv.length
        let r = await wo.upload('empty.bin', u8a, rec.cb)

        assert.strict.deepEqual(rsv.length, n0 + 1)
        let last = rsv[rsv.length - 1]
        assert.strict.deepEqual(last.filename, 'empty.bin')
        assert.strict.deepEqual(last.size, 0)
        assert.strict.deepEqual(last.hash, md5(u8a))
        assert.strict.deepEqual(r, { filename: 'empty.bin', size: 0 })

        //進度: m皆為upload, 末值須為100
        assert.strict.deepEqual(rec.evs.length > 0, true)
        assert.strict.deepEqual([...new Set(rec.evs.map((v) => v.m))], ['upload'])
        assert.strict.deepEqual(rec.evs[rec.evs.length - 1].prog, 100)
    })

    it('權限驗證失敗時, upload須收到permission denied', async function() {
        let wo = mkClient({ getToken: () => '', retryUpload: 0 })
        wo.on('error', () => {})

        let u8a = mkU8a(1024, 23)
        let msg = null
        try {
            await wo.upload('deny.bin', u8a, () => {})
        }
        catch (err) {
            msg = err
        }
        assert.strict.deepEqual(msg, 'permission denied')
    })

})
