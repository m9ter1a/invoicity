const test=require('node:test')
const assert=require('node:assert/strict')
const {documentFile,excerpts,needsVision}=require('../src/document-evidence.cjs')
const {engine}=require('../src/model.cjs')
const {readLedger, ledgerAnswer,currentLedgerAnswer}=require('../src/ledger.cjs')
const plan=require('../src/plan-schema.cjs')
const ctx={active:'Report',sheets:['Report'],cells:[],visual:{legend:{a:'#ff0000'}}}
const agent=engine('/no-inference-for-exact-requests')
const file=(text)=>documentFile('ledger.pdf',text,true)
test('colored finance documents skip vision while visual questions and contextual follow-ups use it',()=>{
  assert.equal(needsVision('Show total revenue in Europe'),false)
  assert.equal(needsVision('Which rows are highlighted?'),true)
  assert.equal(needsVision('What about that one?', [{role:'user',text:'Which row is highlighted?'}]),true)
  assert.equal(needsVision('What about that one?', [{role:'user',text:'Sum all charges'}]),false)
})
test('page 37 is searchable and transaction references have exact boundaries',async()=>{
  const pages=Array.from({length:37},(_,i)=>'Transaction report '.repeat(40)+(i===36?'last refund INV-1042':'INV-10420'))
  const source=file(pages.join('\f'))
  assert.ok(source.text.length<=6000)
  assert.equal(excerpts(source,'Find INV-1042').passages.some(p=>p.page===37),true)
  const reply=await agent.chat({context:ctx,question:'Find INV-1042',attachments:[source]})
  assert.match(reply.message,/Page 37/)
  assert.doesNotMatch(reply.message,/Page 1 —/)
})
test('complete refund totals use the last page, handle column order and skip subtotal lines',async()=>{
  const header='Currency|ID|Region|Segment|Period|Type|Amount'
  const pages=Array.from({length:35},(_,i)=>header+'\nUSD|TX-'+i+'|Europe|Enterprise|Week 1|sale|8.01')
  pages.push(header+'\nUSD|R-1|Europe|Enterprise|Week 2|refund|10.05\nUSD|Total|Europe|Enterprise|Week 2|sale|9999')
  const source=file(pages.join('\f'))
  for(const [question,expected] of [['Sum all refunds','-10.05'],['What is net revenue for Enterprise in Europe?','270.30'],['How much did revenue for Enterprise in Europe change from Week 1 to Week 2 after refunds?','-290.40']]){
    const reply=await agent.chat({context:ctx,question,attachments:[source]})
    assert.ok(reply.message.includes('USD '+expected),reply.message)
    assert.deepEqual(reply.actions,[])
  }
  assert.match(ledgerAnswer(file(pages.concat('').join('\f')),'Sum all refunds').message,/Unreadable pages: 37/)
  assert.match(ledgerAnswer(file(pages.concat(header+'\nEUR|X|Europe|Enterprise|Week 2|sale|10').join('\f')),'Sum all refunds').message,/single currency/)
  assert.equal(readLedger(file(header+'\nUSD|A|E|S|W|sale|4\nUSD|A|E|S|W|sale|4')),null)
})
test('a new total after compressed history reads current document values',async()=>{
  const cell=v=>({v})
  const sheet={name:'Ledger',cellData:[[cell('ID'),cell('Currency'),cell('Amount')],[cell('X'),cell('USD'),cell('1.01')]]}
  const ask=()=>agent.chat({question:'Calculate total revenue',context:{...ctx,ledgerAnswer:currentLedgerAnswer(sheet,'Calculate total revenue')},
    history:[{role:'summary',text:'Prior revenue was USD 1.01.'}]})
  assert.match((await ask()).message,/USD 1.01/)
  sheet.cellData[1][2].v=9.89
  assert.match((await ask()).message,/USD 9.89/)
})
test('the decoder requires nested rows for write input and operation-specific format arguments at the boundary',()=>{
  const choices=plan.json_schema.schema.properties.actions.items.anyOf
  const schemaFor=op=>choices.find(v=>v.properties.op.enum.includes(op))
  for(const op of ['write','format','fill','align']) assert.equal(schemaFor(op).additionalProperties,false)
  assert.deepEqual(schemaFor('write').required,['op','range','values'])
  assert.equal(schemaFor('write').properties.values.items.type,'array')
  assert.deepEqual(schemaFor('fill').required,['op','range','value'])
})
