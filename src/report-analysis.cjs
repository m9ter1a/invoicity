// Locate a report previously written by the agent, then read its live cells.
// The saved plan supplies the column identities only; its amounts may be stale.
function currentReport(sheet, messages) {
  const prior = messages.findLast(m => m.state === 'applied' &&
    m.actions?.some(a => a.op === 'write' && a.sheet === sheet.name && a.range === 'A1' && a.values?.[0]?.[0] === 'Week') &&
    m.actions.some(a => a.op === 'format' && a.sheet === sheet.name && a.value === '"$"#,##0.00'))
  if (!prior) return null
  const write = prior.actions.find(a => a.op === 'write' && a.sheet === sheet.name && a.range === 'A1' && a.values?.[0]?.[0] === 'Week')
  const header = write.values[0]
  const rows = sheet.cellData || {}
  if (header.length < 2 || header.some((name,i) => typeof name !== 'string' || rows[0]?.[i]?.v !== name) ||
      rows[0]?.[header.length]?.v != null) return null
  const weeks = []
  const labels = new Set()
  for (const [index,row] of Object.entries(rows)) {
    if (index === '0') continue
    if (!header.some((_,i) => row[i]?.v != null || row[i]?.f)) continue
    const label = row[0]?.v
    if (typeof label !== 'string' || !/^Week [1-9]\d?$/i.test(label) || labels.has(label.toLowerCase())) return null
    labels.add(label.toLowerCase())
    const cents = header.slice(1).map((_,i) => {
      const value = row[i+1]?.v
      if (typeof value !== 'number') return NaN
      const rounded = Math.round(value * 100)
      return Math.abs(value * 100 - rounded) < 0.00001 ? rounded : NaN
    })
    if (!cents.every(Number.isSafeInteger)) return null
    weeks.push({label,cents})
  }
  return weeks.length ? { regions:header.slice(1), weeks } : null
}

function rankWeek(question, report) {
  if (!report) return null
  const q = question.trim().replace(/^(?:okay[, ]+)?(?:please\s+)?(?:tell me\s+)?/i,'').replace(/[?.!]+$/,'').trim()
  const match = /^(?:(?:what(?:'s| is| was)|which (?:is|was)) (?:the )?(best|worst|strongest|weakest|highest|lowest) week|which week (?:had|has) (?:the )?(highest|lowest|most|least) (?:total |weekly )?revenue)(?: (?:for|in) (.+)| (overall|across all regions))?$/i.exec(q)
  if (!match) return null
  const region = match[3] && !/^(?:all regions|the company)$/i.test(match[3]) ? match[3] : null
  const col = region ? report.regions.findIndex(name => name.toLowerCase() === region.toLowerCase()) : -1
  if (region && col < 0) return null
  const numbers = report.weeks.map(w => col < 0 ? w.cents.reduce((sum,n)=>sum+n,0) : w.cents[col])
  if (!numbers.every(Number.isSafeInteger)) return null
  const highest = /^(best|strongest|highest|most)$/i.test(match[1] || match[2])
  const target = highest ? Math.max(...numbers) : Math.min(...numbers)
  const labels = report.weeks.filter((_,i)=>numbers[i] === target).map(w=>w.label)
  const amount = (target/100).toLocaleString('en-US',{style:'currency',currency:'USD'})
  const scope = col < 0 ? 'across all regions' : 'for ' + report.regions[col]
  return {message:labels.join(' and ') + (labels.length > 1 ? ' tied for the ' : ' had the ') +
    (highest ? 'highest' : 'lowest') + ' revenue ' + scope + ' at ' + amount + '.', actions:[]}
}
module.exports = { currentReport, rankWeek }
