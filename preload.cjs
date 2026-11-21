const { contextBridge, ipcRenderer } = require('electron')
const api = {}
for (const name of [
  'list',
  'read',
  'create',
  'save',
  'importFile',
  'exportFile',
  'attachment',
  'audit',
  'chat',
  'modelStatus',
  'toggleStar',
  'flushDone',
])
  api[name] = (...args) => ipcRenderer.invoke(name, ...args)
api.onFlush = (fn) => ipcRenderer.on('flush', () => fn())
contextBridge.exposeInMainWorld('localDesk', api)
