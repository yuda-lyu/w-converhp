import assert from 'assert'
import encodeRfc5987 from '../src/encodeRfc5987.mjs'


/**
 * 純函式層: Content-Disposition filename* 之 RFC 5987 編碼
 * 期望值依 RFC 5987 §3.2.1: attr-char 為 ALPHA / DIGIT / ! # $ & + - . ^ _ ` | ~, 其餘一律 pct-encoded(UTF-8)
 */
describe('unit-encodeRfc5987', function() {

    let cases = [
        //[輸入, 期望, 說明]
        ['a.bin', 'a.bin', '英數與點原樣'],
        ['中文檔名 測試.7z', '%E4%B8%AD%E6%96%87%E6%AA%94%E5%90%8D%20%E6%B8%AC%E8%A9%A6.7z', '中文 UTF-8 逐位元組編碼, 空白為 %20'],
        [`it's (v2)*.txt`, 'it%27s%20%28v2%29%2A.txt', `' ( ) * 不在 attr-char 內, encodeURIComponent 不編但此處須編`],
        ['a"b;c=d.txt', 'a%22b%3Bc%3Dd.txt', '引號分號等號皆編碼, 不可能破壞標頭語法'],
        ['x\r\ny.txt', 'x%0D%0Ay.txt', 'CR LF 編碼, 不可能注入標頭'],
        ['😀.png', '%F0%9F%98%80.png', '合法代理對視為單一 code point'],
        ['\uD83D.png', '%EF%BF%BD.png', '孤立代理對以 U+FFFD 取代而非拋 URIError'],
        ['!#$&+-.^_`|~', '!%23%24%26%2B-.%5E_%60%7C~', 'attr-char 全集: encodeURIComponent 保留 ! - . _ ~, 其餘過度編碼(RFC 5987 允許任何字元 pct-encoded)'],
        ['', '', '空字串'],
        [null, '', 'null 視為空字串'],
        [123, '123', '數值以字串處理'],
    ]

    for (let [inp, exp, note] of cases) {
        it(`${note}: ${JSON.stringify(inp)} -> ${JSON.stringify(exp)}`, function() {
            assert.strict.deepEqual(encodeRfc5987(inp), exp)
        })
    }

    it('輸出只含 attr-char 與 %XX(對任意含控制字元與符號之輸入)', function() {
        let s = ''
        for (let i = 0; i < 256; i++) {
            s += String.fromCharCode(i)
        }
        s += '中文😀'
        let r = encodeRfc5987(s)
        assert.strict.deepEqual(/^(?:[A-Za-z0-9!#$&+\-.^_`|~]|%[0-9A-F]{2})*$/.test(r), true, r)
    })

})
