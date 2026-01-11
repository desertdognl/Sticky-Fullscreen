// Content script: when on an allowed domain, show a small overlay button
// that the user can click to enter fullscreen (satisfies user-gesture requirement).

function createOverlay() {
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
}

function removeOverlay() {
  const el = document.getElementById('sticky-fullscreen-overlay');
  if (el) el.remove();
}

function checkAndMaybeShow() {
  chrome.storage.sync.get({ fullscreenSites: '' }, (data) => {
    const sites = data.fullscreenSites.split('\n').map(s => s.trim()).filter(s => s.length > 0);
    const url = location.href;
    const isAllowed = sites.some(site => url.includes(site));
    if (isAllowed) {
      // Show overlay to allow user to enter fullscreen.
      createOverlay();
    } else {
      removeOverlay();
    }
  });
}

// Listen for background messages (fallback path)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.action === 'showFullscreenPrompt') {
    createOverlay();
  }
});

// Run check on load and when storage changes
checkAndMaybeShow();
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.fullscreenSites) checkAndMaybeShow();
});
