/**
 * 判定target是否位於base資料夾之內(不含base本身)
 *
 * 以path.relative判定而非startsWith(base + sep): 後者於base為磁碟根目錄(如 C:\ 或 /)時, resolve結果自帶尾分隔符,
 * 再加sep會變成雙分隔符而使合法路徑被誤拒。逸出判準採is-path-inside之作法: relative結果為 '..'、以 '..'+sep 開頭, 或為絕對路徑
 *
 * 本函式為純字串判定, 不解符號連結亦不存取檔案系統; 呼叫端須先以realpath正規化base, 並自行處理目標為符號連結之情形
 * path模組由呼叫端傳入: 本模組亦會被打包進瀏覽器端client, 不可於頂層import 'path'; 亦可傳入path.win32/path.posix供跨平台測試
 *
 * @param {String} base 輸入基準資料夾絕對路徑
 * @param {String} target 輸入目標絕對路徑
 * @param {Object} path 輸入path模組(或path.win32、path.posix)
 * @returns {Boolean} 回傳target是否位於base之內
 */
function isPathInside(base, target, path) {
    let rel = path.relative(path.resolve(base), path.resolve(target))
    if (rel === '') {
        return false //即base本身
    }
    if (rel === '..' || rel.startsWith(`..${path.sep}`)) {
        return false
    }
    if (path.isAbsolute(rel)) {
        return false //不同磁碟機(win32)
    }
    return true
}


export default isPathInside
