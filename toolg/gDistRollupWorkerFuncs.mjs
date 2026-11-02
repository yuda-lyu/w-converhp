import path from 'path'
import rollupWorkerCore from 'w-package-tools/src/rollupWorkerCore.mjs'


let fdSrc = './src'
let fdTar = './src'

async function core() {

    //因為WConverhpServer會import checkTotalHash.wk.umd.js故得先編譯
    await rollupWorkerCore({
        name: 'checkTotalHash', //原模組名稱, 將來會掛於winodw下或於node引入使用
        type: 'function', //原模組輸出為函數, 可傳入參數初始化
        // execFunctionByInstance: true, //default, 原模組為計算函數回傳結果
        fpSrc: path.resolve(fdSrc, 'checkTotalHash.mjs'), //原始檔案路徑
        fpTar: path.resolve(fdTar, 'checkTotalHash.wk.umd.js'), //檔案輸出路徑
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

    //因為WConverhpServer會import checkSlicesHash.wk.umd.js故得先編譯
    await rollupWorkerCore({
        name: 'checkSlicesHash', //原模組名稱, 將來會掛於winodw下或於node引入使用
        type: 'function', //原模組輸出為函數, 可傳入參數初始化
        // execFunctionByInstance: true, //default, 原模組為計算函數回傳結果
        fpSrc: path.resolve(fdSrc, 'checkSlicesHash.mjs'), //原始檔案路徑
        fpTar: path.resolve(fdTar, 'checkSlicesHash.wk.umd.js'), //檔案輸出路徑
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

    //因為WConverhpServer會import mergeSlices.wk.umd.js故得先編譯
    await rollupWorkerCore({
        name: 'mergeSlices', //原模組名稱, 將來會掛於winodw下或於node引入使用
        type: 'function', //原模組輸出為函數, 可傳入參數初始化
        // execFunctionByInstance: true, //default, 原模組為計算函數回傳結果
        fpSrc: path.resolve(fdSrc, 'mergeSlices.mjs'), //原始檔案路徑
        fpTar: path.resolve(fdTar, 'mergeSlices.wk.umd.js'), //檔案輸出路徑
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

}
core()
    .catch((err) => {
        //產製失敗須以非0結束, 發布流程以離開碼判定成敗; 明設離開碼, 不依賴Node之unhandled-rejections模式
        console.error(err)
        process.exitCode = 1
    })

//node toolg/gDistRollupWorkerFuncs.mjs
