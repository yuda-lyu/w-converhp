import assert from 'assert'
import fs from 'fs'
// import _ from 'lodash-es'
import w from 'wsemi'
import WConverhpServer from '../src/WConverhpServer.mjs'
import WConverhpClient from '../src/WConverhpClient.mjs'


describe('uploadLargeFile', function() {

    let msAll = []

    let runServer = () => {

        let ms = []

        let opt = {
            port: 8082, //8080, //同時test故得要不同port
            apiName: 'api',
            pathStaticFiles: '.', //要存取專案資料夾下web.html, 故不能給dist
            verifyConn: async ({ apiType, authorization, headers, query }) => {
                // console.log('verifyConn', `apiType[${apiType}]`, `authorization[${authorization}]`)
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

        wo.on('upload', (input, pm) => {
            // console.log(`Server[port:${opt.port}]: upload`, input)

            try {

                let b = fs.readFileSync(`./${input.path}`)
                let u8a = new Uint8Array(b)
                let t = u8a
                let ts = [t[0], t[1], t[2]]
                ms.push({ 'receive and return': ts })

                fs.unlinkSync(`./${input.path}`) //測試完刪除暫存檔

                let output = input
                pm.resolve(output)
            }
            catch (err) {
                // console.log('upload error', err)
                pm.reject('upload error')
            }

        })
        wo.on('error', () => {
            // console.log(`Server[port:${opt.port}]: error`, err)
        })
        wo.on('handler', (data) => {
            // console.log(`Server[port:${opt.port}]: handler`, data)
        })

        setTimeout(() => {
            // console.log('ms', ms)
            msAll.push({ server: ms })
            wo.stop()
        }, 2000)

    }

    let runClient = () => {

        let ms = []

        let opt = {
            FormData,
            url: 'http://localhost:8082', //同時test故得要不同port
            apiName: 'api',
            getToken: () => {
                return 'token-for-test'
            },
        }

        //new
        let wo = new WConverhpClient(opt)

        wo.on('error', () => {
            // console.log(`error`, err)
        })

        function uploadLargeFile() {
            let core = async() => {

                //u8a
                let u8a = new Uint8Array(fs.readFileSync('./test/1mb.7z')) //使用test內檔案
                // console.log('u8a.length', u8a.length)
                // console.log('uploadLargeFile u8a', u8a)
                let t = u8a
                let ts = [t[0], t[1], t[2]]
                ms.push({ 'upload u8a.length': ts })

                await wo.upload('1mb.7z', u8a,
                    function ({ prog, p, m }) {
                        // console.log('client web: upload: prog', prog, p, m)
                        if (m === 'upload') {
                            // console.log('client web: upload: prog', prog)
                        }
                    })
                    .then(function(res) {
                        // console.log('client web: upload: then', res)
                        ms.push({ 'upload output': { filename: res.filename } })
                    })
                    .catch(function () {
                        // console.log('client web: upload: catch', err)
                    })

                // console.log('ms', ms)
                msAll.push({ client: ms })

            }
            core()
        }

        uploadLargeFile()

    }

    let run = () => {
        let pm = w.genPm()
        runServer()
        runClient()
        setTimeout(() => {
            // console.log('msAll', msAll)
            // fs.writeFileSync('./test_uploadLargeFile.json', JSON.stringify(msAll), 'utf8')
            pm.resolve(msAll)
        }, 4000)
        return pm
    }

    let res = `[{"client":[{"upload u8a.length":[55,122,188]},{"upload output":{"filename":"1mb.7z"}}]},{"server":[{"receive and return":[55,122,188]}]}]`
    it(`should return ${res} when test`, async function() {
        let r = await run()
        r = JSON.stringify(r)
        let rr = res
        assert.strict.deepEqual(r, rr)
    })

})
