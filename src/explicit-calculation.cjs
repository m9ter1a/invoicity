// Keep an explicit reference list intact. More complex questions can still use
// the full planner, including filters, multiple sheets and natural-language labels.
const functions = {sum:'SUM', total:'SUM', average:'AVERAGE', mean:'AVERAGE', minimum:'MIN', maximum:'MAX', count:'COUNT'}
const cell = '\\$?[A-Z]{1,3}\\$?[1-9]\\d{0,4}'
const ref = cell + '(?::' + cell + ')?'
const list = '(' + ref + '(?:(?:\\s*,\\s*(?:and\\s+)?|\\s+and\\s+)' + ref + ')*)'
const aggregate = '^(?:the )?(' + Object.keys(functions).join('|') + ')\\s+'
const expression = new RegExp(aggregate + '(?:of\\s+)?(?:cells?\\s+)?' + list + '$', 'i')
// A metric label can precede an explicitly enumerated set of source cells.
const named = new RegExp(aggregate +
  '(?:(?:daily|weekly|monthly|quarterly|annual) )?(?:revenue|sales|income|expenses|costs|receipts)' +
  '(?: for (?:the )?[a-z][a-z -]{0,48}?)? (?:using (?:cells? )?|across (?:weekly |monthly |quarterly )?totals )' + list + '$', 'i')
const destination = new RegExp('^(?:write|put|insert) (?:a |the )?formula in (' + cell + ') (?:for|to calculate) (.+)$', 'i')
function explicitCalculation(question, sheet) {
  const text = question.trim().replace(/[?.!]+$/,'').replace(/^please\s+/i,'')
  const request = text.replace(/[.?!]\s+(?:answer in (?:the )?chat|the cell should show the calculated result)$/i, '')
  const edit = destination.exec(request)
  const metric = edit ? edit[2] : request.replace(/^(?:what(?:'s| is)|calculate|compute|find)\s+/i,'')
  const filtered = /\b(?:excluding|except|without|only|where|minus|plus|weighted|after|before|above|below|if|and|or)\b/i.test(metric.split(/\s+(?:using|across)\s+/i)[0])
  const operands = expression.exec(metric) || (!filtered && named.exec(metric))
  if (!operands) return null
  const refs = operands[2].toUpperCase().match(new RegExp(ref,'g'))
  const formula = '=' + functions[operands[1].toLowerCase()] + '(' + refs.join(',') + ')'
  if (!edit) return {calculation:{sheet,formula},actions:[]}
  const range = edit[1].toUpperCase().replaceAll('$','')
  // A destination inside an input range would replace an operand and create a cycle.
  const point = address => {
    const [,letters,digits] = /^([A-Z]+)(\d+)$/.exec(address.replaceAll('$',''))
    return [Number(digits), [...letters].reduce((n,l)=>26*n+l.charCodeAt(0)-64,0)]
  }
  const target = point(range)
  if (refs.some(ref => {
    const [first,last=first] = ref.split(':').map(point)
    return target.every((n,i)=>n>=Math.min(first[i],last[i]) && n<=Math.max(first[i],last[i]))
  })) return {message:'Choose a destination outside the source cells to avoid a circular formula.',actions:[]}
  return {message:'Wrote the formula in ' + range + '.',actions:[{op:'write',sheet,range,values:[[formula]]}]}
}
module.exports = { explicitCalculation }
