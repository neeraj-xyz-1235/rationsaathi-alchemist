// Receipt photos stay on THIS device (IndexedDB), keyed by record id. Only a "proof attached"
// flag goes to the server, so no photo is ever uploaded. Photos are shrunk first so a few phone
// pictures do not fill the browser's storage.
const DB = 'rationsaathi-proof'
const STORE = 'photos'

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function run(mode, fn) {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const req = fn(tx.objectStore(STORE))
    tx.oncomplete = () => { db.close(); resolve(req?.result) }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

export const saveProof = (id, blob) => run('readwrite', (s) => s.put(blob, id))
export const getProof = (id) => run('readonly', (s) => s.get(id))
export const deleteProof = (id) => run('readwrite', (s) => s.delete(id))
export const clearProofs = () => run('readwrite', (s) => s.clear())

/** Shrink an image File to at most `max` px on the long side, as a JPEG Blob. */
export async function shrinkImage(file, max = 1400) {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not read that image.'))), 'image/jpeg', 0.8))
}
