// Nemotron can emit one cell as a scalar, a one-element row or a 1×1 matrix.
function normalizeWrite(action) {
  if (action?.op !== 'write' || !/^[A-Z]+[1-9]\d*$/i.test(action.range)) return action
  const values = Object.hasOwn(action, 'values') ? action.values : action.value
  const scalar = (v) => v === null || ['number', 'boolean', 'string'].includes(typeof v)
  if (scalar(values)) return { ...action, values: [[values]] }
  if (Array.isArray(values) && values.length === 1 && scalar(values[0]))
    return { ...action, values: [values] }
  return action
}

function interpretReply(reply, question, activeSheet) {
  // An explicit, quoted single-cell command has an exact target and literal.
  // Resolve it even when the model only acknowledges the request or changes the text.
  const literal = /^\s*in\s+([a-z]{1,3}[1-9]\d{0,4})\s+type\s+"([^"\r\n]*)"\s*[.!]?\s*$/i.exec(question)
  if (literal && activeSheet) {
    const range = literal[1].toUpperCase()
    return {
      message: 'Updated ' + range + '.',
      actions: [{ op: 'write', sheet: activeSheet, range, values: [[literal[2]]] }],
    }
  }
  return { ...reply, actions: reply.actions.map(normalizeWrite) }
}
module.exports = { interpretReply }
