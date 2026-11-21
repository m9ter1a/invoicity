const {
  app,
  BrowserWindow,
  nativeTheme,
  ipcMain,
  dialog,
  Menu,
  session,
} = require('electron')
const path = require('node:path')
const fs = require('node:fs/promises')
const { promisify } = require('node:util')
const execFile = promisify(require('node:child_process').execFile)
const { createBook, audit } = require('./src/books.cjs')
const { storage } = require('./src/storage.cjs')
const {
  importBook,
  exportBytes,
  printHTML,
  values,
} = require('./src/formats.cjs')
const { engine } = require('./src/model.cjs')
const vendor = app.isPackaged
  ? path.join(process.resourcesPath, 'vendor')
  : path.join(__dirname, 'vendor')
const model = engine(vendor)
const sheetTypes = ['xlsx', 'xls', 'ods', 'xlsb', 'csv', 'tsv']
let win,
  db,
  allowClose = false,
  flushing = false
app.commandLine.appendSwitch('lang', 'en-US')
app.setName('Invoicity')
if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.on('second-instance', () => {
    if (win?.isMinimized()) win.restore()
    win?.focus()
  })
  app.whenReady().then(() => {
    db = storage(path.join(app.getPath('userData'), 'books'))
    session.defaultSession.webRequest.onBeforeRequest(
      { urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] },
      (_, cb) => cb({ cancel: true }),
    )
    session.defaultSession.setPermissionRequestHandler((_, __, cb) => cb(false))
    win = new BrowserWindow({
      width: 1390,
      height: 880,
      minWidth: 900,
      minHeight: 620,
      backgroundColor: '#fafafa',
      title: 'Invoicity',
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 18, y: 17 },
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
      },
    })
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    win.webContents.on('will-navigate', (e) => e.preventDefault())
    const menu = Menu.buildFromTemplate([
      { role: 'appMenu' },
      { role: 'editMenu' },
      {
        label: 'Window',
        submenu: [{ role: 'minimize' }, { role: 'togglefullscreen' }],
      },
    ])
    Menu.setApplicationMenu(menu)
    win.on('close', (e) => {
      if (allowClose) return
      e.preventDefault()
      if (!flushing) {
        flushing = true
        win.webContents.send('flush')
      }
    })
    win.loadFile(path.join(__dirname, 'dist', 'index.html'))
  })
  app.on('window-all-closed', () => app.quit())
  app.on('will-quit', () => model.stop())
}
function handle(name, fn) {
  ipcMain.handle(name, (e, ...args) => {
    if (
      !win ||
      e.sender !== win.webContents ||
      e.senderFrame !== win.webContents.mainFrame
    )
      throw Error('Unavailable')
    return fn(...args)
  })
}
handle('flushDone', (ok) => {
  flushing = false
  if (ok) {
    allowClose = true
    win.close()
  }
})
handle('setAppearance', (theme) => {
  if (!['dark', 'light'].includes(theme)) throw Error('Unknown appearance.')
  nativeTheme.themeSource = theme
  win.setBackgroundColor(theme === 'dark' ? '#121212' : '#fafafa')
})
handle('list', () => db.list())
handle('read', (id) => db.read(id))
handle('create', () => {
  const book = createBook()
  db.save(book)
  return book
})
handle('save', (book) => db.save(book))
handle('toggleStar', (id) => {
  const book = db.read(id)
  book.star = !book.star
  db.save(book)
  return book.star
})
handle('audit', (snap) => audit(snap))
handle('modelStatus', () => model.status())
handle('chat', (request) => model.chat(request))
async function pick(extensions) {
  const { filePaths } = await dialog.showOpenDialog(win, {
    buttonLabel: 'Open',
    properties: ['openFile'],
    filters: [{ name: 'Supported documents', extensions }],
  })
  if (!filePaths.length) return
  const file = filePaths[0]
  if ((await fs.stat(file)).size > 50 * 1024 * 1024)
    throw Error('Files must be 50 MB or smaller.')
  return file
}
handle('importFile', async () => {
  const file = await pick(sheetTypes)
  if (!file) return null
  const book = await importBook(file)
  db.save(book)
  return book
})
handle('attachment', async () => {
  const file = await pick([
    ...sheetTypes,
    'txt',
    'md',
    'pdf',
    'docx',
    'png',
    'jpg',
    'jpeg',
  ])
  if (!file) return null
  const ext = path.extname(file).slice(1).toLowerCase()
  let text
  if (sheetTypes.includes(ext)) {
    const { snapshot } = await importBook(file)
    text = snapshot.sheetOrder
      .map(
        (id) =>
          snapshot.sheets[id].name +
          '\n' +
          values(snapshot, snapshot.sheets[id])
            .map((r) => r.join('\t'))
            .join('\n'),
      )
      .join('\n')
  } else if (ext === 'docx')
    text = (
      await execFile(
        '/usr/bin/textutil',
        ['-convert', 'txt', '-stdout', file],
        { maxBuffer: 16e6 },
      )
    ).stdout
  else if (['pdf', 'png', 'jpg', 'jpeg'].includes(ext))
    text = (
      await execFile(path.join(vendor, 'extract'), [file], {
        maxBuffer: 16e6,
        timeout: 120000,
      })
    ).stdout
  else text = await fs.readFile(file, 'utf8')
  if (!text.trim()) throw Error('No readable text was found in the file.')
  return {
    name: path.basename(file),
    text: text.slice(0, 6000),
    partial:
      text.length > 6000 || text.includes('[Only the first 30 pages were read.]'),
  }
})
handle('exportFile', async (snap, ext, activeId) => {
  if (!['xlsx', 'xls', 'ods', 'csv', 'tsv', 'docx', 'pdf'].includes(ext))
    throw Error('Unknown file format.')
  const { filePath } = await dialog.showSaveDialog(win, {
    buttonLabel: 'Save',
    defaultPath: snap.name.replace(/[/:]/g, '-') + '.' + ext,
    filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
  })
  if (!filePath) return false
  let bytes
  if (ext === 'pdf') {
    const pdf = new BrowserWindow({
      show: false,
      webPreferences: { sandbox: true, javascript: false },
    })
    try {
      await pdf.loadURL(
        'data:text/html;charset=utf-8,' + encodeURIComponent(printHTML(snap)),
      )
      bytes = await pdf.webContents.printToPDF({
        preferCSSPageSize: true,
        printBackground: true,
      })
    } finally {
      pdf.destroy()
    }
  } else bytes = await exportBytes(snap, ext, activeId)
  const temp = filePath + '.' + require('node:crypto').randomUUID() + '.tmp'
  try {
    await fs.writeFile(temp, bytes, { mode: 0o600 })
    await fs.rename(temp, filePath)
  } finally {
    await fs.rm(temp, { force: true })
  }
  return true
})
