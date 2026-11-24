const { contextBridge, ipcRenderer, webUtils } = require('electron')
const api = { platform: process.platform }
for (const name of [
  'list',
  'setAppearance',
  'read',
  'create',
  'save',
  'importFile',
  'exportFile',
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
api.attachment = () => ipcRenderer.invoke('attachment')
api.attachDroppedFile = (file) => {
  const path = webUtils.getPathForFile(file)
  if (!path) throw Error('Drop a file from your computer.')
  return ipcRenderer.invoke('droppedAttachment', path)
}
api.onFlush = (fn) => ipcRenderer.on('flush', () => fn())
contextBridge.exposeInMainWorld('localDesk', api)
