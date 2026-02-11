(() => {
  function tryFullscreen() {
    const el = document.documentElement || document.body;
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
    if (typeof req === 'function') {
      try { req.call(el); } catch (_) {}
    }
  }

  // Listen for real click events on the overlay button in page world.
  // Using a capture-phase listener ensures we run within the actual user gesture.
  window.addEventListener('click', (ev) => {
    try {
      const t = ev.target;
      if (t && t.id === 'sticky-fullscreen-overlay-button') {
        tryFullscreen();
      }
    } catch (_) {}
  }, true);

  // Fallback: allow message-based trigger if needed
  window.addEventListener('message', (ev) => {
    try {
      const data = ev && ev.data;
      if (data && data.type === 'StickyFullscreenRequest') {
        tryFullscreen();
      }
    } catch (_) {}
  }, false);
})();
