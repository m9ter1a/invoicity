const Papa = require('papaparse')
const aliases = {reference:'id', 'transaction id':'id', id:'id', 'invoice id':'id', type:'type', region:'region',
  segment:'segment', period:'period', week:'period', date:'date', currency:'currency', amount:'amount', 'net amount':'amount'}
function parseMoney(raw) {
  const match = /^(-?)\s*([$€£]?)\s*((?:\d{1,3}(?:,\d{3})+|\d+))(?:\.(\d{1,2}))?$/.exec(raw)
  if (!match) return null
  const cents = Number(match[3].replaceAll(',','') + (match[4] || '').padEnd(2,'0')) * (match[1] ? -1 : 1)
  return Number.isSafeInteger(cents) ? {cents, symbol:match[2]} : null
}
// Require a supported header and account for every nonempty record before totaling.
function readLedger(file) {
  if (file.partial) return null
  const records = [], seen = new Set()
  let keys, delimiter
  let legacy = false
  for (const [p,page] of (file.pages || [file.text]).entries()) {
    const lines = page.split(/\r?\n/).map(s=>s.trim()).filter(Boolean)
    for (const [i,line] of lines.entries()) {
      if (/^reference\s+date\s+period\s+region\s+amount$/i.test(line)) {
        if (!/\bUSD\b/.test((file.pages || [file.text])[0])) return null
        keys=['id','date','period','region','amount']; legacy=true; continue
      }
      if (/^(?:sample statement\s+)?\d+\s*\/\s*\d+$/i.test(line)) continue
      if (!keys && /\.pdf$/i.test(file.name) && !/[0-9].*[$€£]|[$€£]\s*\d/.test(line) &&
          !/[,|\t]/.test(line) && !/\b(?:reference|amount|currency|id)\b/i.test(line)) continue
      const sep = ['\t','|',','].find(s=>line.includes(s)) || delimiter
      const split = sep ? Papa.parse(line,{delimiter:sep}).data[0].map(s=>s.trim()) : []
      const header = split.map(k=>aliases[k.toLowerCase()])
      if (header.includes('id') && header.includes('amount')) {
        if (new Set(header.filter(Boolean)).size !== header.filter(Boolean).length) return null
        keys=header; delimiter=sep; continue
      }
      if (!keys) return null
      let values
      if (legacy) {
        const match=/^(\S+)\s+([A-Za-z]{3}\s+\d{1,2})\s+(Week\s+\d{1,2})\s+([\p{L}][\p{L} .&’'-]*)\s+(-?\$[\d,.]+)$/iu.exec(line)
        if (!match) return null
        values=match.slice(1)
      } else {
        const parsed=Papa.parse(line,{delimiter})
        values=parsed.data[0].map(x=>x.trim())
        if (parsed.errors.length || keys.length!==values.length) return null
      }
      const row=Object.fromEntries(keys.flatMap((k,j)=>k?[[k,values[j]]]:[]))
      if (/^(?:(?:grand|sub)\s*)?total$/i.test(row.id)) continue
      if (!row.id || seen.has(row.id)) return null
      seen.add(row.id)
      const money=parseMoney(row.amount)
      if (!money) return null
      const symbolCurrency=({'$':'USD','€':'EUR','£':'GBP'})[money.symbol]
      const currency=row.currency?.toUpperCase() || (legacy ? 'USD' : money.symbol === '$' ? null : symbolCurrency)
      if (!/^[A-Z]{3}$/.test(currency || '') ||
          (money.symbol === '$' ? !['USD','CAD','AUD','NZD','SGD','HKD'].includes(currency) : symbolCurrency && currency!==symbolCurrency)) return null
      const refund=row.type ? /^(refund|return|credit note)$/i.test(row.type) : money.cents<0
      if (row.type && !/^(sale|payment|revenue|receipt|refund|return|credit note)$/i.test(row.type)) return null
      records.push({...row,currency,refund,cents:refund?-Math.abs(money.cents):money.cents,source:file.sourceRows ? 'row '+file.sourceRows[i] : 'p.'+(p+1)+' row '+(i+1)})
    }
  }
  return records.length?records:null
}
function filterRows(rows, scope) {
  if (!scope) return rows
  const values=scope.split(/\s+(?:in|for|and|during)\s+/i)
  for (const value of values) {
    const fields=['region','segment','period','currency','date'].filter(k=>rows.some(r=>r[k]?.toLowerCase()===value.toLowerCase()))
    if (fields.length!==1) return null
    rows=rows.filter(r=>r[fields[0]]?.toLowerCase()===value.toLowerCase())
  }
  return rows
}
function metricRequest(question) {
  const q=question.trim().replace(/[?.!]+$/,'').replace(/^please\s+/i,'')
  const total=/^(?:(?:what (?:is|was)|calculate|sum|show|total|find|add up)\s+)?(?:the\s+)?(?:total\s+|all\s+|net\s+)*(revenue|refunds|receipts)(?:\s+(?:for|in|during)\s+(.+?))?(?:\s+after refunds)?$/i.exec(q)
  const change=/^(?:how much did|calculate the change in) (?:net )?revenue(?: change)?(?: (?:for|in) (.+?))?(?: change)? from (.+?) to (.+?)(?: after refunds)?$/i.exec(q)
  return total || change ? {total,change} : null
}
function ledgerAnswer(file, question) {
  const ask=metricRequest(question)
  if (!ask) return null
  const {total,change}=ask
  const fail = message=>({message,actions:[]})
  if (file.partial) return fail('A complete total is unavailable because part of the attachment could not be read.'+(file.missing?.length?' Unreadable pages: '+file.missing.join(', ')+'.':''))
  const records=readLedger(file)
  if (!records) return fail('I could not verify a transaction reference, amount and currency for every row. Check the document layout before using a total.')
  const selected=filterRows(records,change?change[1]:total[2])
  if (!selected) return fail('Specify an exact region, segment, currency or period from this report.')
  const matching=total?.[1].toLowerCase()==='refunds'?selected.filter(r=>r.refund):selected
  if (!selected.length || new Set(selected.map(r=>r.currency)).size!==1) return fail('Choose a single currency and a scope with matching transactions.')
  const currency=selected[0].currency
  const sum=rows=>rows.reduce((n,r)=>n+BigInt(r.cents),0n)
  const display=n=>currency+' '+(n<0n?'-':'')+(n<0n?-n:n).toString().padStart(3,'0').replace(/(\d{2})$/,'.$1')
  let value, detail, used=matching
  if (change) {
    const start=filterRows(selected,change[2]),end=filterRows(selected,change[3])
    if (!start?.length || !end?.length || ![change[2],change[3]].every(v=>selected.some(r=>[r.date,r.period].some(k=>k?.toLowerCase()===v.toLowerCase()))))
      return fail('Specify two periods that appear in the report.')
    value=sum(end)-sum(start); used=[...start,...end]
    detail='Change from '+change[2]+' ('+display(sum(start))+') to '+change[3]+' ('+display(sum(end))+')'
  } else {value=sum(matching);detail=total[1].toLowerCase()==='refunds'?'Refunds (signed)':'Net receipts'}
  const sources=used.slice(0,8).map(r=>r.id+' ('+r.source+')').join(', ')
  return fail(detail+': '+display(value)+'. '+used.length+' transactions in '+file.name+'.'+(sources?' Sources: '+sources+(used.length>8?' and '+(used.length-8)+' more':'')+'.':''))
}
function currentLedgerAnswer(sheet,question) {
  if (!metricRequest(question)) return null
  const data=sheet.cellData || {}
  const header=Object.values(data[0] || {}).map(cell=>aliases[String(cell?.v||'').trim().toLowerCase()])
  if (!header.includes('amount') || !header.includes('id')) return null
  const columns=Object.keys(data[0]).map(Number).sort((a,b)=>a-b)
  const lines=[]
  const sourceRows=[]
  for(const [index,row] of Object.entries(data)) {
    const values=columns.map(c=>{
      const cell=row[c]
      return cell?.f && cell.v==null ? '(uncalculated)' : cell?.v ?? ''
    })
    if (values.every(v=>v==='')) continue
    sourceRows.push(Number(index)+1)
    lines.push(Papa.unparse([values],{delimiter:'\t'}))
  }
  return ledgerAnswer({name:sheet.name,text:lines.join('\n'),sourceRows},question)
}
module.exports={readLedger,ledgerAnswer,currentLedgerAnswer}
