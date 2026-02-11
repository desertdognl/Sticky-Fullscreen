# Changelog

All notable changes to this extension are documented below.

## 1.4.1 (2026-02-11)

- Fix: Guard content script calls to Chrome APIs to avoid "Uncaught Error: Extension context invalidated" when the extension is reloaded or updated while a page is open. Calls to `chrome.storage` and `chrome.runtime.sendMessage` now use safe wrappers that fail gracefully.

## 1.4.2 (2026-02-11)

- Fix (Arc): Overlay button now triggers fullscreen via a page-world helper injected into the document. This makes the click count as a proper user gesture in Arc and similar Chromium forks, allowing `requestFullscreen()` to succeed.

## 1.4.3 (2026-02-11)

- Fix (Arc CSP): Replace inline script injection with an external helper `pageHelper.js` loaded via `web_accessible_resources` to comply with Arc’s Content Security Policy. The helper listens for real clicks on the overlay button and requests fullscreen in page world.

## 1.4.4 (2026-02-11)

- Docs: Update README with Arc behavior notes, including version variability (older Arc may have allowed programmatic fullscreen; newer versions require user gestures and often exit fullscreen on redirects).

## 1.4.5 (2026-02-11)

- Feature: Added "Overlay Placement" option (Top-right or Center). Center placement can improve usability in Arc by making re-entry to fullscreen faster after redirects.

## 1.3.0 (2026-01-16)

- Updated options popup width to 600px.

## 1.4.0 (2026-02-10)

- Added site rules with per-site overlay and cursor toggles, including wildcard and regex matching.
- Added auto-exit fullscreen options for leaving allowed sites and switching away from allowed tabs.
- Added keyboard shortcuts to toggle fullscreen and enable/disable the extension.
- Added a global enable toggle and legacy allowlist compatibility.

## 1.2.0 (2026-01-14)

- Added option: **Show Fullscreen Button** — toggle whether the small "Enter Fullscreen" overlay button is shown on allowed sites. The overlay auto-hides after 10 seconds.
- Added option: **Hide Mouse Cursor** — when enabled, the mouse cursor will automatically hide after 10 seconds of inactivity on allowed sites.
- Added option: **Avoid fullscreen on initial page load** — when enabled, the extension will not trigger fullscreen on the first completed navigation for a tab; it will only perform fullscreen after a subsequent redirect/navigation.
- Implemented per-tab tracking in the background script to skip initial fullscreen when the above option is enabled.
- Implemented overlay auto-hide (10s) and mouse-hider behavior in `content.js`.
- Removed the `Fullscreen Button Timeout` option (timeout is now hardcoded to 10 seconds).
- Fixed: Ensure cursor hiding works after redirects and SPA navigations by detecting URL changes in `content.js`.

## 1.1.0

- Initial public release.
