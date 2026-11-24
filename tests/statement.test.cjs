const test = require('node:test')
const assert = require('node:assert/strict')
const {weeklyStatement, weeklyTable} = require('../src/statement.cjs')

const file = {
  name: 'receipts.pdf',
  text: ['Revenue / USD', 'Reference Date Period Region Amount',
    'RC-1 Oct 09 Week 2 West $2,000.00', 'RC-2 Oct 02 Week 1 East $10.20',
    'RC-3 Oct 05 Week 1 East $0.15', 'RC-4 Oct 06 Week 1 East -$0.05',
    'Sample statement 01 / 01'].join('\n'),
}

test('summarizes complete USD receipts by week and requested region order', () => {
  const statement = weeklyStatement(file)
  const {actions} = weeklyTable(statement, ['East', 'West'], 'Sheet 1')
  assert.deepEqual(actions[0].values, [['Week','East','West'], ['Week 1',10.3,0], ['Week 2',0,2000]])
  assert.equal(actions[2].range, 'B2:C3')
})

test('falls back on incomplete, unrecognized, or ambiguous statements', () => {
  for (const changed of [{partial:true}, {text:file.text.replace('USD','EUR')},
    {text:file.text.replace('RC-2','RC-1')}, {text:file.text + '\nRC-5 invalid amount'}])
    assert.equal(weeklyStatement({...file,...changed}), null)
})
