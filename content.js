// Content script: when on an allowed domain, show a small overlay button
// that the user can click to enter fullscreen (satisfies user-gesture requirement).

let overlayTimeoutId = null;

function createOverlay(timeoutSeconds) {
  // timeoutSeconds provided but will be 10 (hardcoded usage)
  removeOverlay();
  if (document.getElementById('sticky-fullscreen-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'sticky-fullscreen-overlay';
  overlay.style.position = 'fixed';
  overlay.style.right = '18px';
  overlay.style.top = '18px';
  overlay.style.zIndex = '2147483647';
  overlay.style.backdropFilter = 'blur(4px)';

  const btn = document.createElement('button');
  btn.textContent = 'Enter Fullscreen';
  btn.style.background = '#54E4C3';
  btn.style.color = '#000';
  btn.style.border = 'none';
  btn.style.padding = '10px 14px';
  btn.style.borderRadius = '8px';
  btn.style.fontWeight = '600';
  btn.style.cursor = 'pointer';
  btn.style.boxShadow = '0 6px 18px rgba(0,0,0,0.2)';

  const close = document.createElement('button');
  close.textContent = '×';
  close.style.marginLeft = '8px';
  close.style.background = 'transparent';
  close.style.color = '#fff';
  close.style.border = 'none';
  close.style.fontSize = '18px';
  close.style.cursor = 'pointer';

  btn.addEventListener('click', async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch (e) {
      // ignore
    }
    removeOverlay();
  });

  close.addEventListener('click', removeOverlay);

  overlay.appendChild(btn);
  overlay.appendChild(close);
  document.body.appendChild(overlay);

  if (overlayTimeoutId) {
    clearTimeout(overlayTimeoutId);
    overlayTimeoutId = null;
  }

  if (typeof timeoutSeconds === 'number' && timeoutSeconds > 0) {
    overlayTimeoutId = setTimeout(() => {
      removeOverlay();
    }, timeoutSeconds * 1000);
  }
}

function removeOverlay() {
  const el = document.getElementById('sticky-fullscreen-overlay');
  if (overlayTimeoutId) {
    clearTimeout(overlayTimeoutId);
    overlayTimeoutId = null;
  }
  if (el) el.remove();
}

let mouseHideTimer = null;
let mouseHidden = false;
const MOUSE_HIDE_DELAY_SECONDS = 10; // fixed 10 seconds as requested

function addCursorHideStyle() {
  if (document.getElementById('sticky-fullscreen-cursor-style')) return;
  const style = document.createElement('style');
  style.id = 'sticky-fullscreen-cursor-style';
  style.textContent = '* { cursor: none !important; }';
  document.head.appendChild(style);
}

function removeCursorHideStyle() {
  const el = document.getElementById('sticky-fullscreen-cursor-style');
  if (el) el.remove();
}

function onUserActivityWhileHiding() {
  // show cursor immediately
  if (mouseHidden) {
    removeCursorHideStyle();
    mouseHidden = false;
  }
  if (mouseHideTimer) clearTimeout(mouseHideTimer);
  mouseHideTimer = setTimeout(() => {
    addCursorHideStyle();
    mouseHidden = true;
  }, MOUSE_HIDE_DELAY_SECONDS * 1000);
}

function enableMouseHider() {
  // attach listeners to reset the timer on activity
  document.addEventListener('mousemove', onUserActivityWhileHiding, true);
  document.addEventListener('keydown', onUserActivityWhileHiding, true);
  document.addEventListener('touchstart', onUserActivityWhileHiding, true);
  // start timer
  if (mouseHideTimer) clearTimeout(mouseHideTimer);
  mouseHideTimer = setTimeout(() => {
    addCursorHideStyle();
    mouseHidden = true;
  }, MOUSE_HIDE_DELAY_SECONDS * 1000);
}

function disableMouseHider() {
  document.removeEventListener('mousemove', onUserActivityWhileHiding, true);
  document.removeEventListener('keydown', onUserActivityWhileHiding, true);
  document.removeEventListener('touchstart', onUserActivityWhileHiding, true);
  if (mouseHideTimer) {
    clearTimeout(mouseHideTimer);
    mouseHideTimer = null;
  }
  if (mouseHidden) {
    removeCursorHideStyle();
    mouseHidden = false;
  }
}

function checkAndMaybeShow() {
  chrome.storage.sync.get({ fullscreenSites: '', showFullscreenButton: true, hideMouseCursor: false, onlyAfterNavigation: false }, (data) => {
    const sites = data.fullscreenSites.split('\n').map(s => s.trim()).filter(s => s.length > 0);
    const url = location.href;
    const isAllowed = sites.some(site => url.includes(site));
    if (isAllowed) {
      if (data.showFullscreenButton) {
        const showIfAllowed = () => {
          // hardcoded timeout of 10 seconds
          createOverlay(10);
        };

        if (data.onlyAfterNavigation) {
          // ask background whether this tab has seen an initial navigation
          chrome.runtime.sendMessage({ action: 'isTabSeen' }, (resp) => {
            if (resp && resp.seen) {
              showIfAllowed();
            } else {
              // do not show now; mark this tab as seen so next navigation will trigger
              chrome.runtime.sendMessage({ action: 'markTabSeen' }, () => {});
            }
          });
        } else {
          showIfAllowed();
        }
      }
      if (data.hideMouseCursor) {
        enableMouseHider();
      } else {
        disableMouseHider();
      }
    } else {
      removeOverlay();
      disableMouseHider();
    }
  });
}

// Listen for background messages (fallback path)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.action === 'showFullscreenPrompt') {
    chrome.storage.sync.get({ showFullscreenButton: true, fullscreenButtonTimeout: 5 }, (data) => {
      if (data.showFullscreenButton) {
        const timeout = parseInt(data.fullscreenButtonTimeout || 0, 10);
        createOverlay(Number.isNaN(timeout) ? 0 : timeout);
      }
    });
  }
});

// Run check on load and when storage changes
checkAndMaybeShow();
// Re-run checks when storage changes (including hideMouseCursor)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && (changes.fullscreenSites || changes.showFullscreenButton || changes.fullscreenButtonTimeout || changes.hideMouseCursor)) checkAndMaybeShow();
});

// Detect SPA / pushState / replaceState navigations and full redirects
(function watchUrlChanges() {
  let lastUrl = location.href;

  const onUrlChange = () => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      checkAndMaybeShow();
    }
  };

  const _pushState = history.pushState;
  history.pushState = function () {
    _pushState.apply(this, arguments);
    window.dispatchEvent(new Event('locationchange'));
  };

  const _replaceState = history.replaceState;
  history.replaceState = function () {
    _replaceState.apply(this, arguments);
    window.dispatchEvent(new Event('locationchange'));
  };

  window.addEventListener('popstate', () => window.dispatchEvent(new Event('locationchange')));
  window.addEventListener('locationchange', onUrlChange);

  // Fallback: poll for URL changes (covers some edge cases)
  setInterval(onUrlChange, 1000);
})();
