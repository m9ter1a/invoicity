import { build } from 'esbuild'
import { mkdir, copyFile } from 'node:fs/promises'
await mkdir('dist', { recursive: true })
await build({
  entryPoints: ['src/ui.jsx'],
  bundle: true,
  outfile: 'dist/ui.js',
  minify: true,
  format: 'iife',
  target: 'chrome136',
  define: { 'process.env.NODE_ENV': '"production"' },
  loader: {
    '.woff2': 'file',
    '.woff': 'file',
    '.svg': 'dataurl',
    '.png': 'dataurl',
  },
  assetNames: 'assets/[name]-[hash]',
  legalComments: 'eof',
  logLevel: 'info',
})
await copyFile('src/voice-capture.js', 'dist/voice-capture.js')
await copyFile('src/index.html', 'dist/index.html')

const { cp } = await import('node:fs/promises')
await mkdir('dist/ocr', { recursive: true })
for (const file of ['extract.html', 'extract.mjs']) await copyFile('src/' + file, 'dist/' + file)
for (const name of ['pdf.min.mjs', 'pdf.worker.min.mjs', 'pdf.renderer.min.mjs'])
  await copyFile('node_modules/pdfjs-dist/build/' + name, 'dist/ocr/' + name)
for (const name of ['cmaps', 'wasm', 'standard_fonts'])
  await cp('node_modules/pdfjs-dist/' + name, 'dist/ocr/' + name, {recursive: true})
for (const file of ['tesseract.min.js', 'worker.min.js'])
  await copyFile('node_modules/tesseract.js/dist/' + file, 'dist/ocr/' + file)
await copyFile('node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js', 'dist/ocr/tesseract-core-lstm.wasm.js')
for (const lang of ['eng', 'rus'])
  await copyFile('node_modules/@tesseract.js-data/' + lang + '/4.0.0_best_int/' + lang + '.traineddata.gz', 'dist/ocr/' + lang + '.traineddata.gz')
