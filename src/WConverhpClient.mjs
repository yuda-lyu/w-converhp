// import axiosNode from 'axios/lib/axios.js'
// import axiosNode from 'axios'
// import axiosBrowser from 'axios/dist/axios.min.js'
// import axiosBrowser from 'axios/dist/esm/axios.min.js'
import axios from 'axios' //axios已可自動依照調用環境切換
// import * as FormData from 'form-data/lib/form_data.js'
// import FormData from 'form-data'
import get from 'lodash-es/get.js'
import each from 'lodash-es/each.js'
// import getGlobal from 'wsemi/src/getGlobal.mjs'
import isWindow from 'wsemi/src/isWindow.mjs'
import genPm from 'wsemi/src/genPm.mjs'
import genID from 'wsemi/src/genID.mjs'
import Evem from 'wsemi/src/evem.mjs'
import pm2resolve from 'wsemi/src/pm2resolve.mjs'
import isfun from 'wsemi/src/isfun.mjs'
import ispint from 'wsemi/src/ispint.mjs'
import isearr from 'wsemi/src/isearr.mjs'
import strright from 'wsemi/src/strright.mjs'
import blob2u8arr from 'wsemi/src/blob2u8arr.mjs'
import obj2u8arr from 'wsemi/src/obj2u8arr.mjs'
import u8arr2obj from 'wsemi/src/u8arr2obj.mjs'


/**
 * 建立Hapi使用者(Node.js與Browser)端物件
 *
 * @class
 * @param {Object} opt 輸入設定參數物件
 * @param {String} [opt.url='http://localhost:8080'] 輸入Hapi伺服器網址，預設為'http://localhost:8080'
 * @param {String} [opt.apiName='api'] 輸入api名稱，預設為'api'
 * @param {Integer} [opt.timePolling=2000] 輸入輪詢間隔時間整數，單位為毫秒，預設為2000
 * @param {Integer} [opt.retry=3] 輸入傳輸失敗重試次數整數，預設為3
 * @returns {Object} 回傳通訊物件，可監聽事件open、openOnce、close、error、reconn、broadcast、deliver，可使用函數execute、broadcast、deliver
 * @example
 *
 * import WConverhpClient from 'w-converhp/dist/w-converhp-client.umd.js'
 *
 * let opt = {
 *     url: 'http://localhost:8080',
 *     apiName: 'api',
 * }
 *
 * //new
 * let wo = new WConverhpClient(opt)
 *
 * wo.on('open', function() {
 *     console.log('client nodejs: open')
 * })
 * wo.on('openOnce', function() {
 *     console.log('client nodejs: openOnce')
 *
 *     //p
 *     let name = 'zdata.b1'
 *     let p = {
 *         a: 12,
 *         b: 34.56,
 *         c: 'test中文',
 *         d: {
 *             name: name,
 *             u8a: new Uint8Array([66, 97, 115]),
 *             //u8a: new Uint8Array(fs.readFileSync('C:\\Users\\Administrator\\Desktop\\'+name)),
 *         }
 *     }
 *
 *     //execute
 *     wo.execute('add', { p },
 *         function (prog, p, m) {
 *             console.log('client nodejs: execute: prog', prog, p, m)
 *         })
 *         .then(function(r) {
 *             console.log('client nodejs: execute: add', r)
 *         })
 *         .catch(function(err) {
 *             console.log('client nodejs: execute: catch', err)
 *         })
 *
 *     //broadcast
 *     wo.broadcast('client nodejs broadcast hi', function (prog) {
 *         console.log('client nodejs: broadcast: prog', prog)
 *     })
 *         .catch(function(err) {
 *             console.log('client nodejs: broadcast: catch', err)
 *         })
 *
 *     //deliver
 *     wo.deliver('client nodejs deliver hi', function (prog) {
 *         console.log('client nodejs: deliver: prog', prog)
 *     })
 *         .catch(function(err) {
 *             console.log('client nodejs: deliver: catch', err)
 *         })
 *
 * })
 * wo.on('close', function() {
 *     console.log('client nodejs: close')
 * })
 * wo.on('error', function(err) {
 *     console.log('client nodejs: error', err)
 * })
 * wo.on('reconn', function() {
 *     console.log('client nodejs: reconn')
 * })
 * wo.on('broadcast', function(data) {
 *     console.log('client nodejs: broadcast', data)
 * })
 * wo.on('deliver', function(data) {
 *     console.log('client nodejs: deliver', data)
 * })
 *
 */
function WConverhpClient(opt) {
    let clientId = genID() //供伺服器識別真實連線使用者


    //ee, ev
    let ee = new Evem()
    //let ev = new Evem()


    //eeEmit
    function eeEmit(name, ...args) {
        setTimeout(() => {
            ee.emit(name, ...args)
        }, 1)
    }


    function core() {


        //default
        if (!opt.url) {
            opt.url = 'http://localhost:8080'
        }
        if (!opt.apiName) {
            opt.apiName = 'api'
        }
        if (!opt.timePolling) {
            opt.timePolling = 2000
        }
        if (!opt.retry) {
            opt.retry = 3
        }


        //url
        let url = ''
        if (strright(opt.url, 1) === '/') {
            url = opt.url + opt.apiName
        }
        else {
            url = opt.url + '/' + opt.apiName
        }


        /**
         * Hapi監聽開啟事件
         *
         * @memberof WConverhpClient
         * @example
         * wo.on('open', function() {
         *     ...
         * })
         */
        function onOpen() {} onOpen()
        function open() {
            eeEmit('open')
        }


        /**
         * Hapi監聽第一次開啟事件
         *
         * @memberof WConverhpClient
         * @example
         * wo.on('openOnce', function() {
         *     ...
         * })
         */
        function onOpenOnce() {} onOpenOnce()
        function openOnce() {
            eeEmit('openOnce')
        }


        /**
         * Hapi監聽錯誤事件
         *
         * @memberof WConverhpClient
         * @param {*} err 接收錯誤訊息
         * @example
         * wo.on('error', function(err) {
         *     ...
         * })
         */
        function onError() {} onError()
        function error(msg, err) {
            eeEmit('error', { msg, err })
        }


        //res2u8arr
        async function res2u8arr(env, bb) {
            let u8a
            if (env === 'browser') {
                u8a = await blob2u8arr(bb)
            }
            else {
                u8a = new Uint8Array(bb)
            }
            return u8a
        }


        //sendDataCore
        function sendDataCore(data, cbProgress) {
            //console.log('sendData', data, cbProgress)

            //pm
            let pm = genPm()

            //env
            let env = isWindow() ? 'browser' : 'nodejs'
            // console.log('env', env)

            // //g
            // let g = getGlobal()

            //obj2u8arr
            let u8a = obj2u8arr(data)
            // console.log('u8a', u8a)

            //u8a to blob(in browser) or buffer(in nodejs)
            let bb
            if (env === 'browser') {
                bb = new Blob([u8a.buffer])
            }
            else { //nodejs
                bb = Buffer.from(u8a)
            }
            // console.log('bb', bb)

            //new
            let fmd
            if (env === 'browser') {
                fmd = new FormData()
            }
            else {
                if (isfun(opt.FormData)) {
                    fmd = new opt.FormData({ maxDataSize: 1024 * 1024 * 1024 }) //nodejs, 使用套件form-data設定資料量最大為1g
                }
                else {
                    console.log(`invalid opt.FormData, need [npm i form-data] and [import FormData from 'form-data'] to set opt.FormData = FormData`)
                    throw new Error('invalid opt.FormData')
                }
            }

            //append
            //fmd.append('aa', 'test')
            fmd.append('bb', bb)
            // console.log('fmd', fmd)

            //ct
            let ct = 'multipart/form-data'
            if (env === 'nodejs') {
                ct += `; boundary=${fmd.getBoundary()}` //nodejs, 使用套件form-data需設定boundary
            }
            // console.log('ct', ct)

            //rt
            let rt = 'blob'
            if (env === 'nodejs') {
                rt = 'arraybuffer' //nodejs下沒有blob, 只能設定'json', 'arraybuffer', 'document', 'json', 'text', 'stream'
            }
            // console.log('rt', rt)

            //s
            let s = {
                method: 'POST',
                url,
                data: fmd,
                headers: {
                    'Content-Type': ct, //數據視為file上傳
                },
                timeout: 5 * 60 * 1000, //5分鐘
                maxContentLength: Infinity, //1024 * 1024 * 1024, Infinity //axios於nodejs中會限制內容大小故需改為無限
                maxBodyLength: Infinity, //1024 * 1024 * 1024, Infinity //axios於nodejs中會限制內容大小故需改為無限
                responseType: rt,
                onUploadProgress: function(ev) {
                    //console.log('onUploadProgress', ev)

                    //r
                    let r = 0
                    let loaded = ev.loaded
                    let total = ev.total
                    if (ispint(total)) {
                        r = (loaded * 100) / total
                    }

                    //cbProgress
                    if (isfun(cbProgress)) {
                        cbProgress(Math.floor(r), loaded, 'upload')
                    }

                },
                onDownloadProgress: function (ev) {
                    // console.log('onDownloadProgress', ev)

                    //r
                    let r = 0
                    let loaded = ev.loaded
                    // let total = ev.srcElement.getResponseHeader('Content-length') //若需要得知下載進度, 需於伺服器回傳時提供Content-length
                    let total = ev.total
                    if (ispint(total)) {
                        r = (loaded * 100) / total
                    }

                    //cbProgress
                    if (isfun(cbProgress)) {
                        cbProgress(Math.floor(r), loaded, 'donwload')
                    }

                },
            }
            // console.log('s', s)

            //axios
            //使用import axios from 'axios', 若於套件內測試, 由於執行時axios自動選用nodejs或browser版本, 分不出差異
            //但若是發佈成套件再由其他套件呼叫使用就會預設使用axiosNode版本, 導致瀏覽器端出錯: Cannot convert undefined or null to object[at mergeConfig]
            // let axios = null
            // if (env === 'browser') {
            //     axios = axiosBrowser
            // }
            // else {
            //     axios = axiosNode
            // }

            //axios
            axios(s)
                .then(async (res) => {
                    // console.log('axios then', res)

                    //bb
                    let bb = get(res, 'data')
                    // console.log('bb', bb)

                    //res2u8arr
                    let u8a = await res2u8arr(env, bb)
                    // console.log('u8a', u8a)

                    //u8arr2obj
                    let data = u8arr2obj(u8a)
                    // console.log('data', data)

                    pm.resolve(data)
                })
                .catch(async (res) => {
                    //console.log('axios catch', res.toJSON())
                    //Network Error除可能是網路斷線之外, 亦可能因硬碟空間不足(<4g)無法下載, 或是被瀏覽器外掛封鎖阻擋

                    //statusText, err
                    let statusText = get(res, 'response.statusText') || get(res, 'message')
                    let err = get(res, 'response.data') || get(res, 'stack')

                    if (statusText) {
                        // console.log('statusText', statusText)
                        data = statusText
                    }
                    else if (err) {
                        // console.log('err', err)
                        data = err
                    }
                    else {
                        try {
                            res = res.toJSON()
                        }
                        catch (err) {}
                        console.log('err', res)
                        data = 'Can not connect to server.'
                    }
                    if (data === 'Network Error') {
                        data = `${data}. Make sure your space of hard drive is large enough or blocking by browser plugins.`
                    }

                    pm.reject(data)
                })

            return pm
        }


        //sendData
        async function sendData(data, cbProgress) {

            //sendDataCore
            let r = await pm2resolve(sendDataCore)(data, cbProgress)

            let n = 0
            while (r.state === 'error') {
                n += 1
                if (n > opt.retry) {
                    break
                }
                console.log(`retry n=${n}`)
                r = await pm2resolve(sendDataCore)(data, cbProgress)
            }

            //return
            if (r.state === 'success') {
                return r.msg
            }
            else {
                return Promise.reject(r.msg)
            }

        }


        //sendMsg
        function sendMsg(msg, cbResult, cbProgress) {
            //console.log(msg, cbResult, cbProgress)

            //sendData
            sendData(msg, cbProgress)
                .then((res) => {
                    //console.log('sendData then', res)

                    //cbResult
                    cbResult(res)

                })
                .catch((err) => {
                    //console.log('sendData catch', err)

                    //cbResult
                    cbResult({
                        error: err,
                    })

                })

        }


        function polling() {

            //setInterval
            setInterval(() => {

                //triggerPolling
                triggerPolling()
                    .then((res) => {
                        //console.log('polling res', res)

                        //output
                        let output = get(res, 'success.output', null)
                        //console.log('output', output)

                        //check
                        if (output === null) {
                            return
                        }
                        if (!isearr(output)) {
                            return
                        }

                        //each
                        each(output, (v, k) => {
                            setTimeout(() => {

                                if (get(v, 'mode') === 'broadcast') {
                                    //broadcast 廣播
                                    eeEmit('broadcast', get(v, 'data'))
                                }
                                else if (get(v, 'mode') === 'deliver') {
                                    //deliver 發送
                                    eeEmit('deliver', get(v, 'data'))
                                }
                                else {
                                    error('invalid data.mode in polling', v)
                                }

                            }, 10 * (k + 1))
                        })

                    })
                    .catch((err) => {
                        error('can not polling', err)
                        eeEmit('reconn')
                    })

            }, opt.timePolling)

        }


        function triggerPolling() {

            //pm
            let pm = genPm()

            //msg
            let msg = {
                _mode: 'polling',
                clientId,
            }

            //cb
            function cb(res) {
                pm.resolve(res)
            }

            //sendMsg
            sendMsg(msg, cb, () => {})

            return pm
        }


        function triggerExecute(func, input, cbResult, cbProgress) {
            //console.log('triggerExecute', func, input, cbResult, cbProgress)

            //mode
            let mode = 'execute'

            //msg
            let msg = {
                _mode: mode,
                clientId,
                func,
                input,
            }

            //sendMsg
            sendMsg(msg, cbResult, cbProgress)

        }


        function triggerBroadcast(input, cbResult, cbProgress) {
            triggerCommon(input, cbResult, cbProgress, 'broadcast')
        }


        function triggerDeliver(input, cbResult, cbProgress) {
            triggerCommon(input, cbResult, cbProgress, 'deliver')
        }


        function triggerCommon(input, cbResult, cbProgress, mode) {

            //msg
            let msg = {
                _mode: mode,
                clientId,
                input,
            }

            //sendMsg
            sendMsg(msg, cbResult, cbProgress)

        }


        //triggerExecute, 若斷線重連則需自動清除過去監聽事件
        ee.removeAllListeners('triggerExecute')
        ee.on('triggerExecute', triggerExecute)


        //triggerBroadcast, 若斷線重連則需自動清除過去監聽事件
        ee.removeAllListeners('triggerBroadcast')
        ee.on('triggerBroadcast', triggerBroadcast)


        //triggerDeliver, 若斷線重連則需自動清除過去監聽事件
        ee.removeAllListeners('triggerDeliver')
        ee.on('triggerDeliver', triggerDeliver)


        //open, openOnce, polling
        open()
        openOnce()
        polling()


    }


    //parseOutput
    function parseOutput(pm, data) {
        let resSuccess = get(data, 'success', null)
        let resError = get(data, 'error', null)
        if (resSuccess !== null) {
            let output = get(resSuccess, 'output')
            pm.resolve(output)
        }
        else {
            pm.reject(resError)
        }
    }


    /**
     * Hapi通訊物件對伺服器端執行函數，表示傳送資料給伺服器，並請伺服器執行函數
     *
     * @memberof WConverhpClient
     * @function execute
     * @param {String} func 輸入執行函數之名稱字串
     * @param {*} [input=null] 輸入執行函數之輸入資訊
     * @example
     * let func = 'NameOfFunction'
     * let input = {...}
     * wo.execute(func, input)
     */
    ee.execute = function (func, input, cbProgress = function () {}) {
        let pm = genPm()
        eeEmit('triggerExecute', func, input,
            function(data) { //結果用promise回傳
                parseOutput(pm, data)
            },
            cbProgress //傳輸進度用cb回傳
        )
        return pm
    }


    /**
     * Hapi通訊物件對伺服器端廣播函數，表示傳送資料給伺服器，還需轉送其他客戶端
     *
     * @memberof WConverhpClient
     * @function broadcast
     * @param {*} data 輸入廣播函數之輸入資訊
     * @example
     * let data = {...}
     * wo.broadcast(data)
     */
    ee.broadcast = function (data, cbProgress = function () {}) {
        let pm = genPm()
        eeEmit('triggerBroadcast', data,
            function(data) { //結果用promise回傳
                parseOutput(pm, data)
            },
            cbProgress //傳輸進度用cb回傳
        )
        return pm
    }


    /**
     * Hapi通訊物件對伺服器端發送函數，表示僅傳送資料給伺服器
     *
     * @memberof WConverhpClient
     * @function deliver
     * @param {*} data 輸入發送函數之輸入資訊
     * @example
     * let data = {...}
     * wo.deliver(data)
     */
    ee.deliver = function (data, cbProgress = function () {}) {
        let pm = genPm()
        eeEmit('triggerDeliver', data,
            function(data) { //結果用promise回傳
                parseOutput(pm, data)
            },
            cbProgress //傳輸進度用cb回傳
        )
        return pm
    }


    // /**
    //  * Hapi監聽重連事件
    //  *
    //  * @memberof WConverhpClient
    //  * @example
    //  * wo.on('reconn', function() {
    //  *     ...
    //  * })
    //  */
    // function onReconn() {} onReconn()
    // function reconn() {
    //     eeEmit('reconn')
    //     setTimeout(function() {
    //         core()
    //     }, 1000)
    // }


    //core
    core()


    return ee
}


export default WConverhpClient
