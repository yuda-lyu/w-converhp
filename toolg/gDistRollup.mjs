import rollupFile from 'w-package-tools/src/rollupFile.mjs'


let fdSrc = './src'
let fdTar = './dist'

//server走nodejs解析(偏好node內建)
await rollupFile({
    fn: 'WConverhpServer.mjs',
    fdSrc,
    fdTar,
    nameDistType: 'kebabCase',
    globals: {
        'worker_threads': 'worker_threads',
        'path': 'path',
        'fs': 'fs',
        'stream': 'stream',
        'http': 'http',
        '@hapi/hapi': '@hapi/hapi',
        '@hapi/inert': '@hapi/inert',
    },
    external: [
        'worker_threads',
        'path',
        'fs',
        'stream',
        'http',
        '@hapi/hapi',
        '@hapi/inert',
    ],
    runin: 'nodejs',
})

//client走browser解析(吃依賴package.json的browser欄位), 不可改nodejs否則會打入node取向依賴變體(bundle爆增且可能引入瀏覽器不可執行路徑)
await rollupFile({
    fn: 'WConverhpClient.mjs',
    fdSrc,
    fdTar,
    nameDistType: 'kebabCase',
    globals: {
        'path': 'path',
        'fs': 'fs',
        'stream': 'stream',
        '@hapi/hapi': '@hapi/hapi',
        '@hapi/inert': '@hapi/inert',
    },
    external: [
        'worker_threads',
        'path',
        'fs',
        'stream',
        '@hapi/hapi',
        '@hapi/inert',
    ],
    runin: 'browser',
})
