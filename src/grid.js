import {
  createUniver,
  defaultTheme,
  LocaleType,
  mergeLocales,
} from '@univerjs/presets'
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core'
import coreEn from '@univerjs/preset-sheets-core/locales/en-US'
import { UniverSheetsFilterPreset } from '@univerjs/preset-sheets-filter'
import filterEn from '@univerjs/preset-sheets-filter/locales/en-US'
import { UniverSheetsSortPreset } from '@univerjs/preset-sheets-sort'
import sortEn from '@univerjs/preset-sheets-sort/locales/en-US'
import '@univerjs/preset-sheets-core/lib/index.css'
import '@univerjs/preset-sheets-filter/lib/index.css'
import '@univerjs/preset-sheets-sort/lib/index.css'

// Theme only the editor chrome. Imported cell and fill colors belong to the document.
const neutral = {
  0: '#ffffff',
  50: '#fafafa',
  100: '#eeeeee',
  200: '#dfdfdf',
  300: '#bcbcbc',
  400: '#aaaaaa',
  500: '#949494',
  600: '#686868',
  700: '#3b3b3b',
  800: '#242424',
  900: '#191919',
  1000: '#080808',
}
const theme = {
  ...defaultTheme,
  gray: neutral,
  primary: neutral,
  blue: neutral,
  red: neutral,
  orange: neutral,
  yellow: neutral,
  green: neutral,
  jiqing: neutral,
  indigo: neutral,
  purple: neutral,
  pink: neutral,
}
export function mountGrid(container, snapshot, onChange, darkMode) {
  const { univer, univerAPI: api } = createUniver({
    locale: LocaleType.EN_US,
    darkMode,
    theme,
    locales: { [LocaleType.EN_US]: mergeLocales(coreEn, filterEn, sortEn) },
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
    setDark: dark => api.toggleDarkMode(dark),
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
function visibleColors(sheet) {
  const view = sheet.getVisibleRange()
  if (!view) return { rows: [] }
  const { startRow, startColumn } = view
  const height = Math.min(32, view.endRow - startRow + 1, sheet.getMaxRows() - startRow)
  const width = Math.min(32, view.endColumn - startColumn + 1, sheet.getMaxColumns() - startColumn)
  const range = sheet.getRange(startRow, startColumn, height, width)
  const symbols = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const keys = new Map(), legend = {}
  const rows = range.getBackgrounds().map(row => row.map(fill => {
    if (!fill || /^#(?:fff|ffffff)$/i.test(fill)) return '.'
    if (!keys.has(fill)) {
      if (keys.size >= symbols.length) return '?'
      const key = symbols[keys.size]
      keys.set(fill, key)
      legend[key] = fill
    }
    return keys.get(fill)
  }).join(''))
  return { origin: col(startColumn) + (startRow + 1), legend, rows }
}
export function context(grid) {
  const snap = grid.snapshot(),
    active = grid.book.getActiveSheet(),
    selection = grid.book.getActiveRange()?.getA1Notation() || 'A1'
  const result = {
    workbookName: snap.name,
    active: active.getSheetName(),
    selection,
    visual: visibleColors(active),
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
function paintPattern(sh, range, action, sheetData) {
  const face = action.value ?? '#ffcc33'
  const rgb = [1, 3, 5].map(i => parseInt(String(face).slice(i, i + 2), 16))
  const light = rgb[0] * .299 + rgb[1] * .587 + rgb[2] * .114
  const smiley = action.op === 'smiley'
  const rows = smiley ? ['..FFF..', '.FFFFF.', 'FFIFIFF', 'FFFFFFF', 'FIFFFIF', '.FIIIF.', '..FFF..'] : action.rows
  const palette = smiley ? { F: face, I: light < 106 ? '#fafafa' : '#202020' } : action.palette
  check(Array.isArray(rows) && rows.length && rows.length <= 32 && typeof rows[0] === 'string',
    'The drawing needs between 1 and 32 rows.')
  const width = rows[0].length
  check(width > 0 && width <= 32 && rows.every(row => typeof row === 'string' && row.length === width &&
    [...row].every(c => c === '.' || /^#[a-f0-9]{6}$/i.test(palette?.[c]))), 'Check the drawing size and color palette.')
  const r = range.getRow(), c = range.getColumn()
  check(r + rows.length <= sh.getMaxRows() && c + width <= sh.getMaxColumns(), 'The drawing extends beyond the sheet.')
  if (!Object.keys(sheetData?.cellData || {}).length && !Object.keys(sheetData?.columnData || {}).length)
    sh.setColumnWidths(c, width, sh.getRowHeight(r))
  rows.forEach((line, dy) => {
    for (let x = 0; x < width;) {
      const symbol = line[x], start = x++
      while (x < width && line[x] === symbol) x++
      if (symbol !== '.') sh.getRange(r + dy, c + start, 1, x - start).setBackgroundColor(palette[symbol])
    }
  })
}
export function applyPlan(grid, actions) {
  const prior = grid.snapshot()
  try {
    for (const a of actions) {
      const book = grid.book,
        sh = a.sheet ? book.getSheetByName(a.sheet) : book.getActiveSheet()
      if (a.op === 'addSheet') {
        check(
          validName(a.name) && !book.getSheetByName(a.name),
          'This sheet name is invalid or already in use.',
        )
        book.insertSheet(a.name)
        continue
      }
      check(sh, 'The proposed sheet could not be found.')
      if (a.op === 'renameSheet') {
        check(
          validName(a.name) && !book.getSheetByName(a.name),
          'Check the sheet name.',
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
          'Invalid position or count.',
        )
        if (a.op.startsWith('delete'))
          check(
            a.index + a.count - 1 <= limit && a.count < limit,
            'The deletion extends beyond the sheet.',
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
        'The proposed cell address is invalid.',
      )
      let range = sh.getRange(a.range)
      if (a.op === 'smiley' || a.op === 'pixelArt') {
        paintPattern(sh, range, a, sh.getSheet().getSnapshot())
        continue
      }
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
          'The proposed cell values are invalid.',
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
        'The range extends beyond the sheet.',
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
            'A filter already exists or the range is invalid.',
          )
          break
        case 'sort':
          check(
            integer(a.index, range.getColumn() + 1, range.getLastColumn() + 1),
            'Check the sort column.',
          )
          range.sort({ column: a.index - 1, ascending: a.ascending !== false })
          break
        case 'format':
          check(
            typeof a.value === 'string' && a.value.length <= 150,
            'Invalid number format.',
          )
          range.setNumberFormat(a.value)
          break
        case 'fill':
          check(/^#[0-9a-f]{6}$/i.test(a.value), 'Invalid color.')
          range.setBackgroundColor(a.value)
          break
        case 'align':
          check(
            ['left', 'center', 'right'].includes(a.value),
            'Invalid alignment.',
          )
          range.setHorizontalAlignment(a.value)
          break
        default:
          throw Error('Unsupported assistant action.')
      }
    }
  } catch (e) {
    grid.restore(prior)
    throw e
  }
}
