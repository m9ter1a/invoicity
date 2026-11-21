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
await copyFile('src/index.html', 'dist/index.html')
