/** Encode filenames while retaining folder separators accepted by Apache. */
export function encodeOutlinePath(path) {
  return path.split('/').map(encodeURIComponent).join('/');
}
