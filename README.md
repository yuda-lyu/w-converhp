# w-converhp
An operator for hapi in nodejs and browser.

![language](https://img.shields.io/badge/language-JavaScript-orange.svg) 
[![npm version](http://img.shields.io/npm/v/w-converhp.svg?style=flat)](https://npmjs.org/package/w-converhp) 
[![license](https://img.shields.io/npm/l/w-converhp.svg?style=flat)](https://npmjs.org/package/w-converhp) 
[![npm download](https://img.shields.io/npm/dt/w-converhp.svg)](https://npmjs.org/package/w-converhp) 
[![npm download](https://img.shields.io/npm/dm/w-converhp.svg)](https://npmjs.org/package/w-converhp)
[![jsdelivr download](https://img.shields.io/jsdelivr/npm/hm/w-converhp.svg)](https://www.jsdelivr.com/package/npm/w-converhp)

## Documentation
To view documentation or get support, visit [docs](https://yuda-lyu.github.io/w-converhp/WConverhpServer.html).

## Parts
`w-converhp` includes 2 parts: 
* `w-converhp-server`: for nodejs server
* `w-converhp-client`: for nodejs and browser client

## Installation
### Using npm(ES6 module):
```alias
npm i w-converhp
```

#### Example for w-converhp-server in nodejs:
> **Link:** [[dev source code](https://github.com/yuda-lyu/w-converhp/blob/master/srv.mjs)]
```alias
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

    let streamRead = null
    try {
        ms.push({ 'download': input })

        //fp
        let fp = `./test/1mb.7z`

        //check, 檔案存在才往下

        //fileSize
        let stats = fs.statSync(fp)
        let fileSize = stats.size

        //streamRead
        streamRead = fs.createReadStream(fp)

        //filename
        let filename = `1mb中文.7z` //測試支援中文

        //fileType
        let fileType = 'application/x-7z-compressed'

        //output
        let output = {
            streamRead,
            filename,
            fileSize,
            fileType,
        }

        pm.resolve(output)
    }
    catch (err) {
        console.log('download error', err)
        // try {
        //     streamRead.destroy() //若fs.createReadStream早於fs.statSync執行, 但fs.statSync發生錯誤時, stream得要destroy
        // }
        // catch (err) {}
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

```

#### Example for w-converhp-client in nodejs:
> **Link:** [[dev source code](https://github.com/yuda-lyu/w-converhp/blob/master/scla.mjs)]
```alias
import FormData from 'form-data'
import WConverhpClient from './src/WConverhpClient.mjs'

let ms = []

let opt = {
    FormData,
    url: 'http://localhost:8080',
    apiName: 'api',
    getToken: () => {
        return 'token-for-test'
    },
}

//new
let wo = new WConverhpClient(opt)

wo.on('error', (err) => {
    console.log(`error`, err)
})

function downloadLargeFile() {
    let core = async() => {

        await wo.download('id-for-file',
            function ({ prog, p, m }) {
                // console.log('client web: download: prog', prog, p, m)
                if (m === 'download') {
                    console.log('client web: download: prog', prog)
                }
            },
            {
                fdDownload: './', //於後端nodejs環境才能提供
            })
            .then(function(res) {
                console.log('client web: download: then', res)
                ms.push({ 'download output': res })
            })
            .catch(function (err) {
                console.log('client web: download: catch', err)
            })

        console.log('ms', ms)

    }
    core()
}

downloadLargeFile()

```

### In a browser(UMD module):
> **Note:** `w-converhp-client` does't depend on any package.

[Necessary] Add script for w-converhp-client.
```alias
<script src="https://cdn.jsdelivr.net/npm/w-converhp@2.0.32/dist/w-converhp-client.umd.js"></script>
```

#### Example for w-converhp-client in browser:
> **Link:** [[dev source code](https://github.com/yuda-lyu/w-converhp/blob/master/web.html)]
```alias

let opt = {
    // FormData, //使用瀏覽器內建FormData, 非後端不須另外提供
    url: 'http://localhost:8080',
    apiName: 'api',
}

//new
let WConverhpClient=window['w-converhp-client']
let wo = new WConverhpClient(opt)

async function execute(name, u8a){

    //p
    let p = {
        a: 12,
        b: 34.56,
        c: 'test中文',
        d: {
            name: name,
            u8a,
        },
    }
    console.log('p',p)

    //execute
    await wo.execute('add', { p },
        function ({ prog, p, m }) {
            console.log('client web: execute: prog', prog, p, m)
        })
        .then(function(r) {
            console.log('client web: execute: add', r)
            wsemi.downloadFileFromU8Arr(r._bin.name,r._bin.u8a)
        })
        .catch(function (err) {
            console.log('client web: execute: catch', err)
        })

}

function executeWithU8a() {
    let core = async()=>{

        //u8a
        let u8a = new Uint8Array([66, 97, 115])
        console.log('executeWithU8a u8a', u8a)
    
        //execute
        await execute('zdata.b1', u8a)

    }
    core()
}

function executeWithFile() {
    let core = async()=>{

        let msg = await wsemi.domShowInputAndGetFiles({ sizeMbLimit: 100*1000 }) //100g
        console.log('domShowInputAndGetFiles msg',msg)

        //check
        if(Object.keys(msg.errs).length > 0){
            console.log('errs',msg.errs)
            return
        }

        //check
        if(msg.files.length===0){
            return 
        }

        //file
        let file = msg.files[0]
        console.log('file',file)

        //blob2u8arr
        let u8a = await wsemi.blob2u8arr(file)
        console.log('executeWithFile u8a',u8a)
        
        //execute
        await execute(file.name,u8a)

    }
    core()
}

function uploadLargeFile(){
    let core = async()=>{

        let msg = await wsemi.domShowInputAndGetFiles({ sizeMbLimit: 100*1000 }) //100g
        console.log('domShowInputAndGetFiles msg',msg)

        //check
        if(Object.keys(msg.errs).length > 0){
            console.log('errs',msg.errs)
            return
        }

        //check
        if(msg.files.length===0){
            return 
        }

        //file
        let file = msg.files[0]
        console.log('file',file)

        //upload
        await wo.upload(file.name, file,
            function ({ prog, p, m }) {
                console.log('client web: upload: prog', prog, p, m)
            })
            .then(function(res) {
                console.log('client web: upload: then', res)
            })
            .catch(function (err) {
                console.log('client web: upload: catch', err)
            })

    }
    core()
}

```