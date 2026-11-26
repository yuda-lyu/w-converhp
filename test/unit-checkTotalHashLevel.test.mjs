import assert from 'assert'
import fs from 'fs'
import path from 'path'
import checkTotalHashSrc from '../src/checkTotalHash.mjs'
import checkTotalHashBundle from '../src/checkTotalHash.wk.umd.js'


/**
 * unit: checkTotalHash 僅列舉暫存夾(pathUploadTemp)第1層之切片檔(規則帳本 R-LIST-LEVEL)
 *
 * 規格對應:
 *   S1. 切片檔平放於 pathUploadTemp 下(`${fileHash}_${n}`), 子資料夾(含更深層)內之同前綴檔不是本檔之切片, 不得計入 slks
 *       (wsemi 1.9.80起 fsGetFilesInFolder 未給 levelLimit 即窮舉全部層級, 須明寫 { levelLimit: 1 })
 *   S2. 第1層之合法切片(大小 > 0 且 <= sizeSlice)仍全數計入
 *
 * 兩個實作皆測: 伺服器實際執行者為 checkTotalHash.wk.umd.js(內嵌打包當時之 wsemi), .mjs 為其建置輸入(帳本 R14);
 * 只測 .mjs 時, 改了 .mjs 而未重產 .wk.umd.js 之偏差測不到, 只測產物時則反之(產物內嵌舊版 wsemi 時層數語意仍為舊預設)。
 */

let impls = [
    ['src/checkTotalHash.mjs', checkTotalHashSrc],
    ['src/checkTotalHash.wk.umd.js', checkTotalHashBundle],
]

let fdRoot = path.resolve('./test/_tmp/unit-checkTotalHashLevel')
let nRun = 0

//各檔大小逐筆相異, 使資料看值即知來源
let put = (fp, size) => {
    fs.mkdirSync(path.dirname(fp), { recursive: true })
    fs.writeFileSync(fp, Buffer.alloc(size, size % 251))
}

let freshDir = () => {
    nRun += 1
    let fd = path.join(fdRoot, `run${nRun}`)
    fs.rmSync(fd, { recursive: true, force: true })
    fs.mkdirSync(fd, { recursive: true })
    return fd
}

describe('unit-checkTotalHashLevel', function() {
    this.timeout(60000)

    before(function() {
        fs.rmSync(fdRoot, { recursive: true, force: true })
    })

    after(function() {
        fs.rmSync(fdRoot, { recursive: true, force: true })
        try {
            fs.rmdirSync(path.resolve('./test/_tmp')) //僅於已無其他測試之中介資料夾時刪除
        }
        catch (err) {}
    })

    for (let [name, fn] of impls) {

        it(`${name}: 只計第1層之切片檔, 子資料夾(含更深層)內之同前綴檔不計入 slks`, async function() {
            let fd = freshDir()

            //第1層: bb22_0(1024)、bb22_2(500), 皆為合法切片(大小 > 0 且 <= sizeSlice=1024)
            put(path.join(fd, 'bb22_0'), 1024)
            put(path.join(fd, 'bb22_2'), 500)

            //子層與更深層之同前綴檔(大小亦合法, 故若被列入即會計入 slks)
            put(path.join(fd, 'sub', 'bb22_5'), 800)
            put(path.join(fd, 'sub', 'deeper', 'bb22_9'), 700)

            //整檔不存在(pathFile = pathUploadTemp/bb22), 走切片候選分支
            let r = await fn(3000, 1024, 'bb22', fd)

            //S1, S2
            assert.ok(r.error === undefined, 'must not return error')
            assert.ok(r.bAllExist === false, 'whole file must not exist in this fixture')
            assert.deepStrictEqual([...r.slks].sort((a, b) => a - b), [0, 2])
            assert.ok(r.bSls === true, 'bSls must be true when level 1 slices exist')
        })

    }

})
