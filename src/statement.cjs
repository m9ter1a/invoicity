const { readLedger } = require('./ledger.cjs')
// Only accept a complete, single-currency statement with a recognized header and
// one receipt per line. Other file layouts go through the general planner.
function weeklyStatement(file) {
  if (!file || file.partial) return null
  const records = readLedger(file)
  if (!records) return null
  const weeks = new Map(), regions = new Set()
  for (const row of records) {
    const period = /^(?:week\s+)?(\d{1,2})$/i.exec(row.period || '')
    if (!period || !row.region || row.currency !== 'USD') return null
    const week = Number(period[1])
    if (!weeks.has(week)) weeks.set(week,new Map())
    const amounts=weeks.get(week)
    const sum=(amounts.get(row.region) || 0) + row.cents
    if (!Number.isSafeInteger(sum)) return null
    regions.add(row.region)
    amounts.set(row.region,sum)
  }
  return weeks.size && regions.size<=24 ? {weeks,regions:[...regions]} : null
}

// Match complete requests only. Extra instructions (filters, formulas, a destination,
// etc.) still belong to the general planner.
function requestedColumns(question, regions) {
  const text = question.trim().replace(/[.!]+$/, '').replace(/\s+/g, ' ')
  const report = /^(?:please )?(?:(?:turn|convert) (?:this|the|my) (?:pdf|file|statement) into (?:a |a new )?|(?:build|create|make|generate) (?:me )?(?:a |a new )?)weekly revenue (?:table|report|summary)(?: from (?:this|the|my) (?:pdf|file|statement))?(.*)$/i.exec(text)
  if (!report) return null
  const layout = report[1].trim()
  if (/^(?:(?:with )?(?:one|a) column (?:per|for each) region|by region|broken down by region)$/i.test(layout)) return regions
  const list = /^[.,;]?\s*(?:with )?(?:columns|coulmns)\s*:\s*week\s*,\s*(.+?)(?:,\s*use USD amounts)?$/i.exec(layout)
  if (!list) return null
  const columns = list[1].split(/\s*,\s*/).map(label =>
    regions.find(region => region.toLowerCase() === label.toLowerCase()))
  return columns.every(Boolean) && new Set(columns).size === columns.length ? columns : null
}

function weeklyTable(statement, columns, sheet, existingSheets = []) {
  const actions = []
  if (existingSheets.length) {
    const names = new Set(existingSheets.map(name => name.toLowerCase()))
    sheet = 'Weekly revenue'
    for (let n = 2; names.has(sheet.toLowerCase()); n++) sheet = 'Weekly revenue ' + n
    actions.push({op: 'addSheet', name: sheet})
  }
  const values = [['Week', ...columns]]
  for (const [week, amounts] of [...statement.weeks].sort(([a], [b]) => a - b))
    values.push(['Week ' + week, ...columns.map(region => (amounts.get(region) || 0) / 100)])
  const end = String.fromCharCode(65 + columns.length)
  return {
    message: 'Created the weekly revenue table on ' + sheet + '.',
    actions: [
      ...actions,
      { op: 'write', sheet, range: 'A1', values },
      { op: 'bold', sheet, range: 'A1:' + end + '1' },
      { op: 'format', sheet, range: 'B2:' + end + values.length, value: '"$"#,##0.00' },
    ],
  }
}
module.exports = { weeklyStatement, requestedColumns, weeklyTable }
