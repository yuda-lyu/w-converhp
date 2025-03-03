import fs from 'fs'
import w from 'wsemi'
import FormData from 'form-data'
import WConverhpClient from './src/WConverhpClient.mjs'


let opt = {
    FormData,
    url: 'http://localhost:8080',
    apiName: 'api',
}

//new
let wo = new WConverhpClient(opt)

async function execute(name, u8a) {

    //p
    let p = {
        a: 12,
        b: 34.56,
        c: 'test中文',
        d: {
            name,
            u8a,
        },
    }
    console.log('p', p)

    //execute
    await wo.execute('add', { p },
        function (prog, p, m) {
            console.log('client web: execute: prog', prog, p, m)
        })
        .then(function(r) {
            console.log('client web: execute: add', r)
            console.log('r._bin.name', r._bin.name, 'r._bin.u8a', r._bin.u8a)
            // w.downloadFileFromU8Arr(r._bin.name, r._bin.u8a)
        })
        .catch(function (err) {
            console.log('client web: execute: catch', err)
        })

}

function executeWithU8a() {
    let core = async() => {

        //u8a
        let u8a = new Uint8Array([66, 97, 115])
        console.log('executeWithU8a u8a', u8a)

        //execute
        await execute('zdata.b1', u8a)

    }
    core()
}

executeWithU8a()


//node --experimental-modules scla.mjs
