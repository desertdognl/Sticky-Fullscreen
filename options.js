const saveOptions = () => {
  const extensionEnabled = document.getElementById('extensionEnabled').checked;
  const fullscreenSites = document.getElementById('fullscreenSites').value;
  const siteRules = document.getElementById('siteRules').value;
  const showFullscreenButton = document.getElementById('showFullscreenButton').checked;
  const hideMouseCursor = document.getElementById('hideMouseCursor').checked;
  const overlayPosition = document.getElementById('overlayPosition').value;
  const onlyAfterNavigation = document.getElementById('onlyAfterNavigation').checked;
  const autoExitOnLeave = document.getElementById('autoExitOnLeave').checked;
  const autoExitOnTabBlur = document.getElementById('autoExitOnTabBlur').checked;

  const legacyLines = siteRules
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('#'))
    .map(line => line.split(/\s+/)[0])
    .filter(Boolean);

  chrome.storage.sync.set({
    extensionEnabled,
    fullscreenSites: legacyLines.join('\n') || fullscreenSites,
    siteRules,
    showFullscreenButton,
    hideMouseCursor,
    overlayPosition,
    onlyAfterNavigation,
    autoExitOnLeave,
    autoExitOnTabBlur
  }, () => {
    const status = document.getElementById('status');
    status.textContent = 'Settings saved!';
    setTimeout(() => { status.textContent = ''; }, 2000);
  });
};

const restoreOptions = () => {
  chrome.storage.sync.get({
    extensionEnabled: true,
    fullscreenSites: '',
    siteRules: '',
    showFullscreenButton: true,
    hideMouseCursor: false,
    overlayPosition: 'top-right',
    onlyAfterNavigation: false,
    autoExitOnLeave: false,
    autoExitOnTabBlur: false
  }, (items) => {
    document.getElementById('extensionEnabled').checked = !!items.extensionEnabled;
    document.getElementById('fullscreenSites').value = items.fullscreenSites;
    document.getElementById('siteRules').value = items.siteRules || items.fullscreenSites;
    document.getElementById('showFullscreenButton').checked = !!items.showFullscreenButton;
    document.getElementById('hideMouseCursor').checked = !!items.hideMouseCursor;
    document.getElementById('overlayPosition').value = items.overlayPosition || 'top-right';
    document.getElementById('onlyAfterNavigation').checked = !!items.onlyAfterNavigation;
    document.getElementById('autoExitOnLeave').checked = !!items.autoExitOnLeave;
    document.getElementById('autoExitOnTabBlur').checked = !!items.autoExitOnTabBlur;
  });
};

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);