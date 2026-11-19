import assert from 'assert'
import u8arr2obj from 'wsemi/src/u8arr2obj.mjs'
import obj2u8arr from 'wsemi/src/obj2u8arr.mjs'
import probeReadable from '../src/probeReadable.mjs'
import encodeStrict from '../src/encodeStrict.mjs'


/**
 * unit: 不可讀值之探針(帳本 R32: probeReadable、encodeStrict)
 *
 * 規格(帳本 R32 之條文, 每條斷言於註解標明對應條):
 *   S1 不可讀 = 讀其型別標籤(Object.prototype.toString.call)即拋錯者 —— 已撤銷之 Proxy、拋錯之 Symbol.toStringTag getter、get 陷阱拋錯之 Proxy;
 *      深探另含鍵集合讀取(ownKeys 與 getOwnPropertyDescriptor 陷阱)拋錯者。回傳空字串為可讀, 非空字串為原因(恆非空)
 *   S2 淺探只觸碰值本身之型別標籤; 深探走訪資料屬性與陣列元素能到達之全部物件
 *   S3 探針無副作用: 不呼叫 accessor、toJSON、方法(其呼叫次數由序列化器掌握, 帳本 R7 之 #34b: toJSON 只執行一次)
 *      L4 已知限制: accessor 或 toJSON「回傳」之不可讀值不在探針範圍(探針不呼叫之)
 *   S4 不展開: 二進位內容(ArrayBuffer 與其視圖)、函數值、序列化器不會走到其子圖者(有 toJSON 者、Error、DOMException; 否則為假陽性); 循環與共享參照不重複走訪、不視為不可讀;
 *      可讀之值經 encodeStrict 與經 obj2u8arr 嚴格模式逐位元組相同(契約: 可讀者行為不變)
 *   S5 只壞 has 陷阱之 Proxy 不屬不可讀(wsemi 之判斷函數與 JSON 序列化皆不依賴 in 運算子)
 *   S6 encodeStrict: 先探針再以 obj2u8arr 之嚴格模式序列化; 不可讀者回 state 為 error 且 msg 以 'unreadable value:' 起首; 其餘依 obj2u8arr 嚴格模式原樣
 */
describe('unit-probeReadable', function() {

    //shapes, 不可讀之形狀工廠(每次新建)
    let unreadable = {
        '已撤銷之 Proxy': () => {
            let r = Proxy.revocable({}, {})
            r.revoke()
            return r.proxy
        },
        '已撤銷之函數 Proxy': () => {
            let r = Proxy.revocable(function() {}, {})
            r.revoke()
            return r.proxy
        },
        '拋錯之 Symbol.toStringTag': () => {
            let o = { a: 1 }
            Object.defineProperty(o, Symbol.toStringTag, {
                get() {
                    throw new Error('tag boom')
                },
            })
            return o
        },
        'get 陷阱拋錯之 Proxy': () => new Proxy({}, {
            get() {
                throw new Error('get boom')
            },
        }),
    }

    it('S1 原始值恆可讀', function() {
        for (let v of [null, undefined, 0, 1.5, NaN, '', 'abc', true, false, Symbol('s'), 10n]) {
            assert.strict.deepEqual(probeReadable(v), '', String(typeof v))
            assert.strict.deepEqual(probeReadable(v, { deep: false }), '', String(typeof v))
        }
    })

    it('S1 一般值可讀: 物件、陣列、Date、Map、Set、類別實例、無原型物件、Buffer、typed array、函數', function() {
        class K {
            constructor() {
                this.x = 1
            }
        }
        let vs = [{}, { a: 1, b: { c: [1, 2, { d: 3 }] } }, [], [1, 'a', null], new Date(), new Map([[1, 2]]), new Set([1]), new K(), Object.create(null), Buffer.from('abc'), new Uint8Array(4), new ArrayBuffer(4), () => 1, async function() {}]
        for (let v of vs) {
            assert.strict.deepEqual(probeReadable(v), '')
            assert.strict.deepEqual(probeReadable(v, { deep: false }), '')
        }
    })

    it('S1 不可讀形狀: 淺探與深探皆回非空原因字串', function() {
        for (let [k, f] of Object.entries(unreadable)) {
            let a = probeReadable(f())
            let b = probeReadable(f(), { deep: false })
            assert.strict.deepEqual(typeof a === 'string' && a.length > 0, true, `${k} 深探: ${JSON.stringify(a)}`)
            assert.strict.deepEqual(typeof b === 'string' && b.length > 0, true, `${k} 淺探: ${JSON.stringify(b)}`)
        }
    })

    it('S1 原因恆非空: 即使拋出之值不是 Error(取不到訊息者為 unreadable value)', function() {
        let p = new Proxy({}, {
            get() {
                throw undefined // eslint-disable-line no-throw-literal
            },
        })
        let c = probeReadable(p)
        assert.strict.deepEqual(c, 'unreadable value', JSON.stringify(c))
    })

    it('S1 原因含拋出之訊息(供事件診斷)', function() {
        assert.strict.deepEqual(probeReadable(unreadable['拋錯之 Symbol.toStringTag']()).includes('tag boom'), true)
        assert.strict.deepEqual(probeReadable(unreadable['get 陷阱拋錯之 Proxy']()).includes('get boom'), true)
    })

    it('S2 鍵集合讀取拋錯(ownKeys 陷阱): 深探為不可讀, 淺探只觸碰型別標籤故為可讀', function() {
        let mk = () => new Proxy({ a: 1 }, {
            ownKeys() {
                throw new Error('ownKeys boom')
            },
        })
        assert.strict.deepEqual(probeReadable(mk()).includes('ownKeys boom'), true)
        assert.strict.deepEqual(probeReadable(mk(), { deep: false }), '')
    })

    it('S2 getOwnPropertyDescriptor 陷阱拋錯: 深探為不可讀', function() {
        let p = new Proxy({ a: 1 }, {
            getOwnPropertyDescriptor() {
                throw new Error('gopd boom')
            },
        })
        assert.strict.deepEqual(probeReadable(p).includes('gopd boom'), true)
    })

    it('S2 深探走訪: 物件屬性、陣列元素、深層、多分支之一; 淺探不走訪(巢狀不可讀者淺探為可讀)', function() {
        for (let [k, f] of Object.entries(unreadable)) {
            let places = {
                物件屬性: () => ({ x: 1, n: f() }),
                陣列元素: () => [1, 2, f()],
                物件內之陣列內之物件: () => ({ a: [{ b: { c: f() } }] }),
                多分支之末: () => ({ a: { b: 1 }, c: [{ d: 2 }], e: { f: { g: f() } } }),
            }
            for (let [pk, pf] of Object.entries(places)) {
                assert.strict.deepEqual(probeReadable(pf()) !== '', true, `${k} @ ${pk} 深探須為不可讀`)
                assert.strict.deepEqual(probeReadable(pf(), { deep: false }), '', `${k} @ ${pk} 淺探不走訪須為可讀`)
            }
        }
    })

    it('S2 深層(1000 層)中之不可讀者亦被找到; 10 萬層之鏈結不致堆疊溢位', function() {
        let bad = unreadable['拋錯之 Symbol.toStringTag']()
        let o = { v: bad }
        for (let i = 0; i < 1000; i++) {
            o = { n: o }
        }
        assert.strict.deepEqual(probeReadable(o) !== '', true)

        let l = { n: null }
        for (let i = 0; i < 100000; i++) {
            l = { n: l }
        }
        assert.strict.deepEqual(probeReadable(l), '')
    })

    it('S3 無副作用: 不呼叫 accessor 與方法(物件屬性、巢狀物件、類別原型上之 getter 與方法)', function() {
        let n = { getter: 0, method: 0, nestedGetter: 0, protoGetter: 0, protoMethod: 0 }
        class K {
            get pg() {
                n.protoGetter += 1
                return 1
            }

            pm() {
                n.protoMethod += 1
            }
        }
        let k = new K()
        k.own = { z: 1 }
        let o = {
            a: 1,
            get g() {
                n.getter += 1
                return { x: 1 }
            },
            m() {
                n.method += 1
            },
            nested: {
                get h() {
                    n.nestedGetter += 1
                    return 1
                },
            },
            k,
        }
        assert.strict.deepEqual(probeReadable(o), '')
        assert.strict.deepEqual(n, { getter: 0, method: 0, nestedGetter: 0, protoGetter: 0, protoMethod: 0 })
    })

    it('S3 不呼叫 toJSON(帳本 R7 之 #34b): 有 toJSON 者本身被觸碰、其子圖不展開', function() {
        let n = 0
        let o = {
            toJSON() {
                n += 1
                return { y: 2 }
            },
            inner: { a: 1 },
        }
        assert.strict.deepEqual(probeReadable({ top: o, arr: [o] }), '')
        assert.strict.deepEqual(n, 0)
        //有 toJSON 者自身仍被觸碰: 其型別標籤不可讀者為不可讀
        let bad = unreadable['拋錯之 Symbol.toStringTag']()
        bad.toJSON = () => 1
        assert.strict.deepEqual(probeReadable({ x: bad }) !== '', true)
    })

    it('L4 已知限制: accessor 或 toJSON「回傳」之不可讀值不在探針範圍(探針不呼叫之, 其呼叫次數由序列化器掌握; 帳本 R32 之 L4)', function() {
        let bad = unreadable['拋錯之 Symbol.toStringTag']
        assert.strict.deepEqual(probeReadable({
            get g() {
                return bad()
            }
        }), '')
        assert.strict.deepEqual(probeReadable({
            toJSON() {
                return { n: bad() }
            }
        }), '')
    })

    it('S4 序列化器不會走到其子圖者不展開(假陽性之防止): 有 toJSON 者(含 Date、類別原型上之 toJSON、accessor 定義之 toJSON、陷阱代理)、Error、DOMException', function() {
        let bad = unreadable['已撤銷之 Proxy']
        let withProp = (o) => {
            o.bad = bad()
            return o
        }
        class D {
            toJSON() {
                return 1
            }
        }
        let vs = {
            '自有 toJSON': () => ({
                toJSON() {
                    return 1
                },
                bad: bad()
            }),
            'Date 帶不可讀屬性': () => withProp(new Date(0)),
            '類別原型上之 toJSON': () => withProp(new D()),
            'accessor 定義之 toJSON': () => ({
                get toJSON() {
                    return () => 1
                },
                bad: bad()
            }),
            'Error 帶不可讀屬性': () => withProp(new Error('e')),
            'DOMException 帶不可讀屬性': () => withProp(new DOMException('e', 'AbortError')),
            'ownKeys 陷阱拋錯但 target 有 toJSON 之 Proxy': () => new Proxy({
                toJSON() {
                    return 1
                }
            }, {
                ownKeys() {
                    throw new Error('ownKeys boom')
                }
            }),
        }
        for (let [k, f] of Object.entries(vs)) {
            assert.strict.deepEqual(probeReadable(f()), '', k)
            assert.strict.deepEqual(probeReadable({ nest: [f()] }), '', `巢狀: ${k}`)
        }
        //對照: toJSON 為不可呼叫之資料屬性者, 序列化器不採用而走其鍵, 故其子圖須展開(不可讀者為不可讀)
        assert.strict.deepEqual(probeReadable({ toJSON: 1, bad: bad() }) !== '', true)
        //對照: 原型鏈上更近者不可呼叫即遮蔽更遠之 toJSON(同 JSON 之取法)
        let o = Object.create({
            toJSON() {
                return 1
            }
        })
        Object.defineProperty(o, 'toJSON', { value: 1, enumerable: false })
        o.bad = bad()
        assert.strict.deepEqual(probeReadable(o) !== '', true)
    })

    it('S4 可讀之值: encodeStrict 與 obj2u8arr 嚴格模式逐位元組相同(契約 5: 可讀者行為不變)', function() {
        class D {
            toJSON() {
                return { d: 1 }
            }
        }
        let shared = { s: 1 }
        let cyc = { a: 1 }
        cyc.self = cyc
        let sparse = [1, , 3] // eslint-disable-line no-sparse-arrays
        let vs = {
            '一般巢狀': () => ({ a: [1, { b: 'x' }], c: null, d: true }),
            '二進位混合': () => ({ u: new Uint8Array([1, 2, 3]), n: { b: Buffer.from('abc') } }),
            'Date': () => ({ t: new Date(0) }),
            'Error 帶屬性': () => ({ e: Object.assign(new Error('boom'), { code: 7 }) }),
            '自有 toJSON': () => ({
                x: {
                    toJSON() {
                        return { y: 2 }
                    }
                }
            }),
            '類別原型上之 toJSON': () => ({ x: new D() }),
            'Map 與 Set': () => ({ m: new Map([[1, 2]]), s: new Set([1]) }),
            '稀疏陣列': () => ({ a: sparse }),
            '共享參照': () => ({ x: shared, y: shared }),
            '循環參照(兩者皆 error)': () => cyc,
            'BigInt(兩者皆 error)': () => ({ v: 10n }),
            '含函數與 undefined 之鍵': () => ({ f() {}, u: undefined, n: 1 }),
            '只壞 has 陷阱之 Proxy': () => ({
                p: new Proxy({ a: 1 }, {
                    has() {
                        throw new Error('has boom')
                    }
                })
            }),
        }
        for (let [k, f] of Object.entries(vs)) {
            let a = encodeStrict(f())
            let b = obj2u8arr(f(), { returnWithStateAndMsg: true })
            assert.strict.deepEqual(a.state, b.state, `${k} 狀態`)
            if (a.state === 'success') {
                assert.strict.deepEqual(Buffer.from(a.msg).equals(Buffer.from(b.msg)), true, `${k} 位元組`)
            }
            else {
                assert.strict.deepEqual(a.msg, b.msg, `${k} 錯誤訊息`)
            }
        }
    })

    it('S4 不展開二進位內容: Uint8Array、Buffer、ArrayBuffer、DataView 不呼叫 ownKeys, 大小為 2 千萬位元組者亦即時完成', function() {
        let calls = []
        let ownKeys = Reflect.ownKeys
        Reflect.ownKeys = function(x) {
            calls.push(Object.prototype.toString.call(x))
            return ownKeys(x)
        }
        let t0 = Date.now()
        try {
            let big = new Uint8Array(20 * 1000 * 1000)
            assert.strict.deepEqual(probeReadable(big), '')
            assert.strict.deepEqual(probeReadable({ b: Buffer.alloc(1000 * 1000), a: new ArrayBuffer(1000 * 1000), d: new DataView(new ArrayBuffer(8)), u16: new Uint16Array(1000) }), '')
        }
        finally {
            Reflect.ownKeys = ownKeys
        }
        let dt = Date.now() - t0
        assert.strict.deepEqual(calls.filter((t) => t !== '[object Object]'), [], `不得對二進位呼叫 ownKeys: ${JSON.stringify(calls)}`)
        assert.strict.deepEqual(dt < 3000, true, `二進位不展開, 應即時完成: ${dt}ms`)
    })

    it('S4 函數值不展開: 函數之自有屬性中之不可讀者不計', function() {
        let f = function() {}
        f.bad = unreadable['已撤銷之 Proxy']()
        assert.strict.deepEqual(probeReadable({ f }), '')
    })

    it('S4 循環與共享參照: 不視為不可讀, 且循環中之不可讀者仍被找到', function() {
        let o = { a: 1 }
        o.self = o
        assert.strict.deepEqual(probeReadable(o), '')
        let shared = { s: 1 }
        assert.strict.deepEqual(probeReadable({ x: shared, y: shared, z: [shared, shared] }), '')
        let c = { a: 1 }
        c.self = c
        c.bad = unreadable['拋錯之 Symbol.toStringTag']()
        assert.strict.deepEqual(probeReadable(c) !== '', true)
    })

    it('S5 只壞 has 陷阱之 Proxy 為可讀(定義鎖: 探針不讀 has)', function() {
        let p = new Proxy({ a: 1 }, {
            has() {
                throw new Error('has boom')
            },
        })
        assert.strict.deepEqual(probeReadable(p), '')
        assert.strict.deepEqual(probeReadable({ n: p }), '')
        assert.strict.deepEqual(JSON.stringify(p), '{"a":1}') //對照: JSON 序列化亦不讀 has
    })

    it('S6 encodeStrict: 一般值序列化成功且可解回', function() {
        let v = { a: 1, b: 'x', c: [1, 2, { d: null }], u: new Uint8Array([1, 2, 3]) }
        let r = encodeStrict(v)
        assert.strict.deepEqual(r.state, 'success')
        let d = u8arr2obj(r.msg, { returnWithStateAndMsg: true })
        assert.strict.deepEqual(d.state, 'success')
        assert.strict.deepEqual(d.msg.a, 1)
        assert.strict.deepEqual(d.msg.c, [1, 2, { d: null }])
        assert.strict.deepEqual(Array.from(d.msg.u), [1, 2, 3])
    })

    it('S6 encodeStrict: 不可讀之值(頂層、巢狀)回 error 且 msg 以 unreadable value: 起首', function() {
        for (let [k, f] of Object.entries(unreadable)) {
            for (let v of [{ x: f() }, { x: 1, n: [{ y: f() }] }]) {
                let r = encodeStrict(v)
                assert.strict.deepEqual(r.state, 'error', k)
                assert.strict.deepEqual(typeof r.msg === 'string' && r.msg.startsWith('unreadable value: '), true, `${k}: ${JSON.stringify(r.msg)}`)
            }
        }
    })

    it('S6 encodeStrict: 其餘不可序列化者(BigInt、循環參照)仍依 obj2u8arr 嚴格模式回 error(msg 不以 unreadable value 起首)', function() {
        let c = { a: 1 }
        c.self = c
        for (let v of [{ v: 10n }, c]) {
            let r = encodeStrict(v)
            assert.strict.deepEqual(r.state, 'error')
            assert.strict.deepEqual(typeof r.msg === 'string' && r.msg.length > 0 && !r.msg.startsWith('unreadable value'), true, JSON.stringify(r.msg))
        }
    })

    it('S3 encodeStrict: toJSON 只被呼叫一次(帳本 R7 之 #34b; 探針不得多呼叫一次), 且序列化結果為其回傳值', function() {
        let n = 0
        let v = {
            ro: {
                toJSON() {
                    n += 1
                    return { seq: n }
                },
            },
        }
        let r = encodeStrict(v)
        assert.strict.deepEqual(r.state, 'success')
        assert.strict.deepEqual(n, 1, `toJSON 呼叫次數 ${n}`)
        assert.strict.deepEqual(u8arr2obj(r.msg).ro, { seq: 1 })
    })

})
