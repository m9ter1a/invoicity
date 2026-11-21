import { _electron as electron } from 'playwright-core'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const temp = await mkdtemp(path.join(os.tmpdir(), 'invoicity-test-'))
const app = await electron.launch({
  executablePath: process.env.INVOICITY_BINARY || require('electron'),
  args: [
    ...(process.env.INVOICITY_BINARY ? [] : ['.']),
    '--user-data-dir=' + temp,
  ],
  timeout: 60000,
})
try {
  const page = await app.firstWindow()
  page.on('pageerror', (e) => console.error('renderer:', e.message))
  page.setDefaultTimeout(20000)
  const create = page.getByRole('button', { name: 'New spreadsheet', exact: true })
  await create.waitFor()
  assert.equal(await page.locator('html').getAttribute('lang'), 'en')
  assert.doesNotMatch(await page.locator('main').innerText(), /Templates|On this Mac|Sample invoice/i)
  await create.click()
  const title = page.getByRole('textbox', { name: 'Document name' })
  await title.fill('Quarterly invoices')
  await title.press('Enter')
  await page.getByRole('heading', { name: 'Invoicity', exact: true }).waitFor()
  assert.doesNotMatch(await page.locator('.editorTop').innerText(), /saved|saving/i)
  await page.screenshot({ path: path.join(temp, 'editor.png') })
  await page.getByRole('button', { name: 'Back to documents' }).click()
  const search = page.getByRole('searchbox', { name: 'Search documents by name' })
  await search.waitFor()
  await page.keyboard.press('Meta+k')
  assert.ok(await search.evaluate((el) => el === document.activeElement))
  await search.fill('  QUARTERLY  ')
  await page.getByRole('button', { name: 'Quarterly invoices' }).waitFor()
  await search.fill('no matching name')
  await page.getByText('No matching documents.').waitFor()
  await page.getByRole('button', { name: 'Clear search' }).click()
  await page.screenshot({ path: path.join(temp, 'home.png') })
  await page.getByRole('button', { name: 'Quarterly invoices' }).click()
  await page.getByRole('button', { name: 'Check invoice', exact: true }).click()
  await page.getByText('Invoice check', { exact: true }).waitFor()
  assert.match(
    await page.locator('dialog').innerText(),
    /No invoice fields detected/,
  )
  await page.getByRole('button', { name: 'Close' }).click()
  await page.getByRole('button', { name: 'Back to documents' }).click()
  await writeFile(
    path.join(temp, 'sample.csv'),
    'Position,Qty,Rate\nService,2,100',
  )
  await app.evaluate(
    ({ dialog }, p) => {
      dialog.showOpenDialog = async () => ({ filePaths: [p] })
    },
    path.join(temp, 'sample.csv'),
  )
  await page.getByRole('button', { name: /Import a file/ }).click()
  await page.getByRole('textbox', { name: 'Document name' }).fill('Import test')
  await page.getByRole('textbox', { name: 'Document name' }).press('Enter')
  const text = page.getByRole('textbox', { name: 'Message Invoicity' })
  await writeFile(path.join(temp, 'receipt.txt'), 'Control value for D2 = 42')
  await app.evaluate(
    ({ dialog }, p) => {
      dialog.showOpenDialog = async () => ({ filePaths: [p] })
    },
    path.join(temp, 'receipt.txt'),
  )
  await page.getByRole('button', { name: 'Attach document' }).click()
  await page.getByText('receipt.txt', { exact: true }).waitFor()
  await text.fill(
    'Write the control value from the attachment into D2 of Sheet 1.',
  )
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  const receipt = page.locator('.actionDetails summary', { hasText: /^Applied/ })
  await receipt.waitFor({ timeout: 190000 })
  assert.equal(await page.getByRole('button', { name: 'Apply changes' }).count(), 0)
  await receipt.click()
  await page.getByText(/Sheet 1 · D2/i).waitFor()
  for (const ext of ['xlsx', 'xls', 'ods', 'csv', 'tsv', 'docx', 'pdf']) {
    await page.getByRole('button', { name: 'Export', exact: true }).click()
    await page.locator('select').selectOption(ext)
    const out = path.join(temp, 'export.' + ext)
    await app.evaluate(({ dialog }, p) => {
      dialog.showSaveDialog = async () => ({ filePath: p })
    }, out)
    await page.getByRole('button', { name: 'Save file' }).click()
    await page.locator('dialog').waitFor({ state: 'hidden' })
    const data = await readFile(out)
    assert.ok(data.length > 0)
    if (ext === 'csv') assert.match(data.toString(), /Service,2,100,42/)
    if (ext === 'pdf') assert.equal(data.toString('ascii', 0, 4), '%PDF')
  }
  await page.getByRole('button', { name: 'Back to documents' }).click()
  await page.getByRole('button', { name: 'Import test', exact: true }).click()
  await receipt.waitFor()
  console.log('PASS desktop flow; screenshots and exports:', temp)
} catch (e) {
  const p = await app.firstWindow()
  console.error((await p.locator('body').innerText()).slice(-3500))
  throw e
} finally {
  await app.close()
}
