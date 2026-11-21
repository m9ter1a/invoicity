const XLSX = require('xlsx')
const Excel = require('exceljs')
const Papa = require('papaparse')
const {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  WidthType,
  HeadingLevel,
} = require('docx')
const { createBook, sheetFromRows, textValue } = require('./books.cjs')
const path = require('node:path')
const fs = require('node:fs/promises')

function checkBounds(r, c) {
  if (r >= 100000 || c >= 1000)
    throw Error(
      'Sheets can contain up to 100,000 rows and 1,000 columns.',
    )
}
const argb = (color) => (color?.argb ? '#' + color.argb.slice(-6) : undefined)
async function importBook(filename) {
  const data = await fs.readFile(filename),
    ext = path.extname(filename).slice(1).toLowerCase()
  const book = createBook(
    'blank',
    path.basename(filename, path.extname(filename)),
  )
  const snap = book.snapshot
  snap.sheetOrder = []
  snap.sheets = {}
  function add(sheet) {
    snap.sheetOrder.push(sheet.id)
    snap.sheets[sheet.id] = sheet
  }
  if (['csv', 'tsv'].includes(ext)) {
    const parsed = Papa.parse(data.toString('utf8').replace(/^\uFEFF/, ''), {
      delimiter: ext === 'tsv' ? '\t' : '',
      skipEmptyLines: 'greedy',
    })
    if (parsed.errors.some((e) => e.code === 'MissingQuotes'))
      throw Error('The CSV contains an unclosed quotation mark.')
    const rows = parsed.data.map((row) =>
      row.map((v) =>
        /^-?(0|[1-9]\d*)(\.\d+)?$/.test(v) && v.length < 16 ? Number(v) : v,
      ),
    )
    rows.forEach((row, r) => checkBounds(r, row.length - 1))
    add(sheetFromRows('Sheet 1', rows))
  } else {
    const wb = XLSX.read(data, {
      type: 'buffer',
      cellNF: true,
      cellStyles: true,
    })
    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name],
        sh = sheetFromRows(name, [])
      for (const [address, source] of Object.entries(ws)) {
        if (address.startsWith('!') || source.t === 'z') continue
        const { r, c } = XLSX.utils.decode_cell(address)
        checkBounds(r, c)
        const cell = {
          v: source.t === 'e' ? source.w : source.v,
          t: source.t === 'n' ? 2 : source.t === 'b' ? 3 : 1,
        }
        if (source.f) cell.f = '=' + source.f
        if (source.z && source.z !== 'General')
          cell.s = { n: { pattern: source.z } }
        ;(sh.cellData[r] ||= {})[c] = cell
        sh.rowCount = Math.max(sh.rowCount, r + 20)
        sh.columnCount = Math.max(sh.columnCount, c + 4)
      }
      sh.mergeData = (ws['!merges'] || []).map(({ s, e }) => ({
        startRow: s.r,
        endRow: e.r,
        startColumn: s.c,
        endColumn: e.c,
      }))
      sh.columnData = Object.fromEntries(
        (ws['!cols'] || []).flatMap((col, i) =>
          col
            ? [[i, { w: col.wpx || Math.round((col.wch || 16) * 7 + 5) }]]
            : [],
        ),
      )
      add(sh)
    }
    if (ext === 'xlsx') {
      const excel = new Excel.Workbook()
      await excel.xlsx.load(data)
      for (const id of snap.sheetOrder) {
        const sh = snap.sheets[id],
          ws = excel.getWorksheet(sh.name)
        ws?.eachRow((row, r) =>
          row.eachCell((cell, c) => {
            const target = sh.cellData[r - 1]?.[c - 1]
            if (!target) return
            const s = { ...target.s },
              font = cell.font || {}
            if (font.bold) s.bl = 1
            if (font.italic) s.it = 1
            if (font.size) s.fs = font.size
            if (argb(font.color)) s.cl = { rgb: argb(font.color) }
            if (cell.fill?.pattern === 'solid' && argb(cell.fill.fgColor))
              s.bg = { rgb: argb(cell.fill.fgColor) }
            if (Object.keys(s).length) target.s = s
          }),
        )
      }
    }
  }
  if (!snap.sheetOrder.length) throw Error('The file contains no sheets.')
  book.kind = 'import'
  return book
}
function style(snap, cell) {
  return typeof cell?.s === 'string'
    ? snap.styles?.[cell.s] || {}
    : cell?.s || {}
}
function displayed(snap, cell) {
  const value = textValue(cell),
    pattern = style(snap, cell).n?.pattern
  if (typeof value === 'number' && pattern) {
    try {
      return XLSX.SSF.format(pattern, value)
    } catch {}
  }
  return String(value)
}
function values(snap, sh) {
  const out = []
  for (const [r, row] of Object.entries(sh.cellData || {}))
    for (const [c, cell] of Object.entries(row)) {
      if (cell.v == null && !cell.f && !cell.p) continue
      ;(out[r] ||= [])[c] = displayed(snap, cell)
    }
  return Array.from(out, (x) => Array.from(x || [], (v) => v ?? ''))
}
function toExcel(snap) {
  const wb = new Excel.Workbook()
  wb.calcProperties.fullCalcOnLoad = true
  for (const id of snap.sheetOrder) {
    const sh = snap.sheets[id],
      ws = wb.addWorksheet(sh.name)
    for (const [r, row] of Object.entries(sh.cellData || {}))
      for (const [c, src] of Object.entries(row)) {
        const cell = ws.getCell(+r + 1, +c + 1),
          v = textValue(src),
          s = style(snap, src)
        cell.value = src.f ? { formula: src.f.replace(/^=/, ''), result: v } : v
        if (s.n?.pattern) cell.numFmt = s.n.pattern
        const rgb = (v) => 'FF' + v.replace('#', '')
        cell.font = {
          bold: !!s.bl,
          italic: !!s.it,
          size: s.fs || 11,
          ...(s.cl?.rgb ? { color: { argb: rgb(s.cl.rgb) } } : {}),
        }
        if (s.bg?.rgb)
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: rgb(s.bg.rgb) },
          }
      }
    for (const m of sh.mergeData || [])
      ws.mergeCells(
        m.startRow + 1,
        m.startColumn + 1,
        m.endRow + 1,
        m.endColumn + 1,
      )
    for (const [c, dim] of Object.entries(sh.columnData || {}))
      if (dim.w) ws.getColumn(+c + 1).width = Math.max(1, (dim.w - 5) / 7)
  }
  return wb
}
async function exportBytes(snap, ext, activeId) {
  const sh = snap.sheets[activeId] || snap.sheets[snap.sheetOrder[0]]
  if (ext === 'xlsx') return toExcel(snap).xlsx.writeBuffer()
  if (ext === 'csv' || ext === 'tsv')
    return Buffer.from(
      '\uFEFF' +
        Papa.unparse(values(snap, sh), {
          delimiter: ext === 'tsv' ? '\t' : ',',
          escapeFormulae: true,
        }),
    )
  if (ext === 'ods' || ext === 'xls') {
    const wb = XLSX.utils.book_new()
    for (const id of snap.sheetOrder) {
      const sheet = snap.sheets[id],
        ws = {}
      let maxR = 0,
        maxC = 0
      for (const [r, row] of Object.entries(sheet.cellData || {}))
        for (const [c, cell] of Object.entries(row)) {
          const v = textValue(cell)
          ws[XLSX.utils.encode_cell({ r: +r, c: +c })] = {
            v,
            t: typeof v === 'number' ? 'n' : typeof v === 'boolean' ? 'b' : 's',
            f: cell.f?.replace(/^=/, ''),
            z: style(snap, cell).n?.pattern,
          }
          maxR = Math.max(maxR, +r)
          maxC = Math.max(maxC, +c)
        }
      ws['!ref'] = XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: maxR, c: maxC },
      })
      XLSX.utils.book_append_sheet(wb, ws, sheet.name)
    }
    return XLSX.write(wb, {
      bookType: ext === 'xls' ? 'biff8' : 'ods',
      type: 'buffer',
    })
  }
  if (ext === 'docx') {
    const sections = snap.sheetOrder.map((id) => {
      const sheet = snap.sheets[id],
        rows = values(snap, sheet)
      const cols = Math.max(1, ...rows.map((r) => r.length))
      if (cols * Math.max(1, rows.length) > 150000)
        throw Error('Use XLSX to export a workbook of this size.')
      return {
        children: [
          new Paragraph({ text: sheet.name, heading: HeadingLevel.HEADING_1 }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: (rows.length ? rows : [[]]).map(
              (row) =>
                new TableRow({
                  children: Array.from(
                    { length: cols },
                    (_, i) =>
                      new TableCell({
                        children: [new Paragraph(row[i] || '')],
                      }),
                  ),
                }),
            ),
          }),
        ],
      }
    })
    return Packer.toBuffer(new Document({ sections }))
  }
  throw Error('Unsupported export format.')
}
function printHTML(snap) {
  const escape = (v) =>
    String(v)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
  return (
    '<meta charset="utf-8"><style>@page{size:A4 landscape;margin:14mm}body{font:11px Helvetica;color:#202422}section+section{break-before:page}td{border:1px solid #c5c9c6;padding:5px;overflow-wrap:anywhere}table{border-collapse:collapse;width:100%}tr{break-inside:avoid}</style>' +
    snap.sheetOrder
      .map((id) => {
        const sheet = snap.sheets[id]
        return (
          '<section><h1>' +
          escape(snap.name) +
          '</h1><h2>' +
          escape(sheet.name) +
          '</h2><table>' +
          values(snap, sheet)
            .map(
              (row) =>
                '<tr>' +
                row.map((v) => '<td>' + escape(v) + '</td>').join('') +
                '</tr>',
            )
            .join('') +
          '</table></section>'
        )
      })
      .join('')
  )
}
module.exports = { importBook, exportBytes, printHTML, values }
