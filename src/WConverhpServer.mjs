import Hapi from '@hapi/hapi'
import Inert from '@hapi/inert' //提供靜態檔案
import events from 'events'
import get from 'lodash/get'
import uniqBy from 'lodash/uniqBy'
import isEqual from 'lodash/isEqual'
import genPm from 'wsemi/src/genPm.mjs'
import genID from 'wsemi/src/genID.mjs'


/**
 * 建立Hapi伺服器
 *
 * @class
 * @param {Object} [opt={}] 輸入設定物件，預設{}
 * @param {Integer} [opt.port=8080] 輸入Hapi伺服器所在port，預設8080
 * @param {Integer} [opt.strSplitLength=1000000] 輸入傳輸封包長度整數，預設為1000000
 * @returns {Object} 回傳通訊物件，可監聽事件open、error、clientChange、execute、broadcast、deliver，可使用函數broadcast
 * @example
 *
 * import WConverhpServer from 'w-converhp/dist/w-converhp-server.umd.js'
 *
 * let opt = {
 *     port: 8080,
 *     authenticate: function(token) {
 *         //使用token驗證使用者身份
 *         return new Promise(function(resolve, reject) {
 *             setTimeout(function() {
 *                 resolve(true)
 *             }, 1000)
 *         })
 *     },
 * }
 *
 * //new
 * let wo = new WConverhpServer(opt)
 *
 * wo.on('open', function() {
 *     console.log(`Server[port:${opt.port}]: open`)
 * })
 * wo.on('error', function(err) {
 *     console.log(`Server[port:${opt.port}]: error`, err)
 * })
 * wo.on('clientChange', function(clients) {
 *     console.log(`Server[port:${opt.port}]: now clients: ${clients.length}`)
 * })
 * wo.on('execute', function(func, input, callback) {
 *     console.log(`Server[port:${opt.port}]: execute`, func, input)
 *
 *     if (func === 'add') {
 *         let r = input.p1 + input.p2
 *         callback(r)
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
    let conns = []
    let clients = []


    //default
    if (!opt.port) {
        opt.port = 8080
    }
    if (!opt.apiName) {
        opt.apiName = 'api'
    }


    //ee
    let ee = new events.EventEmitter()


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
    function clientChange() {
        eeEmit('clientChange', clients, opt)
    }


    //changeConns
    function changeConns(conns) {
        let clients_new = uniqBy(conns, 'clientId')
        if (!isEqual(clients, clients_new)) {
            clients = clients_new
            clientChange()
        }
    }


    //parserData
    async function parserData(data) {
        //console.log('parserData', data)

        //pm
        let pm = genPm()

        //_mode
        let _mode = get(data, '_mode', '')

        //cbResult for execute
        function cbResult(output) {

            //add output
            data['output'] = output

            //delete input, 因input可能很大故回傳數據不包含原input
            delete data['input']

            //resolve
            pm.resolve(JSON.stringify(data))

        }

        //emit
        if (_mode === 'execute') {

            //func
            let func = get(data, 'func', '')

            //input
            let input = get(data, 'input', null)

            //execute 執行
            eeEmit('execute', func, input, cbResult)

        }
        else if (_mode === 'deliver') {

            //input
            let input = get(data, 'input', null)

            //deliver 交付
            eeEmit('deliver', input)

            //cbResult, 直接調用
            cbResult('ok')

        }
        else {
            let msg = 'can not find _mode in data'
            error(msg, data)
            pm.reject(msg)
        }

        return pm
    }


    //apiHP
    let apiHP = {
        path: '/' + opt.apiName,
        method: 'POST',
        handler: function (req, res) {
            //console.log(req, res)

            //pm
            let pm = genPm()

            //connId
            let connId = genID()

            //clientId
            let clientId = get(req.payload, 'clientId')

            //client
            let client = {
                headers: req.headers,
                info: req.info,
            }

            //push
            conns.push({
                clientId,
                connId,
                data: client,
            })
            changeConns(conns)

            //data
            let data = req.payload

            //parserData
            parserData(data)
                .then(function(r) {
                    pm.resolve(r)
                })
                .catch(function(r) {
                    pm.reject(r)
                })
                .finally(function() {

                    //remove
                    conns = conns.filter(function(c) {
                        return c.connId !== connId
                    })
                    changeConns(conns)

                })

            return pm
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
        server.route([api, apiHP])

        //start
        await server.start()

        console.log(`Server running at: ${server.info.uri}`)

    }

    if (opt.serverHapi) {
        opt.serverHapi.route(apiHP)
    }
    else {
        startServer()
    }

    return ee
}


export default WConverhpServer
