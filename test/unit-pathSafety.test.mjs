import assert from 'assert'
import path from 'path'
import sanitizeFilename from '../src/sanitizeFilename.mjs'
import isPathInside from '../src/isPathInside.mjs'


/**
 * 純函式層: 不可信檔名之淨化, 與路徑包含判定(以path.win32 / path.posix 各驗一次, 不依賴執行平台)
 */
describe('unit-pathSafety', function() {

    describe('sanitizeFilename', function() {

        let cases = [
            //[輸入, 期望, 說明]
            ['a.bin', 'a.bin', '一般檔名原樣'],
            ['中文檔名 測試.7z', '中文檔名 測試.7z', '中文與空白保留'],
            ['../escaped.bin', 'escaped.bin', '去除 ../'],
            ['../../x/y/z.bin', 'z.bin', '多層路徑只取最末段'],
            ['..\\..\\y.bin', 'y.bin', '反斜線亦視為分隔符'],
            ['/etc/passwd', 'passwd', '絕對路徑只取最末段'],
            ['C:\\Windows\\evil.bin', 'evil.bin', 'Windows 絕對路徑只取最末段'],
            ['C:evil.bin', 'C_evil.bin', 'Windows 磁碟機相對路徑: 冒號替換, 不再能逸出'],
            ['..', 'unknown', '純 .. 落回預設'],
            ['.', 'unknown', '純 . 落回預設'],
            ['', 'unknown', '空字串落回預設'],
            ['   ', 'unknown', '純空白落回預設(結尾空白去除後為空)'],
            ['a<b>c:d"e|f?g*h.txt', 'a_b_c_d_e_f_g_h.txt', '非法字元替換為底線'],
            ['bad\x00name.bin', 'bad_name.bin', 'NUL 替換'],
            ['name.txt. . .', 'name.txt', '結尾點與空白去除'],
            ['..foo', '..foo', '前導點保留(非路徑段)'],
            ['CON', '_CON', '保留裝置名前置底線'],
            ['nul.txt', '_nul.txt', '保留裝置名不論副檔名與大小寫'],
            ['COM1.log', '_COM1.log', 'COM1'],
            ['console.txt', 'console.txt', '非保留名不動'],
        ]

        for (let [inp, exp, note] of cases) {
            it(`${note}: ${JSON.stringify(inp)} -> ${JSON.stringify(exp)}`, function() {
                assert.strict.deepEqual(sanitizeFilename(inp), exp)
            })
        }

        it('非字串輸入落回預設', function() {
            assert.strict.deepEqual(sanitizeFilename(null), 'unknown')
            assert.strict.deepEqual(sanitizeFilename(123), 'unknown')
            assert.strict.deepEqual(sanitizeFilename(undefined, 'x'), 'x')
        })

    })

    describe('isPathInside (win32)', function() {
        let p = path.win32

        it('一般子項目為內', function() {
            assert.strict.deepEqual(isPathInside('C:\\dl', 'C:\\dl\\a.bin', p), true)
            assert.strict.deepEqual(isPathInside('C:\\dl', 'C:\\dl\\sub\\a.bin', p), true)
        })

        it('base 為磁碟根目錄時, 其下檔案須為內(startsWith(base+sep) 會在此誤判)', function() {
            assert.strict.deepEqual(isPathInside('C:\\', 'C:\\a.bin', p), true)
        })

        it('base 本身不算內', function() {
            assert.strict.deepEqual(isPathInside('C:\\dl', 'C:\\dl', p), false)
            assert.strict.deepEqual(isPathInside('C:\\dl', 'C:\\dl\\', p), false)
        })

        it('../ 逸出為外', function() {
            assert.strict.deepEqual(isPathInside('C:\\dl', 'C:\\dl\\..\\x.bin', p), false)
            assert.strict.deepEqual(isPathInside('C:\\dl', 'C:\\x.bin', p), false)
        })

        it('同前綴之兄弟資料夾為外', function() {
            assert.strict.deepEqual(isPathInside('C:\\dl', 'C:\\dl-other\\a.bin', p), false)
        })

        it('不同磁碟機為外', function() {
            assert.strict.deepEqual(isPathInside('C:\\dl', 'D:\\dl\\a.bin', p), false)
        })

        it('以 .. 開頭之檔名(非路徑段)為內', function() {
            assert.strict.deepEqual(isPathInside('C:\\dl', 'C:\\dl\\..foo', p), true)
        })

    })

    describe('isPathInside (posix)', function() {
        let p = path.posix

        it('一般子項目為內', function() {
            assert.strict.deepEqual(isPathInside('/dl', '/dl/a.bin', p), true)
        })

        it('base 為根目錄時, 其下檔案須為內', function() {
            assert.strict.deepEqual(isPathInside('/', '/a.bin', p), true)
        })

        it('base 本身不算內', function() {
            assert.strict.deepEqual(isPathInside('/dl', '/dl', p), false)
        })

        it('../ 逸出與兄弟資料夾為外', function() {
            assert.strict.deepEqual(isPathInside('/dl', '/dl/../x.bin', p), false)
            assert.strict.deepEqual(isPathInside('/dl', '/dl-other/a.bin', p), false)
        })

        it('以 .. 開頭之檔名為內', function() {
            assert.strict.deepEqual(isPathInside('/dl', '/dl/..foo', p), true)
        })

    })

})
