import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { _electron as electron } from 'playwright-core'
import books from '../src/books.cjs'
import store from '../src/storage.cjs'

const profile = await mkdtemp(path.join(tmpdir(), 'invoicity-bookmarks-'))
const dir = path.join(profile, 'books')
await mkdir(dir)
const documents = ['Budget', 'Forecast', 'Forecast'].map((name, index) => ({
  ...books.createBook('blank', name),
  updated: new Date(Date.UTC(2025, 0, 3 - index)).toISOString(),
}))
for (const book of documents) await writeFile(path.join(dir, book.id + '.json'), JSON.stringify(book))

const binary = process.env.INVOICITY_BINARY
const app = await electron.launch({
  executablePath: binary || createRequire(import.meta.url)('electron'),
  args: [...(binary ? [] : ['.']), '--user-data-dir=' + profile],
})
try {
  const page = await app.firstWindow()
  const button = (name) => page.getByRole('button', { name, exact: true })
  await button('Get started').click()
  await button('Skip tour').click()
  const rows = page.locator('.record')
  const toggle = index => rows.nth(index).locator('button[aria-pressed]')
  const states = () => rows.locator('button[aria-pressed]').evaluateAll(buttons => buttons.map(b => b.getAttribute('aria-pressed') === 'true'))
  const library = store.storage(dir)
  const verify = flags => {
    const actual = library.list().map(({ id, updated, star }) => ({ id, updated, star }))
    assert.deepEqual(actual, documents.map(({ id, updated }, i) => ({ id, updated, star: flags[i] })))
  }

  await toggle(2).click()
  await page.locator('.record button[aria-pressed=true]').first().waitFor()
  verify([false, false, true])
  assert.deepEqual(await states(), [false, false, true])
  const search = page.getByRole('searchbox')
  await search.fill('forecast')
  await toggle(0).click()
  await page.locator('.record button[aria-pressed=true]').nth(1).waitFor()
  verify([false, true, true])
  await button('Bookmarked').click()
  await toggle(0).click()
  await rows.nth(1).waitFor({ state: 'detached' })
  verify([false, false, true])

  await page.reload()
  await rows.nth(2).waitFor()
  assert.deepEqual(await states(), [false, false, true])
  await toggle(0).click()
  await toggle(2).click()
  await page.locator('.record').nth(2).locator('button[aria-pressed=false]').waitFor()
  verify([true, false, false])
  console.log('Verified workbook IDs, row order, timestamps, search, bookmarked filter, and persistence.')
} finally {
  await app.close()
}
