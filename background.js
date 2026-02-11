const DEFAULT_SETTINGS = {
  fullscreenSites: '',
  siteRules: '',
  showFullscreenButton: true,
  hideMouseCursor: false,
  onlyAfterNavigation: false,
  autoExitOnLeave: false,
  autoExitOnTabBlur: false,
  extensionEnabled: true
};

// Keep track of whether we've seen an initial navigation for a tab.
// Stored per-tab in chrome.storage.local as key `seen_<tabId>`.
function markTabSeen(tabId, callback) {
  const key = `seen_${tabId}`;
  const obj = {};
  obj[key] = true;
  chrome.storage.local.set(obj, () => {
    if (callback) callback();
  });
}

function isTabSeen(tabId, cb) {
  const key = `seen_${tabId}`;
  chrome.storage.local.get([key], (res) => {
    cb(Boolean(res[key]));
  });
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
      hasPath: pattern.includes('/')
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

    rules.push(rule);
  }

  return rules;
}

function isUrlAllowed(urlString, rulesText, legacyText) {
  let url;
  try {
    url = new URL(urlString);
  } catch (e) {
    return false;
  }

  const rules = parseRules(rulesText);
  const targetHost = url.host;
  const targetHostPath = `${url.host}${url.pathname}${url.search}`;
  const targetFull = url.href;

  for (const rule of rules) {
    if (!rule.regex) continue;
    const target = rule.isRegex ? targetFull : (rule.hasProtocol ? targetFull : (rule.hasPath ? targetHostPath : targetHost));
    if (rule.regex.test(target)) return true;
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
    if (regex.test(target)) return true;
  }

  return false;
}

function exitFullscreen(windowId) {
  chrome.windows.get(windowId, (currentWindow) => {
    if (currentWindow && currentWindow.state === 'fullscreen') {
      chrome.windows.update(windowId, { state: 'normal' }, () => {
        if (chrome.runtime.lastError) {
          // ignore
        }
      });
    }
  });
}

chrome.webNavigation.onCompleted.addListener((details) => {
  if (details.frameId !== 0) return; // Only for the main frame

  chrome.tabs.get(details.tabId, (tab) => {
    if (!tab || !tab.url) return;

    chrome.storage.sync.get(DEFAULT_SETTINGS, (data) => {
      if (!data.extensionEnabled) return;

      const isAllowed = isUrlAllowed(tab.url, data.siteRules, data.fullscreenSites);

      if (!isAllowed) {
        if (data.autoExitOnLeave && tab.active) {
          exitFullscreen(tab.windowId);
        }
        return;
      }

      // If the option to only act after navigation is enabled, and this is the first
      // completed navigation for the tab, mark it as seen and skip fullscreen now.
      if (data.onlyAfterNavigation) {
        isTabSeen(details.tabId, (seen) => {
          if (!seen) {
            markTabSeen(details.tabId);
            return; // skip fullscreen on initial load
          }
          // otherwise fallthrough and attempt fullscreen
          attemptFullscreen(tab, details.tabId);
        });
      } else {
        attemptFullscreen(tab, details.tabId);
      }
    });
  });
});

function attemptFullscreen(tab, tabId) {
  chrome.windows.get(tab.windowId, (currentWindow) => {
    if (currentWindow && currentWindow.state !== 'fullscreen') {
      chrome.windows.update(tab.windowId, { state: 'fullscreen' }, () => {
        if (chrome.runtime.lastError) {
          // Some Chromium-based browsers may block programmatic fullscreen.
          // Ask the content script to show a user-gesture prompt overlay.
          try {
            chrome.tabs.sendMessage(tabId, { action: 'showFullscreenPrompt' });
          } catch (e) {
            // ignore
          }
        }
      });
    }
  });
}

const lastActiveTabByWindow = {};

chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (data) => {
    const windowId = activeInfo.windowId;
    const prevTabId = lastActiveTabByWindow[windowId];

    if (data.extensionEnabled && data.autoExitOnTabBlur && prevTabId && prevTabId !== activeInfo.tabId) {
      chrome.tabs.get(prevTabId, (prevTab) => {
        if (prevTab && prevTab.url && isUrlAllowed(prevTab.url, data.siteRules, data.fullscreenSites)) {
          exitFullscreen(windowId);
        }
      });
    }

    if (data.extensionEnabled && data.autoExitOnLeave) {
      chrome.tabs.get(activeInfo.tabId, (tab) => {
        if (tab && tab.url && !isUrlAllowed(tab.url, data.siteRules, data.fullscreenSites)) {
          exitFullscreen(windowId);
        }
      });
    }

    lastActiveTabByWindow[windowId] = activeInfo.tabId;
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  const key = `seen_${tabId}`;
  chrome.storage.local.remove(key, () => {
    if (chrome.runtime.lastError) {
      // ignore
    }
  });
});

// Respond to content script queries about whether this tab has been "seen"
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !sender || !sender.tab) return;
  const tabId = sender.tab.id;
  if (msg.action === 'isTabSeen') {
    isTabSeen(tabId, (seen) => sendResponse({ seen }));
    return true; // indicate async response
  }
  if (msg.action === 'markTabSeen') {
    markTabSeen(tabId, () => sendResponse({ ok: true }));
    return true;
  }
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-fullscreen') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      if (!tab) return;
      chrome.windows.get(tab.windowId, (currentWindow) => {
        if (!currentWindow) return;
        const nextState = currentWindow.state === 'fullscreen' ? 'normal' : 'fullscreen';
        chrome.windows.update(tab.windowId, { state: nextState }, () => {
          if (chrome.runtime.lastError) {
            // ignore
          }
        });
      });
    });
  }

  if (command === 'toggle-extension-enabled') {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (data) => {
      chrome.storage.sync.set({ extensionEnabled: !data.extensionEnabled }, () => {
        if (chrome.runtime.lastError) {
          // ignore
        }
      });
    });
  }
});