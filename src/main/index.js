'use strict'

const { app, globalShortcut, ipcMain, session } = require('electron')
const win = require('./window')
const googleLogin = require('./google-login')
const tray = require('./tray')

const PARTITION = 'persist:pinp'

// Must be set before any window exists. Accessory mode is what stops macOS from
// yanking the user to our Space when the app activates — a regular app owns a
// Space, and that alone defeats the whole point of a PiP window.
app.setActivationPolicy('accessory')

// Only one instance, or global shortcuts fight over registration.
if (!app.requestSingleInstanceLock()) app.quit()

app.whenReady().then(() => {
  app.dock?.hide()

  // One UA everywhere, applied at the webContents level so it drives both the
  // HTTP header and `navigator.userAgent`. See google-login.js for why a clean
  // Chrome UA (buildCleanUserAgent) is not enough on its own.
  const userAgent = googleLogin.FIREFOX_UA
  app.userAgentFallback = userAgent

  const ses = session.fromPartition(PARTITION)
  ses.setUserAgent(userAgent)
  stripClientHints(ses)

  const w = win.create({ userAgent, partition: PARTITION })

  // The pair that makes it float over fullscreen apps. `screen-saver` is the
  // highest non-system level; `skipTransformProcessType` matters precisely
  // BECAUSE we're already a UIElement app — without it the process oscillates
  // between UIElement and Foreground and the Dock icon flickers.
  w.setAlwaysOnTop(true, 'screen-saver')
  w.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true,
    skipTransformProcessType: true,
  })

  tray.create({ onToggleVisible: () => win.toggleVisible() })

  registerShortcuts()
  registerIpc()
})

/**
 * Chromium attaches User-Agent Client Hints (`Sec-CH-UA`, `Sec-CH-UA-Mobile`,
 * `Sec-CH-UA-Platform`) to every request. Firefox implements none of them.
 *
 * So without this, a single request carries a Firefox `User-Agent` AND a
 * `Sec-CH-UA: "Chromium";v="..."` — the two contradict each other in the same
 * set of headers, which is a stronger signal than the User-Agent alone. Setting
 * a convincing UA and leaving these in place defeats the point.
 *
 * Note this is NOT the failed approach in google-login.js (2): that one changed
 * the UA header while leaving `navigator.userAgent` disagreeing. Here the UA is
 * already consistent everywhere and we are only REMOVING headers that would
 * contradict it. Nothing is being forged.
 */
function stripClientHints(ses) {
  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = details.requestHeaders
    for (const name of Object.keys(headers)) {
      if (name.toLowerCase().startsWith('sec-ch-ua')) delete headers[name]
    }
    callback({ requestHeaders: headers })
  })
}

function registerShortcuts() {
  const bindings = {
    'Command+Control+Alt+1': () => win.applyPreset(1),
    'Command+Control+Alt+2': () => win.applyPreset(2),
    'Command+Control+Alt+3': () => win.applyPreset(3),
    'Command+Control+Alt+4': () => win.applyPreset(4),
    'Command+Control+Alt+Left': () => win.snapTo('bottom-left'),
    'Command+Control+Alt+Right': () => win.snapTo('bottom-right'),
    'Command+Control+Alt+Up': () => win.snapTo('top-right'),
    'Command+Control+Alt+Down': () => win.snapTo('bottom-right'),
    'Command+Control+Alt+O': () => win.cycleOpacity(),
    'Command+Control+Alt+H': () => win.toggleVisible(),
    'Command+Control+Alt+P': () => win.toggleClickThrough(),
    'Command+Control+Alt+Q': () => app.quit(),
  }

  for (const [accel, fn] of Object.entries(bindings)) {
    // Registration fails silently if another app already owns the combo —
    // surface it rather than leaving the user wondering why a key does nothing.
    if (!globalShortcut.register(accel, fn)) {
      console.warn(`[pinp] shortcut unavailable (already taken?): ${accel}`)
    }
  }
}

function registerIpc() {
  ipcMain.on('chrome-visible', (_e, visible) => win.setChromeVisible(!!visible))
  ipcMain.on('navigate', (_e, url) => win.navigate(url))
  ipcMain.on('back', () => win.goBack())
  ipcMain.on('forward', () => win.goForward())
  ipcMain.on('reload', () => win.reload())
  ipcMain.on('preset', (_e, n) => win.applyPreset(n))
  ipcMain.on('snap', (_e, corner) => win.snapTo(corner))
  ipcMain.on('cycle-opacity', () => win.cycleOpacity())
  ipcMain.on('quit', () => app.quit())
}

app.on('will-quit', () => globalShortcut.unregisterAll())
app.on('window-all-closed', () => app.quit())
