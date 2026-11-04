/**
 * 向作業系統要 N 個互異且「跨行程未被認領」之空閒 TCP 埠(listen(0) + 認領登錄)
 *
 * 兩種用法:
 *   - 作為模組: `allocFree(count, opt)` (async), 供單元測試與其他 async 流程直接取用
 *   - 作為腳本: `node portsAlloc.mjs <count>` → stdout 印 JSON 陣列; 供 `ports.mjs` 以同步子行程取得
 *     (`portOf` 須維持同步: 測試檔多在 describe 本體同步取用, 而 `net.Server.listen` 是 async)
 *
 * 作法:
 *   1. **同時持有** count 個監聽器再一併釋放 —— 同時持有即保證這一批互異。優先綁 `::`(雙棧, 一個埠同時涵蓋 IPv4 與 IPv6), 無 IPv6 之環境退綁 `0.0.0.0`。
 *   2. 每個埠先到**認領登錄**(`test/_tmp/ports-claims/<埠>/owner`, 以 mkdir 原子建立, 內記持有者 pid)認領, 認領失敗(已被存活之行程認領)就丟棄、再向作業系統要一個。
 *      持有者行程結束後, 其認領於下次配發時被回收。
 *
 * 為何需要認領登錄(ch309 獨立審查實測): 配發 → 釋放 → 測試綁定之間有空窗, 而 Windows 之暫時埠配發**不是**全系統單一遞增計數器 ——
 * 多個行程併發配發時, 釋放後之埠可在數百毫秒內被另一行程取得(8 行程各配發 240 次, 4 輪中有 2 輪出現跨行程重複; 模擬 14 個 mocha worker 約 2000 次綁定出現 1 次 EADDRINUSE)。
 * `mocha --parallel` 之 worker 正是併發配發者, 故以登錄補上跨行程互斥: 配發者在行程存活期間持有其認領, 他人取到同一號碼時會被擋下並重新要一個。
 * 認領只管「本套件測試彼此之間」; 與他套件之同埠由作業系統保證(作業系統不會把仍被綁定之埠發給別人, 且這批埠來自暫時埠範圍而非任一套件之固定埠)。
 */
import fs from 'fs'
import net from 'net'
import path from 'path'
import { fileURLToPath } from 'url'


//fdClaimDefault, 預設認領登錄夾(test/_tmp 已 gitignore; 須用 fileURLToPath: new URL(...).pathname 會把中文路徑 percent-encoding)
let fdClaimDefault = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '_tmp', 'ports-claims')

//isAlive, 行程是否存活
let isAlive = (pid) => {
    try {
        process.kill(pid, 0)
        return true
    }
    catch (err) {
        return err.code === 'EPERM'
    }
}

//ownerOf, 讀某認領之持有者 pid; 讀不到(剛被建立、尚未寫入 owner)回 NaN
let ownerOf = (fdClaim, port) => {
    try {
        return Number(fs.readFileSync(path.join(fdClaim, String(port), 'owner'), 'utf8'))
    }
    catch (err) {
        return NaN
    }
}

//rmQuiet, 盡力刪除某認領夾; 失敗不拋(多個行程併發回收同一個夾時, Windows 會對刪除中或被開啟中的夾回 EPERM/EBUSY; 獨立複跑 npm test 時實際發生過 —— 回收是盡力而為, 刪不掉就留給下次)
let rmQuiet = (fd) => {
    try {
        fs.rmSync(fd, { recursive: true, force: true })
    }
    catch (err) {}
}

//prune, 回收持有者已結束之認領(owner 讀不到者不動: 可能剛被建立)
let prune = (fdClaim) => {
    let names = []
    try {
        names = fs.readdirSync(fdClaim)
    }
    catch (err) {
        return
    }
    let aliveOf = new Map() //同一持有者(多半是少數幾個 worker)只查一次存活
    for (let n of names) {
        let o = ownerOf(fdClaim, n)
        if (!Number.isInteger(o) || o <= 0) {
            continue
        }
        if (!aliveOf.has(o)) {
            aliveOf.set(o, isAlive(o))
        }
        if (aliveOf.get(o) === false) {
            rmQuiet(path.join(fdClaim, n))
        }
    }
}

//claim, 認領某埠; true=成功。以 mkdir(原子)建立; 已被認領時, 持有者已結束才回收重認, 持有者仍存活(或剛被建立)則失敗。
//mkdir/寫入遇 EPERM/EBUSY/EACCES(另一行程正在回收同名夾)一律視為「這個埠這次認領不到」, 由呼叫端再要一個, 不拋錯
let claim = (fdClaim, port, owner) => {
    let fd = path.join(fdClaim, String(port))
    for (let k = 0; k < 2; k++) {
        try {
            fs.mkdirSync(fd)
        }
        catch (err) {
            if (['EEXIST', 'EPERM', 'EBUSY', 'EACCES'].includes(err.code) === false) {
                throw err
            }
            let o = ownerOf(fdClaim, port)
            if (err.code === 'EEXIST' && Number.isInteger(o) && o > 0 && !isAlive(o)) {
                rmQuiet(fd)
                continue
            }
            return false
        }
        try {
            fs.writeFileSync(path.join(fd, 'owner'), String(owner))
            return true
        }
        catch (err) {
            rmQuiet(fd) //夾已建立卻寫不進 owner: 不留無主之夾(無主之夾不會被回收)
            return false
        }
    }
    return false
}

//listenZero, 在 host 上 listen(0)並回傳監聽器
let listenZero = (host) => {
    return new Promise((resolve, reject) => {
        let s = net.createServer()
        s.once('error', reject)
        s.listen(0, host, () => {
            s.off('error', reject)
            resolve(s)
        })
    })
}

//pickOs, 向作業系統要一個埠(回傳持有中之監聽器)
let pickOs = async() => {
    try {
        return await listenZero('::')
    }
    catch (err) {
        if (err.code !== 'EAFNOSUPPORT' && err.code !== 'EADDRNOTAVAIL') {
            throw err
        }
        return await listenZero('0.0.0.0') //無 IPv6 之環境
    }
}

//closeOne, 關閉監聽器並等其釋放
let closeOne = (s) => {
    return new Promise((resolve) => {
        s.close(() => {
            resolve()
        })
    })
}

/**
 * 向作業系統要 count 個互異且跨行程未被認領之空閒埠
 *
 * @param {Integer} count 需要幾個,正整數
 * @param {Object} [opt={}] 設定物件(供單元測試注入)
 * @param {String} [opt.fdClaim] 認領登錄夾,預設 test/_tmp/ports-claims
 * @param {Integer} [opt.owner] 認領之持有者 pid,預設本行程
 * @param {Function} [opt.pick] 向作業系統要一個埠之函數(回傳持有中之監聽器),預設 listen(0)
 * @returns {Promise<Array<Integer>>} 埠陣列(長度 count, 互異)
 */
async function allocFree(count, opt = {}) {
    if (!Number.isInteger(count) || count < 1) {
        throw new Error(`allocFree: count 須為正整數, 實得 ${count}`)
    }
    let fdClaim = opt.fdClaim || fdClaimDefault
    let owner = opt.owner || process.pid
    let pick = opt.pick || pickOs
    fs.mkdirSync(fdClaim, { recursive: true })

    //全面回收至多每 60 秒一次(以標記檔之 mtime 節流): 否則每次配發都讀遍所有認領, 認領數大時為 O(N²)(壓力實測 1920 筆時慢 65 倍);
    //被擋的個別認領仍由 claim() 當場回收, 不依賴本回收
    let fpMark = path.join(fdClaim, '.last-prune')
    let tMark = 0
    try {
        tMark = fs.statSync(fpMark).mtimeMs
    }
    catch (err) {}
    if (Date.now() - tMark > 60000) {
        try {
            fs.writeFileSync(fpMark, String(Date.now()))
        }
        catch (err) {}
        prune(fdClaim)
    }

    let held = []
    let ports = []
    let nReject = 0
    try {
        while (ports.length < count) {
            let s = null
            try {
                s = await pick()
            }
            catch (err) {
                //系統資源暫時不足(同機多個行程同時大量開監聽時, Windows 會回 ENOBUFS)或埠剛好被占: 稍候再要, 不整批失敗
                if (!['ENOBUFS', 'EADDRINUSE', 'EMFILE', 'ENFILE'].includes(err.code)) {
                    throw err
                }
                nReject += 1
                if (nReject > 200) {
                    throw err
                }
                await new Promise((resolve) => setTimeout(resolve, 20))
                continue
            }
            let p = s.address().port
            if (!claim(fdClaim, p, owner)) {
                await closeOne(s) //已被別的存活行程認領: 丟棄, 再要一個
                nReject += 1
                if (nReject > 200) {
                    throw new Error(`allocFree: 連續 ${nReject} 個埠都已被其他行程認領`)
                }
                continue
            }
            held.push(s)
            ports.push(p)
        }
        return ports
    }
    catch (err) {
        for (let p of ports) {
            rmQuiet(path.join(fdClaim, String(p))) //失敗不留認領
        }
        throw err
    }
    finally {
        await Promise.all(held.map(closeOne))
    }
}


//作為腳本直接執行時: node portsAlloc.mjs <count>; 認領之持有者為呼叫端(父行程, 即 mocha worker), 子行程一結束認領仍在
//以檔名判斷主模組(不比對路徑: 路徑含符號連結或 junction 時 import.meta.url 與 argv[1] 之 realpath 不同)
if (path.basename(process.argv[1] || '') === 'portsAlloc.mjs') {
    try {
        let ports = await allocFree(Number(process.argv[2]), { owner: process.ppid })
        process.stdout.write(JSON.stringify(ports))
    }
    catch (err) {
        process.stderr.write(String(err && err.stack ? err.stack : err))
        process.exit(1)
    }
}


//r, 本檔對外提供之能力: allocFree(向作業系統要 N 個互異且跨行程未被認領之埠)
let r = {
    allocFree,
}


export default r
