const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  saveFile: (data) => ipcRenderer.invoke('dialog:saveFile', data), 
  openFile: () => ipcRenderer.invoke('dialog:openFile')         
});