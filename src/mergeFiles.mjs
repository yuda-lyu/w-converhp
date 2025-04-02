import path from 'path'
import fs from 'fs'
import genPm from 'wsemi/src/genPm.mjs'
import fsIsFile from 'wsemi/src/fsIsFile.mjs'
import fsDeleteFile from 'wsemi/src/fsDeleteFile.mjs'


let mergeFiles = async (pathUploadTemp, packageId, chunkTotal, filename) => {
    let errTemp = ''

    //pm
    let pm = genPm()

    //攔截錯誤, 注意stream是非同步故try catch是無法攔截的, 須各自監聽read與write串流的error事件處理, 此處是攔截串流以外的錯誤
    try {

        //pathFileMerge
        let pathFileMerge = path.join(pathUploadTemp, packageId)
        // console.log('pathFileMerge', pathFileMerge)

        //streamWrite
        let streamWrite = fs.createWriteStream(pathFileMerge)
        // console.log(`merge filename[${filename}] start`)

        for (let i = 0; i < chunkTotal; i++) {
            // console.log(`merge ${i + 1}/${chunkTotal}`)

            //chunkIndex
            let chunkIndex = i

            //pathFileChunk
            let pathFileChunk = path.join(pathUploadTemp, `${packageId}_${chunkIndex}`)

            //check
            if (!fsIsFile(pathFileChunk)) {
                // console.log(`pathFileChunk[${pathFileChunk}] is not a file`)
                throw new Error(`missing chunk ${i} of filename[${filename}]`)
            }

            // console.log(`merging chunk[${chunkIndex + 1}/${chunkTotal}]...`)

            //使用readFileSync會忽略背壓, 若寫入相對慢就會儲存至記憶體, 導致記憶體超量使用, 得要偵測與控制背壓
            // //chunkData
            // let chunkData = fs.readFileSync(pathFileChunk)
            // //write
            // streamWrite.write(chunkData)
            // //fsDeleteFile
            // fsDeleteFile(pathFileChunk)

            //transfer
            let transfer = () => {
                let pmc = genPm()

                //streamRead
                let streamRead = fs.createReadStream(pathFileChunk)

                //監測錯誤
                streamRead.on('error', (err) => {
                    errTemp = err.message
                    pmc.reject(err)
                })

                //監測串流結束
                streamRead.on('end', () => {
                    fsDeleteFile(pathFileChunk)
                    pmc.resolve()
                })

                //pipe, 將讀取流接入寫入流, 會自動調節讀寫速率處理背壓
                //注意pipe不會自動處理錯誤, 若read出錯也不會因pipe轉移至write, 故read的錯誤得要獨立監聽處理
                streamRead.pipe(streamWrite, { end: false })

                return pmc
            }
            await transfer()

            // console.log(`merge chunk[${chunkIndex + 1}/${chunkTotal}] done`)
        }

        //end
        streamWrite.end()

        //error, 若有error則不會觸發finish
        streamWrite.on('error', (err) => {
            // console.log(`merge filename[${filename}] err`, err)
            errTemp = err.message
            pm.reject(errTemp)
        })

        //finish, end之後檔案未必完成寫入會有時間差, 得要監聽finish才能確定寫入檔案完成
        streamWrite.on('finish', () => {
            // console.log(`merge filename[${filename}] end`)

            //r
            let r = {
                filename,
                path: pathFileMerge,
            }
            // let s = fs.statSync(pathFileMerge)
            // console.log('s.size', s.size)

            //resolve
            pm.resolve(r)

        })

    }
    catch (err) {
        errTemp = err.message
        pm.reject(errTemp)
    }

    return pm
}

export default mergeFiles
