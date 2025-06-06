import path from 'path'
import fs from 'fs'
import _ from 'lodash-es'
import w from 'wsemi'
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

function uploadLargeFile() {
    let core = async() => {

        let fsz = '10mb' //0mb 10mb 100mb 1000mb

        //u8a
        let u8a = fs.readFileSync(`../_data/${fsz}.7z`) //用fs讀有檔案大小上限
        console.log('u8a.length', u8a.length)
        // console.log('uploadLargeFile u8a', u8a)
        ms.push({ 'upload u8a.length': u8a.length })

        await wo.upload(`${fsz}.7z`, u8a,
            function ({ prog, p, m }) {
                // console.log('client web: upload: prog', prog, p, m)
                if (m === 'upload') {
                    console.log('client web: upload: prog', prog)
                }
            })
            .then(function(res) {
                console.log('client web: upload: then', res)
                ms.push({ 'upload output': res })
            })
            .catch(function (err) {
                console.log('client web: upload: catch', err)
            })

        console.log('ms', ms)

    }
    core()
        .catch((err) => {
            console.log(err)
        })
}

uploadLargeFile()


//node sclc.mjs
