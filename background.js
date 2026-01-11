chrome.webNavigation.onCompleted.addListener((details) => {
  if (details.frameId === 0) { // Only for the main frame
    chrome.tabs.get(details.tabId, (tab) => {
      if (tab.url) {
        chrome.storage.sync.get({ fullscreenSites: '' }, (data) => {
          const sites = data.fullscreenSites.split('\n').map(s => s.trim()).filter(s => s.length > 0);
          const isAllowed = sites.some(site => tab.url.includes(site));

          if (isAllowed) {
            chrome.windows.get(tab.windowId, (currentWindow) => {
              if (currentWindow.state !== 'fullscreen') {
                chrome.windows.update(tab.windowId, { state: 'fullscreen' }, () => {
                  if (chrome.runtime.lastError) {
                    // Some Chromium-based browsers may block programmatic fullscreen.
                    // Ask the content script to show a user-gesture prompt overlay.
                    try {
                      chrome.tabs.sendMessage(details.tabId, { action: 'showFullscreenPrompt' });
                    } catch (e) {
                      // ignore
                    }
                  }
                });
              }
            });
          }
        });
      }
    });
  }
});