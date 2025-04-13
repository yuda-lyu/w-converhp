
import fsGetFileXxHash from 'wsemi/src/fsGetFileXxHash.mjs'


function calcFileHash(fp) {
    return fsGetFileXxHash(fp)
}


export default calcFileHash
