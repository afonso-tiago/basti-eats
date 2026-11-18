(() => {
  const storageKey = 'basti-eats:theme';
  const modes = ['light', 'dark', 'auto'];
  const deviceTheme = matchMedia('(prefers-color-scheme: dark)');
  const browserColor = document.querySelector('meta[name="theme-color"]');

  function readMode() {
    try {
      const saved = localStorage.getItem(storageKey);
      if (modes.includes(saved)) return saved;
    } catch {
      // Use the device setting when browser storage is unavailable.
    }
    return 'auto';
  }

  let mode = readMode();
  function applyTheme() {
    const dark = mode === 'dark' || (mode === 'auto' && deviceTheme.matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    browserColor.content = dark ? '#1d1916' : '#faf8f3';
  }
  applyTheme();
  deviceTheme.addEventListener('change', () => {
    if (mode === 'auto') applyTheme();
  });

  document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('theme-toggle');
    const icon = toggle.querySelector('use');
    const nextMode = () => modes[(modes.indexOf(mode) + 1) % modes.length];
    const capitalize = (value) => value[0].toUpperCase() + value.slice(1);

    function renderButton() {
      const description = `Theme is ${capitalize(mode)}. Switch to ${capitalize(nextMode())}.`;
      toggle.setAttribute('aria-label', description);
      toggle.title = description;
      icon.setAttribute('href', `#theme-${mode}`);
    }

    toggle.addEventListener('click', () => {
      mode = nextMode();
      try {
        localStorage.setItem(storageKey, mode);
      } catch {
        // Apply the theme for this page when it cannot be saved.
      }
      applyTheme();
      renderButton();
    });
    window.addEventListener('storage', (event) => {
      if (event.key !== storageKey && event.key !== null) return;
      mode = readMode();
      applyTheme();
      renderButton();
    });
    renderButton();
  });
})();
