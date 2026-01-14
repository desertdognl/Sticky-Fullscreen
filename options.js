const saveOptions = () => {
  const fullscreenSites = document.getElementById('fullscreenSites').value;
  const showFullscreenButton = document.getElementById('showFullscreenButton').checked;
  const hideMouseCursor = document.getElementById('hideMouseCursor').checked;
  const onlyAfterNavigation = document.getElementById('onlyAfterNavigation').checked;

  chrome.storage.sync.set({ fullscreenSites, showFullscreenButton, hideMouseCursor, onlyAfterNavigation }, () => {
    const status = document.getElementById('status');
    status.textContent = 'Settings saved!';
    setTimeout(() => { status.textContent = ''; }, 2000);
  });
};

const restoreOptions = () => {
  chrome.storage.sync.get({ fullscreenSites: '', showFullscreenButton: true, hideMouseCursor: false, onlyAfterNavigation: false }, (items) => {
    document.getElementById('fullscreenSites').value = items.fullscreenSites;
    document.getElementById('showFullscreenButton').checked = !!items.showFullscreenButton;
    document.getElementById('hideMouseCursor').checked = !!items.hideMouseCursor;
    document.getElementById('onlyAfterNavigation').checked = !!items.onlyAfterNavigation;
  });
};

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);