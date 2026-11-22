const path = require('node:path')
const { execFile } = require('node:child_process')

function wave(pcm) {
  if (!(pcm instanceof ArrayBuffer) || !pcm.byteLength || pcm.byteLength % 2 || pcm.byteLength > 16000 * 2 * 16)
    throw Error('Invalid dictation audio.')
  const header = Buffer.alloc(44)
  header.write('RIFF')
  header.writeUInt32LE(36 + pcm.byteLength, 4)
  header.write('WAVEfmt ', 8)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(16000, 24)
  header.writeUInt32LE(32000, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(pcm.byteLength, 40)
  return Buffer.concat([header, Buffer.from(pcm)])
}

function voiceEngine(vendor) {
  let active
  function cancel(id) {
    if (active && (!id || active.id === id)) {
      active.child.kill()
      active = null
    }
  }
  async function transcribe(id, pcm) {
    if (active || typeof id !== 'string' || id.length > 64) throw Error('Dictation is busy.')
    const bytes = wave(pcm)
    const cli = path.join(vendor, 'voice-' + process.platform, process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli')
    const model = path.join(vendor, 'models', 'whisper-base-q5_1.bin')
    // A named output stem enables segment printing when reading stdin. No output file formats are enabled.
    const args = ['-m', model, '-l', 'auto', '-nt', '-np', '-t', '4', '-of', 'transcript', '-f', '-']
    return new Promise((resolve, reject) => {
      const child = execFile(cli, args, { timeout: 90000, windowsHide: true }, (err, stdout) => {
        if (active?.child === child) active = null
        if (err) reject(Error('Local speech recognition failed. Check that the speech engine is installed.'))
        else resolve(stdout.trim().replace(/\s+/g, ' '))
      })
      active = { id, child }
      child.stdin.on('error', () => {}) // A cancelled process closes its pipe early.
      child.stdin.end(bytes)
    })
  }
  return { cancel, transcribe }
}
module.exports = { voiceEngine }
