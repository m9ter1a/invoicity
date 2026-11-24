// Only accept a complete, single-currency statement with a recognized header and
// one receipt per line. Other file layouts go through the general planner.
function weeklyStatement(file) {
  if (!file || file.partial || !/\.pdf$/i.test(file.name)) return null
  const lines = file.text.trim().split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const header = lines.findIndex(line => /^reference\s+date\s+period\s+region\s+amount$/i.test(line))
  if (header < 0 || !lines.slice(0, header).some(line => /\bUSD\b/.test(line))) return null
  const weeks = new Map(), regions = new Set(), references = new Set()
  for (const line of lines.slice(header + 1)) {
    if (/^(?:sample statement\s+)?\d+\s*\/\s*\d+$/i.test(line)) continue
    const match = /^(\S+)\s+[A-Za-z]{3}\s+\d{1,2}\s+Week\s+(\d{1,2})\s+([\p{L}][\p{L} .&'’-]*)\s+(-?)\$(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{2}))?$/iu.exec(line)
    if (!match) return null
    const [, reference, period, label, sign, dollars, cents = '00'] = match
    const region = label.trim().replace(/\s+/g, ' ')
    if (references.has(reference)) return null
    references.add(reference)
    const week = Number(period)
    if (!weeks.has(week)) weeks.set(week, new Map())
    const totals = weeks.get(week)
    const amount = Number(dollars.replaceAll(',', '') + cents) * (sign ? -1 : 1)
    const sum = (totals.get(region) || 0) + amount
    if (!Number.isSafeInteger(sum)) return null
    totals.set(region, sum)
    regions.add(region)
  }
  return weeks.size && regions.size && regions.size <= 24 ? { weeks, regions: [...regions] } : null
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
