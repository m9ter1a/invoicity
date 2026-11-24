const test = require('node:test')
const assert = require('node:assert/strict')
const {worksheetEvidence} = require('../src/worksheet-evidence.cjs')
const {engine} = require('../src/model.cjs')
function workbook() {
  return {sheetOrder:['actual','plan'],sheets:{
    actual:{name:'Ledger',rowCount:1000,columnCount:26,cellData:{
      949:{0:{v:'INV-950'},1:{v:150},2:{f:'=B950*2',v:300}},
      950:{0:{v:'INV-951'},1:{v:0}},951:{0:{v:'INV-951'},1:{v:15}}
    }},
    plan:{name:"Prior FY's",rowCount:1000,columnCount:26,cellData:{949:{1:{v:120}}}}
  }}
}
const ask = q => worksheetEvidence(workbook(),'Ledger',q)
test('grounds arbitrary requests in live addressed cells outside the preview and on quoted worksheets',()=>{
  const result = ask("Explain C950 compared with 'Prior FY''s'!$B$950.")
  assert.equal(result.answer,undefined)
  assert.deepEqual(result.cells,[{ref:"'Ledger'!C950",value:300,formula:'=B950*2'},{ref:"'Prior FY''s'!B950",value:120}])
  assert.deepEqual(ask("Explain 'Prior FY''s'!B950:B951.").cells.map(c=>c.ref),["'Prior FY''s'!B950","'Prior FY''s'!B951"])
  assert.match(ask('What formula is in C950?').answer,/=B950\*2 = 300/)
  assert.match(ask('What is in B953?').answer,/empty/)
  assert.match(ask('What is in B1001?').answer,/outside/)
  assert.match(ask('What is in Missing!B950?').answer,/could not be found/)
})
test('calculates directional growth and shares with explicit sources and a defined denominator',()=>{
  assert.match(ask("Calculate the percentage change from 'Prior FY''s'!B950 to B950.").answer,/25%/)
  assert.match(ask("What percentage of B950 is 'Prior FY''s'!B950?").answer,/80%/)
  assert.match(ask('Percent change from B950 to B951').answer,/-100%/)
  assert.match(ask('Percent change from B951 to B950').answer,/undefined/)
  assert.match(ask('Percent change from B953 to B950').answer,/numeric value is required/)
  assert.equal(ask('Calculate the percentage change from B951 to B950 and write it in F2').answer,undefined)
})
test('finds exact IDs across the entire column and reports missing or duplicate matches',()=>{
  assert.match(ask('Look up "inv-950" in column A and return column B.').answer,/B950 contains 150/)
  assert.match(ask('Look up "INV-951" in column A and return column B.').answer,/2 matches.*951, 952/)
  assert.match(ask('Look up "INV-95" in column A and return column B.').answer,/No exact match/)
})
test('routes grounded reads through the ordinary chat entry point without loading a model',async()=>{
  const agent = engine('/nonexistent-invoicity-test')
  for (const question of ['What formula is in C950?', 'Percent change from B950 to B951', 'Look up "INV-950" in column A and return column B.']) {
    const focused = ask(question)
    assert.deepEqual(await agent.chat({question,context:{active:'Ledger',focused}}),{message:focused.answer,actions:[]})
  }
})

test('keeps all listed operands when a finance question also names a metric and entity',()=>{
  const {explicitCalculation} = require('../src/explicit-calculation.cjs')
  const total = explicitCalculation('What is the total monthly revenue for the North store across weekly totals G2, M2, S2 and Y2? Answer in the chat.', 'Ledger')
  assert.equal(total.calculation.formula,'=SUM(G2,M2,S2,Y2)')
  const avg = explicitCalculation('Write a formula in Z2 for the average weekly revenue for North using cells G2, M2, S2 and Y2. The cell should show the calculated result.', 'Ledger')
  assert.deepEqual(avg.actions[0],{op:'write',sheet:'Ledger',range:'Z2',values:[['=AVERAGE(G2,M2,S2,Y2)']]})
  assert.equal(explicitCalculation('What is the total revenue for North excluding refunds using cells A1, A2?', 'Ledger'),null)
})
