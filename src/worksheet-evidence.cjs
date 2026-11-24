// Exact cell reads supplement the bounded preview sent to the local model.
const address = String.raw`\$?[A-Z]{1,3}\$?[1-9]\d{0,6}`
const qualifier = String.raw`(?:'(?:[^']|'')+'|[\p{L}_][\p{L}\p{N}_.]*)!`
const reference = '(?:' + qualifier + ')?' + address
const pattern = source => new RegExp(source, 'iu')
const inspect = pattern('^(?:what (?:formula is in|is the (?:formula|value) (?:in|of)|is in)|show (?:me )?(?:the )?(?:value|formula) (?:in|of)) (?:cell )?(' + reference + ')$')
const growth = pattern('^(?:(?:what is|what was|calculate|compute) (?:the )?)?(?:percentage|percent|%) (?:change|growth) from (' + reference + ') to (' + reference + ')$')
const share = pattern('^what (?:percentage|percent|%) of (' + reference + ') is (' + reference + ')$')
const lookup = /^(?:look up|find) (?:"([^"]+)"|'([^']+)') in column ([a-z]{1,3}) (?:and (?:return|show)|and give me) (?:the value (?:in|from) )?column ([a-z]{1,3})$/i
function columnIndex(letters) {
  return [...letters.toUpperCase()].reduce((n, char) => n * 26 + char.charCodeAt(0) - 64, 0) - 1
}
function valueOf(cell) {
  if (cell?.t === 3 && cell.v != null) return Boolean(cell.v)
  return cell?.p?.body?.dataStream?.trimEnd() ?? cell?.v ?? null
}
function read(snapshot, active, token) {
  const split = token.lastIndexOf('!')
  const name = split < 0 ? active : token.slice(0, split).replace(/^'|'$/g, '').replaceAll("''", "'")
  const position = token.slice(split + 1).replaceAll('$', '').toUpperCase()
  const [, letters, digits] = /^([A-Z]+)(\d+)$/.exec(position)
  const row = Number(digits) - 1, col = columnIndex(letters)
  const sheet = snapshot.sheetOrder.map(id => snapshot.sheets[id]).find(s => s.name.toLowerCase() === name.toLowerCase())
  if (!sheet) return {ref:token, error:'Worksheet "' + name + '" could not be found.'}
  const ref = "'" + sheet.name.replaceAll("'", "''") + "'!" + position
  if (row >= sheet.rowCount || col >= sheet.columnCount) return {ref,error:ref + ' is outside the worksheet.'}
  const cell = sheet.cellData?.[row]?.[col]
  return {ref, value:valueOf(cell), ...(cell?.f ? {formula:cell.f} : {})}
}
function describe(cell) {
  if (cell.error) return cell.error
  if (cell.formula) return cell.ref + ' contains ' + cell.formula + (cell.value == null ? ' (result unavailable).' : ' = ' + cell.value + '.')
  return cell.value == null ? cell.ref + ' is empty.' : cell.ref + ' contains ' + cell.value + '.'
}
function percentage(first, second, isGrowth) {
  for (const cell of [first, second]) {
    if (cell.error) return cell.error
    if (!Number.isFinite(cell.value)) return 'A numeric value is required in ' + cell.ref + '.'
  }
  if (first.value === 0) return 'The percentage is undefined because ' + first.ref + ' is zero.'
  const numerator = isGrowth ? second.value - first.value : second.value
  const ratio = numerator / first.value
  if (!Number.isFinite(ratio)) return 'The percentage is outside the supported numeric range.'
  const shown = ratio.toLocaleString('en-US', {style:'percent',maximumFractionDigits:4})
  return isGrowth ? 'The change from ' + first.ref + ' (' + first.value + ') to ' + second.ref + ' (' + second.value + ') is ' + shown + '.'
    : second.ref + ' (' + second.value + ') is ' + shown + ' of ' + first.ref + ' (' + first.value + ').'
}
function lookupValue(snapshot, active, match) {
  const [, doubleQuoted, singleQuoted, source, target] = match
  const key = doubleQuoted ?? singleQuoted
  const sheet = snapshot.sheets[snapshot.sheetOrder.find(id => snapshot.sheets[id].name === active)]
  const col = columnIndex(source)
  if (col >= sheet.columnCount || columnIndex(target) >= sheet.columnCount) return 'One of the requested columns is outside ' + active + '.'
  const matches = []
  for (const [row, cells] of Object.entries(sheet.cellData || {})) {
    const value = valueOf(cells[col])
    if (value != null && String(value).toLowerCase() === key.toLowerCase()) matches.push(Number(row) + 1)
  }
  if (!matches.length) return 'No exact match for "' + key + '" in column ' + source.toUpperCase() + ' on ' + active + '.'
  if (matches.length > 1) return 'Found ' + matches.length + ' matches for "' + key + '" in rows ' + matches.slice(0,10).join(', ') + (matches.length > 10 ? ', …' : '') + '. Which row should I use?'
  return describe(read(snapshot, active, target + matches[0]))
}
function worksheetEvidence(snapshot, active, question) {
  const query = question.trim().replace(/^please\s+/i, '').replace(/[?.!]$/, '').trim()
  const inspectMatch = inspect.exec(query), change = growth.exec(query), fraction = share.exec(query), key = lookup.exec(query)
  let answer
  if (inspectMatch) answer = describe(read(snapshot, active, inspectMatch[1]))
  else if (change || fraction) {
    const [, from, to] = change || fraction
    answer = percentage(read(snapshot, active, from), read(snapshot, active, to), Boolean(change))
  } else if (key) answer = lookupValue(snapshot, active, key)
  // A bounded list provides evidence for more open-ended questions as well.
  const mentions = new RegExp('(?<![\\p{L}\\p{N}_!])(' + reference + ')(?::(' + address + '))?(?![\\p{L}\\p{N}_!])', 'giu')
  const cells = new Map()
  function remember(token) {
    const cell = read(snapshot, active, token)
    if (typeof cell.value === 'string' && cell.value.length > 300) { cell.value = cell.value.slice(0,300); cell.truncated = true }
    if (cell.formula?.length > 300) { cell.formula = cell.formula.slice(0,300); cell.truncated = true }
    cells.set(cell.ref,cell)
  }
  for (const [, first, last] of question.matchAll(mentions)) {
    remember(first)
    // In Sheet!A1:B5 both endpoints belong to Sheet.
    if (last && cells.size < 16) remember(first.slice(0, first.lastIndexOf('!') + 1) + last)
    if (cells.size >= 16) break
  }
  return {cells:[...cells.values()], answer}
}
module.exports = {worksheetEvidence}
