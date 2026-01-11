# Sticky Fullscreen

This Chrome extension maintains fullscreen mode for specific domains across redirects.

## The Problem

Some web applications, especially those used for presentations or dashboards, are best used in fullscreen. However, when you navigate or are redirected to a new page within the same domain, the browser often exits fullscreen mode. This can be disruptive and require manual intervention.

## The Solution

Sticky Fullscreen allows you to whitelist specific domains where you want to enforce fullscreen mode. Once a domain is on the list, the extension will ensure that any tab navigating to that domain automatically enters fullscreen.

## How it Works

The extension listens for tab updates. When a tab finishes loading, the extension checks if the URL belongs to a domain on your whitelist. If it does, it forces the browser window into fullscreen mode.

## Arc browser compatibility

Some Chromium-based browsers (notably Arc) block extensions from forcing fullscreen programmatically because fullscreen entry typically requires a user gesture. When that happens the extension cannot silently set the window to fullscreen.

This extension includes a fallback for those browsers: it attempts the normal `chrome.windows.update({ state: 'fullscreen' })` call, and if that fails the extension uses a content script to show a small overlay button on pages matching your whitelist. Clicking that button runs the page's `requestFullscreen()` call — a user gesture — which will enter fullscreen in browsers that block programmatic fullscreen.

Known behavior:
- Google Chrome (standard builds): the extension can usually set the window to fullscreen automatically.
- Arc and other Chromium forks: programmatic fullscreen may be blocked; the overlay button provides a one-click workaround.

## How to Use

1.  Click the extension icon in your browser toolbar.
2.  Enter the domains you want to keep in fullscreen, one per line. For example:
    ```
    example.com
    app.another-domain.net
    ```
3.  Click "Save".
4.  Navigate to one of the whitelisted domains. The window should now enter and remain in fullscreen mode as you navigate within that domain.

## For Developers

The background script (`background.js`) contains the core logic. It uses the `webNavigation` and `chrome.windows.update` APIs to detect navigation and attempt fullscreen. For browsers that block programmatic fullscreen, a content script (`content.js`) shows a clickable overlay that calls `document.documentElement.requestFullscreen()` as a user gesture.

Files of interest:
- [manifest.json](manifest.json)
- [background.js](background.js)
- [content.js](content.js)
- [options.html](options.html)

To debug: inspect the service worker from the `chrome://extensions` page (in Chrome) or use the developer tools in your browser to see logs from the content script.

## 📜 License
MIT License - feel free to use and modify for your own projects.

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://www.buymeacoffee.com/desertdog)
