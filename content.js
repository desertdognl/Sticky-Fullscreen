const DEFAULT_SETTINGS = {
  fullscreenSites: '',
  siteRules: '',
  showFullscreenButton: true,
  hideMouseCursor: false,
  overlayPosition: 'top-right',
  onlyAfterNavigation: false,
  autoExitOnLeave: false,
  autoExitOnTabBlur: false,
  extensionEnabled: true
};

// Content script: when on an allowed domain, show a small overlay button
// that the user can click to enter fullscreen (satisfies user-gesture requirement).

let overlayTimeoutId = null;

// --- Robustness helpers to avoid "Extension context invalidated" errors ---
function isExtensionAlive() {
  try {
    return !!(chrome && chrome.runtime && chrome.runtime.id);
  } catch (_) {
    return false;
  }
}

function safeStorageSyncGet(keys, cb) {
  try {
    if (!isExtensionAlive() || !chrome.storage || !chrome.storage.sync || typeof chrome.storage.sync.get !== 'function') {
      cb && cb(DEFAULT_SETTINGS);
      return;
    }
    chrome.storage.sync.get(keys, (data) => {
      cb && cb(data || DEFAULT_SETTINGS);
    });
  } catch (_) {
    cb && cb(DEFAULT_SETTINGS);
  }
}

function safeRuntimeSendMessage(message, cb) {
  try {
    if (!isExtensionAlive() || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
      cb && cb();
      return;
    }
    chrome.runtime.sendMessage(message, (resp) => {
      cb && cb(resp);
    });
  } catch (_) {
    cb && cb();
  }
}

// --- Inject a page-world helper so Arc treats the action as a real gesture ---
let pageHelperInjected = false;
function injectPageWorldHelper() {
  if (pageHelperInjected) return;
  try {
    const script = document.createElement('script');
    script.id = 'sticky-fullscreen-page-helper';
    script.src = chrome.runtime.getURL('pageHelper.js');
    script.async = false; // ensure it loads synchronously on first use
    (document.head || document.documentElement).appendChild(script);
    pageHelperInjected = true;
  } catch (_) {
    // ignore
  }
}

function buildWildcardRegex(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const withWildcards = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${withWildcards}$`, 'i');
}

function parseRules(rulesText) {
  const rules = [];
  const lines = (rulesText || '').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const parts = trimmed.split(/\s+/);
    const pattern = parts.shift();
    if (!pattern) continue;

    const rule = {
      pattern,
      isRegex: false,
      hasProtocol: pattern.includes('://'),
      hasPath: pattern.includes('/'),
      overlay: null,
      cursor: null
    };

    if (pattern.startsWith('re:')) {
      rule.isRegex = true;
      const body = pattern.slice(3);
      try {
        rule.regex = new RegExp(body);
      } catch (e) {
        continue;
      }
    } else {
      rule.regex = buildWildcardRegex(pattern);
    }

    for (const token of parts) {
      const lower = token.toLowerCase();
      if (lower === 'overlay=on') rule.overlay = true;
      if (lower === 'overlay=off') rule.overlay = false;
      if (lower === 'cursor=on') rule.cursor = true;
      if (lower === 'cursor=off') rule.cursor = false;
    }

    rules.push(rule);
  }

  return rules;
}

function getRuleDecision(urlString, rulesText, legacyText) {
  let url;
  try {
    url = new URL(urlString);
  } catch (e) {
    return { allowed: false, overlay: null, cursor: null };
  }

  const rules = parseRules(rulesText);
  const targetHost = url.host;
  const targetHostPath = `${url.host}${url.pathname}${url.search}`;
  const targetFull = url.href;

  for (const rule of rules) {
    if (!rule.regex) continue;
    const target = rule.isRegex ? targetFull : (rule.hasProtocol ? targetFull : (rule.hasPath ? targetHostPath : targetHost));
    if (rule.regex.test(target)) {
      return { allowed: true, overlay: rule.overlay, cursor: rule.cursor };
    }
  }

  const legacySites = (legacyText || '')
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const legacy of legacySites) {
    const hasProtocol = legacy.includes('://');
    const hasPath = legacy.includes('/');
    const regex = buildWildcardRegex(legacy);
    const target = hasProtocol ? targetFull : (hasPath ? targetHostPath : targetHost);
    if (regex.test(target)) {
      return { allowed: true, overlay: null, cursor: null };
    }
  }

  return { allowed: false, overlay: null, cursor: null };
}

function createOverlay(timeoutSeconds, position) {
  // timeoutSeconds provided but will be 10 (hardcoded usage)
  removeOverlay();
  if (document.getElementById('sticky-fullscreen-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'sticky-fullscreen-overlay';
  overlay.style.position = 'fixed';
  if (position === 'center') {
    overlay.style.left = '50%';
    overlay.style.top = '50%';
    overlay.style.transform = 'translate(-50%, -50%)';
  } else {
    overlay.style.right = '18px';
    overlay.style.top = '18px';
  }
  overlay.style.zIndex = '2147483647';
  overlay.style.backdropFilter = 'blur(4px)';

  const btn = document.createElement('button');
  btn.textContent = 'Enter Fullscreen';
  btn.id = 'sticky-fullscreen-overlay-button';
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
    injectPageWorldHelper();
    // First try in content-script world (works in Chrome), then fallback to page world
    try {
      const el = document.documentElement;
      if (el && typeof el.requestFullscreen === 'function') {
        await el.requestFullscreen();
      } else {
        throw new Error('no requestFullscreen');
      }
    } catch (_) {
      try {
        window.postMessage({ type: 'StickyFullscreenRequest' }, '*');
      } catch (_) {}
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
  safeStorageSyncGet(DEFAULT_SETTINGS, (data) => {
    if (!data.extensionEnabled) {
      removeOverlay();
      disableMouseHider();
      return;
    }

    const decision = getRuleDecision(location.href, data.siteRules, data.fullscreenSites);
    const isAllowed = decision.allowed;
    const overlayAllowed = decision.overlay !== null ? decision.overlay : data.showFullscreenButton;
    const cursorEnabled = decision.cursor !== null ? decision.cursor : data.hideMouseCursor;

    if (isAllowed) {
      if (overlayAllowed) {
        const showIfAllowed = () => {
          // hardcoded timeout of 10 seconds
          const pos = data.overlayPosition || 'top-right';
          createOverlay(10, pos);
        };

        if (data.onlyAfterNavigation) {
          // ask background whether this tab has seen an initial navigation
          safeRuntimeSendMessage({ action: 'isTabSeen' }, (resp) => {
            if (resp && resp.seen) {
              showIfAllowed();
            } else {
              // do not show now; mark this tab as seen so next navigation will trigger
              safeRuntimeSendMessage({ action: 'markTabSeen' }, () => {});
            }
          });
        } else {
          showIfAllowed();
        }
      } else {
        removeOverlay();
      }

      if (cursorEnabled) {
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
  if (!isExtensionAlive()) return;
  if (msg && msg.action === 'showFullscreenPrompt') {
    safeStorageSyncGet(DEFAULT_SETTINGS, (data) => {
      if (!data.extensionEnabled) return;
      const decision = getRuleDecision(location.href, data.siteRules, data.fullscreenSites);
      const overlayAllowed = decision.overlay !== null ? decision.overlay : data.showFullscreenButton;
      if (!decision.allowed || !overlayAllowed) return;
      const pos = data.overlayPosition || 'top-right';
      createOverlay(10, pos);
    });
  }
});

// Run check on load and when storage changes
checkAndMaybeShow();
// Re-run checks when storage changes (including hideMouseCursor)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && (changes.fullscreenSites || changes.siteRules || changes.showFullscreenButton || changes.hideMouseCursor || changes.onlyAfterNavigation || changes.extensionEnabled)) checkAndMaybeShow();
});

window.addEventListener('pageshow', () => {
  try { checkAndMaybeShow(); } catch (_) {}
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    try { checkAndMaybeShow(); } catch (_) {}
  }
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
