import path from 'path'
import rollupFiles from 'w-package-tools/src/rollupFiles.mjs'
import rollupWorker from 'w-package-tools/src/rollupWorker.mjs'


let fdSrc = './src'
let fdTar = './dist'


async function core() {

    //因為WConverhpServer會import mergeFiles.wk.umd.js故得先編譯
    await rollupWorker({
        name: 'mergeFiles', //原模組名稱, 將來會掛於winodw下或於node引入使用
        type: 'function', //原模組輸出為函數, 可傳入參數初始化
        // execFunctionByInstance: true, //default, 原模組為計算函數回傳結果
        fpSrc: path.resolve(fdSrc, 'mergeFiles.mjs'), //原始檔案路徑
        fpTar: path.resolve(fdSrc, 'mergeFiles.wk.umd.js'), //檔案輸出路徑
        formatOut: 'umd',
        // bMinify: false,
        globals: {
            'path': 'path',
            'fs': 'fs',
        },
        external: [
            'path',
            'fs',
        ],
    })
        .catch((err) => {
            console.log(err)
        })

    await rollupFiles({
        fns: ['WConverhpServer.mjs', 'WConverhpClient.mjs'],
        fdSrc,
        fdTar,
        nameDistType: 'kebabCase',
        globals: {
            'path': 'path',
            'fs': 'fs',
            'stream': 'stream',
            'crypto': 'crypto', //因crypto-js修改使用內建crypto方式, 會偵測nodejs並使用require內建的crypto, 故需剔除
            '@hapi/hapi': '@hapi/hapi',
            '@hapi/inert': '@hapi/inert',
            // 'form-data': 'FormData',
        },
        external: [
            'path',
            'fs',
            'stream',
            'crypto',
            '@hapi/hapi',
            '@hapi/inert',
            // 'form-data',
        ],
    })

}
core()
    .catch((err) => {
        console.log(err)
    })
