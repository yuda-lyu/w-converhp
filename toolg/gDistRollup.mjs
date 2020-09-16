import rollupFiles from 'w-package-tools/src/rollupFiles.mjs'
import getFiles from 'w-package-tools/src/getFiles.mjs'
import w from 'wsemi'


let fdSrc = './src'
let fdTar = './dist'
let fns = getFiles(fdSrc)
fns = fns.filter((v) => {
    return w.strleft(v, 1) === 'W'
})

rollupFiles({
    fns: fns,
    fdSrc,
    fdTar,
    nameDistType: 'kebabCase',
    globals: {
        '@hapi/hapi': '@hapi/hapi',
        '@hapi/inert': '@hapi/inert',
        'events': 'events',
        'stream': 'stream',
        'form-data': 'FormData',
        'crypto': 'crypto', //因crypto-js修改使用內建crypto方式, 會偵測nodejs並使用require內建的crypto, 故需剔除
    },
    external: [
        '@hapi/hapi',
        '@hapi/inert',
        'events',
        'stream',
        'crypto',
    ],
})

