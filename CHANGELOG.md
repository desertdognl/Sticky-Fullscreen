# Changelog

All notable changes to this extension are documented below.

## 1.1.2 (2026-01-14)

- Added option: **Show Fullscreen Button** — toggle whether the small "Enter Fullscreen" overlay button is shown on allowed sites. The overlay auto-hides after 10 seconds.
- Added option: **Hide Mouse Cursor** — when enabled, the mouse cursor will automatically hide after 10 seconds of inactivity on allowed sites.
- Added option: **Avoid fullscreen on initial page load** — when enabled, the extension will not trigger fullscreen on the first completed navigation for a tab; it will only perform fullscreen after a subsequent redirect/navigation.
- Implemented per-tab tracking in the background script to skip initial fullscreen when the above option is enabled.
- Implemented overlay auto-hide (10s) and mouse-hider behavior in `content.js`.
- Removed the `Fullscreen Button Timeout` option (timeout is now hardcoded to 10 seconds).
- Fixed: Ensure cursor hiding works after redirects and SPA navigations by detecting URL changes in `content.js`.

## 1.1.0

- Initial public release.
