// Reads a ration card photo ON THIS DEVICE (tesseract.js). The photo and the raw text are never
// uploaded or stored; only the detected card type and member count leave this module, and the
// user confirms both before they are used.

/** Pure: pull the card type and member count out of OCR text. Exported for testing. */
export function detectCard(text) {
  const t = String(text || '').toLowerCase()
  let type = null
  if (/\baay\b|antyodaya|अंत्योदय/.test(t)) type = 'AAY'
  else if (/\bphh\b|priority\s*house|प्राधान्य/.test(t)) type = 'PHH'
  else if (/\bbpl\b|\bapl\b/.test(t)) type = 'OTHER'

  let members = null
  const m = t.match(/(?:members?|सदस्य)[^\d\n]{0,20}(\d{1,2})\b/)
  if (m) {
    const n = Number(m[1])
    if (n >= 1 && n <= 30) members = n
  }
  return { type, members }
}

/** Run OCR on an image File. onProgress receives 0..1. */
export async function scanCardImage(file, onProgress = () => {}) {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('eng+mar', 1, {
    logger: (m) => { if (m.status === 'recognizing text') onProgress(m.progress) },
  })
  try {
    const { data } = await worker.recognize(file)
    return detectCard(data.text)
  } finally {
    await worker.terminate()
  }
}
