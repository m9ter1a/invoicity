// Feed a local WAV through a real MediaStream without opening a physical microphone.
import { _electron as electron } from 'playwright-core'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdtemp, readFile } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

const binary = process.env.INVOICITY_BINARY
const fixture = path.resolve(process.argv[2] || 'vendor/downloads/whisper-src-1.8.2/samples/jfk.wav')
const expected = process.argv[3] || 'country'
const profile = await mkdtemp(path.join(os.tmpdir(), 'invoicity-dictation-'))
const app = await electron.launch({
  executablePath: binary || createRequire(import.meta.url)('electron'),
  args: [...(binary ? [] : ['.']), '--user-data-dir=' + profile, '--use-fake-device-for-media-stream'],
})
try {
  const page = await app.firstWindow()
  page.on('pageerror', error => console.error(error.message))
  page.on('console', message => { if (message.type() === 'error') console.error(message.text()) })
  const button = name => page.getByRole('button', { name, exact: true })
  await button('Get started').click()
  await button('Skip tour').click()
  await button('New spreadsheet').click()
  const draft = page.getByRole('textbox', { name: 'Message Invoicity' })
  await draft.fill('Existing draft.')
  await page.evaluate(async base64 => {
    const audio = new AudioContext()
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
    const buffer = await audio.decodeAudioData(bytes.buffer)
    const capture = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    navigator.mediaDevices.getUserMedia = async constraints => {
      const device = await capture(constraints)
      device.getTracks().forEach(track => track.stop())
      await audio.resume()
      const source = audio.createBufferSource()
      source.buffer = buffer
      const output = audio.createMediaStreamDestination()
      source.connect(output)
      source.start(audio.currentTime + 1)
      window.fixtureTrack = output.stream.getAudioTracks()[0]
      return output.stream
    }
  }, (await readFile(fixture)).toString('base64'))
  await button('Dictate message').click()
  await page.getByText('Listening…', { exact: true }).waitFor({ timeout: 10000 })
  await page.waitForFunction(() => document.querySelector('.voiceButton').style.getPropertyValue('--voice-scale') > 1, null, { timeout: 20000, polling: 100 })
  await page.waitForFunction(word => document.querySelector('.composer textarea').value.toLowerCase().includes(word), expected, { timeout: 55000, polling: 100 })
  await button('Stop dictation').click()
  await button('Dictate message').waitFor()
  const transcript = await draft.inputValue()
  assert.equal(await page.evaluate(() => window.fixtureTrack.readyState), 'ended')
  assert.ok(transcript.startsWith('Existing draft. ') && transcript.toLowerCase().includes(expected))
  assert.equal(await page.locator('.msg.user').count(), 0)
  await draft.fill('Edited after dictation.')
  assert.equal(await button('Send').isEnabled(), true)
  await button('Dictate message').click()
  await page.getByText('Listening…', { exact: true }).waitFor()
  await button('Close chat').click()
  assert.equal(await page.evaluate(() => window.fixtureTrack.readyState), 'ended')
  await page.getByRole('button', { name: /open invoicity/i }).click()
  assert.equal(await draft.inputValue(), 'Edited after dictation.')
  await button('Dictate message').waitFor()
  console.log('Passed offline microphone, live transcript, stop, editable draft, and chat-close checks:', transcript)
} finally {
  await app.close()
}
