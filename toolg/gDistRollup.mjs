import path from 'path'
import rollupFiles from 'w-package-tools/src/rollupFiles.mjs'
import rollupWorker from 'w-package-tools/src/rollupWorker.mjs'


let fdSrc = './src'
let fdTar = './dist'


async function core() {

    //因為WConverhpServer會import checkTotalHash.wk.umd.js故得先編譯
    await rollupWorker({
        name: 'checkTotalHash', //原模組名稱, 將來會掛於winodw下或於node引入使用
        type: 'function', //原模組輸出為函數, 可傳入參數初始化
        // execFunctionByInstance: true, //default, 原模組為計算函數回傳結果
        fpSrc: path.resolve(fdSrc, 'checkTotalHash.mjs'), //原始檔案路徑
        fpTar: path.resolve(fdSrc, 'checkTotalHash.wk.umd.js'), //檔案輸出路徑
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
        runin: 'nodejs',
    })
        .catch((err) => {
            console.log(err)
        })

    //因為WConverhpServer會import checkSlicesHash.wk.umd.js故得先編譯
    await rollupWorker({
        name: 'checkSlicesHash', //原模組名稱, 將來會掛於winodw下或於node引入使用
        type: 'function', //原模組輸出為函數, 可傳入參數初始化
        // execFunctionByInstance: true, //default, 原模組為計算函數回傳結果
        fpSrc: path.resolve(fdSrc, 'checkSlicesHash.mjs'), //原始檔案路徑
        fpTar: path.resolve(fdSrc, 'checkSlicesHash.wk.umd.js'), //檔案輸出路徑
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
        runin: 'nodejs',
    })
        .catch((err) => {
            console.log(err)
        })

    //因為WConverhpServer會import mergeSlices.wk.umd.js故得先編譯
    await rollupWorker({
        name: 'mergeSlices', //原模組名稱, 將來會掛於winodw下或於node引入使用
        type: 'function', //原模組輸出為函數, 可傳入參數初始化
        // execFunctionByInstance: true, //default, 原模組為計算函數回傳結果
        fpSrc: path.resolve(fdSrc, 'mergeSlices.mjs'), //原始檔案路徑
        fpTar: path.resolve(fdSrc, 'mergeSlices.wk.umd.js'), //檔案輸出路徑
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
        runin: 'nodejs',
    })
        .catch((err) => {
            console.log(err)
        })

    await rollupFiles({
        fns: ['WConverhpServer.mjs'],
        fdSrc,
        fdTar,
        nameDistType: 'kebabCase',
        globals: {
            'worker_threads': 'worker_threads',
            'path': 'path',
            'fs': 'fs',
            'stream': 'stream',
            'crypto': 'crypto', //因crypto-js修改使用內建crypto方式, 會偵測nodejs並使用require內建的crypto, 故需剔除
            '@hapi/hapi': '@hapi/hapi',
            '@hapi/inert': '@hapi/inert',
            // 'form-data': 'FormData',
        },
        external: [
            'worker_threads',
            'path',
            'fs',
            'stream',
            'crypto',
            '@hapi/hapi',
            '@hapi/inert',
            // 'form-data',
        ],
        runin: 'nodejs',
    })

    await rollupFiles({
        fns: ['WConverhpClient.mjs'],
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
            'worker_threads',
            'path',
            'fs',
            'stream',
            'crypto',
            '@hapi/hapi',
            '@hapi/inert',
            // 'form-data',
        ],
        runin: 'browser',
    })

}
core()
    .catch((err) => {
        console.log(err)
    })
