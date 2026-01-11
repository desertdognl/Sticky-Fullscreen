const saveOptions = () => {
  const fullscreenSites = document.getElementById('fullscreenSites').value;

  chrome.storage.sync.set({ fullscreenSites }, () => {
    const status = document.getElementById('status');
    status.textContent = 'Settings saved!';
    setTimeout(() => { status.textContent = ''; }, 2000);
  });
};

const restoreOptions = () => {
  chrome.storage.sync.get({ fullscreenSites: '' }, (items) => {
    document.getElementById('fullscreenSites').value = items.fullscreenSites;
  });
};

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);