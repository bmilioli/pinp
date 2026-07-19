'use strict'

const path = require('node:path')
const { Tray, Menu, app, nativeImage } = require('electron')

/**
 * Accessory mode buys us the floating behavior (no Space ownership, so macOS
 * never yanks the user to our Space) but costs us the Dock icon AND the menu
 * bar. That leaves no obvious way to quit — especially once the window is
 * hidden. The menu bar is the standard macOS home for a dockless app.
 */

// Module-level: a Tray that gets garbage collected disappears from the menu bar.
let tray = null

function create({ onToggleVisible }) {
  const icon = nativeImage.createFromPath(
    path.join(__dirname, '..', '..', 'assets', 'trayTemplate.png')
  )
  // Template image: macOS recolors it for light/dark menu bars on its own.
  icon.setTemplateImage(true)

  tray = new Tray(icon)
  tray.setToolTip('pinp')

  // These accelerators are display-only — Tray menus don't register them. They
  // are accurate because the same combos are registered via globalShortcut, and
  // they double as the discoverable place to learn the shortcuts exist.
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Show / Hide window',
        accelerator: 'Command+Control+Alt+H',
        click: onToggleVisible,
      },
      { type: 'separator' },
      {
        label: 'Quit pinp',
        accelerator: 'Command+Control+Alt+Q',
        click: () => app.quit(),
      },
    ])
  )

  return tray
}

module.exports = { create }
