import { findRow, flattenRows } from './model.js';
import { moveRow } from './row-actions.js';
import { indentRow, outdentRow } from './indent.js';

/** Move one whole subtree; destination IDs remain stable after removing source. */
export function dropRow(document, sourceId, targetId, position) {
  const source = findRow(document.rows, sourceId);
  const target = findRow(document.rows, targetId);
  if (!source || !target || !['before', 'inside', 'after'].includes(position)
    || flattenRows([source.row]).some((row) => row.id === targetId)) return document;
  const next = structuredClone(document);
  const moving = findRow(next.rows, sourceId);
  const [row] = moving.siblings.splice(moving.index, 1);
  const destination = findRow(next.rows, targetId);
  if (position === 'inside') {
    destination.row.children ??= [];
    destination.row.children.push(row);
    destination.row.collapsed = false;
  } else destination.siblings.splice(destination.index + (position === 'after' ? 1 : 0), 0, row);
  return JSON.stringify(next) === JSON.stringify(document) ? document : next;
}

/** Only drags started by a handle in this editor can mutate its document. */
export function createDragDrop(root, context) {
  let sourceId = null;
  let selection = null;
  const clear = () => { sourceId = null; selection = null; delete root.dataset.dragging; };
  function renderRow(row, item) {
    const dom = item.ownerDocument;
    const handle = dom.createElement('button');
    handle.type = 'button';
    handle.draggable = true;
    handle.className = 'outliner-drag-handle';
    handle.textContent = '⠿';
    handle.setAttribute('aria-label', `Move row: ${row.text || 'Untitled'}`);
    handle.title = 'Drag to Before, Inside, or After a row. Keyboard: Alt+Up/Down reorders; Alt+Right/Left nests or lifts.';
    handle.setAttribute('aria-keyshortcuts', 'Alt+ArrowUp Alt+ArrowDown Alt+ArrowRight Alt+ArrowLeft');
    handle.addEventListener('mousedown', () => {
      const current = context.getSelection();
      selection = current?.id === row.id ? current : { id: row.id, offset: 0 };
    });
    handle.addEventListener('dragstart', (event) => {
      if (!event.dataTransfer) { event.preventDefault(); return; }
      sourceId = row.id;
      const current = context.getSelection();
      selection = current?.id === row.id ? current : (selection?.id === row.id ? selection : { id: row.id, offset: 0 });
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', row.id);
      root.dataset.dragging = 'true';
    });
    handle.addEventListener('dragend', clear);
    handle.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { clear(); return; }
      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing) return;
      const actions = {
        ArrowUp: (doc) => moveRow(doc, row.id, -1),
        ArrowDown: (doc) => moveRow(doc, row.id, 1),
        ArrowRight: (doc) => indentRow(doc, row.id),
        ArrowLeft: (doc) => outdentRow(doc, row.id),
      };
      if (!actions[event.key]) return;
      event.preventDefault();
      context.change(actions[event.key], { type: 'move-row', selection: { id: row.id, offset: 0 }, focus: { id: row.id, offset: 0 } });
    });
    item.insertBefore(handle, item.firstChild);
    const zones = dom.createElement('div');
    zones.className = 'outliner-drop-zones';
    for (const position of ['before', 'inside', 'after']) {
      const zone = dom.createElement('div');
      zone.className = 'outliner-drop-zone';
      zone.dataset.dropPosition = position;
      zone.textContent = `${position[0].toUpperCase()}${position.slice(1)} this row`;
      const allowed = () => sourceId && sourceId !== row.id && !flattenRows([findRow(context.getDocument().rows, sourceId)?.row].filter(Boolean)).some((child) => child.id === row.id);
      zone.addEventListener('dragover', (event) => {
        event.stopPropagation();
        if (!allowed()) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        zone.dataset.over = 'true';
      });
      zone.addEventListener('dragleave', () => { delete zone.dataset.over; });
      zone.addEventListener('drop', (event) => {
        event.stopPropagation();
        if (!allowed()) return;
        event.preventDefault();
        const id = sourceId;
        const focus = selection;
        clear();
        context.change((doc) => dropRow(doc, id, row.id, position), { type: 'drop-row', selection: focus, focus });
      });
      zones.appendChild(zone);
    }
    item.appendChild(zones);
  }
  return { renderRow, destroy: clear };
}
