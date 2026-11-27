const {
  app,
  BrowserWindow,
  nativeTheme,
  systemPreferences,
  ipcMain,
  dialog,
  Menu,
  shell,
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
const { documentFile } = require('./src/document-evidence.cjs')
const { engine } = require('./src/model.cjs')
const vendor = app.isPackaged
  ? path.join(process.resourcesPath, 'vendor')
  : path.join(__dirname, 'vendor')
const model = engine(vendor)
const voice = require('./src/voice-engine.cjs').voiceEngine(vendor)
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
    const isEditor = (contents, details) => !!contents && contents === win?.webContents &&
      details.isMainFrame && details.requestingUrl?.split('#')[0] === contents.getURL().split('#')[0]
    session.defaultSession.setPermissionCheckHandler((contents, permission, origin, details) =>
      permission === 'media' && isEditor(contents, details) && details.mediaType === 'audio')
    session.defaultSession.setPermissionRequestHandler((contents, permission, cb, details) => {
      const microphone = permission === 'media' && isEditor(contents, details) &&
        details.mediaTypes?.length === 1 && details.mediaTypes[0] === 'audio'
      if (microphone && process.platform === 'darwin' && !app.commandLine.hasSwitch('use-fake-device-for-media-stream')) {
        systemPreferences.askForMediaAccess('microphone').then(cb, () => cb(false))
      } else cb(Boolean(microphone))
    })
    win = new BrowserWindow({
      width: 1390,
      height: 880,
      minWidth: 900,
      minHeight: 620,
      backgroundColor: '#fafafa',
      title: 'Invoicity',
      ...(process.platform === 'linux' ? {icon: path.join(__dirname, app.isPackaged ? 'icon.png' : 'scripts/invoicity.png')} : {}),
      ...(process.platform === 'darwin' ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 18, y: 17 } } : { autoHideMenuBar: true }),
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
    const landing = app.commandLine.hasSwitch('show-welcome') ? { hash: 'welcome' } : {}
    win.loadFile(path.join(__dirname, 'dist', 'index.html'), landing)
  })
  app.on('window-all-closed', () => app.quit())
  app.on('will-quit', () => { voice.cancel(); model.stop() })
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
handle('transcribeVoice', voice.transcribe)
handle('cancelVoice', (id) => voice.cancel(id))
handle('list', () => db.list())
handle('trashBook', id => shell.trashItem(db.file(id)))
handle('compact', history => model.compact(history))
handle('read', (id) => db.read(id))
handle('create', () => {
  const book = createBook()
  db.save(book)
  return book
})
handle('save', (book) => db.save(book))
handle('toggleStar', (id) => db.toggleStar(id))
handle('audit', (snap) => audit(snap))
handle('modelStatus', () => model.status())
async function captureSheet(view) {
  const [width, height] = win.getContentSize()
  if (!view || !['x','y','width','height'].every(k => Number.isFinite(view[k])))
    throw Error('The sheet image is unavailable.')
  const x = Math.max(0, Math.floor(view.x)), y = Math.max(0, Math.floor(view.y))
  const rect = {x, y, width: Math.min(width - x, Math.floor(view.width)),
    height: Math.min(height - y, Math.floor(view.height))}
  if (rect.width < 1 || rect.height < 1) throw Error('The sheet is outside the window.')
  const screenshot = await win.webContents.capturePage(rect)
  if (screenshot.isEmpty()) throw Error('Could not capture the current sheet.')
  const image = screenshot.resize({width: Math.min(1000, screenshot.getSize().width)}).toJPEG(86)
  return 'data:image/jpeg;base64,' + image.toString('base64')
}
let runningChat
handle('cancelChat', id => {
  if (runningChat?.id === id) runningChat.controller.abort()
})
handle('chat', async ({ id, view, ...request }) => {
  if (runningChat) throw Error('A chat request is already running.')
  const controller = new AbortController()
  runningChat = {id, controller}
  try {
    return await model.chat({...request, capture: () => captureSheet(view), signal: controller.signal})
  } finally {
    runningChat = null
  }
})
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
const attachmentTypes = [...sheetTypes, 'txt', 'md', 'pdf', 'docx', 'png', 'jpg', 'jpeg']
handle('attachment', async () => {
  const file = await pick(attachmentTypes)
  return file ? readAttachment(file) : null
})
handle('droppedAttachment', readAttachment)
async function readAttachment(file) {
  const ext = path.extname(file).slice(1).toLowerCase()
  if (!attachmentTypes.includes(ext)) throw Error('Unsupported attachment format.')
  const stat = await fs.stat(file)
  if (!stat.isFile() || stat.size > 50 * 1024 * 1024)
    throw Error('Choose a file of 50 MB or smaller.')
  let text
  if (['csv','tsv'].includes(ext)) text = await fs.readFile(file, 'utf8')
  else if (sheetTypes.includes(ext)) {
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
  } else if (ext === 'docx') {
    text = (await require('mammoth').extractRawText({path: file})).value
  } else if (['pdf', 'png', 'jpg', 'jpeg'].includes(ext)) {
    if (process.platform === 'darwin') {
      text = (await execFile(path.join(vendor, 'extract'), [file], {maxBuffer: 16e6, timeout: 600000})).stdout
    } else {
      const reader = new BrowserWindow({show: false, webPreferences: {sandbox: true, nodeIntegration: false, contextIsolation: true}})
      const timer = setTimeout(() => reader.destroy(), 600000)
      try {
        await reader.loadFile(path.join(__dirname, 'dist', 'extract.html'))
        const encoded = (await fs.readFile(file)).toString('base64')
        text = await reader.webContents.executeJavaScript('window.extractAttachment(' + JSON.stringify(encoded) + ',' + JSON.stringify(ext) + ')')
      } finally {
        clearTimeout(timer)
        if (!reader.isDestroyed()) reader.destroy()
      }
    }
  }
  else text = await fs.readFile(file, 'utf8')
  return documentFile(path.basename(file), text, ext === 'pdf')
}
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
