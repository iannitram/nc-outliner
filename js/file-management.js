import { encodeOutlinePath } from './file-path.js';
/** File paths are relative to the signed-in user's Outlines folder. */
export function renameDestination(path, name) {
  name = name.trim();
  if (!name || /[/\\]/.test(name)) throw new Error('Enter a filename without a path.');
  if (!name.toLowerCase().endsWith('.opml')) name += '.opml';
  return [...path.split('/').slice(0, -1), name].join('/');
}

export function moveDestination(path, folder) {
  folder = folder.trim().replace(/\/$/, '');
  if (folder && folder.split('/').some(part => !part || part.startsWith('.') || /[\\\x00-\x1f\x7f]/.test(part))) {
    throw new Error('Use a relative folder inside Outlines. Leave blank for Outlines itself.');
  }
  return [folder, path.split('/').at(-1)].filter(Boolean).join('/');
}

/** A failed/conflicted save leaves the current editor and filename intact. */
export async function relocateOutline(api, current, autosave, destination) {
  await autosave.flush();
  if (autosave.hasPending() || autosave.isConflicted()) throw new Error('Save or resolve the conflict before renaming or moving this outline.');
  return api(`/${encodeOutlinePath(current.name)}/relocate`, 'POST', { destination, etag: autosave.getEtag() });
}
