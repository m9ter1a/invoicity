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
