const test = require('node:test'),
  assert = require('node:assert/strict')
const fs = require('node:fs/promises'),
  os = require('node:os'),
  path = require('node:path')
const { createBook, audit } = require('../src/books.cjs')
const { importBook, exportBytes } = require('../src/formats.cjs')
const { storage } = require('../src/storage.cjs')
test('XLSX preserves numbers, formulas, styles and merges through import', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'invoicity-xlsx-'))
  const b = createBook('invoice', 'Test', true),
    sh = b.snapshot.sheets[b.snapshot.sheetOrder[0]]
  sh.cellData[7][3].v = 10000
  sh.mergeData = [{ startRow: 13, endRow: 13, startColumn: 0, endColumn: 1 }]
  const p = path.join(dir, 'invoice.xlsx')
  await fs.writeFile(p, await exportBytes(b.snapshot, 'xlsx'))
  const reopened = (await importBook(p)).snapshot,
    first = reopened.sheets[reopened.sheetOrder[0]]
  assert.equal(first.cellData[7][3].f, '=ROUND(B8*C8,2)')
  assert.equal(first.cellData[7][3].v, 10000)
  assert.equal(first.cellData[6][0].s.bl, 1)
  assert.equal(first.mergeData.length, 1)
})
test('audit flags a line total and duplicate invoice for same supplier', () => {
  const b = createBook('invoice', undefined, true),
    sh = b.snapshot.sheets[b.snapshot.sheetOrder[0]]
  sh.cellData[7][3].v = 1
  assert.ok(audit(b.snapshot).issues.some((x) => x.includes('D8')))
  const r = createBook('register'),
    s = r.snapshot.sheets[r.snapshot.sheetOrder[0]]
  s.cellData[1] = { 0: { v: 'A01' }, 1: { v: 'Supplier' } }
  s.cellData[2] = s.cellData[1]
  assert.match(audit(r.snapshot).issues[0], /A3/)
})
test('independent workspace survives reopening with only user documents', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'invoicity-store-')),
    db = storage(dir),
    b = createBook()
  db.save(b)
  b.name = 'Updated'
  db.save(b)
  assert.equal(storage(dir).list().length, 1)
  assert.equal(storage(dir).read(b.id).name, 'Updated')
  assert.throws(() => db.read('../bad'))
})
