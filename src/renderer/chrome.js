'use strict'

const hotzone = document.getElementById('hotzone')
const urlInput = document.getElementById('url')
const backBtn = document.getElementById('back')
const forwardBtn = document.getElementById('forward')

let pinned = false // held open while the URL field is in use
let closeTimer = null

function setOpen(open) {
  if (!open && pinned) return
  hotzone.classList.toggle('open', open)
  // The main process moves the WebContentsView to match — the bar isn't drawn
  // over the video, the video area actually shrinks.
  window.pinp.setChromeVisible(open)
}

hotzone.addEventListener('mouseenter', () => {
  clearTimeout(closeTimer)
  setOpen(true)
})

// Deferred: the drag handles are app-region: drag, and moving the cursor onto
// one can surface as a mouseleave even though the pointer never left the bar.
// Closing on a timer that any re-entry cancels absorbs those false leaves.
hotzone.addEventListener('mouseleave', () => {
  clearTimeout(closeTimer)
  closeTimer = setTimeout(() => setOpen(false), 150)
})

/* ---------- URL field ---------- */

urlInput.addEventListener('focus', () => {
  pinned = true
  urlInput.select()
})

urlInput.addEventListener('blur', () => {
  pinned = false
  setOpen(false)
})

urlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    window.pinp.navigate(urlInput.value)
    urlInput.blur()
  } else if (e.key === 'Escape') {
    urlInput.blur()
  }
})

/* ---------- buttons ---------- */

backBtn.addEventListener('click', () => window.pinp.back())
forwardBtn.addEventListener('click', () => window.pinp.forward())
document.getElementById('reload').addEventListener('click', () => window.pinp.reload())
document.getElementById('opacity').addEventListener('click', () => window.pinp.cycleOpacity())
document.getElementById('quit').addEventListener('click', () => window.pinp.quit())

for (const btn of document.querySelectorAll('.size')) {
  btn.addEventListener('click', () => window.pinp.preset(Number(btn.dataset.preset)))
}

/* ---------- state pushed from main ---------- */

window.pinp.onNavState(({ url, canGoBack, canGoForward }) => {
  // Don't clobber what the user is typing mid-navigation.
  if (document.activeElement !== urlInput) urlInput.value = url
  backBtn.disabled = !canGoBack
  forwardBtn.disabled = !canGoForward
})

window.pinp.onClickThrough((on) => {
  // Purely informational: while click-through is on this UI can't be clicked at
  // all, so the only way back is the global shortcut.
  urlInput.placeholder = on
    ? 'Click-through ON — ⌘⌃⌥P to disable'
    : 'URL or search on YouTube'
})
