import { getDocument, GlobalWorkerOptions } from './ocr/pdf.min.mjs'

const asset = name => new URL('./ocr/' + name, location.href).href
GlobalWorkerOptions.workerSrc = asset('pdf.worker.min.mjs')

window.extractAttachment = async (encoded, extension) => {
  const data = Uint8Array.fromBase64(encoded)
  let worker, task
  async function recognize(image) {
    worker ??= await window.Tesseract.createWorker('eng+rus', 1, {
      workerPath: asset('worker.min.js'), corePath: asset('tesseract-core-lstm.wasm.js'),
      langPath: asset(''), workerBlobURL: false, cacheMethod: 'none',
    })
    return (await worker.recognize(image)).data.text
  }
  try {
    if (extension !== 'pdf') return await recognize(data)
    task = getDocument({data, cMapUrl: asset('cmaps/'), cMapPacked: true,
      wasmUrl: asset('wasm/'), standardFontDataUrl: asset('standard_fonts/'), isEvalSupported: false})
    const pdf = await task.promise
    const pages = []
    for (let i = 1; i <= Math.min(pdf.numPages, 30); i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      let text = content.items.map(item => item.str || '').join(' ').trim()
      if (!text) {
        const size = page.getViewport({scale: 1})
        const viewport = page.getViewport({scale: Math.min(3, 2200 / Math.max(size.width, size.height))})
        const canvas = document.createElement('canvas')
        canvas.width = Math.ceil(viewport.width)
        canvas.height = Math.ceil(viewport.height)
        await page.render({canvas, viewport}).promise
        text = await recognize(canvas)
      }
      pages.push(text)
      page.cleanup()
      if (pages.join('\n').length > 6000) break
    }
    if (pdf.numPages > 30) pages.push('[Only the first 30 pages were read.]')
    return pages.join('\n')
  } finally {
    await worker?.terminate()
    await task?.destroy()
  }
}
