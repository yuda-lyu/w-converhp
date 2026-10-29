import assert from 'assert'
import fs from 'fs'
import net from 'net'
import path from 'path'
import w from 'wsemi'
import WConverhpServer from '../src/WConverhpServer.mjs'
import wPorts from './tools/ports.mjs'

let { portOf } = wPorts


/**
 * api: 前端於 admit(等待 verifyConn)期間即中斷時, 串流本體之兩條路由(/main、/slc)須終結並收尾(規則帳本 R12 之延伸, 第十二輪 C 卷 ①-2)
 *
 * 兩條路由皆於 await admit 之後才訂閱請求本體之 end/error/close。前端若在此期間中斷, 那些事件已於訂閱前發過而不會再發:
 * 修正前(實測 tmp/r12/probe_abort_admit.mjs): 兩路由之 handler 皆永不終結且 0 則事件; /slc 另開啟之寫入 fd 永不關閉、不完整切片殘留。
 * 此為「現在的狀態」(訂閱時 req.payload.destroyed 已為真), 可於確定時點判出, 屬套件責任(帳本 R12 分界線); 有限時間之 verifyConn 本身是合法用法(JSDoc 範例即有 await)。
 * parse:true 之三條路由由 hapi 於 handler 前讀完本體, 不在此列。
 *
 * fd 是否關閉以追蹤伺服器建立之 WriteStream 實例判定(同 api-sliceAbort 之作法與理由)
 */
describe('api-abortDuringAdmit', function() {
    this.timeout(60000)

    let port = portOf('api-abortDuringAdmit')
    let pathUploadTemp = './test/_tmp/uploadTemp-api-abortDuringAdmit'
    let wsv = null
    let errs = []
    let tracked = []
    let _cws = fs.createWriteStream

    before(async function() {
        fs.rmSync(pathUploadTemp, { recursive: true, force: true })
        fs.createWriteStream = function(...args) {
            let ws = _cws.apply(this, args)
            tracked.push({ path: String(args[0]), ws })
            return ws
        }
        wsv = new WConverhpServer({
            port,
            useInert: false,
            pathUploadTemp,
            verifyConn: async() => {
                await w.delay(300) //有限之授權等待(合法用法), 前端於此期間中斷
                return true
            },
        })
        wsv.on('error', (e) => errs.push(String(e)))
        wsv.on('execute', (func, input, pm) => pm.resolve({ ok: 1 }))
        wsv.on('upload', (input, pm) => pm.resolve(input))
        await wsv.ready //待伺服器就緒(ready)
    })

    after(async function() {
        fs.createWriteStream = _cws
        await wsv.stop()
        fs.rmSync(pathUploadTemp, { recursive: true, force: true })
    })

    //send, 以原始 socket 送請求; abortMs 有值時只送部分本體並於該毫秒後斷線(宣告之 Content-Length 大於已送長度)
    let send = ({ p, extraHeaders = '', declared, body, abortMs }) => {
        return new Promise((resolve) => {
            let bs = []
            let sock = net.connect(port, '127.0.0.1', () => {
                sock.write(
                    `POST ${p} HTTP/1.1\r\n` +
                    `Host: 127.0.0.1:${port}\r\n` +
                    `Authorization: Bearer t\r\n` +
                    `Content-Type: application/octet-stream\r\n` +
                    extraHeaders +
                    `Content-Length: ${declared}\r\n` +
                    `Connection: close\r\n` +
                    `\r\n`
                )
                sock.write(body)
                if (abortMs) {
                    setTimeout(() => {
                        sock.destroy()
                        resolve({ aborted: true })
                    }, abortMs)
                }
            })
            sock.on('data', (d) => bs.push(d))
            sock.on('close', () => resolve({ aborted: false, raw: Buffer.concat(bs).toString('latin1') }))
            sock.on('error', () => resolve({ aborted: true }))
        })
    }

    let hdSlc = (packageId) => `chunk-index: 0\r\nchunk-total: 1\r\npackage-id: ${packageId}\r\n`

    it('/slc: admit 期間中斷 —— 恰一則中斷事件、寫入串流須關閉(fd 不洩漏)、不完整切片須刪除(修正前 fd 開啟、切片殘留、0 則事件)', async function() {
        errs.length = 0
        tracked.length = 0
        await send({ p: '/api/slc', extraHeaders: hdSlc('admitabort01'), declared: 8192, body: Buffer.alloc(1024, 1), abortMs: 50 })
        //等中斷收尾的最後一個效應(事件 → 寫入串流 destroy → close → 刪除切片): 一則事件已發、串流已 close 且 fd 已釋放、不完整切片已刪, 以條件而非固定毫秒同步
        //(逾上限仍未成立則續行, 由下列斷言以具體訊息失敗; 此上限僅防懸置, 不是同步點)
        let fpChunk = path.resolve(pathUploadTemp, 'admitabort01_0')
        await w.waitFun(() => {
            return errs.length >= 1 && tracked.length >= 1 && tracked.every((t) => t.ws.closed === true && t.ws.fd === null) && fs.existsSync(fpChunk) === false
        }, { timeInterval: 10, attemptNum: 3000 }).catch(() => {})
        assert.strict.deepEqual(errs, ['receive chunk[1/1] of packageId[admitabort01] error: closed before receive'], JSON.stringify(errs))
        for (let t of tracked) {
            assert.strict.deepEqual(t.ws.closed, true, `${path.basename(t.path)}: 寫入串流須關閉`)
            assert.strict.deepEqual(t.ws.fd, null, `${path.basename(t.path)}: fd 須釋放`)
        }
        assert.strict.deepEqual(fs.existsSync(fpChunk), false, '不完整切片須刪除')
    })

    it('/main: admit 期間中斷 —— 須恰發一則中斷事件使該次請求終結(修正前 handler 永不終結且 0 則事件)', async function() {
        errs.length = 0
        await send({ p: '/api/main', declared: 8192, body: Buffer.alloc(1024, 1), abortMs: 50 })
        //等 errs 出現該則中斷事件(admit 回來後 handler 補判 payload.destroyed 時同步發出), 以條件而非固定毫秒同步
        //(逾上限仍未成立則續行, 由下列斷言以具體訊息失敗; 此上限僅防懸置, 不是同步點)
        await w.waitFun(() => errs.length >= 1, { timeInterval: 10, attemptNum: 3000 }).catch(() => {})
        assert.strict.deepEqual(errs, ['receive payload error: closed before receive'], JSON.stringify(errs))
    })

    it('對照組: admit 期間本體已完整送達者照常處理(補判不得誤傷: 本體送達但未被讀取時 payload 並非 destroyed)', async function() {
        errs.length = 0
        tracked.length = 0
        let body = Buffer.alloc(2048, 2)
        let rs = await send({ p: '/api/slc', extraHeaders: hdSlc('admitok01'), declared: body.length, body })
        assert.strict.deepEqual(rs.aborted, false)
        assert.strict.deepEqual(rs.raw.indexOf('200 OK') > 0, true, rs.raw.slice(0, 80))
        assert.strict.deepEqual(fs.statSync(path.resolve(pathUploadTemp, 'admitok01_0')).size, body.length)

        let pkt = Buffer.from(w.obj2u8arr({ func: 'f', input: {} }))
        let rm = await send({ p: '/api/main', declared: pkt.length, body: pkt })
        assert.strict.deepEqual(rm.aborted, false)
        assert.strict.deepEqual(rm.raw.indexOf('return-type: success') > 0, true, rm.raw.slice(0, 200))
        assert.strict.deepEqual(errs, [])
    })

})
