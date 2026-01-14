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

chrome.webNavigation.onCompleted.addListener((details) => {
  if (details.frameId !== 0) return; // Only for the main frame

  chrome.tabs.get(details.tabId, (tab) => {
    if (!tab || !tab.url) return;

    chrome.storage.sync.get({ fullscreenSites: '', onlyAfterNavigation: false }, (data) => {
      const sites = data.fullscreenSites.split('\n').map(s => s.trim()).filter(s => s.length > 0);
      const isAllowed = sites.some(site => tab.url.includes(site));

      if (!isAllowed) return;

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