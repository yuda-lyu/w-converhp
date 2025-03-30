import fs from 'fs'
import _ from 'lodash-es'
import WConverhpServer from './src/WConverhpServer.mjs'

let opt = {
    port: 8080,
    apiName: 'api',
    pathStaticFiles: '.', //要存取專案資料夾下web.html, 故不能給dist
    funCheck: ({ apiType, token, headers, query }) => {
        console.log('funCheck', apiType, token)
        return true
    },
}

//new
let wo = new WConverhpServer(opt)

wo.on('execute', function(func, input, pm) {
    // console.log(`Server[port:${opt.port}]: execute`, func, input)
    console.log(`Server[port:${opt.port}]: execute`, func)

    try {

        if (func === 'add') {

            if (_.get(input, 'p.d.u8a', null)) {
                console.log('input.p.d.u8a', input.p.d.u8a)
            }

            let r = {
                _add: input.p.a + input.p.b,
                _data: [11, 22.22, 'abc', { x: '21', y: 65.43, z: 'test中文' }],
                _bin: {
                    name: 'zdata.b2',
                    u8a: new Uint8Array([66, 97, 115]),
                    // name: '100mb.7z',
                    // u8a: new Uint8Array(fs.readFileSync('D:\\開源-JS-006-2-w-converhp\\_temp\\100mb.7z')),
                    // name: '500mb.7z',
                    // u8a: new Uint8Array(fs.readFileSync('D:\\開源-JS-006-2-w-converhp\\_temp\\500mb.7z')),
                    // name: '1000mb.7z',
                    // u8a: new Uint8Array(fs.readFileSync('D:\\開源-JS-006-2-w-converhp\\_temp\\1000mb.7z')),
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
wo.on('upload', function(input, pm) {
    console.log(`Server[port:${opt.port}]: upload`, input)

    try {
        let output = input
        pm.resolve(output)
    }
    catch (err) {
        console.log('execute error', err)
        pm.reject('execute error')
    }

})
wo.on('error', function(err) {
    console.log(`Server[port:${opt.port}]: error`, err)
})
wo.on('handler', function(data) {
    // console.log(`Server[port:${opt.port}]: handler`, data)
})

//node --experimental-modules srv.mjs
