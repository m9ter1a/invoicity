const { contextBridge, ipcRenderer } = require('electron')
const api = { platform: process.platform }
for (const name of [
  'list',
  'setAppearance',
  'read',
  'create',
  'save',
  'importFile',
  'exportFile',
  'attachment',
  'audit',
  'chat',
  'cancelChat',
  'compact',
  'transcribeVoice',
  'cancelVoice',
  'trashBook',
  'modelStatus',
  'toggleStar',
  'flushDone',
])
  api[name] = (...args) => ipcRenderer.invoke(name, ...args)
api.onFlush = (fn) => ipcRenderer.on('flush', () => fn())
contextBridge.exposeInMainWorld('localDesk', api)
