import fs from 'fs'
import stream from 'stream'
import Hapi from '@hapi/hapi'
import Inert from '@hapi/inert' //提供靜態檔案
import get from 'lodash-es/get.js'
import genPm from 'wsemi/src/genPm.mjs'
import iseobj from 'wsemi/src/iseobj.mjs'
import isestr from 'wsemi/src/isestr.mjs'
import isp0int from 'wsemi/src/isp0int.mjs'
import ispint from 'wsemi/src/ispint.mjs'
import isearr from 'wsemi/src/isearr.mjs'
import isbol from 'wsemi/src/isbol.mjs'
import isfun from 'wsemi/src/isfun.mjs'
import ispm from 'wsemi/src/ispm.mjs'
import cint from 'wsemi/src/cint.mjs'
import evem from 'wsemi/src/evem.mjs'
import obj2u8arr from 'wsemi/src/obj2u8arr.mjs'
import u8arr2obj from 'wsemi/src/u8arr2obj.mjs'
import fsIsFolder from 'wsemi/src/fsIsFolder.mjs'
import fsCreateFolder from 'wsemi/src/fsCreateFolder.mjs'
import mergeFiles from './mergeFiles.wk.umd.js'
// import mergeFiles from './mergeFiles.mjs'


/**
 * 建立Hapi伺服器
 *
 * @class
 * @param {Object} [opt={}] 輸入設定物件，預設{}
 * @param {Integer} [opt.port=8080] 輸入Hapi伺服器所在port正整數，預設8080
 * @param {Boolean} [opt.useInert=true] 輸入是否提供瀏覽pathStaticFiles資料夾內檔案之布林值，預設true
 * @param {String} [opt.pathStaticFiles='dist'] 輸入當useInert=true時提供瀏覽資料夾字串，預設'dist'
 * @param {String} [opt.apiName='api'] 輸入API名稱字串，預設'api'
 * @param {String} [opt.pathUploadTemp='./uploadTemp'] 輸入暫時存放切片上傳檔案資料夾字串，預設'./uploadTemp'
 * @param {Function} [opt.verifyConn=()=>{return true}] 輸入呼叫API時檢測函數，預設()=>{return true}
 * @param {Array} [opt.corsOrigins=['*']] 輸入允許跨域網域陣列，若給予['*']代表允許全部，預設['*']
 * @param {Integer} [opt.delayForBasic=0] 輸入基本API用延遲響應時間，單位ms，預設0
 * @param {Integer} [opt.delayForSlice=100] 輸入切片上傳檔案API用延遲響應時間，單位ms，預設100
 * @param {Boolean} [opt.serverHapi=null] 輸入外部提供Hapi伺服器物件，預設null
 * @returns {Object} 回傳事件物件，可監聽事件execute、upload、handler
 * @example
 *
 * import _ from 'lodash-es'
 * import WConverhpServer from 'w-converhp/dist/w-converhp-server.umd.js'
 *
 * let opt = {
 *     port: 8080,
 *     apiName: 'api',
 *     pathStaticFiles: '.', //要存取專案資料夾下web.html, 故不能給dist
 *     verifyConn: () => {
 *         return true
 *     },
 * }
 *
 * //new
 * let wo = new WConverhpServer(opt)
 *
 * wo.on('execute', (func, input, pm) => {
 *     // console.log(`Server[port:${opt.port}]: execute`, func, input)
 *     console.log(`Server[port:${opt.port}]: execute`, func)
 *
 *     try {
 *
 *         if (func === 'add') {
 *
 *             if (_.get(input, 'p.d.u8a', null)) {
 *                 console.log('input.p.d.u8a', input.p.d.u8a)
 *             }
 *
 *             let r = {
 *                 _add: input.p.a + input.p.b,
 *                 _data: [11, 22.22, 'abc', { x: '21', y: 65.43, z: 'test中文' }],
 *                 _bin: {
 *                     name: 'zdata.b2',
 *                     u8a: new Uint8Array([66, 97, 115]),
 *                     // name: '100mb.7z',
 *                     // u8a: new Uint8Array(fs.readFileSync('D:\\開源-JS-006-2-w-converhp\\_temp\\100mb.7z')),
 *                     // name: '500mb.7z',
 *                     // u8a: new Uint8Array(fs.readFileSync('D:\\開源-JS-006-2-w-converhp\\_temp\\500mb.7z')),
 *                     // name: '1000mb.7z',
 *                     // u8a: new Uint8Array(fs.readFileSync('D:\\開源-JS-006-2-w-converhp\\_temp\\1000mb.7z')),
 *                 },
 *             }
 *
 *             pm.resolve(r)
 *
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
 * wo.on('upload', (input, pm) => {
 *     console.log(`Server[port:${opt.port}]: upload`, input)
 *
 *     try {
 *         let output = input
 *         pm.resolve(output)
 *     }
 *     catch (err) {
 *         console.log('upload error', err)
 *         pm.reject('upload error')
 *     }
 *
 * })
 * wo.on('handler', (data) => {
 *     // console.log(`Server[port:${opt.port}]: handler`, data)
 * })
 *
 */
function WConverhpServer(opt = {}) {

    //port
    let port = get(opt, 'port')
    if (!ispint(port)) {
        port = 8080
    }

    //useInert
    let useInert = get(opt, 'useInert')
    if (!isbol(useInert)) {
        useInert = true
    }

    //pathStaticFiles
    let pathStaticFiles = get(opt, 'pathStaticFiles')
    if (!isestr(pathStaticFiles)) {
        pathStaticFiles = 'dist'
    }

    //apiName
    let apiName = get(opt, 'apiName')
    if (!isestr(apiName)) {
        apiName = 'api'
    }

    //apiSliceName
    let apiSliceName = `${apiName}slc`

    //pathUploadTemp
    let pathUploadTemp = get(opt, 'pathUploadTemp')
    if (!isestr(pathUploadTemp)) {
        pathUploadTemp = './uploadTemp'
    }
    if (!fsIsFolder(pathUploadTemp)) {
        fsCreateFolder(pathUploadTemp)
    }

    //verifyConn
    let verifyConn = get(opt, 'verifyConn')
    if (!isfun(verifyConn)) {
        verifyConn = () => {
            return true
        }
    }

    //corsOrigins
    let corsOrigins = get(opt, 'corsOrigins', [])
    if (!isearr(corsOrigins)) {
        corsOrigins = ['*']
    }

    //delayForBasic
    let delayForBasic = get(opt, 'delayForBasic', '')
    if (!isp0int(delayForBasic)) {
        delayForBasic = 0
    }
    delayForBasic = cint(delayForBasic)

    //delayForSlice
    let delayForSlice = get(opt, 'delayForSlice', '')
    if (!isp0int(delayForSlice)) {
        delayForSlice = 100
    }
    delayForSlice = cint(delayForSlice)

    //server
    let server = null
    if (get(opt, 'serverHapi')) {

        //use serverHapi
        server = opt.serverHapi

    }
    else {

        //create server
        server = Hapi.server({
            //host: 'localhost',
            port,
            routes: {
                timeout: {
                    server: false, //關閉伺服器超時
                    socket: false, //關閉socket超時
                },
                cors: {
                    origin: corsOrigins, //Access-Control-Allow-Origin
                    credentials: false, //Access-Control-Allow-Credentials
                },
            },
        })

    }

    //ee
    let ee = evem() //new events.EventEmitter()

    //eeEmit
    let eeEmit = (name, ...args) => {
        setTimeout(() => {
            ee.emit(name, ...args)
        }, 1)
    }

    //procDeal
    async function procDeal(data) {

        //pm, pmm
        let pm = genPm()
        let pmm = genPm()

        //重新處理回傳結果
        pmm
            .then((output) => {

                //add output
                data['output'] = output

                //delete input, 因input可能很大故回傳數據不包含原input
                delete data['input']

                pm.resolve(data)
            })
            .catch((err) => {
                pm.reject(err)
            })

        if (true) {

            //func
            let func = get(data, 'func', '')

            //input
            let input = get(data, 'input', null)

            //execute 執行
            eeEmit('execute', func, input, pmm)

        }

        return pm
    }

    //procUpload
    async function procUpload(input) {
        //console.log('procUpload', data)

        //pm, pmm
        let pm = genPm()
        let pmm = genPm()

        //重新處理回傳結果
        pmm
            .then((output) => {

                //resolve
                pm.resolve(output)

            })
            .catch((err) => {
                pm.reject(err)
            })

        if (true) {

            //upload 上傳檔案
            eeEmit('upload', input, pmm)

        }

        return pm
    }

    //responseU8aStream
    function responseU8aStream(res, u8a) {

        //stream
        let smr = new stream.Readable()
        smr._read = () => {}
        smr.push(u8a)
        smr.push(null)

        return res.response(smr)
            .header('Cache-Control', 'no-cache, no-store, must-revalidate')
            .header('Content-Type', 'application/octet-stream')
            .header('Content-Length', smr.readableLength)
    }

    //apiMain
    let apiMain = {
        path: `/${apiName}`,
        method: 'POST',
        options: {
            payload: {
                maxBytes: 1024 * 1024 * 1024 * 1024, //預設為1mb, 調整至1tb, 也就是給予3次方
                maxParts: 1000 * 1000 * 1000, //預設為1000, 給予3次方
                timeout: false, //避免請求未完成時中斷
                output: 'stream', //前端用blob與application/octet-stream傳
                parse: false,
            },
            timeout: {
                server: false, //關閉伺服器超時
                socket: false, //關閉socket超時
            },
        },
        handler: async function (req, res) {
            // console.log(req, res)
            // console.log('payload', req.payload)

            //headers
            let headers = get(req, 'headers')
            headers = iseobj(headers) ? headers : ''
            // console.log('headers', headers)

            //query
            let query = get(req, 'query')
            query = iseobj(query) ? query : ''
            // console.log('query', query)

            //token
            // let token = get(query, 'token', '')
            let authorization = get(headers, 'authorization', '')
            authorization = isestr(authorization) ? authorization : ''

            //check
            if (true) {

                //verifyConn
                let m = verifyConn({ apiType: 'main', authorization, headers, query })
                if (ispm(m)) {
                    m = await m
                }

                //check
                if (m !== true) {

                    //u8aOut
                    let out = {
                        error: 'permission denied',
                    }
                    let u8aOut = obj2u8arr(out)
                    // console.log('main u8aOut', u8aOut)

                    // console.log('main return permission denied')
                    return responseU8aStream(res, u8aOut)
                }

            }

            //eeEmit
            eeEmit('handler', {
                api: 'apiMain',
                headers,
                query,
            })

            //receive
            let receive = () => {

                //pm
                let pm = genPm()

                //totalSize, chunks
                // let totalSize = 0
                let chunks = []

                //smw
                let smw = new stream.Writable({
                    write(chunk, encoding, cb) {
                        // console.log('receive payload', chunk)

                        // //totalSize
                        // totalSize += chunk.length

                        //push
                        chunks.push(chunk)
                        // console.log('chunk.length', chunk.length, 'totalSize', totalSize)

                        //setTimeout, 延遲觸發cb
                        setTimeout(() => {
                            cb()
                        }, delayForBasic)

                    }
                })

                //pipe
                req.payload.pipe(smw)

                //end
                req.payload.on('end', () => {
                    // console.log(`receive payload done`)

                    //concat
                    let fileBuffer = Buffer.concat(chunks)
                    // console.log('fileBuffer', fileBuffer, fileBuffer.length)

                    //clear, 釋放記憶體
                    chunks = []

                    //resolve
                    pm.resolve(fileBuffer)

                })

                //error
                req.payload.on('error', (err) => {
                    // console.log(`receive payload err`, err)
                    eeEmit('error', `receive payload err`)
                    pm.reject(err.message)
                })

                return pm
            }

            //receive
            let bbInp = await receive()
            // console.log('bbInp', bbInp)

            //u8aInp
            let u8aInp = new Uint8Array(bbInp)
            // console.log('u8aInp', u8aInp)

            //u8arr2obj
            let inp = u8arr2obj(u8aInp)
            // console.log('inp', inp)

            //procDeal
            let out = {}
            await procDeal(inp)
                .then(function(msg) {
                    out.success = msg
                })
                .catch(function(msg) {
                    out.error = msg
                })
            // console.log('out', out)

            //u8aOut
            let u8aOut = obj2u8arr(out)
            // console.log('u8aOut', u8aOut)

            return responseU8aStream(res, u8aOut)
        },
    }

    //apiSlice
    let apiSlice = {
        path: `/${apiSliceName}`,
        method: 'POST',
        options: {
            payload: {
                maxBytes: 1024 * 1024 * 1024 * 1024, //預設為1mb, 調整至1tb, 也就是給予3次方
                maxParts: 1000 * 1000 * 1000, //預設為1000, 給予3次方
                timeout: false, //避免請求未完成時中斷
                output: 'stream', //前端用blob與application/octet-stream傳
                parse: false,
            },
            timeout: {
                server: false, //關閉伺服器超時
                socket: false, //關閉socket超時
            },
        },
        handler: async function (req, res) {
            // console.log(req, res)
            // console.log('payload', req.payload)

            //headers
            let headers = get(req, 'headers')
            headers = iseobj(headers) ? headers : ''
            // console.log('headers', headers)

            //query
            let query = get(req, 'query')
            query = iseobj(query) ? query : ''
            // console.log('query', query)

            //token
            // let token = get(query, 'token', '')
            let authorization = get(headers, 'authorization', '')
            authorization = isestr(authorization) ? authorization : ''

            //check
            if (true) {

                //verifyConn
                let m = verifyConn({ apiType: 'slice', authorization, headers, query })
                if (ispm(m)) {
                    m = await m
                }

                //check
                if (m !== true) {

                    //u8aOut
                    let out = {
                        error: 'permission denied',
                    }
                    let u8aOut = obj2u8arr(out)
                    // console.log('slice u8aOut', u8aOut)

                    // console.log('slice return permission denied')
                    return responseU8aStream(res, u8aOut)
                }

            }

            //eeEmit
            eeEmit('handler', {
                api: 'apiSlice',
                headers,
                query,
            })

            //chunkIndex, chunkTotal, packageId, 從headers接收
            let chunkIndex = get(headers, 'chunk-index', '')
            let chunkTotal = get(headers, 'chunk-total', '')
            let packageId = get(headers, 'package-id', '')

            //check
            if (!isp0int(chunkIndex)) {
                console.log('invalid chunkIndex in headers')
                return res.response({ error: 'invalid chunkIndex in headers' }).code(400)
            }
            chunkIndex = cint(chunkIndex)
            if (!isp0int(chunkTotal)) {
                console.log('invalid chunkTotal in headers')
                return res.response({ error: 'invalid chunkTotal in headers' }).code(400)
            }
            chunkTotal = cint(chunkTotal)
            if (!isestr(packageId)) {
                console.log('invalid packageId in headers')
                return res.response({ error: 'invalid packageId in headers' }).code(400)
            }

            //pathFileChunk
            let pathFileChunk = `${pathUploadTemp}/${packageId}_${chunkIndex}` //path.join(pathUploadTemp, `${packageId}_${chunkIndex}`)
            // console.log('pathFileChunk', pathFileChunk)

            //streamWrite
            let streamWrite = fs.createWriteStream(pathFileChunk)

            //receive
            let receive = () => {

                //pm
                let pm = genPm()

                //pipe
                req.payload.pipe(streamWrite)
                // console.log(`receiving chunk[${chunkIndex + 1}/${chunkTotal}]...`)

                //end
                req.payload.on('end', () => {
                    // console.log(`receive chunk[${chunkIndex + 1}/${chunkTotal}] done`)

                    //setTimeout, 切片上傳添加延遲處理, 避免佔滿伺服器CPU與流量
                    setTimeout(() => {
                        pm.resolve(`chunk[${chunkIndex}/${chunkTotal}] of packageId[${packageId}] done`)
                    }, delayForSlice)

                })

                //error
                req.payload.on('error', () => {
                    // console.log(`receive chunk[${chunkIndex + 1}/${chunkTotal}] err`, err)
                    eeEmit('error', `receive chunk[${chunkIndex + 1}/${chunkTotal}] err`)
                    pm.reject(`chunk[${chunkIndex}/${chunkTotal}] of packageId[${packageId}] err`)
                })

                return pm
            }

            //receive
            let out = {}
            await receive()
                .then(function(msg) {
                    out.success = msg
                })
                .catch(function(msg) {
                    out.error = msg
                })
            // console.log('out', out)

            //u8aOut
            let u8aOut = obj2u8arr(out)
            // console.log('u8aOut', u8aOut)

            return responseU8aStream(res, u8aOut)
        },
    }

    //apiSliceMerge
    let apiSliceMerge = {
        path: `/${apiSliceName}m`,
        method: 'POST',
        options: {
            payload: {
                maxBytes: 1024 * 1024 * 1024 * 1024, //預設為1mb, 調整至1tb, 也就是給予3次方
                maxParts: 1000 * 1000 * 1000, //預設為1000, 給予3次方
                timeout: false, //避免請求未完成時中斷
                // output: 'stream',
                parse: true, //前端送obj過來
            },
            timeout: {
                server: false, //關閉伺服器超時
                socket: false, //關閉socket超時
            },
        },
        handler: async function (req, res) {
            // console.log(req, res)
            // console.log('payload', req.payload)

            //headers
            let headers = get(req, 'headers')
            headers = iseobj(headers) ? headers : ''
            // console.log('headers', headers)

            //query
            let query = get(req, 'query')
            query = iseobj(query) ? query : ''
            // console.log('query', query)

            //token
            // let token = get(query, 'token', '')
            let authorization = get(headers, 'authorization', '')
            authorization = isestr(authorization) ? authorization : ''

            //check
            if (true) {

                //verifyConn
                let m = verifyConn({ apiType: 'merge', authorization, headers, query })
                if (ispm(m)) {
                    m = await m
                }

                //check
                if (m !== true) {

                    //u8aOut
                    let out = {
                        error: 'permission denied',
                    }
                    let u8aOut = obj2u8arr(out)
                    // console.log('mergeu8aOut', u8aOut)

                    // console.log('merge return permission denied')
                    return responseU8aStream(res, u8aOut)
                }

            }

            //eeEmit
            eeEmit('handler', {
                api: 'apiSliceMerge',
                headers,
                query,
            })

            //filename, chunkTotal, packageId, 從payload接收
            let filename = get(req, 'payload.filename', '')
            let chunkTotal = get(req, 'payload.chunk-total', '')
            let packageId = get(req, 'payload.package-id', '')

            //check
            if (!isestr(filename)) {
                console.log('invalid filename in payload')
                return res.response({ error: 'invalid filename in payload' }).code(400)
            }
            if (!isp0int(chunkTotal)) {
                console.log('invalid chunkTotal in payload')
                return res.response({ error: 'invalid chunkTotal in payload' }).code(400)
            }
            chunkTotal = cint(chunkTotal)
            if (!isestr(packageId)) {
                console.log('invalid packageId in payload')
                return res.response({ error: 'invalid packageId in payload' }).code(400)
            }

            //core
            let core = async() => {

                //merge
                // console.log('merge start')
                // let r = await merge()
                let r = await mergeFiles(pathUploadTemp, packageId, chunkTotal, filename)
                // console.log('merge done', r)

                //procUpload
                // console.log('procUpload start')
                let rr = await procUpload(r)
                // console.log('procUpload done', rr)

                return rr
            }

            //core
            let out = {}
            await core()
                .then(function(msg) {
                    out.success = msg
                })
                .catch(function(msg) {
                    out.error = msg
                })
            // console.log('out', out)

            //u8aOut
            let u8aOut = obj2u8arr(out)
            // console.log('u8aOut', u8aOut)

            return responseU8aStream(res, u8aOut)
        },
    }

    //startServer
    async function startServer() {

        //register inert
        if (useInert) {
            await server.register(Inert)
        }

        //apiRoutes
        let apiRoutes = []
        if (useInert) {
            let api = {
                method: 'GET',
                path: '/{file*}',
                handler: {
                    directory: {
                        path: `${pathStaticFiles}/`
                    }
                },
            }
            apiRoutes = [
                ...apiRoutes,
                api,
            ]
        }
        if (true) {
            apiRoutes = [
                ...apiRoutes,
                apiMain,
                apiSlice,
                apiSliceMerge,
            ]
        }

        //route
        server.route(apiRoutes)

        //start
        await server.start()

        console.log(`Server running at: ${server.info.uri}`)

    }

    //start
    if (get(opt, 'serverHapi')) {
        // opt.serverHapi.route([apiMain, apiSlice, apiSliceMerge])
        server.route([apiMain, apiSlice, apiSliceMerge])
    }
    else {
        startServer()
    }

    //stop
    let stop = () => {
        server.stop()
    }

    //save
    ee.stop = stop

    return ee
}


export default WConverhpServer
