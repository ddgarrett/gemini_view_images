const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Supported media extensions
const mediaExts = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.webm', '.ogg']);

function scanDirectory(dirPath) {
  const result = { name: path.basename(dirPath), path: dirPath, type: 'folder', children: [] };
  try {
    const items = fs.readdirSync(dirPath);
    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        const subDir = scanDirectory(fullPath);
        if (subDir.children.length > 0) result.children.push(subDir);
      } else {
        const ext = path.extname(item).toLowerCase();
        if (mediaExts.has(ext)) {
          const isVideo = ['.mp4', '.webm', '.ogg'].includes(ext);
          result.children.push({
            name: item,
            path: fullPath,
            type: isVideo ? 'video' : 'image',
            size: stat.size
          });
        }
      }
    }
  } catch (err) {
    console.error("Error reading dir:", err);
  }
  return result;
}

ipcMain.handle('dialog:openFolder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  if (canceled || filePaths.length === 0) return null;
  
  const rootDir = filePaths[0];
  return scanDirectory(rootDir);
});

// Handle Saving the JSON
ipcMain.handle('dialog:saveFile', async (event, jsonData) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Save Folder Structure',
    filters: [{ name: 'JSON Files', extensions: ['json'] }]
  });
  
  if (!canceled && filePath) {
    fs.writeFileSync(filePath, jsonData, 'utf-8');
    return true;
  }
  return false;
});

// Handle Opening a saved JSON
ipcMain.handle('dialog:openFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Open Folder Structure',
    properties: ['openFile'],
    filters: [{ name: 'JSON Files', extensions: ['json'] }]
  });
  
  if (!canceled && filePaths.length > 0) {
    const rawData = fs.readFileSync(filePaths[0], 'utf-8');
    return JSON.parse(rawData);
  }
  return null;
});