const test = require('node:test')
const assert = require('node:assert/strict')
const { interpretReply } = require('../src/write-actions.cjs')
const interpret = (actions, question = 'Update the sheet') =>
  interpretReply({ message: 'Done', actions }, question, 'Sheet 1').actions
test('single-cell writes accept the scalar, single-item and matrix forms', () => {
  for (const v of ['yooo', 0, false, null]) {
    for (const shape of [{ values: v }, { value: v }, { values: [v] }, { values: [[v]] }])
      assert.deepEqual(interpret([{ op: 'write', range: 'J4', ...shape }])[0].values, [[v]])
  }
})
test('literal typing commands also resolve when Nemotron returns an acknowledgement', () => {
  assert.deepEqual(interpret([], 'in J4 type "yooo"'), [
    { op: 'write', sheet: 'Sheet 1', range: 'J4', values: [['yooo']] },
  ])
  assert.deepEqual(interpret([], 'What happens if in J4 type "yooo"?'), [])
  const values = [['A', 'B'], [1, 2]]
  assert.deepEqual(interpret([{ op: 'write', range: 'J4', values }])[0].values, values)
})
test('a workbook title denotes the current sheet only when it is not already a sheet name', () => {
  const reply = {message: 'Drawn.', actions:[{op:'smiley', range:'B2', sheet:'Budget'}]}
  assert.equal(interpretReply(reply, 'Draw a smile', 'Sheet 1', 'Budget', ['Sheet 1']).actions[0].sheet, 'Sheet 1')
  assert.equal(interpretReply(reply, 'Draw a smile', 'Sheet 1', 'Budget', ['Sheet 1','Budget']).actions[0].sheet, 'Budget')
})
