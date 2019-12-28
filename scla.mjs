import WConverhpClient from './src/WConverhpClient.mjs'
//import WConverhpClient from './dist/w-converhp-client.umd.js'

let opt = {
    url: 'http://localhost:8080',
    apiName: 'api',
    token: '*',
}

//new
let wo = new WConverhpClient(opt)

wo.on('open', function() {
    console.log('client nodejs[port:8080]: open')
})
wo.on('openOnce', function() {
    console.log('client nodejs[port:8080]: openOnce')

    //execute
    wo.execute('add', { p1: 1, p2: 2 },
        function (prog) {
            console.log('client nodejs[port:8080]: execute prog=', prog)
        })
        .then(function(r) {
            console.log('client nodejs[port:8080]: execute add=', r)
        })
        .catch(function(err) {
            console.log('client nodejs[port:8080]: execute error=', err)
        })

    // //broadcast
    // wo.broadcast('client nodejs[port:8080] broadcast hi', function (prog) {
    //     console.log('client nodejs[port:8080]: broadcast prog=', prog)
    // })

    //deliver
    wo.deliver('client deliver hi', function (prog) {
        console.log('client nodejs[port:8080]: deliver prog=', prog)
    })
        .then(function(msg) {
            console.log('client nodejs[port:8080]: deliver msg=', msg)
        })
        .catch(function(err) {
            console.log('client nodejs[port:8080]: deliver error=', err)
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
// wo.on('deliver', function(data) { //伺服器目前無法針對client直接deliver
//     console.log('client nodejs[port:8080]: deliver=', data)
// })
