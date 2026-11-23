/**
 * console 輸出之攔截(診斷輸出測試之共用層, 不帶 .test. 中綴)
 *
 * 觀察面: console.log/error/warn/info 與 process.stdout/stderr.write(伺服端之 worker 執行緒輸出經後者回主執行緒)。
 * 使用: let cp = capture(); try { ... } finally { cp.stop() }; 其後以 cp.recs 斷言(每筆為 { ch, args })。
 * 攔截期間 mocha 之報告器不會寫出(報告於測試結束後才印), 惟須確保 stop 於同一測試內呼叫。
 */
import util from 'util'


//capture, 開始攔截; 回傳 { recs, stop }
function capture() {
    let recs = []
    let o = { log: console.log, error: console.error, warn: console.warn, info: console.info, out: process.stdout.write, err: process.stderr.write }
    for (let ch of ['log', 'error', 'warn', 'info']) {
        console[ch] = (...args) => {
            recs.push({ ch, args })
        }
    }
    process.stdout.write = (s) => {
        recs.push({ ch: 'stdout', args: [String(s)] })
        return true
    }
    process.stderr.write = (s) => {
        recs.push({ ch: 'stderr', args: [String(s)] })
        return true
    }
    let stop = () => {
        console.log = o.log
        console.error = o.error
        console.warn = o.warn
        console.info = o.info
        process.stdout.write = o.out
        process.stderr.write = o.err
    }
    return { recs, stop }
}


//textOf, 把紀錄全展開為一段文字(含巢狀物件與 Error 之堆疊), 供「不得出現某字串」之斷言
function textOf(recs) {
    return recs.map((r) => r.args.map((v) => (typeof v === 'string' ? v : util.inspect(v, { depth: 6 }))).join(' ')).join('\n')
}


let r = {
    capture,
    textOf,
}


export default r
