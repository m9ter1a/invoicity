import assert from 'node:assert/strict'
import { mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { _electron as electron } from 'playwright-core'

const require = createRequire(import.meta.url)
const directory = await mkdtemp(path.join(os.tmpdir(), 'invoicity-revenue-'))
const weeks = [12450, 13780, 11990, 15480]
const total = weeks.reduce((sum, value) => sum + value, 0)
const header = ['Store']
for (let week = 1; week <= 4; week++)
  for (const day of ['Mon','Tue','Wed','Thu','Fri','total']) header.push('Week ' + week + ' ' + day)
const rows = [header]
for (let store = 0; store < 20; store++) {
  const row = [store === 0 ? 'North' : 'Store ' + (store + 1)]
  for (const amount of weeks) {
    const weekly = amount + 50 * store
    row.push(...Array(5).fill(weekly / 5), weekly)
  }
  rows.push(row)
}
const input = path.join(directory, 'Monthly revenue.csv')
await writeFile(input, rows.map(row => row.join(',')).join('\n'))
const binary = process.env.INVOICITY_BINARY
const app = await electron.launch({executablePath:binary || require('electron'),
  args:[...(binary ? [] : ['.']), '--user-data-dir=' + directory]})
try {
  const page = await app.firstWindow()
  const button = name => page.getByRole('button',{name,exact:true})
  const chat = page.getByRole('textbox',{name:'Message Invoicity'})
  async function ask(question) {
    const answers = page.locator('.msg.assistant')
    const before = await answers.count()
    await chat.fill(question)
    await chat.press('Enter')
    await answers.nth(before).waitFor({timeout:240000})
    await button('Chat context').waitFor()
    const answer = await answers.nth(before).innerText()
    console.log(question, '\n', answer)
    return answer
  }
  async function contextAction(option, confirm) {
    await button('Chat context').click()
    await button(option).click()
    await button(confirm).click()
    await page.locator('dialog').waitFor({state:'hidden',timeout:240000})
  }
  async function saved() {
    return page.evaluate(async () => {
      const [item] = await window.localDesk.list()
      return window.localDesk.read(item.id)
    })
  }
  const numberIn = (text, value) => new RegExp('(?<![0-9])' + value + '(?![0-9])').test(text.replace(/(?<=\d)[,\s\u00a0](?=\d{3}\b)/g,''))
  await button('Get started').click()
  await button('Skip tour').click()
  await app.evaluate(({dialog}, file) => { dialog.showOpenDialog = async () => ({filePaths:[file]}) }, input)
  await button('Import a file').click()
  const first = await ask('Какая суммарная выручка магазина North за месяц по четырём недельным итогам G2, M2, S2 и Y2? Ответь в чате.')
  const formulaAnswer = await ask('В Z2 запиши формулу средней недельной выручки North по ячейкам G2, M2, S2 и Y2. В ячейке должен показываться рассчитанный результат.')
  await ask('Нарисуй дракона прямо по середине таблицы.')
  await page.waitForFunction(async () => {
    const [item] = await window.localDesk.list()
    const {messages} = await window.localDesk.read(item.id)
    return messages.at(-1)?.state === 'applied' && messages.at(-1)?.actions[0]?.op === 'paintIcon'
  })
  const drawing = (await saved()).messages.at(-1).actions[0]
  assert.match(drawing.symbol, /[🐉🐲]/u)
  await contextAction('Compress context','Compress chat')
  const compressed = await saved()
  console.log('Compressed memory:', compressed.messages)
  const recall = await ask('Какую сумму выручки мы получили в первом расчёте?')
  await contextAction('Clear context','Clear chat')
  const finalBook = await saved()
  const sheet = finalBook.snapshot.sheets[finalBook.snapshot.sheetOrder[0]]
  const formula = sheet.cellData[1]?.[25]
  const filled = Object.entries(sheet.cellData).flatMap(([r,row]) =>
    Object.entries(row).filter(([,cell]) => (typeof cell.s === 'string' ? finalBook.snapshot.styles[cell.s] : cell.s)?.bg?.rgb)
      .map(([c]) => [Number(r), Number(c)]))
  const ys=filled.map(p=>p[0]), xs=filled.map(p=>p[1])
  const limits = [Math.min(...ys), Math.max(...ys), Math.min(...xs), Math.max(...xs)]
  console.log('Formula and cached result:', formula, 'Painted bounds (zero-based):', limits, 'Messages after clear:', finalBook.messages.length)
  assert.ok(numberIn(first,total), 'Incorrect first calculation')
  assert.ok(numberIn(formulaAnswer,total / weeks.length))
  assert.equal(formula.v, total / weeks.length)
  assert.match(formula.f, /^=/)
  assert.ok(filled.length > 30)
  assert.ok(Math.abs((limits[0]+limits[1])/2-10)<=2 && Math.abs((limits[2]+limits[3])/2-12.5)<=2, 'Picture is not centered over A1:Z21')
  for (const [r,row] of rows.entries()) for (const [c,value] of row.entries()) assert.equal(sheet.cellData[r][c].v,value)
  assert.equal(compressed.messages.length,1)
  assert.equal(compressed.messages[0].role,'summary')
  assert.ok(numberIn(compressed.messages[0].text,total))
  assert.ok(numberIn(recall,total))
  assert.equal(finalBook.messages.length,0)
  assert.equal(await page.locator('.msg').count(),0)
  console.log('PASS single-session revenue workflow')
} finally { await app.close() }
