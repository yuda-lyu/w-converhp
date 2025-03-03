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

function uploadLargeFile() {
    let core = async() => {

        //u8a
        let u8a = new Uint8Array(fs.readFileSync('../_data/1000mb.7z'))
        console.log('u8a.length', u8a.length)
        console.log('uploadLargeFile u8a', u8a)

        await wo.upload('1000mb.7z', u8a,
            function (prog, p, m) {
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

uploadLargeFile()


//node --experimental-modules sclc.mjs
