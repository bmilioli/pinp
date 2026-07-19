#!/usr/bin/env bash
#
# Regenerate assets/icon.icns from assets/icon.svg.
#
# The SVG is the source of truth; the .icns is a build product that happens to
# be committed, so that cloning the repo doesn't require rsvg-convert. Run this
# after editing the SVG:  npm run icon
#
set -euo pipefail

cd "$(dirname "$0")/.."

SVG=assets/icon.svg
ICNS=assets/icon.icns
SET=build/icon.iconset

command -v rsvg-convert >/dev/null || {
  echo "rsvg-convert not found — brew install librsvg" >&2
  exit 1
}

rm -rf "$SET"
mkdir -p "$SET"

# The ten slots iconutil expects. Left column is the name it must have, right
# column the pixel size it must actually be rendered at.
render() {
  rsvg-convert -w "$2" -h "$2" "$SVG" -o "$SET/icon_$1.png"
}

render 16x16        16
render 16x16@2x     32
render 32x32        32
render 32x32@2x     64
render 128x128     128
render 128x128@2x  256
render 256x256     256
render 256x256@2x  512
render 512x512     512
render 512x512@2x 1024

iconutil -c icns "$SET" -o "$ICNS"
rm -rf "$SET"

echo "wrote $ICNS ($(du -h "$ICNS" | cut -f1))"
