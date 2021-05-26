//import fs from 'fs'
import WConverhpClient from './src/WConverhpClient.mjs'
// import WConverhpClient from './dist/w-converhp-client.umd.js' //編譯後axios與form-data都不適合執行於nodejs, 故需引用程式碼執行


let opt = {
    url: 'http://localhost:8080',
    apiName: 'api',
}

//new
let wo = new WConverhpClient(opt)

wo.on('open', function() {
    console.log('client nodejs[port:8080]: open')
})
wo.on('openOnce', function() {
    console.log('client nodejs[port:8080]: openOnce')

    //p
    let name = 'zdata.b1'
    let p = {
        a: 12,
        b: 34.56,
        c: 'test中文',
        d: {
            name: name,
            u8a: new Uint8Array([66, 97, 115]),
            //u8a: new Uint8Array(fs.readFileSync('/path/filename.txt')),
        }
    }

    //execute
    console.log('wo.execute')
    wo.execute('add', { p },
        function (prog, p, m) {
            console.log('client nodejs[port:8080]: execute: prog', prog, p, m)
        })
        .then(function(r) {
            console.log('client nodejs[port:8080]: execute: add', r)
        })
        .catch(function(err) {
            console.log('client nodejs[port:8080]: execute: catch', err)
        })

    //broadcast
    wo.broadcast('client nodejs[port:8080] broadcast hi', function (prog) {
        console.log('client nodejs[port:8080]: broadcast: prog', prog)
    })
        .catch(function(err) {
            console.log('client nodejs[port:8080]: broadcast: catch', err)
        })

    //deliver
    wo.deliver('client nodejs[port:8080] deliver hi', function (prog) {
        console.log('client nodejs[port:8080]: deliver: prog', prog)
    })
        .catch(function(err) {
            console.log('client nodejs[port:8080]: deliver: catch', err)
        })

})
wo.on('close', function() {
    console.log('client nodejs[port:8080]: close')
})
wo.on('error', function(err) {
    console.log('client nodejs[port:8080]: error', err)
})
wo.on('reconn', function() {
    console.log('client nodejs[port:8080]: reconn')
})
wo.on('broadcast', function(data) {
    console.log('client nodejs[port:8080]: broadcast', data)
})
wo.on('deliver', function(data) {
    console.log('client nodejs[port:8080]: deliver', data)
})

//node --experimental-modules --es-module-specifier-resolution=node scla.mjs
