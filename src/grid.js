import { createUniver, LocaleType, mergeLocales } from '@univerjs/presets'
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core'
import coreRu from '@univerjs/preset-sheets-core/locales/ru-RU'
import { UniverSheetsFilterPreset } from '@univerjs/preset-sheets-filter'
import filterRu from '@univerjs/preset-sheets-filter/locales/ru-RU'
import { UniverSheetsSortPreset } from '@univerjs/preset-sheets-sort'
import sortRu from '@univerjs/preset-sheets-sort/locales/ru-RU'
import '@univerjs/preset-sheets-core/lib/index.css'
import '@univerjs/preset-sheets-filter/lib/index.css'
import '@univerjs/preset-sheets-sort/lib/index.css'

export function mountGrid(container, snapshot, onChange) {
  const { univer, univerAPI: api } = createUniver({
    locale: LocaleType.RU_RU,
    darkMode: true,
    locales: { [LocaleType.RU_RU]: mergeLocales(coreRu, filterRu, sortRu) },
    presets: [
      UniverSheetsCorePreset({ container, ribbonType: 'simple' }),
      UniverSheetsFilterPreset(),
      UniverSheetsSortPreset(),
    ],
  })
  let book = api.createWorkbook(snapshot)
  const sub = api.addEvent(api.Event.CommandExecuted, ({ id }) => {
    if (id.includes('.mutation.')) onChange()
  })
  return {
    get book() {
      return book
    },
    snapshot: () => book.save(),
    async finish() {
      await book.endEditingAsync(true)
      await api.getFormula().onCalculationResultApplied(15000)
    },
    restore(snapshot) {
      api.disposeUnit(book.getId())
      book = api.createWorkbook(snapshot)
    },
    dispose() {
      sub.dispose()
      univer.dispose()
    },
  }
}
function col(n) {
  let s = ''
  for (n++; n; n = Math.floor((n - 1) / 26))
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}
export function context(grid) {
  const snap = grid.snapshot(),
    active = grid.book.getActiveSheet(),
    selection = grid.book.getActiveRange()?.getA1Notation() || 'A1'
  const result = {
    name: snap.name,
    active: active.getSheetName(),
    selection,
    sheets: snap.sheetOrder.map((id) => snap.sheets[id].name),
    cells: [],
    partial: false,
  }
  let remaining = 9200
  for (const id of [
    active.getSheetId(),
    ...snap.sheetOrder.filter((id) => id !== active.getSheetId()),
  ]) {
    const sheet = snap.sheets[id]
    for (const [r, row] of Object.entries(sheet.cellData || {})) {
      const cells = Object.entries(row)
        .filter(([, c]) => c.v != null || c.f || c.p)
        .map(
          ([c, cell]) =>
            col(+c) +
            (+r + 1) +
            '=' +
            String(
              cell.f
                ? cell.f + ' → ' + (cell.v ?? '')
                : (cell.p?.body?.dataStream ?? cell.v),
            ).slice(0, 300),
        )
      if (!cells.length) continue
      const line = sheet.name + ' | ' + cells.join(' | ')
      if (line.length > remaining) {
        result.partial = true
        break
      }
      result.cells.push(line)
      remaining -= line.length
    }
  }
  const range = grid.book.getActiveRange()
  if (range && range.getHeight() * range.getWidth() <= 100)
    result.selectedValues = JSON.stringify(range.getValues()).slice(0, 1600)
  return result
}
const check = (b, m) => {
  if (!b) throw Error(m)
}
const validName = (s) =>
  typeof s === 'string' && s.trim() && s.length <= 31 && !/[\\/?*:\[\]]/.test(s)
const integer = (v, min, max) => Number.isInteger(v) && v >= min && v <= max
export function applyPlan(grid, actions) {
  const prior = grid.snapshot()
  try {
    for (const a of actions) {
      const book = grid.book,
        sh = a.sheet ? book.getSheetByName(a.sheet) : book.getActiveSheet()
      if (a.op === 'addSheet') {
        check(
          validName(a.name) && !book.getSheetByName(a.name),
          'Занятое или недопустимое имя листа.',
        )
        book.insertSheet(a.name)
        continue
      }
      check(sh, 'Лист из предложения отсутствует.')
      if (a.op === 'renameSheet') {
        check(
          validName(a.name) && !book.getSheetByName(a.name),
          'Проверьте имя листа.',
        )
        sh.setName(a.name)
        continue
      }
      if (
        [
          'insertRows',
          'deleteRows',
          'insertColumns',
          'deleteColumns',
          'columnWidth',
          'rowHeight',
          'freezeRows',
          'freezeColumns',
        ].includes(a.op)
      ) {
        const rows = /Rows|rowHeight/.test(a.op),
          limit = rows ? sh.getMaxRows() : sh.getMaxColumns()
        check(
          integer(a.index, 1, limit) &&
            integer(a.count, a.op.startsWith('freeze') ? 0 : 1, 1000),
          'Недопустимый индекс или количество.',
        )
        if (a.op.startsWith('delete'))
          check(
            a.index + a.count - 1 <= limit && a.count < limit,
            'Диапазон удаления выходит за лист.',
          )
        if (a.op === 'columnWidth') sh.setColumnWidth(a.index - 1, a.count)
        else if (a.op === 'rowHeight') sh.setRowHeight(a.index - 1, a.count)
        else if (a.op === 'freezeRows') sh.setFrozenRows(a.count)
        else if (a.op === 'freezeColumns') sh.setFrozenColumns(a.count)
        else sh[a.op](a.index - 1, a.count)
        continue
      }
      check(
        typeof a.range === 'string' &&
          /^[A-Z]{1,3}[1-9]\d{0,4}(:[A-Z]{1,3}[1-9]\d{0,4})?$/i.test(a.range),
        'Модель предложила некорректный адрес ячейки.',
      )
      let range = sh.getRange(a.range)
      if (a.op === 'write') {
        const matrix = a.values
        check(
          Array.isArray(matrix) &&
            Array.isArray(matrix[0]) &&
            matrix[0].length > 0 &&
            matrix.every(
              (r) =>
                Array.isArray(r) &&
                r.length === matrix[0].length &&
                r.every(
                  (v) =>
                    v === null ||
                    ['string', 'number', 'boolean'].includes(typeof v),
                ),
            ),
          'Модель предложила некорректные значения.',
        )
        range = sh.getRange(
          range.getRow(),
          range.getColumn(),
          matrix.length,
          matrix[0].length,
        )
      }
      check(
        range.getHeight() * range.getWidth() <= 50000 &&
          range.getLastRow() < sh.getMaxRows() &&
          range.getLastColumn() < sh.getMaxColumns(),
        'Диапазон выходит за пределы листа.',
      )
      switch (a.op) {
        case 'write':
          range.setValues(
            a.values.map((row) =>
              row.map((v) =>
                typeof v === 'string' && v.startsWith('=') ? { f: v } : v,
              ),
            ),
          )
          break
        case 'clear':
          range.clearContent()
          break
        case 'bold':
          range.setFontWeight('bold')
          break
        case 'italic':
          range.setFontStyle('italic')
          break
        case 'merge':
          range.merge()
          break
        case 'unmerge':
          range.breakApart()
          break
        case 'filter':
          check(
            range.createFilter(),
            'Фильтр уже есть или диапазон не подходит.',
          )
          break
        case 'sort':
          check(
            integer(a.index, range.getColumn() + 1, range.getLastColumn() + 1),
            'Проверьте столбец сортировки.',
          )
          range.sort({ column: a.index - 1, ascending: a.ascending !== false })
          break
        case 'format':
          check(
            typeof a.value === 'string' && a.value.length <= 150,
            'Некорректный формат.',
          )
          range.setNumberFormat(a.value)
          break
        case 'fill':
          check(/^#[0-9a-f]{6}$/i.test(a.value), 'Некорректный цвет.')
          range.setBackgroundColor(a.value)
          break
        case 'align':
          check(
            ['left', 'center', 'right'].includes(a.value),
            'Некорректное выравнивание.',
          )
          range.setHorizontalAlignment(a.value)
          break
        default:
          throw Error('Неизвестное действие модели.')
      }
    }
  } catch (e) {
    grid.restore(prior)
    throw e
  }
}
