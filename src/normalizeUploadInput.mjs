/**
 * 將 upload 之輸入正規化為兩種表示之一: Blob(含 File)或位元組視圖(Uint8Array, Buffer 原樣保留)
 *
 * why: 原本 upload 不正規化, 而大小、切片、雜湊三者對同一輸入各自解讀 —— 大小以 bb.size、bb.length 依序猜, 切片以 bb.slice, 雜湊以 new Blob([inp]);
 * 實測(第十輪 D2): ArrayBuffer 兩個屬性皆無而大小取 1, 雜湊卻以整個 ArrayBuffer 計, 應用端以 success 收到 **1 byte**;
 * DataView 無 slice 而拋 TypeError; Uint16Array 之 length 為元素數而切出之位元組為 2 倍 → Payload Too Large; 非 ASCII 字串以字元數切、以 UTF-8 送 → 同;
 * null 等不支援之輸入則以看不出原因之 TypeError 失敗且 0 則事件。
 *
 * 位元組語意與 fetch / axios 之 BodyInit 一致: ArrayBuffer 與所有 ArrayBufferView 取其位元組, 字串取其 UTF-8 位元組。
 * 判定 Blob 以 instanceof 而非 wsemi 之 isblob: File 之 Object.prototype.toString 為 [object File], isblob 對其回 false(nodejs 實測)。
 * 非 Buffer 之視圖以 new Uint8Array(buffer, byteOffset, byteLength) 表達, 其後切片須用會複製之 slice(使 axios 送出之 data.buffer 恰為該片;
 * axios 對非 Buffer 之視圖送 data.buffer, 以 subarray 切出之視圖會連同底層其餘位元組一併送出)。
 *
 * @param {*} v 輸入 upload 之輸入
 * @returns {Blob|Uint8Array|null} 回傳正規化後之輸入; 不支援者回 null
 * @example
 *
 * console.log(normalizeUploadInput(new ArrayBuffer(3)))
 * // => Uint8Array(3) [ 0, 0, 0 ]
 *
 * console.log(normalizeUploadInput('中'))
 * // => Uint8Array(3) [ 228, 184, 173 ]
 *
 * console.log(normalizeUploadInput(123))
 * // => null
 *
 */
function normalizeUploadInput(v) {
    try {
        if (typeof Blob !== 'undefined' && v instanceof Blob) {
            return v
        }
        if (typeof Buffer !== 'undefined' && Buffer.isBuffer(v)) {
            return v
        }
        if (v instanceof ArrayBuffer) {
            return new Uint8Array(v)
        }
        if (ArrayBuffer.isView(v)) {
            return new Uint8Array(v.buffer, v.byteOffset, v.byteLength)
        }
        if (typeof v === 'string') {
            return new TextEncoder().encode(v)
        }
    }
    catch (err) {}
    return null
}


export default normalizeUploadInput
