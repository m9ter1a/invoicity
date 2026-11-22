import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream, existsSync } from 'node:fs'
import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

const platform = process.argv[2] || process.platform
const runtime = {
  darwin: ['macos-arm64.tar.gz', '4b9067216c4f06961c3d13426bfa045d7ce68ca3237d3c77a87f575d88482fee'],
  linux: ['ubuntu-x64.tar.gz', 'd2a270c7043ddfbc4f243aab0fcb34b8f647b2eb71ac80813b43d4e367db7035'],
  win32: ['win-cpu-x64.zip', 'e9e06ce5b9c78c02a6c639e601c7f6bb05c01a4be7cf1899abfe63bebb1c2c59'],
}[platform]
if (!runtime) throw Error('Supported targets: darwin, win32, linux.')
const models = 'vendor/models'
const cache = 'vendor/downloads'
await mkdir(models, {recursive:true})
await mkdir(cache, {recursive:true})
async function check(file, sha) {
  if (!sha) return
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(file)) hash.update(chunk)
  if (hash.digest('hex') !== sha) throw Error('Checksum mismatch: ' + file)
}
async function fetchFile(url, file, sha) {
  if (existsSync(file)) return check(file, sha)
  const part = file + '.part'
  execFileSync('curl', ['--fail','--location','--retry','3','--output',part,url], {stdio:'inherit'})
  await check(part, sha)
  await rename(part, file)
}
const hf = 'https://huggingface.co/'
// Tere Labs Q4_K_M of NVIDIA Nemotron 3 Nano 4B, calibrated on Invoicity requests (see README, Model).
await fetchFile(hf+'terelabs/Nemotron-3-Nano-4B-Invoicity-GGUF/resolve/35084b02a86cf0a0a5e128309bcb3a6e4bae34b2/Nemotron-3-Nano-4B-Invoicity-Q4_K_M.gguf', models+'/nemotron.gguf','168ecf97adc91a3a3c0283e6d43c9168dd9c693500c23f48f67390fa03928645')
for (const [file,sha] of [
  ['SmolVLM-500M-Instruct-Q8_0.gguf','9d4612de6a42214499e301494a3ecc2be0abdd9de44e663bda63f1152fad1bf4'],
  ['mmproj-SmolVLM-500M-Instruct-Q8_0.gguf','d1eb8b6b23979205fdf63703ed10f788131a3f812c7b1f72e0119d5d81295150'],
]) await fetchFile(hf+'ggml-org/SmolVLM-500M-Instruct-GGUF/resolve/72e986006ef53e37cdd3f6d4241c90b0f01df376/'+file,models+'/'+file,sha)
await fetchFile('https://www.nvidia.com/content/dam/en-zz/Solutions/license-agreements/enterprise-software/NVIDIA-Nemotron-Open-Model-License-12-12-25.pdf',models+'/NVIDIA-License.pdf')
await fetchFile('https://www.apache.org/licenses/LICENSE-2.0.txt',models+'/SmolVLM-LICENSE.txt')

const nativeDir = platform === 'darwin' ? 'vendor/llama' : 'vendor/llama-'+platform
const server = platform === 'win32' ? 'llama-server.exe' : 'llama-server'
if (!existsSync(path.join(nativeDir, '.b12611')) || !existsSync(path.join(nativeDir,server))) {
  const archive = cache+'/llama-'+platform+(platform === 'win32' ? '.zip' : '.tar.gz')
  await fetchFile('https://github.com/ggml-org/llama.cpp/releases/download/b12611/llama-b12611-bin-'+runtime[0],archive,runtime[1])
  const stage = await mkdtemp('vendor/.engine-')
  if (platform === 'win32' && process.platform === 'linux') execFileSync('unzip',['-q',archive,'-d',stage])
  else {
    // Git Bash's GNU tar cannot unpack ZIP files. Windows ships bsdtar.
    const tar = process.platform === 'win32' ? path.join(process.env.SystemRoot,'System32','tar.exe') : 'tar'
    execFileSync(tar,['-xf',archive,'-C',stage,...(platform === 'win32' ? [] : ['--strip-components=1'])])
  }
  if (!existsSync(path.join(stage,server))) throw Error('Missing runtime: '+server)
  await writeFile(path.join(stage,'.b12611'),'')
  await rm(nativeDir,{recursive:true,force:true})
  await rename(stage,nativeDir)
}
if (platform === 'darwin') execFileSync('swiftc',['-O','scripts/extract.swift','-o','vendor/extract'])
