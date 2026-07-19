# pinp

**A floating picture-in-picture mini-browser for macOS.**

A tiny always-on-top window that stays visible over *everything* — including
fullscreen apps and other Spaces — so you can keep a video, a stream, or a live
dashboard in the corner of your screen while you work.

It is a real browser, not a video embed: it renders any URL, keeps your login
sessions between restarts, and hides its entire UI until you hover it.

```
┌────────────────────────────────┐
│ ⠿ ‹ › ⟳ [ url…  ] S M L XL ◐ × │  ← chrome bar (only visible on hover)
├────────────────────────────────┤
│                                │
│          the page              │  ← 16:9, always-on-top, click-through-able
│                                │
└────────────────────────────────┘
```

> The codebase and its comments are in English so the project is accessible to
> the widest possible audience. Issues and pull requests in **English or
> Portuguese** are equally welcome.

---

## Table of contents

- [Why this exists](#why-this-exists)
- [Features](#features)
- [Requirements](#requirements)
- [Install & run](#install--run)
- [Building a .app](#building-a-app)
- [Usage](#usage)
  - [Keyboard shortcuts](#keyboard-shortcuts)
  - [The chrome bar](#the-chrome-bar)
  - [The menu bar icon](#the-menu-bar-icon)
- [How it works](#how-it-works)
  - [Architecture](#architecture)
  - [Process model & IPC](#process-model--ipc)
  - [The hard parts](#the-hard-parts)
- [Configuration](#configuration)
- [Project layout](#project-layout)
- [Known limitations](#known-limitations)
- [Ideas & good first issues](#ideas--good-first-issues)
- [Contributing](#contributing)
- [Security & privacy](#security--privacy)
- [License](#license)

---

## Why this exists

macOS has native picture-in-picture, and Safari/Chrome both support it — but it
comes with real constraints:

| | Native PiP | pinp |
|---|---|---|
| Works with any site | ❌ only `<video>` elements that opt in | ✅ any URL |
| Interact with the page | ❌ play/pause only | ✅ full browser |
| Survives fullscreen apps | ⚠️ inconsistent | ✅ by design |
| Keeps your session | ✅ | ✅ persistent partition |
| Click-through mode | ❌ | ✅ |
| Opacity control | ❌ | ✅ 100 / 80 / 60 / 40 % |
| Size presets & corner snapping | ❌ | ✅ global shortcuts |
| Needs the parent browser open | ✅ | ❌ standalone app |

The design goal is **zero friction**: the window has no title bar, no Dock icon,
no menu bar, and its controls are invisible until your cursor touches the top
edge. It should feel like part of the desktop, not like another app you manage.

---

## Features

- **Always on top of everything**, including other apps' fullscreen Spaces —
  and it never drags you out of the Space you're currently on.
- **Frameless 16:9 window** with a hover-revealed chrome bar.
- **Full navigation**: URL bar, back / forward / reload, and a bare search term
  falls back to a YouTube search.
- **Four size presets** — 320×180, 480×270, 640×360, 854×480.
- **Corner snapping** with a 16 px margin, respecting the menu bar and Dock.
- **Opacity cycling** through 100 → 80 → 60 → 40 %.
- **Click-through mode**: the window ignores the mouse entirely so you can click
  the app *behind* it while the video keeps playing on top.
- **Persistent session**: your logins survive restarts.
- **Google sign-in works** — see [the hard parts](#the-hard-parts) for the
  ~30 lines of reasoning behind that one.
- **Window state is remembered** (position, size, opacity) and validated against
  connected displays, so unplugging a monitor never strands the window
  off-screen.
- **Menu bar icon** for show/hide and quit, since an accessory app has no Dock
  icon or menu bar of its own.
- **No runtime dependencies.** `package.json` has two devDependencies (Electron
  and electron-builder) and nothing else.

---

## Requirements

- **macOS** (Apple Silicon build target is `arm64`; see
  [Known limitations](#known-limitations) for Intel).
- **Node.js 18+** and npm.
- **Xcode Command Line Tools** — only needed to build a `.app`
  (`xcode-select --install`). Running from source doesn't require them.

---

## Install & run

```bash
git clone <your-fork-url> pinp
cd pinp
npm install
npm start
```

The window appears immediately, loading YouTube. It takes no focus on launch by
design — it opens *inactive* so it can't yank you out of whatever you were
doing.

To see debug output about what the page actually observes:

```bash
PINP_DEBUG=1 npm start
```

This logs the `navigator.userAgent` seen inside the page after every load, which
is the first thing to check if Google sign-in ever breaks.

---

## Building a .app

```bash
npm run build
```

The bundle lands in `dist/mac-arm64/pinp.app`. Drag it to `/Applications`.

A few deliberate choices in `electron-builder.yml` that are worth understanding
before you change them:

- **`identity: "-"` (ad-hoc signature).** The resulting app runs only on the
  machine that built it — which is exactly the intended use case for a personal
  utility. It needs Command Line Tools only; the Xcode requirement in Apple's
  docs is about *notarization*, which we don't do.
- **`hardenedRuntime: false`.** This one is critical: hardened runtime combined
  with ad-hoc signing enables *library validation*, which rejects the prebuilt
  Electron framework (it has a different Team ID) and the app then simply
  refuses to launch.
- **`LSUIElement: true`.** Marks it as an accessory app — no Dock icon, no menu
  bar. This mirrors `app.setActivationPolicy('accessory')` at runtime, and
  having it in the plist means the Dock icon never flashes during startup.
- **`NSBluetooth*UsageDescription`.** Google sign-in can fall back to passkeys
  and security keys, which travel over Bluetooth. Chromium refuses to touch
  Bluetooth unless the bundle declares a usage description — without these the
  FIDO path fails with *"does not have Bluetooth metadata in its Info.plist"*.

---

## Usage

### Keyboard shortcuts

All shortcuts are **global** — they work no matter which app has focus. The
modifier is <kbd>⌘</kbd><kbd>⌃</kbd><kbd>⌥</kbd> (Command + Control + Option).

| Shortcut | Action |
|---|---|
| <kbd>⌘⌃⌥</kbd> + <kbd>1</kbd> | Size preset S — 320×180 |
| <kbd>⌘⌃⌥</kbd> + <kbd>2</kbd> | Size preset M — 480×270 |
| <kbd>⌘⌃⌥</kbd> + <kbd>3</kbd> | Size preset L — 640×360 |
| <kbd>⌘⌃⌥</kbd> + <kbd>4</kbd> | Size preset XL — 854×480 |
| <kbd>⌘⌃⌥</kbd> + <kbd>←</kbd> | Snap to bottom-left |
| <kbd>⌘⌃⌥</kbd> + <kbd>→</kbd> | Snap to bottom-right |
| <kbd>⌘⌃⌥</kbd> + <kbd>↑</kbd> | Snap to top-right |
| <kbd>⌘⌃⌥</kbd> + <kbd>↓</kbd> | Snap to bottom-right |
| <kbd>⌘⌃⌥</kbd> + <kbd>O</kbd> | Cycle opacity |
| <kbd>⌘⌃⌥</kbd> + <kbd>H</kbd> | Show / hide the window |
| <kbd>⌘⌃⌥</kbd> + <kbd>P</kbd> | Toggle click-through |
| <kbd>⌘⌃⌥</kbd> + <kbd>Q</kbd> | Quit |

> ⚠️ The arrow-key mapping above is *as currently implemented*, and it's odd —
> `↓` and `→` both snap bottom-right, and **top-left is unreachable**. That's a
> known bug, not a design decision. See
> [good first issues](#ideas--good-first-issues).

If a shortcut does nothing, another app probably already owns that combination.
Registration failures are logged to the console rather than failing silently:

```
[pinp] shortcut unavailable (already taken?): Command+Control+Alt+O
```

**Click-through deserves a warning.** Once enabled, the window ignores *all*
mouse events — you cannot click its own UI to turn it back off. The global
<kbd>⌘⌃⌥P</kbd> is the only way out. The URL placeholder changes to remind you.

### The chrome bar

The bar is hidden by default, collapsed to a 14 px sliver at the top of the
window. Move the cursor over that sliver and it expands to 36 px, revealing:

- **⠿ drag handle** — the window is frameless, so this is how you move it. It's
  available even while collapsed.
- **‹ › ⟳** — back, forward, reload. Back/forward disable themselves when there's
  no history in that direction.
- **URL field** — accepts a full URL, a bare domain (`example.com`), or free
  text, which becomes a YouTube search. <kbd>Enter</kbd> navigates,
  <kbd>Esc</kbd> cancels. While the field has focus the bar stays pinned open.
- **S M L XL** — the four size presets.
- **◐** — cycle opacity.
- **×** — quit.

Important: the bar does not *overlay* the page. When it expands, the page view
is physically moved down and shrunk, so nothing is ever hidden behind it.

<kbd>⌘C</kbd> / <kbd>⌘V</kbd> / <kbd>⌘X</kbd> / <kbd>⌘A</kbd> / <kbd>⌘Z</kbd>
work in the URL field. They're wired manually because accessory mode removes the
menu bar, and with it the standard macOS edit accelerators — without this you
literally could not paste a URL.

### The menu bar icon

An accessory app has no Dock icon and no menu bar, which leaves no obvious way
to quit — especially once the window is hidden. The menu bar icon is the
standard macOS answer, and offers *Show / Hide window* and *Quit*. The
accelerators shown in that menu are display-only labels; the real registration
happens through `globalShortcut`.

---

## How it works

### Architecture

```
┌─────────────────────────────── main process ────────────────────────────────┐
│                                                                             │
│  index.js         app lifecycle · session/UA setup · global shortcuts · IPC │
│  window.js        the BrowserWindow + WebContentsView, and every action     │
│  tray.js          menu bar icon and its context menu                        │
│  bounds-store.js  persist/restore window state, validated against displays  │
│  google-login.js  the user-agent string, and the reasoning behind it        │
│                                                                             │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │ contextBridge (preload.js)
┌──────────────────────────────────┴──────────────────────────────────────────┐
│  renderer: chrome.html / chrome.css / chrome.js                             │
│  Just the hover bar. Sandboxed, CSP-locked, no Node access.                 │
└─────────────────────────────────────────────────────────────────────────────┘

The page itself lives in a separate WebContentsView layered on top of the
renderer, in a persistent session partition (`persist:pinp`).
```

Roughly 820 lines of JavaScript in total, heavily commented — most comments
explain *why* rather than *what*, because nearly every non-obvious line is
working around a specific platform or Electron behavior.

### Process model & IPC

The renderer never touches `ipcRenderer` directly. `preload.js` exposes a
minimal, explicit verb list on `window.pinp` behind `contextBridge`:

```js
window.pinp.navigate(url)        window.pinp.preset(n)
window.pinp.back()               window.pinp.snap(corner)
window.pinp.forward()            window.pinp.cycleOpacity()
window.pinp.reload()             window.pinp.quit()
window.pinp.setChromeVisible(b)

window.pinp.onNavState(cb)       // main → renderer: url, canGoBack, canGoForward
window.pinp.onClickThrough(cb)   // main → renderer: click-through state
```

Both the renderer and the page view run with `contextIsolation: true` and
`nodeIntegration: false`. The renderer additionally carries a strict CSP
(`default-src 'none'`).

### The hard parts

These are the non-obvious constraints the implementation is built around. If you
are going to change one of these areas, read the source comments first — they
document approaches that were tried and failed.

**Floating over fullscreen apps.** Three things must be true together:

```js
app.setActivationPolicy('accessory')      // before any window exists
w.setAlwaysOnTop(true, 'screen-saver')    // highest non-system level
w.setVisibleOnAllWorkspaces(true, {
  visibleOnFullScreen: true,
  skipTransformProcessType: true,
})
```

Accessory mode is what stops macOS from yanking you to the app's Space when it
activates — a *regular* app owns a Space, and that alone defeats the entire
point of a PiP window. And `skipTransformProcessType` matters precisely
*because* we're already a UIElement app: without it the process oscillates
between UIElement and Foreground, and the Dock icon flickers.

**The collapsed bar is 14 px, not 0 and not 5.** Not zero, because the
`WebContentsView` sits on top of the window's own renderer and any area it
covers receives no mouse events at all — collapsing to 0 would leave no DOM to
hover and no way to bring the bar back. Not 5, because macOS reserves roughly
the top 5 px of a frameless resizable window for its own resize border, so a
5 px sliver was entirely owned by the OS and never delivered a hover. Keep this
in sync with `--collapsed-h` in `chrome.css`.

**Google sign-in.** Google blocks sign-in from embedded browsers
([electron#22346](https://github.com/electron/electron/issues/22346)) with *"This
browser or app may not be secure."* Two approaches failed before the current one:

1. Stripping the `Electron/` token to leave a clean Chrome UA — Google's check is
   heuristic and flags Chrome-shaped embedded browsers anyway.
2. Overriding only the HTTP `User-Agent` header per host — the header said
   Firefox while `navigator.userAgent` inside the page still said Chrome. The
   check also runs client-side, and that mismatch is itself a red flag.

So the UA is set at the **webContents** level, where it drives both the header
and `navigator.userAgent`, and it is consistent across every request. Firefox
rather than Chrome, because Google's detection is built on Chrome-specific
signals, and YouTube is fully supported on Firefox (VP9/AV1/Opus all present) so
nothing is lost. `Sec-CH-UA*` client hints are stripped, because Firefox
implements none of them and a Firefox UA arriving alongside `Sec-CH-UA:
"Chromium"` contradicts itself in the same request.

The reported macOS version is hardcoded to `10.15`. **That is not a typo and
must not be "fixed"** — Firefox caps the reported macOS version at 10.15 for
fingerprinting resistance, so every real Firefox on Mac reports 10.15. A UA
claiming a plausible modern version (14.x, 15.x) is emitted by *no real browser*,
which makes it a tell rather than a disguise.

This is a heuristic countermeasure to a heuristic check, and Google can change
it unilaterally. If sign-in breaks, **bumping `FIREFOX_UA` in
`src/main/google-login.js` to a current Firefox release is the first thing to
try.**

**Other Electron quirks worked around:**

- `WebContentsView` instantiates with a *white* background (unlike the old
  `BrowserView`), causing a white flash on every load — hence
  `setBackgroundColor('#000000')`.
- `setAutoResize` no longer exists; view bounds are maintained manually on every
  `resize`, synchronously, or the view visibly lags behind the frame.
- Aspect ratio "is not respected when the window is resized programmatically",
  so the size presets carry exact 16:9 numbers themselves.
- No min/max window size is set, because
  [electron#50367](https://github.com/electron/electron/issues/50367) makes the
  aspect-ratio clamp drift when the window hits those constraints.
- Click-through silently stops working after a page reload
  ([electron#15376](https://github.com/electron/electron/issues/15376)), so it's
  re-applied on every `did-finish-load`.
- `showInactive()` rather than `show()` everywhere, so the window never steals
  focus.

---

## Configuration

There is no settings UI yet. The knobs are constants at the top of the source
files — a deliberate choice for now, and an obvious area for contribution
(see [ideas](#ideas--good-first-issues)).

| Constant | File | Default | Meaning |
|---|---|---|---|
| `HOME_URL` | `src/main/window.js` | `https://www.youtube.com` | Page loaded at startup |
| `PRESETS` | `src/main/window.js` | 320/480/640/854 wide | The four size presets |
| `OPACITY_STEPS` | `src/main/window.js` | `[1, .8, .6, .4]` | Opacity cycle |
| `SNAP_MARGIN` | `src/main/window.js` | `16` | Gap from screen edges when snapping |
| `ASPECT` | `src/main/window.js` | `16 / 9` | Locked aspect ratio |
| `CHROME_H` / `CHROME_COLLAPSED` | `src/main/window.js` | `36` / `14` | Bar heights — mirror in `chrome.css` |
| `FIREFOX_UA` | `src/main/google-login.js` | Firefox 148 | The user-agent string |
| bindings map | `src/main/index.js` | — | Global shortcuts |

**Window state** (position, size, opacity) is stored as JSON at:

```
~/Library/Application Support/pinp/window-state.json
```

It's written debounced at 400 ms so dragging doesn't hammer the disk, and
flushed on close. On load, the saved position is validated against the currently
connected displays — at least 80 px of the window must overlap some display's
work area, otherwise the position is discarded and macOS centers the window.
Delete this file to reset.

**Browser data** (cookies, logins, cache) lives in the `persist:pinp` partition
under the same directory.

---

## Project layout

```
pinp/
├── src/
│   ├── main/
│   │   ├── index.js          # entry point: lifecycle, session/UA, shortcuts, IPC
│   │   ├── window.js         # the window + page view, and every action on them
│   │   ├── tray.js           # menu bar icon
│   │   ├── bounds-store.js   # window state persistence + display validation
│   │   └── google-login.js   # the UA string and why it is what it is
│   ├── preload.js            # contextBridge surface — the only main↔renderer door
│   └── renderer/
│       ├── chrome.html       # the hover bar markup
│       ├── chrome.css        # its styling (keep --collapsed-h in sync!)
│       └── chrome.js         # hover logic, URL field, buttons
├── assets/
│   └── trayTemplate.png      # menu bar icon (template image — macOS recolors it)
├── electron-builder.yml      # macOS packaging config
└── package.json
```

---

## Known limitations

Stated plainly, because knowing where a project *doesn't* work is what makes it
worth contributing to:

- **macOS only.** The floating behavior depends on `activationPolicy`,
  `visibleOnAllWorkspaces` and `skipTransformProcessType`, which are
  Mac-specific. Windows and Linux would need a different implementation of the
  same idea.
- **Apple Silicon only in the build config.** The `arm64` target is hardcoded.
  It likely works on Intel by adding `x64` to the target list, but that is
  untested.
- **Ad-hoc signed**, so a built `.app` runs only on the machine that produced
  it. There is no notarized release.
- **No automated tests**, no linter, no CI.
- **No settings UI.** Changing the home page means editing a constant.
- **Google sign-in is inherently fragile** — it depends on a heuristic that
  Google controls.
- **The arrow-key snap bindings are wrong** (see the shortcuts table).
- **DRM-protected content (Netflix, Prime Video, etc.) will not play**, because
  the build doesn't ship the Widevine CDM.

---

## Ideas & good first issues

Contributions are genuinely welcome — this started as a personal utility and
there is a lot of low-hanging fruit.

**Good first issues:**

- 🐛 **Fix the arrow-key snapping.** `↑` should snap to a top corner pair and
  `↓` to a bottom pair, or the four arrows should map to the four corners in
  some coherent way. `top-left` is currently unreachable. `src/main/index.js`.
- 🐛 **Keep `CHROME_COLLAPSED` and `--collapsed-h` from drifting** — they're
  duplicated across JS and CSS with only a comment holding them together.
- ✨ **Remember the last URL** across restarts, alongside the window bounds.
- ✨ **A "reset window position" item** in the menu bar menu.
- 📝 **Screenshots / a GIF for this README.**

**Larger, higher-impact:**

- ⚙️ **A settings window** — home URL, custom shortcuts, presets, snap margin.
- 🔖 **Bookmarks or quick-switch shortcuts** for frequently used pages.
- 🪟 **Multiple windows**, so you can float two things at once.
- 🖥️ **Windows / Linux support**, with a per-platform floating strategy.
- 📐 **Free aspect ratio** as an option — 16:9 is locked today.
- 🧪 **Tests and CI.** There is nothing at all right now; even a smoke test that
  boots the app in CI would be a real improvement.
- 🔊 **A global play/pause shortcut** that reaches the page.
- 🎬 **Auto-detect the video element** and crop the window to it.

**Opinions wanted** (open an issue — no code needed):

- Is <kbd>⌘⌃⌥</kbd> the right modifier, or is it too awkward to reach?
- Should the chrome bar reveal on hover, or on a shortcut?
- Is YouTube the right default home page for a general-purpose tool?

---

## Contributing

1. **Fork and branch.** `git checkout -b feature/my-idea`
2. **Match the existing style.** No build step, no transpiler, no framework —
   plain CommonJS with `'use strict'`, 2-space indent, no semicolons. Adding a
   dependency should be argued for, not assumed; the project currently has zero
   runtime dependencies and that is a feature.
3. **Comment the *why*, not the *what*.** This codebase is mostly workarounds
   for platform behavior. If you discover a constraint, write it down — and if
   you tried an approach that failed, document *that* too. `google-login.js` is
   the model: it's more comment than code, and the comments are the valuable
   part.
4. **Test manually on a real Mac**, including: over a fullscreen app, across
   Spaces, after unplugging an external display, and after a page reload if you
   touched click-through.
5. **Open a PR** describing what you changed and how you verified it.

**Bug reports** should include your macOS version, your Mac's chip
(Apple Silicon / Intel), your Electron version, and whether you're running from
source or from a built `.app`. If it's a sign-in issue, the output of
`PINP_DEBUG=1 npm start` is the most useful thing you can attach.

Ideas, criticism of the architecture, and "why did you do it this way?"
questions are all welcome as issues.

---

## Security & privacy

- **pinp collects nothing and phones home to nowhere.** There is no telemetry,
  no analytics, no update check.
- **All browsing data stays local**, in the app's own Application Support
  directory. It is a separate browser profile — not shared with Safari or
  Chrome.
- **The renderer is locked down**: `contextIsolation: true`,
  `nodeIntegration: false`, a strict CSP, and an explicit `contextBridge`
  surface. The web page never gets Node access.
- **About the user-agent:** pinp presents itself as Firefox and removes
  Chromium's client-hint headers so its request headers don't contradict each
  other. Nothing is fabricated beyond the browser identity itself — no
  credentials are intercepted, no traffic is proxied or inspected. The full
  reasoning is in `src/main/google-login.js`. If you'd rather not do this, set
  `FIREFOX_UA` to Electron's default UA; everything except Google sign-in will
  keep working.
- Found a security issue? Open an issue, or contact the maintainer privately if
  you consider it sensitive.

---

## License

ISC. See `package.json`.

---

*Built with [Electron](https://www.electronjs.org/). If pinp is useful to you,
a star is appreciated — and an issue describing how you use it is appreciated
more.*
