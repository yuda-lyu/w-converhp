import assert from 'assert'
import fs from 'fs'
import _ from 'lodash-es'
import w from 'wsemi'
import WConverhpServer from '../src/WConverhpServer.mjs'
import WConverhpClient from '../src/WConverhpClient.mjs'


describe('downloadLargeFile', function() {

    let ms = []

    let runServer = () => {

        // let ms = []

        let opt = {
            port: 8083, //同時test故得要不同port
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

        wo.on('download', (input, pm) => {
            // console.log(`Server[port:${opt.port}]: download`, input)

            let streamRead = null
            try {
                ms.push({ 'server receive input': input })

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
                // console.log('download error', err)
                // try {
                //     streamRead.destroy() //若fs.createReadStream早於fs.statSync執行, 但fs.statSync發生錯誤時, stream得要destroy
                // }
                // catch (err) {}
                pm.reject('download error')
            }

        })
        wo.on('error', () => {
            // console.log(`Server[port:${opt.port}]: error`, err)
        })
        wo.on('handler', (data) => {
            // console.log(`Server[port:${opt.port}]: handler`, data)
        })

        setTimeout(() => {
            wo.stop()
        }, 2000)

    }

    let runClient = () => {

        // let ms = []

        let opt = {
            FormData,
            url: 'http://localhost:8083', //同時test故得要不同port
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

        function downloadLargeFile() {
            let core = async() => {

                ms.push({ 'client download input': 'id-for-file' })
                await wo.download('id-for-file',
                    function ({ prog, p, m }) {
                        // console.log('client web: download: prog', prog, p, m)
                        if (m === 'download') {
                            // console.log('client web: download: prog', prog)
                        }
                    },
                    {
                        fdDownload: './',
                    })
                    .then(function(res) {
                        // console.log('client web: download: then', res)

                        //getFileName
                        res = w.getFileName(res)
                        ms.push({ 'client download done': res })

                        fs.unlinkSync(res) //測試完刪除臨時檔

                    })
                    .catch(function () {
                        // console.log('client web: download: catch', err)
                    })

                // console.log('ms', ms)

            }
            core()
                .catch(() => {
                    // console.log(err)
                })
        }

        downloadLargeFile()

    }

    let run = () => {
        let pm = w.genPm()
        runServer()
        runClient()
        setTimeout(() => {
            // console.log('ms', ms)
            // fs.writeFileSync('./test_downloadLargeFile.json', JSON.stringify(ms), 'utf8')
            pm.resolve(ms)
        }, 4000)
        return pm
    }

    let res = `[{"client download input":"id-for-file"},{"server receive input":{"fileId":"id-for-file"}},{"client download done":"1mb中文.7z"}]`
    it(`should return ${res} when test`, async function() {
        let r = await run()
        r = JSON.stringify(r)
        let rr = res
        assert.strict.deepEqual(r, rr)
    })

})
