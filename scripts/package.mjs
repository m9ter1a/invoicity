import { packager } from '@electron/packager'
import { build } from 'esbuild'
import {
  mkdir,
  mkdtemp,
  cp,
  copyFile,
  readFile,
  writeFile,
  readdir,
  access,
  rename,
} from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
const root = process.cwd(),
  stage = await mkdtemp(path.join(os.tmpdir(), 'invoicity-package-')),
  src = path.join(stage, 'app')
const pkg = JSON.parse(await readFile('package.json', 'utf8'))
await mkdir(src)
await cp('dist', path.join(src, 'dist'), { recursive: true })
await copyFile('preload.cjs', path.join(src, 'preload.cjs'))
await writeFile(
  path.join(src, 'package.json'),
  JSON.stringify({
    name: pkg.name,
    productName: pkg.productName,
    version: pkg.version,
    main: 'main.cjs',
  }),
)
await build({
  entryPoints: ['main.cjs'],
  outfile: path.join(src, 'main.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node24',
  external: ['electron'],
  legalComments: 'eof',
})
const licenses = []
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'))
for (const [dir, p] of Object.entries(lock.packages)) {
  if (!dir || p.dev) continue
  const files = await readdir(dir).catch(() => [])
  const license = files.find((x) => /^licen[sc]e(\.md|\.txt)?$/i.test(x))
  if (license)
    licenses.push(
      dir +
        ' ' +
        p.version +
        '\n' +
        (await readFile(path.join(dir, license), 'utf8')),
    )
}
await writeFile(
  path.join(src, 'Third-party notices.txt'),
  licenses.join('\n\n'),
)
const iconset = path.join(stage, 'App.iconset'),
  icon = path.join(stage, 'App.icns')
execFileSync('swift', [
  '-module-cache-path',
  path.join(stage, 'swift-cache'),
  'scripts/icon.swift',
  iconset,
])
execFileSync('iconutil', ['-c', 'icns', iconset, '-o', icon])
const version = pkg.devDependencies.electron,
  cache = path.join(os.homedir(), 'Library/Caches/electron')
let zipDir
for (const n of await readdir(cache).catch(() => [])) {
  const dir = path.join(cache, n)
  try {
    await access(path.join(dir, 'electron-v' + version + '-darwin-arm64.zip'))
    zipDir = dir
    break
  } catch {}
}
const [result] = await packager({
  dir: src,
  out: path.join(root, 'release'),
  name: 'Invoicity',
  appBundleId: 'app.invoicity.desktop',
  extendInfo: {
    CFBundleDevelopmentRegion: 'en',
    CFBundleLocalizations: ['en'],
  },
  electronLanguages: ['en', 'en-US', 'en_US'],
  appVersion: pkg.version,
  platform: 'darwin',
  arch: 'arm64',
  electronVersion: version,
  electronZipDir: zipDir,
  icon,
  prune: false,
  asar: true,
  overwrite: true,
  osxSign: false,
})
const app = path.join(result, 'Invoicity.app'),
  vendor = path.join(app, 'Contents/Resources/vendor')
await mkdir(path.join(vendor, 'models'), { recursive: true })
await cp('vendor/llama', path.join(vendor, 'llama'), {
  recursive: true,
  verbatimSymlinks: true,
  filter: (p) =>
    p === 'vendor/llama' ||
    p.endsWith('.dylib') ||
    ['llama-server', 'LICENSE'].includes(path.basename(p)),
})
await copyFile('vendor/extract', path.join(vendor, 'extract'))
for (const f of ['nemotron.gguf', 'NVIDIA-License.pdf'])
  await copyFile('vendor/models/' + f, path.join(vendor, 'models', f))
execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], {
  stdio: 'inherit',
})
console.log(app)
