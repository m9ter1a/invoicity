import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { _electron as electron } from 'playwright-core'

const isMac = process.platform === 'darwin', windows = process.platform === 'win32'
const bundle = path.resolve('release', 'Invoicity-'+process.platform+'-'+(isMac ? 'arm64' : 'x64'))
const binary = path.join(bundle, isMac ? 'Invoicity.app/Contents/MacOS/Invoicity' : windows ? 'Invoicity.exe' : 'Invoicity')
const resources = path.join(bundle, isMac ? 'Invoicity.app/Contents/Resources' : 'resources')
const runtime = path.join(resources,'vendor','llama')
execFileSync(path.join(runtime,windows ? 'llama-server.exe' : 'llama-server'), ['--version'], {cwd:runtime,stdio:'inherit'})
const temp = await mkdtemp(path.join(os.tmpdir(),'invoicity-platform-'))
const app = await electron.launch({executablePath:binary,args:['--user-data-dir='+temp],timeout:90000})
try {
  const page = await app.firstWindow()
  const button = name => page.getByRole('button',{name,exact:true})
  await button('Get started').click()
  await button('Skip tour').click()
  await button('New spreadsheet').click()
  const cell = page.getByRole('textbox',{name:'Message Invoicity'})
  await cell.waitFor()
  const status = await page.evaluate(() => window.localDesk.modelStatus())
  assert.ok(status.installed)
  let primary
  for (const theme of ['light','dark']) {
    if (theme === 'dark') await button('Switch to dark theme').click()
    await button('Export').click()
    const shape = btn => btn.evaluate(el => {
      const s = getComputedStyle(el)
      return [el.offsetHeight,s.fontSize,s.lineHeight,s.fontWeight,s.borderRadius,s.padding,s.borderWidth]
    })
    primary = await shape(button('Save file'))
    assert.equal(primary[0],40)
    await page.keyboard.press('Escape')
    await button('Chat context').click()
    assert.deepEqual(await shape(button('Compress context')),primary)
    assert.deepEqual(await shape(button('Clear context')),primary)
    await page.keyboard.press('Escape')
  }
  // Exercise the offline readers in the actual packaged Chromium, including on macOS.
  const extracted = await app.evaluate(async ({BrowserWindow,app}) => {
    const reader = new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}})
    const sample = new BrowserWindow({show:false,webPreferences:{sandbox:true}})
    try {
      await sample.loadURL('data:text/html,<body style="font:48px Arial;background:white;color:black">Invoice 4729<br>Weekly revenue</body>')
      const pdf = (await sample.webContents.printToPDF({})).toString('base64')
      await reader.loadFile(app.getAppPath() + '/dist/extract.html')
      const png = await reader.webContents.executeJavaScript(`(() => {
        const c=document.createElement('canvas'); c.width=700; c.height=120;
        const g=c.getContext('2d'); g.fillStyle='white';g.fillRect(0,0,700,120);
        g.fillStyle='black';g.font='bold 54px Arial';g.fillText('Invoice 4729',20,75);return c.toDataURL().split(',')[1]
      })()`)
      const read = (input,ext) => reader.webContents.executeJavaScript('window.extractAttachment('+JSON.stringify(input)+','+JSON.stringify(ext)+')')
      return [await read(pdf,'pdf'),await read(png,'png')]
    } finally {reader.destroy(); sample.destroy()}
  })
  for (const text of extracted) assert.match(text,/4729/)
  assert.match(extracted[0], /4729\s*\n\s*Weekly revenue/)
  console.log('PASS offline PDF and image extraction, both themes and button geometry')
  await cell.fill('In J4 type "platform test"')
  await cell.press('Enter')
  const reply = page.locator('.msg.assistant').last()
  await reply.waitFor({timeout:420000})
  assert.match(await reply.innerText(), /Applied/, 'Local agent failed to write the test value')
  await button('Back to documents').click()
  const value = await page.evaluate(async () => {
    const [item] = await window.localDesk.list()
    const { snapshot } = await window.localDesk.read(item.id)
    return snapshot.sheets[snapshot.sheetOrder[0]].cellData[3][9].v
  })
  assert.equal(value,'platform test')
  await button('Delete Untitled spreadsheet').click()
  assert.equal(await button('Cancel').evaluate(el=>el.offsetHeight),primary[0])
  console.log('PASS packaged '+process.platform+' local agent and persisted spreadsheet')
} finally { await app.close() }
