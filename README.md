# w-converhp
An operator for hapi in nodejs and browser.

![language](https://img.shields.io/badge/language-JavaScript-orange.svg) 
[![npm version](http://img.shields.io/npm/v/w-converhp.svg?style=flat)](https://npmjs.org/package/w-converhp) 
[![license](https://img.shields.io/npm/l/w-converhp.svg?style=flat)](https://npmjs.org/package/w-converhp) 
[![gzip file size](http://img.badgesize.io/yuda-lyu/w-converhp/master/dist/w-converhp-server.umd.js.svg?compression=gzip)](https://github.com/yuda-lyu/w-converhp)
[![npm download](https://img.shields.io/npm/dt/w-converhp.svg)](https://npmjs.org/package/w-converhp) 
[![jsdelivr download](https://img.shields.io/jsdelivr/npm/hm/w-converhp.svg)](https://www.jsdelivr.com/package/npm/w-converhp)

## Documentation
To view documentation or get support, visit [docs](https://yuda-lyu.github.io/w-converhp/WConverhpServer.html).

## Parts
`w-converhp` includes 2 parts: 
* `w-converhp-server`: for nodejs server
* `w-converhp-client`: for nodejs and browser client

## Installation
### Using npm(ES6 module):
> **Note:** `w-converhp-server` is mainly dependent on `@hapi/hapi` and `@hapi/inert`.

> **Note:** `w-converhp-client` is mainly dependent on `form-data`.

```alias
npm i w-converhp
```
#### Example for w-converhp-server:
> **Link:** [[dev source code](https://github.com/yuda-lyu/w-converhp/blob/master/srv.mjs)]
```alias
import WConverhpServer from 'w-converhp/dist/w-converhp-server.umd.js'

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
                    //u8a: new Uint8Array(fs.readFileSync('C:\\Users\\Administrator\\Desktop\\z500mb.7z')),
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

// Server running at: http://localhost:8080
// Server[port:8080]: open
// Server[port:8080]: execute add
// Server[port:8080]: broadcast client nodejs[port:8080] broadcast hi
// Server[port:8080]: deliver client nodejs[port:8080] deliver hi
// Server[port:8080]: client enter: [random key]
// Server[port:8080]: now clients: 1
// broadcast prog 100
// Server[port:8080]: execute add
// Server[port:8080]: broadcast client web broadcast hi
// Server[port:8080]: deliver client web deliver hi
// Server[port:8080]: client enter: [random key]
// Server[port:8080]: now clients: 2
// broadcast prog 100
```
#### Example for w-converhp-client:
> **Link:** [[dev source code](https://github.com/yuda-lyu/w-converhp/blob/master/scla.mjs)]
```alias
import WConverhpClient from 'w-converhp/dist/w-converhp-client.umd.js'

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
            //u8a: new Uint8Array(fs.readFileSync('C:\\Users\\Administrator\\Desktop\\'+name)),
        }
    }

    //execute
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

// client nodejs[port:8080]: open
// client nodejs[port:8080]: openOnce
// client nodejs[port:8080]: execute: add {
//   ab: 46.56,
//   v: [ 11, 22.22, 'abc', { x: '21', y: 65.43, z: 'test中文' } ],
//   file: { name: 'zdata.b2', u8a: Uint8Array [ 66, 97, 115 ] }
// }
// client nodejs[port:8080]: deliver { mode: 'deliver', data: 'server deliver hi([random key])' }
// client nodejs[port:8080]: broadcast { text: 'server broadcast hi(1)', data: Uint8Array [ 66, 97, 115 ] }
// client nodejs[port:8080]: broadcast { text: 'server broadcast hi(2)', data: Uint8Array [ 66, 97, 115 ] }
```

### In a browser(UMD module):
> **Note:** `w-converhp-client` does't depend on any package.

[Necessary] Add script for w-converhp-client.
```alias
<script src="https://cdn.jsdelivr.net/npm/w-converhp@1.0.34/dist/w-converhp-client.umd.js"></script>
```
#### Example for w-converhp-client:
> **Link:** [[dev source code](https://github.com/yuda-lyu/w-converhp/blob/master/web.html)]
```alias

let opt = {
    url: 'http://localhost:8080',
}

//new
let WConverhpClient=window['w-converhp-client']
let wo = new WConverhpClient(opt)

wo.on('open', function() {
    console.log('client web: open')
})
wo.on('openOnce', function() {
    console.log('client web: openOnce')

    //p
    let name = 'zdata.b1'
    let p = {
        a: 12,
        b: 34.56,
        c: 'test中文',
        d: {
            name: name,
            u8a: new Uint8Array([66, 97, 115]),
            //u8a: new Uint8Array(fs.readFileSync('C:\\Users\\Administrator\\Desktop\\'+name)),
        }
    }

    //execute
    wo.execute('add', { p:p },
        function (prog, p, m) {
            console.log('client web: execute: prog', prog, p, m)
        })
        .then(function(r) {
            console.log('client web: execute: add', r)
        })
        .catch(function (err) {
            console.log('client web: execute: catch', err)
        })

    //broadcast
    wo.broadcast('client web broadcast hi', function (prog) {
        console.log('client web: broadcast: prog', prog)
    })
        .catch(function (err) {
            console.log('client web: broadcast: catch', err)
        })

    //deliver
    wo.deliver('client web deliver hi', function (prog) {
        console.log('client web: deliver: prog', prog)
    })
        .catch(function (err) {
            console.log('client web: deliver: catch', err)
        })

})
wo.on('close', function() {
    console.log('client web: close')
})
wo.on('error', function(err) {
    console.log('client web: error', err)
})
wo.on('reconn', function() {
    console.log('client web: reconn')
})
wo.on('broadcast', function(data) {
    console.log('client web: broadcast', data)
})
wo.on('deliver', function(data) { 
    console.log('client web: deliver', data)
})
wo.on('handler', function(data) {
    // console.log(`Server[port:${opt.port}]: handler`, data)
})

// client web: open
// client web: openOnce
// client web: execute: add {
//   ab: 46.56,
//   v: [ 11, 22.22, 'abc', { x: '21', y: 65.43, z: 'test中文' } ],
//   file: { name: 'zdata.b2', u8a: Uint8Array [ 66, 97, 115 ] }
// }
// client web: deliver { mode: 'deliver', data: 'server deliver hi([random key])' }
// client web: broadcast { text: 'server broadcast hi(1)', data: Uint8Array [ 66, 97, 115 ] }
// client web: broadcast { text: 'server broadcast hi(2)', data: Uint8Array [ 66, 97, 115 ] }
```