const fs = require('node:fs')
const path = require('node:path')
const { isDeepStrictEqual } = require('node:util')
const { createBook } = require('./books.cjs')
// Upgrade only the untouched sample shipped in 0.1. User workbooks keep their own language.
function localizeSample(book) {
  if (
    !book.demo ||
    book.name !== 'Пример инвойса' ||
    book.messages.length ||
    book.snapshot.sheetOrder.length !== 1
  )
    return book
  const sheet = book.snapshot.sheets[book.snapshot.sheetOrder[0]]
  if (sheet.name !== 'Инвойс') return book
  const sample = createBook('invoice', 'Sample invoice', true)
  const english = sample.snapshot.sheets[sample.snapshot.sheetOrder[0]]
  const expected = structuredClone(english)
  const oldRows = [
    ['Инвойс', '№'],
    ['Дата', sheet.cellData?.[1]?.[1]?.v],
    ['Поставщик', 'Студия «Пример»'],
    ['Покупатель', 'Компания «Образец»'],
    ['Валюта'],
    [],
    ['Наименование', 'Количество', 'Цена', 'Сумма'],
    ['Аналитические услуги'],
    ['Подготовка отчёта'],
    [],
    [],
    ['Итого'],
  ]
  oldRows.forEach((row, r) =>
    row.forEach((value, c) => {
      expected.cellData[r][c].v = value
    }),
  )
  for (const cell of Object.values(expected.cellData[6]))
    cell.s.bg.rgb = '#39483f'
  expected.id = sheet.id
  expected.name = sheet.name
  if (
    !isDeepStrictEqual(sheet, expected) ||
    Object.keys(book.snapshot.styles || {}).length
  )
    return book
  english.id = sheet.id
  english.cellData[1][1].v = sheet.cellData[1][1].v
  book.name = book.snapshot.name = sample.name
  book.snapshot.locale = sample.snapshot.locale
  book.snapshot.sheets[sheet.id] = english
  return book
}
function storage(dir) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  const file = (id) => {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw Error('Invalid document ID')
    return path.join(dir, id + '.json')
  }
  const read = (id) =>
    localizeSample(JSON.parse(fs.readFileSync(file(id), 'utf8')))
  const write = (book) => {
    if (!book.name?.trim() || !book.snapshot?.sheetOrder?.length)
      throw Error('The workbook needs a name and at least one sheet.')
    const dst = file(book.id),
      temp = dst + '.tmp'
    fs.writeFileSync(temp, JSON.stringify(book), { mode: 0o600, flush: true })
    fs.renameSync(temp, dst)
  }
  return {
    file,
    read,
    save(book) {
      book.updated = new Date().toISOString()
      write(book)
      return book.updated
    },
    toggleStar(id) {
      const book = read(id)
      book.star = !book.star
      write(book)
      return book.star
    },
    list: () =>
      fs
        .readdirSync(dir)
        .filter((x) => x.endsWith('.json'))
        .map((x) => {
          const { snapshot, messages, ...meta } = read(x.slice(0, -5))
          return { ...meta, sheets: snapshot.sheetOrder.length }
        })
        .sort((a, b) => b.updated.localeCompare(a.updated)),
  }
}
module.exports = { storage }
