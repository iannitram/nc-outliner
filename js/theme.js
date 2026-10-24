export const THEME_PREFS = ['auto', 'light', 'dark'];

export function normalizePref(v) {
  return THEME_PREFS.includes(v) ? v : 'auto';
}

export function nextPref(p) {
  const normalized = normalizePref(p);
  const index = THEME_PREFS.indexOf(normalized);
  return THEME_PREFS[(index + 1) % THEME_PREFS.length];
}

export function themeAttr(p) {
  const normalized = normalizePref(p);
  return normalized === 'auto' ? null : normalized;
}

export function storageKey(uid) {
  return `outliner.theme.${uid || 'anonymous'}`;
}

export function loadPref(storage, uid) {
  try {
    if (!storage) return 'auto';
    const value = storage.getItem(storageKey(uid));
    return normalizePref(value);
  } catch (e) {
    return 'auto';
  }
}

export function savePref(storage, uid, pref) {
  try {
    if (!storage) return false;
    const normalized = normalizePref(pref);
    storage.setItem(storageKey(uid), normalized);
    return true;
  } catch (e) {
    return false;
  }
}