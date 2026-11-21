const fs = require('node:fs')
const path = require('node:path')
const { createBook } = require('./books.cjs')
function storage(dir) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  const file = (id) => {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw Error('Недопустимый идентификатор')
    return path.join(dir, id + '.json')
  }
  const read = (id) => JSON.parse(fs.readFileSync(file(id), 'utf8'))
  const save = (book) => {
    if (!book.name?.trim() || !book.snapshot?.sheetOrder?.length)
      throw Error('Проверьте название и листы книги.')
    const dst = file(book.id),
      temp = dst + '.tmp'
    book.updated = new Date().toISOString()
    fs.writeFileSync(temp, JSON.stringify(book), { mode: 0o600, flush: true })
    fs.renameSync(temp, dst)
    return book.updated
  }
  if (!fs.existsSync(path.join(dir, '.initialized'))) {
    if (!fs.readdirSync(dir).some((x) => x.endsWith('.json')))
      save(createBook('invoice', 'Пример инвойса', true))
    fs.writeFileSync(path.join(dir, '.initialized'), '1')
  }
  return {
    read,
    save,
    list: () =>
      fs
        .readdirSync(dir)
        .filter((x) => x.endsWith('.json'))
        .map((x) => {
          const { snapshot, messages, ...meta } = read(x.slice(0, -5))
          return { ...meta, sheets: snapshot.sheetOrder.length }
        })
        .sort((a, b) => b.updated.localeCompare(a.updated)),
  }
}
module.exports = { storage }
