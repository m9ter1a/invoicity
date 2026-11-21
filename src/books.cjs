const { randomUUID } = require('node:crypto')

function sheetFromRows(name, rows, widths = []) {
  const cellData = {}
  for (const [r, row] of rows.entries()) {
    row.forEach((value, c) => {
      if (value == null || value === '') return
      const cell =
        typeof value === 'object'
          ? value
          : { v: value, t: typeof value === 'number' ? 2 : 1 }
      ;(cellData[r] ||= {})[c] = cell
    })
  }
  return {
    id: randomUUID(),
    name,
    rowCount: Math.max(200, rows.length + 20),
    columnCount: rows.reduce((max, row) => Math.max(max, row.length), 26),
    cellData,
    defaultColumnWidth: 116,
    defaultRowHeight: 26,
    columnData: Object.fromEntries(widths.map((w, i) => [i, { w }])),
  }
}
const rubric = { bg: { rgb: '#39483f' }, cl: { rgb: '#ffffff' }, bl: 1 }
const money = { n: { pattern: '#,##0.00' } }
const heading = (v) => ({ v, t: 1, s: rubric })
const formula = (f) => ({ f, s: money })
function createBook(kind = 'blank', name, demo = false) {
  const id = randomUUID()
  const today = new Date().toLocaleDateString('ru-RU')
  const invoice = [
    [{ v: 'Инвойс', t: 1, s: { fs: 21, bl: 1 } }, '№', demo ? 'DEMO-001' : ''],
    ['Дата', today],
    ['Поставщик', demo ? 'Студия «Пример»' : ''],
    ['Покупатель', demo ? 'Компания «Образец»' : ''],
    ['Валюта', 'RUB'],
    [],
    ['Наименование', 'Количество', 'Цена', 'Сумма'].map(heading),
    [
      demo ? 'Аналитические услуги' : '',
      demo ? 4 : null,
      demo ? 2500 : null,
      formula('=ROUND(B8*C8,2)'),
    ],
    [
      demo ? 'Подготовка отчёта' : '',
      demo ? 2 : null,
      demo ? 1800 : null,
      formula('=ROUND(B9*C9,2)'),
    ],
    ['', null, null, formula('=ROUND(B10*C10,2)')],
    [],
    ['Итого', null, null, formula('=SUM(D8:D10)')],
  ]
  const register = [
    ['Номер инвойса', 'Поставщик', 'Дата', 'Сумма', 'Валюта', 'Статус'].map(
      heading,
    ),
  ]
  const sh =
    kind === 'invoice'
      ? sheetFromRows('Инвойс', invoice, [235, 160, 140, 154])
      : kind === 'register'
        ? sheetFromRows('Реестр', register, [160, 220, 140, 150, 110, 155])
        : sheetFromRows('Лист 1', [])
  const title =
    name ||
    {
      invoice: 'Новый инвойс',
      register: 'Реестр инвойсов',
      blank: 'Без названия',
    }[kind]
  return {
    id,
    name: title,
    kind,
    star: false,
    demo,
    updated: new Date().toISOString(),
    messages: [],
    snapshot: {
      id,
      name: title,
      appVersion: '1.6.0',
      locale: 'ruRU',
      styles: {},
      sheetOrder: [sh.id],
      sheets: { [sh.id]: sh },
    },
  }
}
function label(c) {
  let s = ''
  for (c++; c; c = Math.floor((c - 1) / 26))
    s = String.fromCharCode(65 + ((c - 1) % 26)) + s
  return s
}
function textValue(cell) {
  if (!cell) return ''
  if (cell.p?.body?.dataStream) return cell.p.body.dataStream.trimEnd()
  if (cell.t === 3) return Boolean(cell.v)
  return cell.v ?? ''
}
function sheetRows(sheet) {
  const entries = Object.entries(sheet.cellData || {})
  const height = entries.reduce((m, [r]) => Math.max(m, Number(r) + 1), 0)
  const rows = Array.from({ length: height }, () => [])
  for (const [r, cells] of entries)
    for (const [c, cell] of Object.entries(cells)) rows[r][c] = textValue(cell)
  return rows
}
function audit(snapshot) {
  const issues = []
  let tested = 0
  for (const sheet of Object.values(snapshot.sheets)) {
    const rows = sheetRows(sheet),
      seen = new Map()
    const say = (r, c, msg) =>
      issues.push(sheet.name + '!' + label(c) + (r + 1) + ' — ' + msg)
    let qty = -1,
      price = -1,
      total = -1,
      number = -1,
      supplier = -1,
      item = -1,
      expectedTotal = 0,
      lines = 0
    rows.forEach((row, r) => {
      const norm = row.map((v) =>
        String(v ?? '')
          .trim()
          .toLowerCase(),
      )
      if (norm.includes('количество') || norm.includes('qty')) {
        qty = norm.findIndex((v) => ['количество', 'qty'].includes(v))
        price = norm.findIndex((v) =>
          ['цена', 'price', 'unit price'].includes(v),
        )
        total = norm.findIndex((v) => ['сумма', 'amount', 'total'].includes(v))
        item = norm.findIndex((v) =>
          ['наименование', 'description', 'item'].includes(v),
        )
        return
      }
      if (norm.includes('номер инвойса')) {
        number = norm.indexOf('номер инвойса')
        supplier = norm.indexOf('поставщик')
        return
      }
      if (number >= 0 && row.some((v) => v !== '' && v != null)) {
        tested++
        const n = String(row[number] ?? '').trim()
        const k =
          String(row[supplier] ?? '')
            .trim()
            .toLowerCase() +
          '|' +
          n.toLowerCase()
        if (!n) say(r, number, 'Отсутствует номер инвойса.')
        else if (seen.has(k))
          say(
            r,
            number,
            'Повтор номера у того же поставщика, первая запись в строке ' +
              seen.get(k) +
              '.',
          )
        else seen.set(k, r + 1)
      }
      if (
        total >= 0 &&
        lines &&
        ['итого', 'total', 'subtotal'].includes(norm[0])
      ) {
        tested++
        if (
          typeof row[total] !== 'number' ||
          Math.abs(expectedTotal - row[total]) >= 0.009
        )
          say(
            r,
            total,
            'Сумма проверенных позиций ' +
              expectedTotal.toFixed(2) +
              ', указан итог ' +
              String(row[total] ?? 'пусто') +
              '.',
          )
      }
      if (
        qty >= 0 &&
        price >= 0 &&
        total >= 0 &&
        (row[qty] || row[price] || row[item]) &&
        !['итого', 'total', 'subtotal'].includes(norm[0])
      ) {
        tested++
        const q = row[qty],
          p = row[price],
          t = row[total]
        if (typeof t === 'number') {
          expectedTotal += t
          lines++
        }
        if ([q, p, t].some((x) => typeof x !== 'number' || !Number.isFinite(x)))
          say(r, total, 'Проверьте числовые значения количества, цены и суммы.')
        else if (Math.abs(Math.round(q * p * 100) / 100 - t) >= 0.009)
          say(
            r,
            total,
            'Ожидаемая сумма ' + (q * p).toFixed(2) + ', указано ' + t + '.',
          )
      }
      if (
        ['поставщик', 'покупатель', 'дата', 'валюта'].includes(norm[0]) &&
        row.length <= 2
      ) {
        tested++
        if (!row[1]) say(r, 1, 'Поле «' + row[0] + '» пустое.')
      }
      for (const [c, v] of Object.entries(row))
        if (
          /^#(REF!|DIV\/0!|VALUE!|N\/A|NAME\?|NUM!|NULL!|SPILL!)/.test(
            String(v),
          )
        )
          say(r, Number(c), 'Ошибка формулы ' + v + '.')
    })
  }
  return { tested, issues }
}
module.exports = {
  createBook,
  sheetFromRows,
  sheetRows,
  textValue,
  label,
  audit,
}
