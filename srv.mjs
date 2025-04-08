import fs from 'fs'
import _ from 'lodash-es'
import w from 'wsemi'
import WConverhpServer from './src/WConverhpServer.mjs'

let ms = []

let opt = {
    port: 8080,
    apiName: 'api',
    pathStaticFiles: '.', //要存取專案資料夾下web.html, 故不能給dist
    verifyConn: async ({ apiType, authorization, headers, query }) => {
        console.log('verifyConn', `apiType[${apiType}]`, `authorization[${authorization}]`)
        let token = w.strdelleft(authorization, 7) //刪除Bearer
        if (!w.isestr(token)) {
            return false
        }
        // await w.delay(3000)
        return true
    },
}

//new
let wo = new WConverhpServer(opt)

wo.on('execute', (func, input, pm) => {
    // console.log(`Server[port:${opt.port}]: execute`, func, input)
    console.log(`Server[port:${opt.port}]: execute`, func)

    try {

        if (func === 'add') {

            if (_.get(input, 'p.d.u8a', null)) {
                console.log('input.p.d.u8a', input.p.d.u8a)
                ms.push({ 'input.p.d.u8a': input.p.d.u8a })
            }

            let r = {
                _add: input.p.a + input.p.b,
                _data: [11, 22.22, 'abc', { x: '21', y: 65.43, z: 'test中文' }],
                _bin: {
                    name: 'zdata.b2',
                    u8a: new Uint8Array([52, 66, 97, 115]),
                },
            }

            pm.resolve(r)

        }
        else {
            console.log('invalid func')
            pm.reject('invalid func')
        }

    }
    catch (err) {
        console.log('execute error', err)
        pm.reject('execute error')
    }

})
wo.on('upload', (input, pm) => {
    console.log(`Server[port:${opt.port}]: upload`, input)

    try {
        ms.push({ 'receive and return': input })
        let output = input
        pm.resolve(output)
    }
    catch (err) {
        console.log('upload error', err)
        pm.reject('upload error')
    }

})
wo.on('download', (input, pm) => {
    console.log(`Server[port:${opt.port}]: download`, input)

    try {
        ms.push({ 'download': input })

        //fp
        let fp = `./test/1mb.7z`

        //streamRead
        let streamRead = fs.createReadStream(fp)

        //fileName
        let fileName = `1mb.7z`

        //fileSize
        let stats = fs.statSync(fp)
        let fileSize = stats.size

        //fileType
        let fileType = 'application/x-7z-compressed'

        //output
        let output = {
            streamRead,
            fileName,
            fileSize,
            fileType,
        }

        pm.resolve(output)
    }
    catch (err) {
        console.log('download error', err)
        pm.reject('download error')
    }

})
wo.on('error', (err) => {
    console.log(`Server[port:${opt.port}]: error`, err)
})
wo.on('handler', (data) => {
    // console.log(`Server[port:${opt.port}]: handler`, data)
})

setTimeout(() => {
    console.log('ms', ms)
    // console.log('ms', JSON.stringify(ms))
    wo.stop()
}, 3000)


//node --experimental-modules srv.mjs
