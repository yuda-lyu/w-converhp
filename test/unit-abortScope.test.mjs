import assert from 'assert'
import events from 'events'
import wAbortScope from '../src/abortScope.mjs'


let { isAbortSignal, genAbortScope } = wAbortScope


/**
 * unit: 一次公開呼叫之中止範圍(對應 src/abortScope.mjs, 規則帳本 R27)
 *
 * 本模組是 client 中止語意之底層: 入口競速(ctx.run)、getToken 之出口(ctx.callApp)、可中止之退避、合併輪詢之停止皆建立於其上。
 * 本檔鎖住其契約(依 src/abortScope.mjs 之 JSDoc):
 *   - 未給 signal(undefined、null)為永不中止之範圍: 不建 AbortController、signal 為 undefined、race 直通、delay 即一般之延遲
 *     —— 使未使用中止之既有呼叫其行為與交給 axios 之組態皆與未支援中止前相同
 *   - 已中止之 signal: 範圍一建立即為中止, race 不呼叫所給函數、以 reason 拒絕
 *   - 中止時尚未 settle 之 race 以 reason **原樣**(同一個物件)拒絕; 所給 promise 之後續拒絕被接住, 不成未處理之 rejection
 *   - 中止只觸發一次, 處理器只被呼叫一次; 已中止後才註冊之處理器立即被呼叫
 *   - 對外部 signal 只掛一個監聽, dispose 後為 0(長壽 signal 被重複用於大量呼叫時不累積)
 *   - reason 為 undefined 時補 name 為 AbortError 之錯誤(執行環境不提供 reason 者)
 */
describe('unit-abortScope', function() {
    this.timeout(20000)

    let listenersOf = (signal) => events.getEventListeners(signal, 'abort').length

    //withCountedAbortController, 期間內計數 AbortController 之建構次數(genAbortScope 於呼叫時才解析全域之 AbortController)
    let withCountedAbortController = (fn) => {
        let Ori = globalThis.AbortController
        let n = 0
        globalThis.AbortController = class extends Ori {
            constructor(...args) {
                super(...args)
                n += 1
            }
        }
        try {
            fn()
        }
        finally {
            globalThis.AbortController = Ori
        }
        return n
    }

    //settle, 取 promise 之結局(不論成敗)
    let settle = (p) => p.then((v) => ({ ok: true, v }), (e) => ({ ok: false, e }))

    describe('isAbortSignal', function() {

        it('AbortSignal(含 AbortSignal.abort、AbortSignal.timeout、AbortSignal.any 所建者)為 true', function() {
            let ac = new AbortController()
            let sigs = [ac.signal, AbortSignal.abort(), AbortSignal.timeout(1000)]
            if (typeof AbortSignal.any === 'function') {
                sigs.push(AbortSignal.any([ac.signal]))
            }
            for (let s of sigs) {
                assert.strict.deepEqual(isAbortSignal(s), true)
            }
        })

        it('非 AbortSignal 者為 false, 含誤把 AbortController 本身當成 signal 給入', function() {
            for (let v of [undefined, null, 0, 1, '', 'x', true, {}, [], () => {}, new AbortController(), { aborted: 'false', addEventListener() {}, removeEventListener() {} }, { aborted: false }]) {
                assert.strict.deepEqual(isAbortSignal(v), false, `${Object.prototype.toString.call(v)}`)
            }
        })

    })

    describe('genAbortScope: 未給 signal', function() {

        for (let [label, sig] of [['undefined', undefined], ['null', null]]) {

            it(`signal 為 ${label}: 不建 AbortController, scope.signal 為 undefined, 永不中止`, function() {
                let scope = null
                let n = withCountedAbortController(() => {
                    scope = genAbortScope(sig)
                })
                assert.strict.deepEqual(n, 0)
                assert.strict.deepEqual(scope.signal, undefined)
                assert.strict.deepEqual(scope.isAborted(), false)
                assert.strict.deepEqual(scope.reason(), undefined)
                scope.dispose()
            })

            it(`signal 為 ${label}: race 直通 —— 給函數者回傳其回傳值本身(同一個 promise), 給 promise 者回傳該 promise 本身`, async function() {
                let scope = genAbortScope(sig)
                let p = Promise.resolve(7)
                let calls = 0
                let r1 = scope.race(() => {
                    calls += 1
                    return p
                })
                assert.strict.deepEqual(calls, 1)
                assert.strict.equal(r1, p)
                assert.strict.equal(scope.race(p), p)
                assert.strict.deepEqual(await r1, 7)
                scope.dispose()
            })

            it(`signal 為 ${label}: delay 為一般之延遲`, async function() {
                let scope = genAbortScope(sig)
                let t0 = Date.now()
                await scope.delay(50)
                let dt = Date.now() - t0
                assert.strict.deepEqual(dt >= 40, true, `dt=${dt}`)
                scope.dispose()
            })

        }

    })

    describe('genAbortScope: 已中止之 signal', function() {

        it('範圍一建立即為中止, reason 為 signal.reason 原樣, 內部 signal 亦已中止且帶同一 reason, 不對外部 signal 掛監聽', function() {
            let rs = { tag: 'pre-aborted' }
            let sig = AbortSignal.abort(rs)
            let scope = genAbortScope(sig)
            assert.strict.deepEqual(scope.isAborted(), true)
            assert.strict.equal(scope.reason(), rs)
            assert.strict.deepEqual(scope.signal.aborted, true)
            assert.strict.equal(scope.signal.reason, rs)
            assert.strict.deepEqual(listenersOf(sig), 0)
            scope.dispose()
        })

        it('race 不呼叫所給函數, 以 reason 拒絕', async function() {
            let rs = new Error('pre')
            let scope = genAbortScope(AbortSignal.abort(rs))
            let calls = 0
            let r = await settle(scope.race(() => {
                calls += 1
                return Promise.resolve(1)
            }))
            assert.strict.deepEqual(calls, 0)
            assert.strict.deepEqual(r.ok, false)
            assert.strict.equal(r.e, rs)
            scope.dispose()
        })

        it('delay 立即以 reason 拒絕, 不等待所給之毫秒數', async function() {
            let scope = genAbortScope(AbortSignal.abort('r'))
            let t0 = Date.now()
            let r = await settle(scope.delay(5000))
            assert.strict.deepEqual(r, { ok: false, e: 'r' })
            assert.strict.deepEqual(Date.now() - t0 < 1000, true)
            scope.dispose()
        })

        it('已中止後才註冊之 onAbort 處理器立即(同步)被呼叫一次', function() {
            let scope = genAbortScope(AbortSignal.abort('r'))
            let got = []
            scope.onAbort((reason) => got.push(reason))
            assert.strict.deepEqual(got, ['r'])
            scope.dispose()
        })

    })

    describe('genAbortScope: 進行中被中止', function() {

        it('race 於 abort() 之同步期間即以 reason 原樣(同一個物件)拒絕; 所給 promise 之後續 settle 不改變結局', async function() {
            let ac = new AbortController()
            let scope = genAbortScope(ac.signal)
            let resolveLater = null
            let p = scope.race(() => new Promise((resolve) => {
                resolveLater = resolve
            }))
            let r = null
            p.then((v) => {
                r = { ok: true, v }
            }, (e) => {
                r = { ok: false, e }
            })
            let rs = { tag: 'user-cancel' }
            ac.abort(rs)
            assert.strict.deepEqual(scope.isAborted(), true)
            assert.strict.equal(scope.reason(), rs)
            resolveLater(1)
            await new Promise((resolve) => setTimeout(resolve, 20))
            assert.strict.deepEqual(r.ok, false)
            assert.strict.equal(r.e, rs)
            scope.dispose()
        })

        it('abort() 未給 reason 者, 拒絕值為 signal.reason(name 為 AbortError 之 DOMException)', async function() {
            let ac = new AbortController()
            let scope = genAbortScope(ac.signal)
            let p = settle(scope.race(new Promise(() => {})))
            ac.abort()
            let r = await p
            assert.strict.deepEqual(r.ok, false)
            assert.strict.equal(r.e, ac.signal.reason)
            assert.strict.deepEqual(r.e.name, 'AbortError')
            scope.dispose()
        })

        it('AbortSignal.timeout 到期: 以其 reason(name 為 TimeoutError)拒絕', async function() {
            let sig = AbortSignal.timeout(30)
            let scope = genAbortScope(sig)
            let r = await settle(scope.race(new Promise(() => {})))
            assert.strict.deepEqual(r.ok, false)
            assert.strict.equal(r.e, sig.reason)
            assert.strict.deepEqual(r.e.name, 'TimeoutError')
            scope.dispose()
        })

        it('所給 promise 於中止後才拒絕: 被接住, 不成未處理之 rejection', async function() {
            let unhandled = []
            let onUnhandled = (e) => unhandled.push(e)
            process.on('unhandledRejection', onUnhandled)
            try {
                let ac = new AbortController()
                let scope = genAbortScope(ac.signal)
                let rejectLater = null
                let p = settle(scope.race(() => new Promise((resolve, reject) => {
                    rejectLater = reject
                })))
                ac.abort('r')
                rejectLater(new Error('late failure after abort'))
                let r = await p
                await new Promise((resolve) => setTimeout(resolve, 50))
                assert.strict.deepEqual(r, { ok: false, e: 'r' })
                assert.strict.deepEqual(unhandled.length, 0, `${unhandled.map(String)}`)
                scope.dispose()
            }
            finally {
                process.off('unhandledRejection', onUnhandled)
            }
        })

        it('race 於中止前 settle 者照常交出其值或錯誤', async function() {
            let ac = new AbortController()
            let scope = genAbortScope(ac.signal)
            let r1 = await settle(scope.race(Promise.resolve('v')))
            let r2 = await settle(scope.race(() => Promise.reject('e')))
            ac.abort('late')
            assert.strict.deepEqual(r1, { ok: true, v: 'v' })
            assert.strict.deepEqual(r2, { ok: false, e: 'e' })
            scope.dispose()
        })

        it('delay 等待中被中止: 立即以 reason 拒絕(清除計時器, 不等到期)', async function() {
            let ac = new AbortController()
            let scope = genAbortScope(ac.signal)
            let t0 = Date.now()
            setTimeout(() => ac.abort('r'), 30)
            let r = await settle(scope.delay(10000))
            assert.strict.deepEqual(r, { ok: false, e: 'r' })
            assert.strict.deepEqual(Date.now() - t0 < 2000, true)
            scope.dispose()
        })

        it('內部 signal(交 axios 者)隨外部 signal 中止, 且帶同一 reason', function() {
            let ac = new AbortController()
            let scope = genAbortScope(ac.signal)
            assert.strict.deepEqual(scope.signal.aborted, false)
            let rs = { tag: 'x' }
            ac.abort(rs)
            assert.strict.deepEqual(scope.signal.aborted, true)
            assert.strict.equal(scope.signal.reason, rs)
            scope.dispose()
        })

    })

    describe('genAbortScope: onAbort 只觸發一次', function() {

        it('外部 abort 事件再次派發(重複 abort()、手動 dispatchEvent)時, 處理器仍只被呼叫一次, reason 不變', function() {
            let ac = new AbortController()
            let scope = genAbortScope(ac.signal)
            let got = []
            scope.onAbort((reason) => got.push(reason))
            ac.abort('first')
            ac.abort('second')
            ac.signal.dispatchEvent(new Event('abort'))
            assert.strict.deepEqual(got, ['first'])
            assert.strict.deepEqual(scope.reason(), 'first')
            scope.dispose()
        })

        it('處理器依註冊順序呼叫; 其一拋錯不中斷其餘處理器; 取消註冊者不被呼叫', function() {
            let ac = new AbortController()
            let scope = genAbortScope(ac.signal)
            let got = []
            scope.onAbort(() => got.push('a'))
            scope.onAbort(() => {
                throw new Error('handler failure')
            })
            let off = scope.onAbort(() => got.push('removed'))
            scope.onAbort(() => got.push('c'))
            off()
            ac.abort()
            assert.strict.deepEqual(got, ['a', 'c'])
            scope.dispose()
        })

    })

    describe('genAbortScope: dispose', function() {

        it('對外部 signal 只掛一個監聽, dispose 後為 0', function() {
            let ac = new AbortController()
            let base = listenersOf(ac.signal)
            let scope = genAbortScope(ac.signal)
            scope.race(new Promise(() => {})).catch(() => {})
            scope.race(new Promise(() => {})).catch(() => {})
            scope.delay(10).catch(() => {})
            assert.strict.deepEqual(listenersOf(ac.signal) - base, 1)
            scope.dispose()
            assert.strict.deepEqual(listenersOf(ac.signal) - base, 0)
        })

        it('同一長壽 signal 用於 1000 個範圍(各自 dispose): 監聽不累積', function() {
            let ac = new AbortController()
            let base = listenersOf(ac.signal)
            for (let i = 0; i < 1000; i++) {
                let scope = genAbortScope(ac.signal)
                scope.dispose()
            }
            assert.strict.deepEqual(listenersOf(ac.signal) - base, 0)
        })

        it('中止後 dispose: 監聽亦為 0', function() {
            let ac = new AbortController()
            let base = listenersOf(ac.signal)
            let scope = genAbortScope(ac.signal)
            ac.abort()
            scope.dispose()
            assert.strict.deepEqual(listenersOf(ac.signal) - base, 0)
        })

        it('dispose 後外部才中止: 範圍不再觸發', function() {
            let ac = new AbortController()
            let scope = genAbortScope(ac.signal)
            let got = []
            scope.onAbort(() => got.push(1))
            scope.dispose()
            ac.abort()
            assert.strict.deepEqual(scope.isAborted(), false)
            assert.strict.deepEqual(got, [])
        })

    })

    describe('genAbortScope: reason 為 undefined 時之補值', function() {

        //fakeSignal, 執行環境之 AbortSignal 不提供 reason 者(較舊之瀏覽器): 以鴨子型別模擬, aborted 為 true 而 reason 為 undefined
        let fakeAbortedSignal = () => {
            return {
                aborted: true,
                reason: undefined,
                addEventListener() {},
                removeEventListener() {},
            }
        }

        it('補 name 為 AbortError 之錯誤, race 以之拒絕(拒絕值不為 undefined)', async function() {
            let sig = fakeAbortedSignal()
            assert.strict.deepEqual(isAbortSignal(sig), true)
            let scope = genAbortScope(sig)
            let rs = scope.reason()
            assert.strict.notDeepEqual(rs, undefined)
            assert.strict.deepEqual(rs.name, 'AbortError')
            let r = await settle(scope.race(() => Promise.resolve(1)))
            assert.strict.deepEqual(r.ok, false)
            assert.strict.equal(r.e, rs)
            scope.dispose()
        })

        it('執行環境無 DOMException 時, 補 name 為 AbortError 之 Error', function() {
            let desc = Object.getOwnPropertyDescriptor(globalThis, 'DOMException')
            Object.defineProperty(globalThis, 'DOMException', { value: undefined, configurable: true, writable: true })
            let rs = null
            try {
                rs = genAbortScope(fakeAbortedSignal()).reason()
            }
            finally {
                Object.defineProperty(globalThis, 'DOMException', desc)
            }
            assert.strict.deepEqual(rs instanceof Error, true)
            assert.strict.deepEqual(rs.name, 'AbortError')
            assert.strict.deepEqual(typeof DOMException, 'function')
        })

    })

})
