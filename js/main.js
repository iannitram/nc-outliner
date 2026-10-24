(function () {
  function load() {
    const el = document.getElementById('outliner-app');
    if (!el) return;
    import(el.dataset.appJs).then((m) => m.start(el)).catch((error) => {
      el.textContent = error instanceof Error ? error.message : String(error);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
}());
