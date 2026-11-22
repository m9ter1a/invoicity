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
const language = process.argv[4] || 'auto'
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
  const picker = page.getByRole('combobox', {name: 'Dictation language'})
  assert.equal(await picker.inputValue(), 'auto')
  await picker.selectOption(language)
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
      window.playFixture = () => source.start(audio.currentTime + 0.05)
      window.fixtureTrack = output.stream.getAudioTracks()[0]
      return output.stream
    }
  }, (await readFile(fixture)).toString('base64'))
  const start = async () => {
    await button('Dictate message').click()
    await page.locator('.voiceButton[data-phase="listening"]').waitFor()
    assert.equal(await page.getByText('Listening…', { exact: true }).count(), 0)
  }
  const sent = page.locator('.msg.user')
  await start()
  await page.waitForTimeout(2300)
  assert.equal(await sent.count(), 0)
  assert.equal(await draft.inputValue(), 'Existing draft.')
  await button('Stop dictation').click()
  await button('Dictate message').waitFor()
  assert.equal(await page.evaluate(() => window.fixtureTrack.readyState), 'ended')

  // Manual stop keeps the transcript editable even after recognition finishes.
  await start()
  await page.evaluate(() => window.playFixture())
  await page.waitForFunction(() => Number(document.querySelector('.voiceButton').style.getPropertyValue('--voice-scale')) > 1,
    null, { polling: 50 })
  await page.waitForTimeout(1200)
  await button('Stop dictation').click()
  await button('Dictate message').waitFor()
  assert.equal(await sent.count(), 0)
  await draft.fill('Edited draft.')
  await start()
  await button('Close chat').click()
  assert.equal(await page.evaluate(() => window.fixtureTrack.readyState), 'ended')
  await page.getByRole('button', { name: /open invoicity/i }).click()
  assert.equal(await draft.inputValue(), 'Edited draft.')
  assert.equal(await picker.inputValue(), language)

  await start()
  await page.evaluate(() => window.playFixture())
  await sent.first().waitFor({ timeout: 60000 })
  const transcript = await sent.locator('p').first().innerText()
  assert.ok(transcript.startsWith('Edited draft. ') && transcript.toLowerCase().includes(expected), transcript)
  assert.equal(await page.evaluate(() => window.fixtureTrack.readyState), 'ended')
  await page.locator('.msg.assistant').first().waitFor({ timeout: 120000 })
  assert.equal(await sent.count(), 1)
  console.log('Passed silence-only, manual stop, chat close and exactly-once voice submission:', transcript)
} finally {
  await app.close()
}
