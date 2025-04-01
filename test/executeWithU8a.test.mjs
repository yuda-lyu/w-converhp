import assert from 'assert'
// import fs from 'fs'
import _ from 'lodash-es'
import w from 'wsemi'
import WConverhpServer from '../src/WConverhpServer.mjs'
import WConverhpClient from '../src/WConverhpClient.mjs'


describe('executeWithU8a', function() {

    let msAll = []

    let runServer = () => {

        let ms = []

        let opt = {
            port: 8080,
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

        wo.on('execute', (func, input, pm) => {
            // console.log(`Server[port:${opt.port}]: execute`, func, input)
            // console.log(`Server[port:${opt.port}]: execute`, func)

            try {

                if (func === 'add') {

                    if (_.get(input, 'p.d.u8a', null)) {
                        // console.log('input.p.d.u8a', input.p.d.u8a)
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
                    // console.log('invalid func')
                    pm.reject('invalid func')
                }

            }
            catch (err) {
                // console.log('execute error', err)
                pm.reject('execute error')
            }

        })
        wo.on('error', () => {
            // console.log(`Server[port:${opt.port}]: error`, err)
        })
        wo.on('handler', (data) => {
            // console.log(`Server[port:${opt.port}]: handler`, data)
        })

        setTimeout(() => {
            // console.log('ms', JSON.stringify(ms))
            msAll.push({ server: ms })
            wo.stop()
        }, 2000)

    }

    let runClient = () => {

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

        wo.on('error', () => {
            // console.log(`error`, err)
        })

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
            // console.log('p', p)
            ms.push({ 'execute input': p })

            //execute
            await wo.execute('add', { p },
                function ({ prog, p, m }) {
                    if (m === 'upload') {
                        // console.log('client web: execute: prog', prog * 0.5, p, m)
                    }
                    if (m === 'download') {
                        // console.log('client web: execute: prog', 50 + prog * 0.5, p, m)
                    }
                })
                .then(function(r) {
                    // console.log('client web: execute: add', r)
                    // console.log('r._bin.name', r._bin.name, 'r._bin.u8a', r._bin.u8a)
                    // w.downloadFileFromU8Arr(r._bin.name, r._bin.u8a)
                    ms.push({ 'execute output': r })
                })
                .catch(function () {
                    // console.log('client web: execute: catch', err)
                })

        }

        function executeWithU8a() {
            let core = async() => {

                //u8a
                let u8a = new Uint8Array([66, 97, 115])
                // console.log('executeWithU8a u8a', u8a)

                //execute
                await execute('zdata.b1', u8a)

                // console.log('ms', JSON.stringify(ms))
                msAll.push({ client: ms })

            }
            core()
        }

        executeWithU8a()

    }

    let run = () => {
        let pm = w.genPm()
        runServer()
        runClient()
        setTimeout(() => {
            // console.log('msAll', JSON.stringify(msAll))
            // fs.writeFileSync('./test_executeWithU8a.json', JSON.stringify(msAll), 'utf8')
            pm.resolve(msAll)
        }, 4000)
        return pm
    }

    let res = `[{"client":[{"execute input":{"a":12,"b":34.56,"c":"test中文","d":{"name":"zdata.b1","u8a":{"0":66,"1":97,"2":115}}}},{"execute output":{"_add":46.56,"_data":[11,22.22,"abc",{"x":"21","y":65.43,"z":"test中文"}],"_bin":{"name":"zdata.b2","u8a":{"0":52,"1":66,"2":97,"3":115}}}}]},{"server":[{"input.p.d.u8a":{"0":66,"1":97,"2":115}}]}]`
    it(`should return ${res} when test`, async function() {
        let r = await run()
        r = JSON.stringify(r)
        let rr = res
        assert.strict.deepEqual(r, rr)
    })

})
