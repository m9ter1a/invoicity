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
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import finance from '../src/finance-model.json' with { type: 'json' }

const platform = process.argv[2] || process.platform
if (!['darwin','linux','win32'].includes(platform)) throw Error('Unsupported platform: ' + platform)
const arch = platform === 'darwin' ? 'arm64' : 'x64'
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
let icon
if (platform === 'darwin') {
  const iconset = path.join(stage, 'App.iconset')
  icon = path.join(stage, 'App.icns')
  execFileSync('swift', ['-module-cache-path', path.join(stage, 'swift-cache'), 'scripts/icon.swift', iconset])
  execFileSync('iconutil', ['-c', 'icns', iconset, '-o', icon])
} else if (platform === 'win32') icon = path.resolve('scripts/invoicity.ico')
else await copyFile('scripts/invoicity.png', path.join(src, 'icon.png'))
const version = pkg.devDependencies.electron,
  cache = path.join(os.homedir(), 'Library/Caches/electron')
let zipDir
for (const n of await readdir(cache).catch(() => [])) {
  const dir = path.join(cache, n)
  try {
    await access(path.join(dir, 'electron-v' + version + '-' + platform + '-' + arch + '.zip'))
    zipDir = dir
    break
  } catch {}
}
const localZip = path.resolve('vendor/downloads')
try {
  await access(path.join(localZip,'electron-v'+version+'-'+platform+'-'+arch+'.zip'))
  zipDir = localZip
} catch {}
const [result] = await packager({
  dir: src,
  out: path.join(root, 'release'),
  name: 'Invoicity',
  appBundleId: 'app.invoicity.desktop',
  extendInfo: {
    NSMicrophoneUsageDescription: 'Dictate messages to Invoicity Agent. Your voice is transcribed on this device.',
    CFBundleDevelopmentRegion: 'en',
    CFBundleLocalizations: ['en'],
  },
  electronLanguages: ['en', 'en-US', 'en_US'],
  appVersion: pkg.version,
  win32metadata: { CompanyName: pkg.productName },
  platform, arch,
  electronVersion: version,
  electronZipDir: zipDir,
  icon,
  prune: false,
  asar: true,
  overwrite: true,
  osxSign: false,
})
const app = platform === 'darwin' ? path.join(result,'Invoicity.app') : result
const vendor = path.join(app, platform === 'darwin' ? 'Contents/Resources/vendor' : 'resources/vendor')
const nativeDir = platform === 'darwin' ? 'vendor/llama' : 'vendor/llama-'+platform
await mkdir(path.join(vendor, 'models'), {recursive:true})
await cp(nativeDir, path.join(vendor,'llama'), {
  recursive:true, verbatimSymlinks:true,
  filter: file => file === nativeDir || /(?:\.dll|\.dylib|\.so(?:\.[0-9.]+)?)$/i.test(file) ||
    /^(llama-server(\.exe)?|LICENSE.*)$/.test(path.basename(file)),
})
await cp('vendor/voice-' + platform, path.join(vendor, 'voice-' + platform), { recursive: true })
await copyFile('vendor/models/whisper-base-q5_1.bin', path.join(vendor, 'models/whisper-base-q5_1.bin'))
if (platform === 'darwin') await copyFile('vendor/extract', path.join(vendor,'extract'))
for (const file of [finance.file,'NVIDIA-License.pdf','SmolVLM-500M-Instruct-Q8_0.gguf','mmproj-SmolVLM-500M-Instruct-Q8_0.gguf','SmolVLM-LICENSE.txt'])
  await copyFile(path.join('vendor/models',file), path.join(vendor,'models',file))
const modelDigest = createHash('sha256')
for await (const chunk of createReadStream(path.join(vendor, 'models', finance.file))) modelDigest.update(chunk)
if (modelDigest.digest('hex') !== finance.sha256) throw Error('Bundled Tere Labs model failed SHA-256 verification')
if (platform === 'darwin') execFileSync('codesign',['--force','--deep','--sign','-',app],{stdio:'inherit'})
console.log(app)
