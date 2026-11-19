import getErrorMessage from 'wsemi/src/getErrorMessage.mjs'


//isRef, 是否為參考型別(物件或函數)
let isRef = (x) => {
    return x !== null && (typeof x === 'object' || typeof x === 'function')
}


//touch, 觸碰值之型別標籤(Object.prototype.toString.call, 即 wsemi 判斷函數之共同底層 _tagOf 所讀者): 會讀 Symbol.toStringTag(含其 getter 與 Proxy 之 get 陷阱)
//已撤銷之 Proxy、get 陷阱拋錯之 Proxy、拋錯之 Symbol.toStringTag getter 皆於此拋錯; 回傳內部標籤字串
//不讀 has 陷阱: wsemi 之判斷函數與 JSON 序列化皆不依賴 in 運算子, 只壞 has 陷阱之 Proxy 於本套件之各處理路徑皆可正常運作, 不視為不可讀
let touch = (x) => {
    return Object.prototype.toString.call(x)
}


//isCallableToJson, toJSON 之屬性描述子是否使序列化器改序列化其回傳值: 資料屬性為函數, 或以 accessor 定義(其值無從不呼叫而得知, 視為有)
//同 JSON.stringify 對 toJSON 之取法: 取最先找到之同名屬性, 該屬性不可呼叫者即視為無(不再往原型鏈上找)
let isCallableToJson = (d) => {
    return typeof d.value === 'function' || d.get !== undefined
}


//hasToJSON, 值是否有 toJSON(沿原型鏈以屬性描述子查, 不讀值、不觸發 getter); cache 為本次探針內之「原型 → 其鏈上是否有 toJSON」(探針為同步, 原型鏈於其間不變)
//查詢本身拋錯(如原型陷阱拋錯之 Proxy)者視為無: 序列化器取 toJSON 不經原型陷阱, 不應因此多判不可讀
let hasToJSON = (x, cache) => {
    try {
        let d = Reflect.getOwnPropertyDescriptor(x, 'toJSON')
        if (d !== undefined) {
            return isCallableToJson(d)
        }
        let path = []
        let res = false
        let p = Reflect.getPrototypeOf(x)
        while (p !== null) {
            if (cache.has(p)) {
                res = cache.get(p)
                break
            }
            path.push(p)
            let dd = Reflect.getOwnPropertyDescriptor(p, 'toJSON')
            if (dd !== undefined) {
                res = isCallableToJson(dd)
                break
            }
            p = Reflect.getPrototypeOf(p)
        }
        for (let q of path) {
            cache.set(q, res)
        }
        return res
    }
    catch (err) {
        return false
    }
}


/**
 * 探針: 檢驗值是否可被安全讀取(型別標籤與鍵集合取得時不拋錯)
 *
 * why 須有本探針(帳本 R32): 應用端與呼叫端交出之值可為任意值, 含已撤銷之 Proxy、拋錯之 Symbol.toStringTag getter 與拋錯之 Proxy 陷阱。
 * wsemi 之判斷函數(isobj、isfun、isestr 等)自 1.9.69 起對此類值一律回 false 而不拋錯(判斷函數回布林), 而本套件原有數個防線
 * 借判斷函數之拋錯而成立(序列化之嚴格模式、下載欄位之判定、串流之辨識): 判定不再拋錯後, 不可讀之值被當成「一般之無效值」或「無特徵之物件」續行, 防線失效。
 * 故凡需「不可讀者走原失敗通道」之站點, 一律以本探針明確判定, 不再倚賴判斷函數之拋錯與否
 *
 * 探針只觸碰型別標籤與鍵集合, 不呼叫值之任何方法, 不展開二進位內容:
 *   - 淺探(opt.deep 為 false): 只觸碰該值本身
 *   - 深探(預設): 自該值起走訪「序列化器會走到」之全部物件(陣列逐元素, 物件逐自有可列舉字串鍵之資料屬性), 逐一觸碰; 以 WeakSet 去除重複與循環(循環不算不可讀, 由序列化器自行回報)
 *     不呼叫 accessor 與 toJSON: 其呼叫次數由序列化器掌握(帳本 R7 #34b: toJSON 須只被呼叫一次), 探針不得多呼叫一次; accessor 與 toJSON 回傳之值不在探針範圍(已知限制, 見帳本 R32 之 L4)
 *     序列化器不會走到者不展開(否則為假陽性): 有 toJSON 者(以屬性描述子沿原型鏈查, 不讀值; 序列化器改序列化其回傳值, 如 Date)、Error 與 DOMException(wsemi 轉為字串)、函數值(JSON 丟鍵)
 *     不展開 ArrayBuffer 與其視圖(Uint8Array、Buffer 等): 其鍵為全部之索引, 展開即配置與位元組數同量之字串
 *     已知偏差(極端罕見, 取捨見下): 陣列以 x[i] 讀元素, 索引上若有 accessor 會被多呼叫一次(不另以描述子讀取以免大陣列之配置成本)
 *     成本: 約等於一次序列化之走訪(實測 100 萬筆物件之陣列約 +0.4 秒), 大輸出之代價見帳本 R32
 *
 * @param {*} v 輸入任意值
 * @param {Object} [opt={}] 輸入設定物件, 預設{}
 * @param {Boolean} [opt.deep=true] 輸入是否深探布林值, 預設true
 * @returns {String} 回傳空字串代表可讀; 非空字串為不可讀之原因(取自拋出之例外, 取不到內容時為 'unreadable value')
 */
function probeReadable(v, opt = {}) {
    let deep = opt.deep !== false
    try {

        //check, 原始值恆可讀
        if (!isRef(v)) {
            return ''
        }

        //shallow
        if (!deep) {
            touch(v)
            return ''
        }

        //deep, 以堆疊走訪(不遞迴, 深層結構不致堆疊溢位)
        let seen = new WeakSet()
        let cacheToJson = new WeakMap()
        let stack = [v]
        while (stack.length > 0) {
            let x = stack.pop()
            if (seen.has(x)) {
                continue
            }
            seen.add(x)

            //touch
            let tag = touch(x)

            //leaf, 序列化器不會走到其子圖者不展開: 函數(JSON 丟鍵)、二進位內容、Error 與 DOMException(wsemi 轉為字串)、有 toJSON 者(序列化器改序列化其回傳值)
            if (typeof x === 'function' || ArrayBuffer.isView(x) || tag === '[object ArrayBuffer]' || tag === '[object SharedArrayBuffer]' || tag === '[object Error]' || tag === '[object DOMException]' || hasToJSON(x, cacheToJson)) {
                continue
            }

            //array, 逐元素(元素讀取同序列化器之讀取; 陣列索引上之 accessor 極為罕見, 不另以描述子讀取以免大陣列之配置成本)
            if (Array.isArray(x)) {
                let n = x.length
                for (let i = 0; i < n; i++) {
                    let e = x[i]
                    if (isRef(e)) {
                        stack.push(e)
                    }
                }
                continue
            }

            //object, 逐自有可列舉字串鍵, 只取資料屬性(不呼叫 accessor)
            for (let k of Reflect.ownKeys(x)) {
                if (typeof k !== 'string') {
                    continue
                }
                let d = Reflect.getOwnPropertyDescriptor(x, k)
                if (d !== undefined && d.enumerable === true && 'value' in d && isRef(d.value)) {
                    stack.push(d.value)
                }
            }

        }

        return ''
    }
    catch (err) {
        let cause = getErrorMessage(err)
        return (typeof cause === 'string' && cause !== '') ? cause : 'unreadable value'
    }
}


export default probeReadable
