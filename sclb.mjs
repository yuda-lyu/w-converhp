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

function executeWithFile() {
    let core = async() => {

        //u8a
        let u8a = new Uint8Array(fs.readFileSync('../_data/10mb.7z'))
        console.log('executeWithFile u8a', u8a)

        //execute
        await execute('10mb.7z', u8a)

    }
    core()
}

executeWithFile()


//node --experimental-modules sclb.mjs
