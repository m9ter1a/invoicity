import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, createReadStream } from 'node:fs'
import { copyFile, mkdir, rename, rm } from 'node:fs/promises'
import path from 'node:path'

const target = process.argv[2] || process.platform
const cache = 'vendor/downloads'
const destination = 'vendor/voice-' + target
const binary = target === 'win32' ? 'whisper-cli.exe' : 'whisper-cli'
const model = 'vendor/models/whisper-base-q5_1.bin'
await mkdir(cache, { recursive: true })
await mkdir('vendor/models', { recursive: true })
async function download(url, file, digest) {
  const cached = existsSync(file)
  const input = cached ? file : file + '.part'
  if (!cached) execFileSync('curl', ['-fLsS', '--retry', '3', '-o', input, url], { stdio: 'inherit' })
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(input)) hash.update(chunk)
  if (hash.digest('hex') !== digest) {
    await rm(input)
    throw Error('Invalid download: ' + file)
  }
  if (!cached) await rename(input, file)
}
await download('https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861/ggml-base-q5_1.bin', model,
  '422f1ae452ade6f30a004d7e5c6a43195e4433bc370bf23fac9cc591f01a8898')
const archive = cache + '/whisper-v1.8.2.tar.gz'
await download('https://codeload.github.com/ggml-org/whisper.cpp/tar.gz/refs/tags/v1.8.2', archive,
  'bcee25589bb8052d9e155369f6759a05729a2022d2a8085c1aa4345108523077')
const source = cache + '/whisper-src-1.8.2'
await mkdir(source, { recursive: true })
execFileSync('tar', ['xf', archive, '-C', source, '--strip-components=1'])
await mkdir(destination, { recursive: true })
if (target === process.platform) {
  const build = cache + '/whisper-build-' + target
  const cmake = process.env.CMAKE || 'cmake'
  const options = ['-DCMAKE_BUILD_TYPE=Release', '-DBUILD_SHARED_LIBS=OFF', '-DGGML_NATIVE=OFF',
    '-DGGML_METAL=OFF', '-DGGML_OPENMP=OFF', '-DWHISPER_BUILD_TESTS=OFF', '-DWHISPER_BUILD_SERVER=OFF']
  if (target === 'darwin') options.push('-DCMAKE_OSX_ARCHITECTURES=arm64', '-DCMAKE_OSX_DEPLOYMENT_TARGET=12.0')
  if (target === 'win32') options.push('-A', 'x64', '-DCMAKE_MSVC_RUNTIME_LIBRARY=MultiThreaded')
  execFileSync(cmake, ['-S', source, '-B', build, ...options], { stdio: 'inherit' })
  execFileSync(cmake, ['--build', build, '--config', 'Release', '--target', 'whisper-cli', '--parallel', '4'], { stdio: 'inherit' })
  const output = path.join(build, 'bin', target === 'win32' ? 'Release' : '', binary)
  await copyFile(output, path.join(destination, binary))
} else if (!existsSync(path.join(destination, binary))) {
  throw Error('Prepare the speech engine on a ' + target + ' runner and copy ' + destination + ' before cross-packaging.')
}
await copyFile(path.join(source, 'LICENSE'), path.join(destination, 'LICENSE-whisper.cpp.txt'))
