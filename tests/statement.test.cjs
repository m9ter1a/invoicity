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

const {engine} = require('../src/model.cjs')
const {requestedColumns} = require('../src/statement.cjs')
const prompt = 'Turn this PDF into a weekly revenue table with one column per region.'

test('an explicit weekly report completes with no inference on blank and occupied sheets', async () => {
  const agent = engine('/unused-model-directory')
  for (const occupied of [false, true]) {
    const result = await agent.chat({question: prompt, attachments: [file], context: {
      selection: 'J4', active: 'Sheet 1', sheets: ['Sheet 1','WEEKLY REVENUE'], cells: occupied ? [prompt] : [],
      activeSheetOccupied: occupied,
    }})
    const write = result.actions.find(action => action.op === 'write')
    assert.equal(write.sheet, occupied ? 'Weekly revenue 2' : 'Sheet 1')
    assert.deepEqual(write.values, [['Week','West','East'],['Week 1',0,10.3],['Week 2',2000,0]])
    assert.equal(result.actions.some(action => action.op === 'addSheet'), occupied)
  }
})

test('only unambiguous revenue report instructions bypass inference', () => {
  const regions = ['West', 'East']
  assert.deepEqual(requestedColumns('Build a weekly revenue table from this file. Columns: Week, East, West, use USD amounts', regions), ['East','West'])
  for (const q of [prompt + ' Exclude returns.', 'Do not create a weekly revenue table by region.',
    'Create a weekly revenue table by region in D4', 'Build a weekly revenue table. Columns: Week, West, Unknown'])
    assert.equal(requestedColumns(q, regions), null)
})
