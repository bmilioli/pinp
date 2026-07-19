'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { app, screen } = require('electron')

// A JSON blob of four numbers doesn't justify a dependency tree. The only real
// value a library would add is validating against connected displays — which is
// what `isOnSomeDisplay` below does.

const FILE = () => path.join(app.getPath('userData'), 'window-state.json')

const DEFAULTS = {
  width: 480,
  height: 275,
  x: null,
  y: null,
  opacity: 1,
}

function read() {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE(), 'utf8'))
    return { ...DEFAULTS, ...raw }
  } catch {
    return { ...DEFAULTS }
  }
}

/**
 * Without this, unplugging an external monitor makes the window restore to
 * coordinates that no longer exist — it opens off-screen and is unreachable.
 */
function isOnSomeDisplay(state) {
  if (state.x == null || state.y == null) return false
  // Require a meaningful slice of the window to be inside some work area, not
  // just one pixel of a corner.
  const MIN_VISIBLE = 80
  return screen.getAllDisplays().some(({ workArea: a }) => {
    const overlapX =
      Math.min(state.x + state.width, a.x + a.width) - Math.max(state.x, a.x)
    const overlapY =
      Math.min(state.y + state.height, a.y + a.height) - Math.max(state.y, a.y)
    return overlapX >= MIN_VISIBLE && overlapY >= MIN_VISIBLE
  })
}

function load() {
  const state = read()
  if (!isOnSomeDisplay(state)) {
    state.x = null
    state.y = null // let macOS center it on the primary display
  }
  return state
}

let timer = null

function save(state) {
  try {
    fs.writeFileSync(FILE(), JSON.stringify(state, null, 2))
  } catch (err) {
    console.error('[pinp] could not save window state:', err.message)
  }
}

/** Writing on every pixel of a drag would hammer the disk — 400ms of quiet is enough. */
function saveDebounced(state) {
  clearTimeout(timer)
  timer = setTimeout(() => save(state), 400)
}

function flush(state) {
  clearTimeout(timer)
  save(state)
}

module.exports = { load, saveDebounced, flush }
