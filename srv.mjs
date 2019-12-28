import WConverhpServer from './src/WConverhpServer.mjs'
//import WConverhpServer from './dist/w-converhp-server.umd.js'

let opt = {
    port: 8080,
    apiName: 'api',
}

//new
let wo = new WConverhpServer(opt)

wo.on('open', function() {
    console.log(`Server[port:${opt.port}]: open`)
})
wo.on('error', function(err) {
    console.log(`Server[port:${opt.port}]: error`, err)
})
wo.on('clientChange', function(clients) {
    console.log(`Server[port:${opt.port}]: now clients: ${clients.length}`)
})
wo.on('execute', function(func, input, callback) {
    console.log(`Server[port:${opt.port}]: execute`, func, input)

    if (func === 'add') {
        let r = input.p1 + input.p2
        callback(r)
    }

})
wo.on('broadcast', function(data) {
    console.log(`Server[port:${opt.port}]: broadcast`, data)
})
wo.on('deliver', function(data) {
    console.log(`Server[port:${opt.port}]: deliver`, data)
})
