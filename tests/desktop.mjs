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
  await page.getByRole('button', { name: /Пример инвойса/ }).waitFor()
  await page.screenshot({ path: path.join(temp, 'home.png') })
  await page.getByRole('button', { name: /Пример инвойса/ }).click()
  await page.getByRole('button', { name: 'Проверить', exact: true }).click()
  await page.getByText('Проверка инвойса', { exact: true }).waitFor()
  assert.match(await page.locator('dialog').innerText(), /расхождений нет/)
  await page.getByRole('button', { name: 'Закрыть' }).click()
  await page.screenshot({ path: path.join(temp, 'editor.png') })
  await page.getByRole('button', { name: 'К таблицам' }).click()
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
  await page.getByRole('button', { name: /Импорт файла/ }).click()
  await page
    .getByRole('textbox', { name: 'Название таблицы' })
    .fill('Проверка импорта')
  await page.getByRole('textbox', { name: 'Название таблицы' }).press('Enter')
  const text = page.getByRole('textbox', { name: 'Сообщение ассистенту' })
  await writeFile(
    path.join(temp, 'receipt.txt'),
    'Контрольное значение для D2 = 42',
  )
  await app.evaluate(
    ({ dialog }, p) => {
      dialog.showOpenDialog = async () => ({ filePaths: [p] })
    },
    path.join(temp, 'receipt.txt'),
  )
  await page.getByRole('button', { name: 'Прикрепить документ' }).click()
  await page.getByText('receipt.txt', { exact: true }).waitFor()
  await text.fill(
    'Запиши контрольное число из вложения в ячейку D2 листа «Лист 1».',
  )
  await page.getByRole('button', { name: 'Отправить', exact: true }).click()
  await page
    .getByRole('button', { name: 'Применить изменения' })
    .click({ timeout: 190000 })
  await page.getByText('Применено', { exact: true }).waitFor()
  for (const ext of ['xlsx', 'xls', 'ods', 'csv', 'tsv', 'docx', 'pdf']) {
    await page.getByRole('button', { name: 'Экспорт', exact: true }).click()
    await page.locator('select').selectOption(ext)
    const out = path.join(temp, 'export.' + ext)
    await app.evaluate(({ dialog }, p) => {
      dialog.showSaveDialog = async () => ({ filePath: p })
    }, out)
    await page.getByRole('button', { name: 'Сохранить файл' }).click()
    await page.locator('dialog').waitFor({ state: 'hidden' })
    const data = await readFile(out)
    assert.ok(data.length > 0)
    if (ext === 'csv') assert.match(data.toString(), /Service,2,100,42/)
    if (ext === 'pdf') assert.equal(data.toString('ascii', 0, 4), '%PDF')
  }
  await page.getByRole('button', { name: 'К таблицам' }).click()
  await page
    .getByRole('button', { name: 'Проверка импорта', exact: true })
    .click()
  await page.getByText('Применено', { exact: true }).waitFor()
  console.log('PASS desktop flow; screenshots and exports:', temp)
} catch (e) {
  const p = await app.firstWindow()
  console.error((await p.locator('body').innerText()).slice(-3500))
  throw e
} finally {
  await app.close()
}
