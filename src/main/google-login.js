'use strict'

/**
 * Google blocks sign-in from embedded browsers with "This browser or app may not
 * be secure" (electron#22346).
 *
 * What did NOT work, and why:
 *
 *  1. Stripping the `Electron/` token, leaving a clean Chrome UA. Google's check
 *     is heuristic and flags Chrome-shaped embedded browsers anyway.
 *  2. Overriding only the HTTP User-Agent header via webRequest, per host. The
 *     header said Firefox but `navigator.userAgent` inside the page still said
 *     Chrome. The check also runs client-side, so it saw Chrome — and the
 *     header/JS mismatch is itself a red flag.
 *
 * So the UA has to change at the webContents level, where it drives BOTH the
 * header and `navigator.userAgent`, and it has to be consistent everywhere —
 * a session that is Firefox on the login page and Chrome on YouTube gets caught
 * by exactly the mismatch in (2).
 *
 * Firefox rather than Chrome because Google's embedded-browser detection is
 * built on Chrome-specific signals. YouTube itself is fully supported on
 * Firefox (VP9/AV1/Opus all present), so nothing is lost by presenting as it.
 *
 * This is a heuristic countermeasure to a heuristic check — Google can change it
 * unilaterally. If sign-in breaks again, bumping FIREFOX_UA to a current Firefox
 * release is the first thing to try.
 */

// The macOS version is HARDCODED at 10.15 — that is not a typo and must not be
// "fixed" to match the real OS. Firefox caps the reported macOS version at 10.15
// for fingerprinting resistance, so every real Firefox on Mac says 10.15 no
// matter what it's running on. A UA claiming a plausible-looking modern version
// (14.x, 15.x) is emitted by NO real browser, which makes it a tell rather than
// a disguise.
//
// `rv:` must always match the Firefox/ version.
const FIREFOX_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:148.0) Gecko/20100101 Firefox/148.0'

module.exports = { FIREFOX_UA }
