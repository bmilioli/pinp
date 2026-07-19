'use strict'

const { contextBridge, ipcRenderer } = require('electron')

// Explicit, minimal surface — the renderer gets verbs, never `ipcRenderer` itself.
contextBridge.exposeInMainWorld('pinp', {
  setChromeVisible: (visible) => ipcRenderer.send('chrome-visible', visible),
  navigate: (url) => ipcRenderer.send('navigate', url),
  back: () => ipcRenderer.send('back'),
  forward: () => ipcRenderer.send('forward'),
  reload: () => ipcRenderer.send('reload'),
  preset: (n) => ipcRenderer.send('preset', n),
  snap: (corner) => ipcRenderer.send('snap', corner),
  cycleOpacity: () => ipcRenderer.send('cycle-opacity'),
  quit: () => ipcRenderer.send('quit'),

  onNavState: (cb) => ipcRenderer.on('nav-state', (_e, s) => cb(s)),
  onClickThrough: (cb) => ipcRenderer.on('click-through', (_e, on) => cb(on)),
})
