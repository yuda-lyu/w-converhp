// import fs from 'fs'
import Hapi from '@hapi/hapi'
import Inert from '@hapi/inert' //提供靜態檔案
import events from 'events'
import stream from 'stream'
import get from 'lodash/get'
import map from 'lodash/map'
import each from 'lodash/each'
import cloneDeep from 'lodash/cloneDeep'
import genPm from 'wsemi/src/genPm.mjs'
import alive from 'wsemi/src/alive.mjs'
import isstr from 'wsemi/src/isstr.mjs'
import obj2u8arr from 'wsemi/src/obj2u8arr.mjs'
import u8arr2obj from 'wsemi/src/u8arr2obj.mjs'


/**
 * 建立Hapi伺服器
 *
 * @class
 * @param {Object} [opt={}] 輸入設定物件，預設{}
 * @param {Integer} [opt.port=8080] 輸入Hapi伺服器所在port，預設8080
 * @param {String} [opt.apiName='api'] 輸入http API伺服器網址的api名稱，預設'api'
 * @returns {Object} 回傳通訊物件，可監聽事件open、error、clientChange、execute、broadcast、deliver，可使用函數broadcast
 * @example
 *
 * import WConverhpServer from 'w-converhp/dist/w-converhp-server.umd.js'
 *
 * let opt = {
 *     port: 8080,
 *     apiName: 'api',
 * }
 *
 * //new
 * let wo = new WConverhpServer(opt)
 *
 * wo.on('open', function() {
 *     console.log(`Server[port:${opt.port}]: open`)
 *
 *     //broadcast
 *     let n = 0
 *     setInterval(() => {
 *         n += 1
 *         let o = {
 *             text: `server broadcast hi(${n})`,
 *             data: new Uint8Array([66, 97, 115]), //support Uint8Array data
 *         }
 *         wo.broadcast(o, function (prog) {
 *             console.log('broadcast prog', prog)
 *         })
 *     }, 1000)
 *
 * })
 * wo.on('error', function(err) {
 *     console.log(`Server[port:${opt.port}]: error`, err)
 * })
 * wo.on('clientChange', function(clients) {
 *     console.log(`Server[port:${opt.port}]: now clients: ${clients.length}`)
 * })
 * wo.on('execute', function(func, input, pm) {
 *     //console.log(`Server[port:${opt.port}]: execute`, func, input)
 *     console.log(`Server[port:${opt.port}]: execute`, func)
 *
 *     try {
 *
 *         if (func === 'add') {
 *
 *             //save
 *             if (_.get(input, 'p.d.u8a', null)) {
 *                 // fs.writeFileSync(input.p.d.name, Buffer.from(input.p.d.u8a))
 *                 // console.log('writeFileSync input.p.d.name', input.p.d.name)
 *             }
 *
 *             let r = {
 *                 ab: input.p.a + input.p.b,
 *                 v: [11, 22.22, 'abc', { x: '21', y: 65.43, z: 'test中文' }],
 *                 file: {
 *                     name: 'zdata.b2',
 *                     u8a: new Uint8Array([66, 97, 115]),
 *                     //u8a: new Uint8Array(fs.readFileSync('C:\\Users\\Administrator\\Desktop\\z500mb.7z')),
 *                 },
 *             }
 *             pm.resolve(r)
 *         }
 *         else {
 *             console.log('invalid func')
 *             pm.reject('invalid func')
 *         }
 *
 *     }
 *     catch (err) {
 *         console.log('execute error', err)
 *         pm.reject('execute error')
 *     }
 *
 * })
 * wo.on('broadcast', function(data) {
 *     console.log(`Server[port:${opt.port}]: broadcast`, data)
 * })
 * wo.on('deliver', function(data) {
 *     console.log(`Server[port:${opt.port}]: deliver`, data)
 * })
 *
 */
function WConverhpServer(opt = {}) {
    let broadcastMessages = {}


    //default
    if (!opt.port) {
        opt.port = 8080
    }
    if (!opt.apiName) {
        opt.apiName = 'api'
    }


    //ee
    let ee = new events.EventEmitter()


    //ea
    let ea = alive()


    //ea broadcastMessages
    setInterval(() => {

        //now alive
        let nowAlive = ea.get()
        //console.log('nowAlive', nowAlive)

        //clientIds
        let clientIds = map(nowAlive, 'key')
        //console.log('clientIds', clientIds)

        //pick
        let t = {}
        each(clientIds, (clientId) => {
            t[clientId] = get(broadcastMessages, clientId, [])
        })
        broadcastMessages = t
        //console.log('broadcastMessages', broadcastMessages)

    }, 1000)


    //eeEmit
    function eeEmit(name, ...args) {
        setTimeout(() => {
            ee.emit(name, ...args)
        }, 1)
    }


    //server
    let server
    if (opt.serverHapi) {

        //use serverHapi
        server = opt.serverHapi

    }
    else {

        //create server
        server = Hapi.server({
            port: opt.port,
            //host: 'localhost',
            routes: {
                cors: true
            },
        })

    }


    /**
     * Hapi監聽開啟事件
     *
     * @memberof WConverhpServer
     * @example
     * wo.on('open', function() {
     *     ...
     * })
     */
    function onOpen() {} onOpen()
    function open() {
        eeEmit('open')
    }
    open()


    /**
     * Hapi監聽錯誤事件
     *
     * @memberof WConverhpServer
     * @param {*} err 傳入錯誤訊息
     * @example
     * wo.on('error', function(err) {
     *     ...
     * })
     */
    function onError() {} onError()
    function error(msg, err) {
        eeEmit('error', { msg, err })
    }


    /**
     * Hapi監聽客戶端變更(上下線)事件
     *
     * @memberof WConverhpServer
     * @example
     * wo.on('clientChange', function(clients) {
     *     ...
     * })
     */
    function onClientChange() {} onClientChange()
    ea.on('message', function({ eventName, key, data, now }) {
        //console.log({ eventName, key, data, now })
        eeEmit('clientChange', ea.get(), opt)
    })


    //dealData
    async function dealData(data) {
        //console.log('dealData', data)

        //pm, pmm
        let pm = genPm()
        let pmm = genPm()

        //_mode
        let _mode = get(data, '_mode', '')

        //重新處理回傳結果
        pmm
            .then((output) => {

                //add output
                data['output'] = output

                //delete input, 因input可能很大故回傳數據不包含原input
                delete data['input']

                //resolve
                pm.resolve(data)

            })
            .catch((err) => {
                pm.reject(err)
            })
        // //cbResult
        // function cbResult(output) {

        //     //add output
        //     data['output'] = output

        //     //delete input, 因input可能很大故回傳數據不包含原input
        //     delete data['input']

        //     //resolve
        //     pm.resolve(data)

        // }

        //emit
        if (_mode === 'execute') {

            //func
            let func = get(data, 'func', '')

            //input
            let input = get(data, 'input', null)

            //execute 執行
            eeEmit('execute', func, input, pmm)

        }
        else if (_mode === 'broadcast') {

            //input
            let input = get(data, 'input', null)

            //broadcast 廣播
            eeEmit('broadcast', input)

            //resolve
            pmm.resolve('ok')

        }
        else if (_mode === 'deliver') {

            //input
            let input = get(data, 'input', null)

            //deliver 交付
            eeEmit('deliver', input)

            //resolve
            pmm.resolve('ok')

        }
        else if (_mode === 'polling') {

            //clientId
            let clientId = get(data, 'clientId', '')

            //polling messages
            let pms = get(broadcastMessages, clientId, [])
            pms = cloneDeep(pms)

            //clear
            broadcastMessages[clientId] = []

            //resolve
            pmm.resolve(pms)

        }
        else {
            let msg = 'can not find _mode in data'
            error(msg, data)
            pm.reject(msg)
            pmm.reject()
        }

        return pm
    }


    //apiMain
    let apiMain = {
        path: '/' + opt.apiName,
        method: 'POST',
        // config: {
        //     payload: {
        //         output: 'stream',
        //         maxBytes: 1000 * 1024 * 1024, //1g
        //     },
        // },
        options: {
            payload: {
                maxBytes: 1000 * 1024 * 1024, //1g
                timeout: 3 * 60 * 1000, //3分鐘, 注意payload timeout必須小於socket timeout
            },
            timeout: {
                socket: 5 * 60 * 1000, //5分鐘
            },
        },
        handler: async function (req, res) {
            //console.log(req, res)
            //console.log('payload', req.payload)

            //bbInp
            let bbInp = get(req, 'payload.bb', null)
            //console.log('bbInp', bbInp)

            //check
            //console.log('isstr(bbInp)', isstr(bbInp))
            if (isstr(bbInp)) {
                bbInp = Buffer.from(bbInp, 'utf8') //收nodejs client的buffer會自動解析變成字串
            }

            //u8aInp
            let u8aInp = new Uint8Array(bbInp)
            //console.log('u8aInp', u8aInp)

            //u8arr2obj
            let inp = u8arr2obj(u8aInp)
            //console.log('inp', inp)

            //clientId
            let clientId = get(inp, 'clientId')

            //client
            let client = {
                headers: req.headers,
                info: req.info,
            }

            //trigger
            ea.trigger(clientId, client)

            //dealData
            let out = {}
            await dealData(inp)
                .then(function(msg) {
                    out.success = msg
                })
                .catch(function(msg) {
                    out.error = msg
                })
            //console.log('out', out)

            //u8aOut
            let u8aOut = obj2u8arr(out)

            //stream
            let sm = new stream.Readable()
            sm._read = () => {}
            sm.push(u8aOut)
            sm.push(null)

            return res.response(sm)
                .header('Content-type', 'application/octet-stream')
                .header('Content-length', sm.readableLength)
        },
    }


    /**
     * Hapi監聽客戶端執行事件
     *
     * @memberof WConverhpServer
     * @param {String} func 傳入執行函數名稱字串
     * @param {*} input 傳入執行函數之輸入數據
     * @param {Function} callback 傳入執行函數之回調函數
     * @param {Function} sendData 傳入執行函數之強制回傳函數，提供傳送任意訊息給客戶端，供由服器多次回傳數據之用
     * @example
     * wo.on('execute', function(func, input, callback, sendData) {
     *     ...
     * })
     */
    function onExecute() {} onExecute()


    /**
     *  Hapi監聽客戶端廣播事件
     *
     * @memberof WConverhpServer
     * @param {*} data 傳入廣播訊息
     * @example
     * wo.on('broadcast', function(data) {
     *     ...
     * })
     */
    function onBroadcast() {} onBroadcast()


    /**
     * Hapi監聽客戶端交付事件
     *
     * @memberof WConverhpServer
     * @param {*} data 傳入交付訊息
     * @example
     * wo.on('deliver', function(data) {
     *     ...
     * })
     */
    function onDeliver() {} onDeliver()


    /**
     * Hapi通訊物件對客戶端廣播函數
     *
     * @memberof WConverhpServer
     * @function broadcast
     * @param {*} data 輸入廣播函數之輸入資訊
     * @example
     * let data = {...}
     * wo.broadcast(data)
     */
    ee.broadcast = function (data, cbProgress = function () {}) {
        //eeEmit('triggerBroadcast', data, cbProgress)

        //modify broadcast data
        let t = {}
        each(broadcastMessages, (v, k) => {

            //push, 數據為陣列, 加入新廣播數據
            v.push(data)

            //save
            t[k] = v

        })
        broadcastMessages = t

        //cbProgress, 無法馬上傳需等待客戶端輪詢接收, 故進度回調只能先回傳100%
        cbProgress(100)

    }


    async function startServer() {

        //register inert
        await server.register(Inert)

        //api
        let api = {
            method: 'GET',
            path: '/{file*}',
            handler: {
                directory: {
                    path: './'
                }
            },
        }

        //route
        server.route([api, apiMain])

        //start
        await server.start()

        console.log(`Server running at: ${server.info.uri}`)

    }

    if (opt.serverHapi) {
        opt.serverHapi.route(apiMain)
    }
    else {
        startServer()
    }

    return ee
}


export default WConverhpServer