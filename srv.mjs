// import fs from 'fs'
import _ from 'lodash'
import WConverhpServer from './src/WConverhpServer.mjs'

let opt = {
    port: 8080,
    apiName: 'api',
}

//new
let wo = new WConverhpServer(opt)

wo.on('open', function() {
    console.log(`Server[port:${opt.port}]: open`)

    //broadcast
    let n = 0
    setInterval(() => {
        n += 1
        let o = {
            text: `server broadcast hi(${n})`,
            data: new Uint8Array([66, 97, 115]), //support Uint8Array data
        }
        wo.broadcast(o, function (prog) {
            console.log('broadcast prog', prog)
        })
    }, 1000)

})
wo.on('error', function(err) {
    console.log(`Server[port:${opt.port}]: error`, err)
})
wo.on('clientChange', function(num) {
    console.log(`Server[port:${opt.port}]: now clients: ${num}`)
})
wo.on('clientEnter', function(clientId, data) {
    console.log(`Server[port:${opt.port}]: client enter: ${clientId}`)

    //deliver
    wo.deliver(clientId, `server deliver hi(${clientId})`)

})
wo.on('clientLeave', function(clientId, data) {
    console.log(`Server[port:${opt.port}]: client leave: ${clientId}`)
})
wo.on('execute', function(func, input, pm) {
    //console.log(`Server[port:${opt.port}]: execute`, func, input)
    console.log(`Server[port:${opt.port}]: execute`, func)

    try {

        if (func === 'add') {

            //save
            if (_.get(input, 'p.d.u8a', null)) {
                // fs.writeFileSync(input.p.d.name, Buffer.from(input.p.d.u8a))
                // console.log('writeFileSync input.p.d.name', input.p.d.name)
            }

            let r = {
                ab: input.p.a + input.p.b,
                v: [11, 22.22, 'abc', { x: '21', y: 65.43, z: 'test中文' }],
                file: {
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
wo.on('broadcast', function(data) {
    console.log(`Server[port:${opt.port}]: broadcast`, data)
})
wo.on('deliver', function(data) {
    console.log(`Server[port:${opt.port}]: deliver`, data)
})
