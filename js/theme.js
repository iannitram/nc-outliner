const themes = ['auto', 'light', 'dark'];

/** Auto inherits Nextcloud's live theme variables rather than the OS preference. */
export function applyTheme(root, theme) {
  if (!themes.includes(theme)) throw new RangeError('Unknown appearance');
  if (theme === 'auto') delete root.dataset.outlinerTheme;
  else root.dataset.outlinerTheme = theme;
}

export function createThemeApi(base, fetcher = globalThis.fetch) {
  return async (theme) => {
    const response = await fetcher(`${base}/theme`, {
      method: theme === undefined ? 'GET' : 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', requesttoken: globalThis.OC?.requestToken ?? '' },
      ...(theme === undefined ? {} : { body: JSON.stringify({ theme }) }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to save appearance.');
    if (!themes.includes(result.theme)) throw new Error('Invalid appearance response.');
    return result.theme;
  };
}

/** A server preference belongs to the signed-in account and follows it across browsers. */
export function mountTheme(root, toolbar, { request = createThemeApi(root.dataset.apiBase) } = {}) {
  const document = root.ownerDocument;
  const label = document.createElement('label');
  label.className = 'outliner-theme';
  const caption = document.createElement('span');
  caption.textContent = 'Appearance';
  const select = document.createElement('select');
  select.setAttribute('aria-label', 'Appearance');
  for (const theme of themes) {
    const option = document.createElement('option');
    option.value = theme;
    option.textContent = theme[0].toUpperCase() + theme.slice(1);
    select.appendChild(option);
  }
  const status = document.createElement('span');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  label.append(caption, select, status);
  toolbar.appendChild(label);
  let saved = 'auto';
  let destroyed = false;
  applyTheme(root, saved);
  select.value = saved;
  select.disabled = true;
  const ready = request().then((theme) => {
    if (destroyed) return;
    saved = theme;
    select.value = saved;
    applyTheme(root, saved);
  }).catch(() => {
    if (!destroyed) status.textContent = 'Unable to load appearance.';
  }).finally(() => { if (!destroyed) select.disabled = false; });
  const change = async () => {
    const wanted = select.value;
    if (!themes.includes(wanted) || select.disabled) return;
    select.disabled = true;
    status.textContent = 'Saving appearance';
    applyTheme(root, wanted);
    try {
      const theme = await request(wanted);
      if (destroyed) return;
      saved = theme;
      select.value = saved;
      applyTheme(root, saved);
      status.textContent = '';
    } catch {
      if (destroyed) return;
      select.value = saved;
      applyTheme(root, saved);
      status.textContent = 'Unable to save appearance. Try again.';
    } finally { if (!destroyed) select.disabled = false; }
  };
  select.addEventListener('change', change);
  return { ready, destroy() { destroyed = true; select.removeEventListener('change', change); label.remove(); } };
}
