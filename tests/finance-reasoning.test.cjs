const test = require('node:test'), assert = require('node:assert/strict')
const {currentReport,rankWeek} = require('../src/report-analysis.cjs')
const {explicitCalculation} = require('../src/explicit-calculation.cjs')
const history = [{state:'applied',actions:[{op:'write',sheet:'Report',range:'A1',values:[['Week','East','West'],['Week 1',1,1]]},{op:'format',sheet:'Report',value:'"$"#,##0.00'}]}]
const cells = (...values) => Object.fromEntries(values.map((v,i)=>[i,{v}]))
function sheet(){
  return {name:'Report',cellData:{0:cells('Week','East','West'),1:cells('Week 1',5,90),2:cells('Week 2',70,30),3:cells('Week 3',60,40)}}
}
test('compares current weekly totals, named regions, ties and negative values',()=>{
  const data=sheet()
  const report=currentReport(data,history)
  assert.match(rankWeek("Okay, please tell me what's the best week?",report).message,/Week 2 and Week 3.*\$100.00/)
  assert.match(rankWeek('Which week had the highest revenue for West?',report).message,/Week 1.*\$90.00/)
  data.cellData[2][1].v=-80
  assert.match(rankWeek('Which week had the lowest revenue?',currentReport(data,history)).message,/Week 2.*-\$50.00/)
  assert.equal(rankWeek('Which week had the highest revenue for West excluding refunds?',report),null)
  delete data.cellData[2][1]
  assert.equal(currentReport(data,history),null)
})
test('uses the stated references for questions and writes a live formula for edits',()=>{
  assert.equal(explicitCalculation('What is the sum of B2, D2 and F2?', 'Data').calculation.formula,'=SUM(B2,D2,F2)')
  assert.equal(explicitCalculation('Write a formula in D2 for the average of B2:B5.', 'Data').actions[0].values[0][0],'=AVERAGE(B2:B5)')
  assert.equal(explicitCalculation('Put a formula in B3 for the total of B2:B5.', 'Data').actions.length,0)
  assert.equal(explicitCalculation('What is the sum of B2:B5 excluding refunds?', 'Data'),null)
})
