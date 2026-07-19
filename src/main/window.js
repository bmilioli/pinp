'use strict'

const path = require('node:path')
const { app, BrowserWindow, WebContentsView, screen, shell } = require('electron')
const boundsStore = require('./bounds-store')

// Expanded chrome bar height.
const CHROME_H = 36
// Collapsed height. Deliberately NOT zero: the WebContentsView sits on top of
// the window's own renderer, so any area it covers receives no mouse events at
// all. If the bar collapsed to 0 there would be no DOM left to hover and no way
// to bring it back. This sliver is the hover hot zone, and carries the drag
// handle that's always available.
//
// Also deliberately NOT 5: macOS reserves roughly the top 5px of a frameless
// resizable window for its own resize border, so a 5px sliver was entirely
// owned by the OS and never delivered a hover to the renderer. Keep this in
// sync with --collapsed-h in chrome.css.
const CHROME_COLLAPSED = 14

const ASPECT = 16 / 9

// Video-area sizes. Window height = these + CHROME_COLLAPSED.
const PRESETS = {
  1: { width: 320, height: 180 },
  2: { width: 480, height: 270 },
  3: { width: 640, height: 360 },
  4: { width: 854, height: 480 },
}

const OPACITY_STEPS = [1, 0.8, 0.6, 0.4]
const SNAP_MARGIN = 16
const HOME_URL = 'https://www.youtube.com'

let win = null
let view = null
let chromeVisible = false
let clickThrough = false
let state = null

function create({ userAgent, partition }) {
  state = boundsStore.load()

  win = new BrowserWindow({
    width: state.width,
    height: state.height,
    ...(state.x != null ? { x: state.x, y: state.y } : {}),
    frame: false,
    resizable: true,
    hasShadow: true,
    backgroundColor: '#000000',
    show: false,
    // No min/max size on purpose: electron#50367 makes the aspect-ratio clamp
    // drift when the window hits those constraints.
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // The ratio applies to the video area, so the chrome sliver is declared as
  // extra size that sits outside the ratio.
  win.setAspectRatio(ASPECT, { width: 0, height: CHROME_COLLAPSED })

  view = new WebContentsView({
    webPreferences: {
      partition, // persistent, so the YouTube login survives restarts
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  // WebContentsView instantiates with a WHITE background (unlike the old
  // BrowserView) — without this there's a white flash on every load.
  view.setBackgroundColor('#000000')
  view.webContents.setUserAgent(userAgent)

  win.contentView.addChildView(view)
  win.loadFile(path.join(__dirname, '..', 'renderer', 'chrome.html'))
  view.webContents.loadURL(HOME_URL)

  layoutView()
  wireEvents()

  // showInactive, not show: opening must not steal focus or drag the user out
  // of whatever Space they're on.
  win.showInactive()
  applyOpacity(state.opacity)

  return win
}

/** The view fills everything below the chrome bar. */
function layoutView() {
  if (!win || !view) return
  const [w, h] = win.getContentSize()
  const top = chromeVisible ? CHROME_H : CHROME_COLLAPSED
  view.setBounds({ x: 0, y: top, width: w, height: Math.max(0, h - top) })
}

function wireEvents() {
  // setAutoResize no longer exists — bounds are ours to maintain. This runs
  // synchronously (not debounced) or the view visibly lags behind the frame.
  win.on('resize', () => {
    layoutView()
    persist()
  })
  win.on('move', persist)

  win.on('close', () => {
    boundsStore.flush(snapshot())
  })

  // Keep target=_blank links inside the same view instead of spawning windows
  // that would have none of our floating behavior.
  view.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) {
      view.webContents.loadURL(url)
    } else {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  const pushNavState = () => {
    if (!win || win.isDestroyed()) return
    win.webContents.send('nav-state', {
      url: view.webContents.getURL(),
      canGoBack: view.webContents.navigationHistory.canGoBack(),
      canGoForward: view.webContents.navigationHistory.canGoForward(),
    })
  }
  view.webContents.on('did-navigate', pushNavState)
  view.webContents.on('did-navigate-in-page', pushNavState)

  // Click-through silently stops working after a page reload (electron#15376),
  // so it has to be re-applied every time the view finishes loading.
  view.webContents.on('did-finish-load', () => {
    if (clickThrough) win.setIgnoreMouseEvents(true, { forward: true })
    pushNavState()

    // Run with PINP_DEBUG=1 to see what the page ACTUALLY sees. The header and
    // navigator.userAgent must agree — a mismatch between them is itself one of
    // the signals Google uses to flag an embedded browser.
    if (process.env.PINP_DEBUG) {
      view.webContents
        .executeJavaScript('navigator.userAgent')
        .then((ua) => console.log('[pinp] navigator.userAgent =', ua))
        .catch(() => {})
    }
  })

  // Accessory mode removes the menu bar entirely, so the standard macOS edit
  // accelerators don't exist. Without this, you cannot paste a URL.
  win.webContents.on('before-input-event', (_event, input) => {
    if (!input.meta || input.type !== 'keyDown') return
    const wc = win.webContents
    switch (input.key.toLowerCase()) {
      case 'c': wc.copy(); break
      case 'v': wc.paste(); break
      case 'x': wc.cut(); break
      case 'a': wc.selectAll(); break
      case 'z': input.shift ? wc.redo() : wc.undo(); break
      case 'q': case 'w': app.quit(); break
    }
  })

  // ⌘Q also has to work while the video has focus — the two webContents receive
  // key events independently, and the view is what's focused most of the time.
  view.webContents.on('before-input-event', (_event, input) => {
    if (!input.meta || input.type !== 'keyDown') return
    const key = input.key.toLowerCase()
    if (key === 'q' || key === 'w') app.quit()
  })
}

function snapshot() {
  const b = win.getBounds()
  return { ...b, opacity: state.opacity }
}

function persist() {
  if (!win || win.isDestroyed()) return
  boundsStore.saveDebounced(snapshot())
}

/* ---------- actions exposed over IPC / global shortcuts ---------- */

function setChromeVisible(visible) {
  if (chromeVisible === visible) return
  chromeVisible = visible
  layoutView()
}

function applyPreset(n) {
  const p = PRESETS[n]
  if (!p || !win) return
  // The docs are explicit: "the aspect ratio is not respected when window is
  // resized programmatically" — so presets carry exact 16:9 numbers themselves.
  win.setSize(p.width, p.height + CHROME_COLLAPSED, false)
  layoutView()
  persist()
}

function snapTo(corner) {
  if (!win) return
  const b = win.getBounds()
  // workArea, not bounds: it already excludes the menu bar and the Dock.
  const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea

  const left = area.x + SNAP_MARGIN
  const right = area.x + area.width - b.width - SNAP_MARGIN
  const top = area.y + SNAP_MARGIN
  const bottom = area.y + area.height - b.height - SNAP_MARGIN

  const pos = {
    'top-left': [left, top],
    'top-right': [right, top],
    'bottom-left': [left, bottom],
    'bottom-right': [right, bottom],
  }[corner]
  if (!pos) return

  win.setPosition(Math.round(pos[0]), Math.round(pos[1]), false)
  persist()
}

function applyOpacity(value) {
  if (!win) return
  state.opacity = value
  win.setOpacity(value)
  persist()
}

function cycleOpacity() {
  const i = OPACITY_STEPS.indexOf(state.opacity)
  applyOpacity(OPACITY_STEPS[(i + 1) % OPACITY_STEPS.length])
}

function toggleVisible() {
  if (!win) return
  if (win.isVisible()) win.hide()
  else win.showInactive()
}

/**
 * Phase 5. Once the window ignores mouse events there is no way to click any UI
 * inside it — the toggle back MUST come from a global shortcut.
 */
function toggleClickThrough() {
  if (!win) return
  clickThrough = !clickThrough
  win.setIgnoreMouseEvents(clickThrough, { forward: true })
  win.webContents.send('click-through', clickThrough)
  return clickThrough
}

function navigate(input) {
  if (!view) return
  const raw = String(input || '').trim()
  if (!raw) return
  let url
  if (/^https?:\/\//i.test(raw)) url = raw
  // A bare token with a dot and no spaces is a domain; anything else is a search.
  else if (/^[^\s]+\.[^\s]{2,}$/.test(raw)) url = `https://${raw}`
  else url = `https://www.youtube.com/results?search_query=${encodeURIComponent(raw)}`
  view.webContents.loadURL(url)
}

const goBack = () => view?.webContents.navigationHistory.goBack()
const goForward = () => view?.webContents.navigationHistory.goForward()
const reload = () => view?.webContents.reload()
const getWindow = () => win

module.exports = {
  create,
  setChromeVisible,
  applyPreset,
  snapTo,
  cycleOpacity,
  toggleVisible,
  toggleClickThrough,
  navigate,
  goBack,
  goForward,
  reload,
  getWindow,
  CHROME_H,
  CHROME_COLLAPSED,
}
