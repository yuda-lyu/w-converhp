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
        .catch((err) => {
            console.log(err)
        })
}

downloadLargeFile()


//node scld.mjs
