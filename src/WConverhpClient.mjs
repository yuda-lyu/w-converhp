import axios from 'axios'
import get from 'lodash-es/get.js'
import isWindow from 'wsemi/src/isWindow.mjs'
import genPm from 'wsemi/src/genPm.mjs'
import genID from 'wsemi/src/genID.mjs'
import haskey from 'wsemi/src/haskey.mjs'
import isfun from 'wsemi/src/isfun.mjs'
import ispint from 'wsemi/src/ispint.mjs'
import isp0int from 'wsemi/src/isp0int.mjs'
import isestr from 'wsemi/src/isestr.mjs'
import isobj from 'wsemi/src/isobj.mjs'
import iseobj from 'wsemi/src/iseobj.mjs'
import ispm from 'wsemi/src/ispm.mjs'
import cint from 'wsemi/src/cint.mjs'
import strright from 'wsemi/src/strright.mjs'
import evem from 'wsemi/src/evem.mjs'
import blob2u8arr from 'wsemi/src/blob2u8arr.mjs'
import obj2u8arr from 'wsemi/src/obj2u8arr.mjs'
import u8arr2obj from 'wsemi/src/u8arr2obj.mjs'
import pmConvertResolve from 'wsemi/src/pmConvertResolve.mjs'
import now2strp from 'wsemi/src/now2strp.mjs'


/**
 * 建立Hapi使用者(Node.js與Browser)端物件
 *
 * @class
 * @param {Object} opt 輸入設定參數物件
 * @param {String} [opt.url='http://localhost:8080'] 輸入Hapi伺服器網址，預設為'http://localhost:8080'
 * @param {String} [opt.apiName='api'] 輸入API名稱字串，預設'api'
 * @param {Function} [opt.getToken=()=>''] 輸入取得使用者token的回調函數，預設()=>''
 * @param {String} [opt.tokenType='Bearer'] 輸入token類型字串，預設'Bearer'
 * @param {Integer} [opt.sizeSlice=1024*1024] 輸入切片上傳檔案之切片檔案大小整數，單位為Byte，預設為1024*1024
 * @param {Integer} [opt.retry=3] 輸入傳輸失敗重試次數整數，預設為3
 * @returns {Object} 回傳事件物件，可使用函數execute、upload
 * @example
 *
 * import WConverhpClient from 'w-converhp/dist/w-converhp-client.umd.js'
 *
 * let opt = {
 *     FormData,
 *     url: 'http://localhost:8080',
 *     apiName: 'api',
 * }
 *
 * //new
 * let wo = new WConverhpClient(opt)
 *
 * async function execute(name, u8a) {
 *
 *     //p
 *     let p = {
 *         a: 12,
 *         b: 34.56,
 *         c: 'test中文',
 *         d: {
 *             name,
 *             u8a,
 *         },
 *     }
 *     console.log('p', p)
 *
 *     //execute
 *     await wo.execute('add', { p },
 *         function (prog, p, m) {
 *             console.log('client web: execute: prog', prog, p, m)
 *         })
 *         .then(function(r) {
 *             console.log('client web: execute: add', r)
 *             console.log('r._bin.name', r._bin.name, 'r._bin.u8a', r._bin.u8a)
 *             // w.downloadFileFromU8Arr(r._bin.name, r._bin.u8a)
 *         })
 *         .catch(function (err) {
 *             console.log('client web: execute: catch', err)
 *         })
 *
 * }
 *
 * function executeWithU8a() {
 *     let core = async() => {
 *
 *         //u8a
 *         let u8a = new Uint8Array([66, 97, 115])
 *         console.log('executeWithU8a u8a', u8a)
 *
 *         //execute
 *         await execute('zdata.b1', u8a)
 *
 *     }
 *     core()
 * }
 * executeWithU8a()
 *
 * function executeWithFile() {
 *     let core = async() => {
 *
 *         //u8a
 *         let u8a = new Uint8Array(fs.readFileSync('../_data/10mb.7z'))
 *         console.log('executeWithFile u8a', u8a)
 *
 *         //execute
 *         await execute('10mb.7z', u8a)
 *
 *     }
 *     core()
 * }
 * executeWithFile()
 *
 * function uploadLargeFile() {
 *     let core = async() => {
 *
 *         //u8a
 *         let u8a = new Uint8Array(fs.readFileSync('../_data/1000mb.7z'))
 *         console.log('u8a.length', u8a.length)
 *         console.log('uploadLargeFile u8a', u8a)
 *
 *         await wo.upload('1000mb.7z', u8a,
 *             function (prog, p, m) {
 *                 console.log('client web: upload: prog', prog, p, m)
 *             })
 *             .then(function(res) {
 *                 console.log('client web: upload: then', res)
 *             })
 *             .catch(function (err) {
 *                 console.log('client web: upload: catch', err)
 *             })
 *
 *     }
 *     core()
 * }
 * uploadLargeFile()
 *
 */
function WConverhpClient(opt) {

    //_url
    let _url = get(opt, 'url')
    if (!isestr(_url)) {
        _url = 'http://localhost:8080'
    }

    //apiName
    let apiName = get(opt, 'apiName')
    if (!isestr(apiName)) {
        apiName = 'api'
    }

    //url
    let url = ''
    if (strright(_url, 1) === '/') {
        url = _url + apiName
    }
    else {
        url = _url + '/' + apiName
    }

    //getToken
    let getToken = get(opt, 'getToken', null)
    if (!isfun(getToken)) {
        getToken = () => {
            return ''
        }
    }

    //tokenType
    let tokenType = get(opt, 'tokenType')
    if (!isestr(tokenType)) {
        tokenType = 'Bearer'
    }

    //sizeSlice
    let sizeSlice = get(opt, 'sizeSlice')
    if (!ispint(sizeSlice)) {
        sizeSlice = 1024 * 1024 //1m
    }

    //retry
    let retry = get(opt, 'retry')
    if (!isp0int(retry)) {
        retry = 3
    }

    //env
    let env = isWindow() ? 'browser' : 'nodejs'
    // console.log('env', env)

    //ee
    let ee = evem() //new events.EventEmitter()

    //eeEmit
    let eeEmit = (name, ...args) => {
        setTimeout(() => {
            ee.emit(name, ...args)
        }, 1)
    }

    //res2u8arr
    async function res2u8arr(bb) {
        //blob(in browser) or buffer(in nodejs) to u8a
        let u8a
        if (env === 'browser') {
            u8a = await blob2u8arr(bb)
        }
        else {
            u8a = new Uint8Array(bb)
        }
        return u8a
    }

    //u8arr2bb
    function u8arr2bb(u8a) {
        //u8a to blob(in browser) or buffer(in nodejs)
        let bb
        if (env === 'browser') {
            bb = new Blob([u8a.buffer])
        }
        else { //nodejs
            bb = Buffer.from(u8a)
        }
        return bb
    }

    //send
    async function send(type, pkg, opt = {}) {

        //headers
        let headers = get(opt, 'headers')
        if (!isobj(headers)) {
            headers = {}
        }
        // console.log('headers', headers)

        //dataType
        let dataType = get(opt, 'dataType', '')
        if (dataType !== 'blob' && dataType !== 'fmd' && dataType !== 'json') {
            dataType = 'blob'
        }
        // console.log('dataType', dataType)

        //cbProgress
        let cbProgress = get(opt, 'cbProgress')
        if (!isfun(cbProgress)) {
            cbProgress = () => {}
        }

        //urlUse
        let urlUse = ''
        if (type === 'basic') {
            urlUse = url
        }
        else if (type === 'slice') {
            urlUse = `${url}slc`
        }
        else if (type === 'slicemerge') {
            urlUse = `${url}slcm`
        }
        else {
            throw new Error(`invalid type[${type}]`)
        }

        //pm
        let pm = genPm()

        //dd, ct
        let dd = null
        let ct = {}
        if (dataType === 'blob') {

            //set ct
            ct = {
                'Content-Type': 'application/octet-stream',
            }

            //set dd
            dd = pkg

        }
        else if (dataType === 'fmd') {

            //fmd
            let fmd
            if (env === 'browser') {
                fmd = new FormData()
            }
            else {
                if (isfun(opt.FormData)) {
                    fmd = new opt.FormData({ maxDataSize: 1024 * 1024 * 1024 * 1024 }) //nodejs, 使用套件form-data設定資料量最大為1tb
                }
                else {
                    // console.log(`invalid opt.FormData, need [npm i form-data] and [import FormData from 'form-data'] to set opt.FormData = FormData`)
                    eeEmit('error', `invalid opt.FormData, need [npm i form-data] and [import FormData from 'form-data'] to set opt.FormData = FormData`)
                    throw new Error('invalid opt.FormData')
                }
            }

            //append
            fmd.append('bb', pkg)
            // console.log('fmd', fmd)

            //set ct
            if (env === 'nodejs') {
                ct = {
                    'Content-Type': `multipart/form-data; boundary=${fmd.getBoundary()}` //nodejs, 使用套件form-data需設定boundary
                }
                // console.log('ct', ct)
            }
            else {
                //browser會自動根據fmd的邊界boundary來設定
            }

            //set dd
            dd = fmd

        }
        else if (dataType === 'json') {
            //axios預設會將物件自動轉換為JSON, 此處指定Content-Type且強制轉, 避免可能問題

            //set ct
            ct = {
                'Content-Type': 'application/json',
            }

            dd = JSON.stringify(pkg)
        }
        // console.log('dd', dd)

        //rt
        let rt = 'blob'
        if (env === 'nodejs') {
            rt = 'arraybuffer' //nodejs下沒有blob, 只能設定'json', 'arraybuffer', 'document', 'json', 'text', 'stream'
        }
        // console.log('rt', rt)

        //token
        let token = getToken()
        if (ispm(token)) {
            token = await token
        }

        //s
        let s = {
            method: 'POST',
            url: urlUse,
            data: dd,
            headers: {
                Authorization: `${tokenType} ${token}`,
                ...ct,
                ...headers,
            },
            timeout: 60 * 60 * 1000, //1hr
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
                cbProgress(Math.floor(r), loaded, 'upload')

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
                cbProgress(Math.floor(r), loaded, 'download')

            },
        }
        // console.log('s', s)

        //axios
        axios(s)
            .then(async (res) => {
                // console.log('axios then', res)

                //bb
                let bb = get(res, 'data')
                // console.log('bb', bb)

                //res2u8arr
                let u8a = await res2u8arr(bb)
                // console.log('u8a', u8a)

                //u8arr2obj
                let data = u8arr2obj(u8a)
                // console.log('data', data)

                //check
                if (!iseobj(data)) {
                    // console.log('data is not an effective object', data)
                    eeEmit('error', `data is not an effective object`)
                    pm.reject(`data is not an effective object`)
                    return
                }

                //分離伺服器資料的success或error
                if (haskey(data, 'success')) {
                    pm.resolve(data.success)
                }
                else if (haskey(data, 'error')) {
                    eeEmit('error', data.error)
                    pm.reject(data.error)
                }
                else {
                    // console.log('invalid data', data)
                    eeEmit('error', `invalid data`)
                    pm.reject(`invalid data`)
                }

            })
            .catch(async (res) => {
                //console.log('axios catch', res.toJSON())
                //Network Error除可能是網路斷線之外, 可能被瀏覽器外掛封鎖阻擋, 亦可能因硬碟空間不足(<4g)無法下載被瀏覽器拒絕

                //data
                let data = null

                //statusText, err
                let statusText = get(res, 'response.statusText') || get(res, 'message')
                let err = get(res, 'response.data') || get(res, 'stack')
                // console.log(`get(res, 'response.statusText')`, get(res, 'response.statusText'))
                // console.log(`get(res, 'message')`, get(res, 'message'))
                // console.log(`get(res, 'response.data')`, get(res, 'response.data'))
                // console.log(`get(res, 'stack')`, get(res, 'stack'))

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
                    // console.log('err', res)
                    eeEmit('error', res)
                    data = 'Can not connect to server.'
                }
                if (data === 'Network Error') {
                    data = `Network Error. Make sure your space of hard drive is large enough or blocking by browser plugins.`
                }

                pm.reject(data)
            })

        return pm
    }

    //sendPkg
    async function sendPkg(type, data, cbProgress) {

        //bb
        let bb = null
        try {

            //obj2u8arr
            let u8a = obj2u8arr(data)
            // console.log('u8a', u8a)

            //u8a to blob(in browser) or buffer(in nodejs)
            bb = u8arr2bb(u8a)
            // console.log('bb', bb)

        }
        catch (err) {
            return Promise.reject(err)
        }

        //send
        // console.log('send bb...')
        let res = await send(type, bb, { dataType: 'blob', cbProgress })
        // console.log('send done', res)

        return res
    }

    //sendData
    async function sendData(type, data, cbProgress) {

        //fun
        let fun = pmConvertResolve(sendPkg)

        //sendPkg
        let r = await fun(type, data, cbProgress)

        let n = 0
        while (r.state === 'error') {
            n += 1
            if (n > retry) {
                break
            }
            console.log(`retry n=${n}`)
            r = await fun(type, data, cbProgress)
        }

        if (r.state === 'success') {
            return r.msg
        }
        else {
            return Promise.reject(r.msg)
        }
    }

    //sendDataSlice
    async function sendDataSlice(tempId, bb, cbProgress) {

        //n
        let n = 0
        if (n === 0) {
            try {
                n = bb.size //for Blob
                n = cint(n)
            }
            catch (err) {}
        }
        if (n === 0) {
            try {
                n = bb.length //for Uint8Array
                n = cint(n)
            }
            catch (err) {}
        }
        if (n === 0) {
            eeEmit('error', `Can not get size of bb`)
            return Promise.reject(`Can not get size of bb`)
        }
        // console.log('n', n)

        //chunkTotal
        let chunkTotal = Math.ceil(n / sizeSlice)
        // console.log('chunkTotal', chunkTotal)

        //packageId
        let packageId = `${now2strp()}-${genID()}`
        // console.log('packageId', packageId)

        //progCount, progWeightSlice
        let progCount = 0
        let progWeightSlice = 0.99 //上傳階段進度使用99%
        // let progWeightMerge = 0.01 //合併階段進度使用1%

        //cbProgressSlice
        let cbProgressSlice = (perc, _psiz, dir) => {
            if (dir === 'upload' && perc === 100) {
                progCount++
                let r = progCount / chunkTotal
                let prog = r * progWeightSlice * 100
                let psiz = r * n
                cbProgress(prog, psiz, 'upload')
            }
        }

        //cbProgressMerge
        let cbProgressMerge = (perc, _psiz, dir) => {
            if (dir === 'download' && perc === 100) {
                cbProgress(100, n, 'upload')
            }
        }

        //upload slice
        for (let i = 0; i < chunkTotal; i++) {

            //start
            let start = i * sizeSlice

            //end
            let end = Math.min(start + sizeSlice, n)

            //chunk
            let chunk = bb.slice(start, end)

            //hd
            let hd = {
                'chunk-index': i,
                'chunk-total': chunkTotal,
                'package-id': packageId,
            }

            //send slice
            // console.log(`uploading chunk[${i + 1}/${chunkTotal}] of packageId[${packageId}]...`)
            await send('slice', chunk, { headers: hd, dataType: 'blob', cbProgress: cbProgressSlice })
            // console.log(`upload chunk[${i + 1}/${chunkTotal}] of packageId[${packageId}] done`, res)

        }

        //send merge
        console.log(`merging tempId[${tempId}]...`)
        let msg = {
            'filename': tempId,
            'chunk-total': chunkTotal,
            'package-id': packageId,
        }
        let resMg = await send('slicemerge', msg, { dataType: 'json', cbProgress: cbProgressMerge })
        // console.log(`merge tempId[${tempId}] done`, resMg)

        return resMg
    }

    //execute
    async function execute(func, input, cbProgress) {

        //msg
        let msg = {
            // _mode: mode,
            // clientId,
            func,
            input,
        }

        //sendData
        let state = ''
        let res = null
        await sendData('basic', msg, cbProgress)
            .then((msg) => {
                // console.log('msg', msg)

                //check, 若為字串為錯誤訊息
                if (isestr(msg)) {
                    state = 'error'
                    res = msg
                    return
                }

                //check, 若為非物件為非預期錯誤
                if (!iseobj(msg)) {
                    console.log('msg is not an effective object', msg)
                    state = 'error'
                    res = 'msg is not an effective object'
                    return
                }

                //check, 若不存在output為非預期錯誤, msg格式為{func,input,output}但input會刪除
                if (!haskey(msg, 'output')) {
                    console.log('invalid msg.output', msg)
                    state = 'error'
                    res = 'invalid msg.output'
                    return
                }

                state = 'success'
                res = msg.output
            })
            .catch((msg) => {
                state = 'error'
                res = msg
            })

        //check
        if (state === '') {
            // console.log('invalid state', r)
            eeEmit('error', `invalid state`)
            return Promise.reject('invalid state')
        }

        //check
        if (state === 'error') {
            // console.log('send data error', r)
            // eeEmit('error', res) //一般錯誤會嘗試n次, 每次也都會emit, 故此處不再基於已知state='error'時再emit
            return Promise.reject(res)
        }

        return res
    }

    //upload
    async function upload(tempId, input, cbProgress) {

        //bb
        let bb = input

        return sendDataSlice(tempId, bb, cbProgress)
    }

    //save
    ee.execute = execute
    ee.upload = upload

    return ee
}


export default WConverhpClient
