import assert from 'node:assert/strict'
import {mkdtemp,writeFile} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {createRequire} from 'node:module'
import {_electron as electron} from 'playwright-core'

// The same report task runs on two different inputs. Assertions check persisted
// results and untouched input cells, while timings include rendering and IPC.
const require=createRequire(import.meta.url)
const timings={first:[],repeat:[]}
for (const price of [12,27]) {
  const dir=await mkdtemp(path.join(os.tmpdir(),'invoicity-eval-'))
  const binary=process.env.INVOICITY_BINARY
  const app=await electron.launch({executablePath:binary||require('electron'),args:[...(binary?[]:['.']),'--user-data-dir='+dir],timeout:90000})
  try {
    const page=await app.firstWindow()
    const button=name=>page.getByRole('button',{name,exact:true})
    const message=page.getByRole('textbox',{name:'Message Invoicity'})
    const answers=page.locator('.msg.assistant')
    let turns=0
    async function ask(q){
      const n=await answers.count()
      await message.fill(q)
      const start=performance.now()
      await message.press('Enter')
      await answers.nth(n).waitFor({timeout:420000})
      const reply=await answers.nth(n).innerText()
      timings[turns++?'repeat':'first'].push(Math.round(performance.now()-start))
      console.log(q,reply)
      return reply
    }
    async function state() {
      return page.evaluate(async()=>{const [item]=await window.localDesk.list();return window.localDesk.read(item.id)})
    }
    await button('Get started').click()
    await button('Skip tour').click()
    await button('New spreadsheet').click()
    const pages=34
    const bytes=await app.evaluate(async({BrowserWindow},{price,pages})=>{
      const pdf=new BrowserWindow({show:false,webPreferences:{sandbox:true}})
      try {
        const html=Array.from({length:pages},(_,i)=>'<section style="break-after:'+ (i+1===pages?'auto':'page')+'"><pre>Currency|ID|Region|Period|Type|Amount\nUSD|TX-'+(1000+i)+'|West|Week 1|sale|'+price+'.00</pre></section>').join('')
        await pdf.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(html))
        return (await pdf.webContents.printToPDF({displayHeaderFooter:false})).toString('base64')
      } finally {pdf.destroy()}
    },{price,pages})
    const pdf=path.join(dir,'Transactions.pdf')
    await writeFile(pdf,Buffer.from(bytes,'base64'))
    await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({filePaths:[file]})},pdf)
    await button('Attach document').click()
    await button('Remove attachment').waitFor()
    const initial=price*pages
    assert.match(await ask('Turn this PDF into a weekly revenue table with one column per region.'),/Applied/)
    const snapshot=async()=>{const book=await state();return book.snapshot.sheets[book.snapshot.sheetOrder[0]].cellData}
    assert.equal((await snapshot())[1][1].v,initial)
    assert.match(await ask('Find TX-1033 in the PDF'),/Page 34/)
    assert.ok((await ask('What is the total of B2?')).includes(String(initial)))
    assert.match(await ask('In J4 type "yooo"'),/Applied/)
    assert.equal((await snapshot())[3][9].v,'yooo')
    assert.match(await ask('Write a formula in C2 for the sum of B2'),/Applied/)
    assert.equal((await snapshot())[1][2].v,initial)
    assert.match(await ask('Set B2 to '+(initial+11)),/Applied/)
    await button('Chat context').click()
    await button('Compress context').click()
    await button('Compress chat').click()
    await page.locator('dialog').waitFor({state:'hidden',timeout:420000})
    const compressed=await state()
    assert.equal(compressed.messages[0].role,'summary')
    assert.ok((await ask('What is the total of B2?')).includes(String(initial+11)))
    const cells=await snapshot()
    assert.equal(cells[1][2].v,initial+11)
    assert.match(cells[1][2].f,/B2/)
    assert.equal(cells[1][0].v,'Week 1')
    assert.equal(cells[3][9].v,'yooo')
    assert.deepEqual(Object.keys(cells).filter(k=>Object.values(cells[k]).some(c=>c.v!=null || c.f)).sort(),['0','1','3'])
  } finally {await app.close()}
}
for (const [phase,values] of Object.entries(timings)) {
  values.sort((a,b)=>a-b)
  const percentile=p=>values[Math.ceil(values.length*p)-1]
  console.log(JSON.stringify({phase,samples:values.length,median_ms:percentile(.5),p95_ms:percentile(.95)}))
}
