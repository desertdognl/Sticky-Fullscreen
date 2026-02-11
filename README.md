# Sticky Fullscreen

This Chrome extension maintains fullscreen mode for specific domains across redirects.

## The Problem

Some web applications, especially those used for presentations or dashboards, are best used in fullscreen. However, when you navigate or are redirected to a new page within the same domain, the browser often exits fullscreen mode. This can be disruptive and require manual intervention.

## The Solution

Sticky Fullscreen allows you to whitelist specific domains where you want to enforce fullscreen mode. Once a domain is on the list, the extension will ensure that any tab navigating to that domain automatically enters fullscreen.

## How it Works

The extension listens for navigations. When a tab finishes loading, the extension checks if the URL belongs to a domain on your whitelist. If it does, it will try to make the window fullscreen. There are user-controllable options (see below) to tweak when and how the extension shows its overlay and triggers fullscreen.

## Arc browser compatibility

Some Chromium-based browsers (notably Arc) block extensions from forcing fullscreen programmatically because fullscreen entry typically requires a user gesture. When that happens the extension cannot silently set the window to fullscreen.

This extension includes a fallback for browsers that block programmatic fullscreen: it attempts `chrome.windows.update({ state: 'fullscreen' })`, and if that fails the content script shows a small overlay button on matching pages. Clicking that button runs the page's `requestFullscreen()` call — a user gesture — which will enter fullscreen in browsers that block programmatic fullscreen.

Known behavior:
- Google Chrome (standard builds): the extension can usually set the window to fullscreen automatically.
- Arc and other Chromium forks: programmatic fullscreen may be blocked; the overlay button provides a one-click workaround. As of 1.4.3, the overlay triggers fullscreen via a page-world helper loaded as an external extension resource so Arc’s CSP permits it and treats the click as a real user gesture.
- Arc version variability: behavior may differ across Arc versions. Older Arc builds have allowed some programmatic fullscreen flows; newer builds typically require a user gesture and will exit fullscreen on redirects. Expect to re-enter fullscreen via the overlay after navigation.
- Arc window modes: “Little Arc” and sidebar windows may impose extra restrictions on fullscreen. Test in a standard Arc tab for the most consistent results.

## How to Use

1.  Click the extension icon in your browser toolbar.
3.  Enter the domains you want to keep in fullscreen, one per line. For example:
    ```
    example.com
    app.another-domain.net
    ```
4.  Click "Save".
5.  Visit a whitelisted site and use the new options:
    - Extension Enabled: globally enable or disable the extension.
    - Show Fullscreen Button: toggles the overlay button (it auto-hides after 10 seconds).
    - Avoid fullscreen on initial page load: when enabled, the extension will skip attempting fullscreen on the first completed navigation for a tab and will only act after a later redirect/navigation.
    - Hide Mouse Cursor: when enabled, hides the cursor after 10 seconds of inactivity on allowed sites.
    - Auto-exit fullscreen: leave fullscreen when navigating away from allowed sites or when switching away from a fullscreen tab.
    - Overlay Placement: choose Top-right (default) or Center to position the overlay. Center placement can be handy in Arc after redirects.
    - Site Rules: one rule per line using `pattern [overlay=on|off] [cursor=on|off]`. Wildcards (`*`) are supported and you can use `re:` for regex.

Note: the overlay hide timeout is now hardcoded to 10 seconds.

## Keyboard Shortcuts

- Toggle fullscreen (current tab): Ctrl+Shift+F (Command+Shift+F on macOS)
- Toggle extension enabled: Ctrl+Shift+E (Command+Shift+E on macOS)

## For Developers

The background script (`background.js`) contains the core logic. It uses the `webNavigation` and `chrome.windows.update` APIs to detect navigation and attempt fullscreen. For browsers that block programmatic fullscreen, a content script (`content.js`) shows a clickable overlay that calls `document.documentElement.requestFullscreen()` as a user gesture.

Files of interest:
- [manifest.json](manifest.json)
- [background.js](background.js)
- [content.js](content.js)
- [options.html](options.html)
- [CHANGELOG.md](CHANGELOG.md)

To debug: inspect the service worker from the `chrome://extensions` page (in Chrome) or use the developer tools in your browser to see logs from the content script. If you change the "Avoid fullscreen on initial page load" option, try reloading the extension and performing a redirect or navigation within the same tab to verify the behavior.

Version: 1.4.5

## Troubleshooting

- Error: "Extension context invalidated"
    - This can occur if the extension updates or reloads while a page is open, and the content script attempts to call Chrome APIs afterward. The extension now guards these calls to fail gracefully. If the error persists, reload the affected tab or refresh the extension from `chrome://extensions`.
- Arc: If clicking the overlay still doesn’t enter fullscreen, try a standard tab (not Little Arc) and ensure the site allows fullscreen. The extension injects a page-world helper, but Arc window modes or site policies can still prevent fullscreen in certain contexts.
    - If you see CSP errors about inline scripts, update to 1.4.3 or reload the extension to ensure the external helper is active.
    - Behavior can vary between Arc versions; if an older version worked differently, recent Arc updates may require the overlay click to re-enter fullscreen after redirects.

## 📜 License
MIT License - feel free to use and modify for your own projects.

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://www.buymeacoffee.com/desertdog)
