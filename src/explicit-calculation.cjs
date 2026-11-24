// Keep an explicit reference list intact. More complex questions can still use
// the full planner, including filters, multiple sheets and natural-language labels.
const functions = {sum:'SUM', total:'SUM', average:'AVERAGE', mean:'AVERAGE', minimum:'MIN', maximum:'MAX', count:'COUNT'}
const cell = '\\$?[A-Z]{1,3}\\$?[1-9]\\d{0,4}'
const ref = cell + '(?::' + cell + ')?'
const expression = new RegExp('^(?:the )?(' + Object.keys(functions).join('|') + ')\\s+(?:of\\s+)?(?:cells?\\s+)?(' +
  ref + '(?:(?:\\s*,\\s*(?:and\\s+)?|\\s+and\\s+)' + ref + ')*)$', 'i')
const destination = new RegExp('^(?:write|put|insert) (?:a |the )?formula in (' + cell + ') (?:for|to calculate) (.+)$', 'i')
function explicitCalculation(question, sheet) {
  const text = question.trim().replace(/[?.!]+$/,'').replace(/^please\s+/i,'')
  const edit = destination.exec(text)
  const operands = expression.exec(edit ? edit[2] : text.replace(/^(?:what(?:'s| is)|calculate|compute|find)\s+/i,''))
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
