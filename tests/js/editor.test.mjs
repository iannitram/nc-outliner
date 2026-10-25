import test from 'node:test';
import assert from 'node:assert/strict';
import { mountEditor } from '../../js/editor.js';

// Minimal DOM surface lets tests drive the actual delegated event handlers.
class Element {
  constructor(tag, ownerDocument) {
    Object.assign(this, { tag, ownerDocument, children: [], dataset: {}, listeners: {}, value: '', selectionStart: 0, selectionEnd: 0, selectionDirection: 'none' });
  }
  appendChild(child) { this.children.push(child); child.parent = this; return child; }
  get classList() { return { add() {} }; }
  get firstChild() { return this.children[0]; }
  insertBefore(child, before) { this.children.splice(Math.max(0, this.children.indexOf(before)), 0, child); child.parent = this; }
  replaceChildren() { for (const child of this.children) child.parent = null; this.children = []; }
  setAttribute() {}
  contains(target) { return target === this || this.children.some((child) => child.contains(target)); }
  matches() { return this.tag === 'textarea' && !!this.dataset.rowId; }
  querySelectorAll() { return this.children.flatMap((child) => [...(child.matches() ? [child] : []), ...child.querySelectorAll()]); }
  addEventListener(type, fn) { this.listeners[type] = fn; }
  removeEventListener(type) { delete this.listeners[type]; }
  focus() { this.ownerDocument.activeElement = this; }
  setSelectionRange(start, end, direction) { Object.assign(this, { selectionStart: start, selectionEnd: end, selectionDirection: direction }); }
  remove() { this.parent.children = this.parent.children.filter((child) => child !== this); }
}
function fixture(document = { rows: [{ id: 'a', text: 'Alpha', children: [] }] }, options = {}) {
  const dom = { createElement(tag) { return new Element(tag, this); } };
  const element = new Element('div', dom);
  const changes = [];
  const editor = mountEditor(element, document, (next) => changes.push(next), options);
  const root = element.children[0];
  const inputs = () => root.querySelectorAll('textarea[data-row-id]');
  const event = (key, target, extra = {}) => {
    const e = { key, target, preventDefault() { this.prevented = true; }, ...extra };
    root.listeners.keydown(e); return e;
  };
  return { element, editor, root, changes, inputs, event, dom };
}

test('typing updates document without replacing focused DOM or losing caret', () => {
  const f = fixture(); const input = f.inputs()[0];
  input.focus(); input.value = 'Alpha!'; input.setSelectionRange(6, 6);
  f.root.listeners.input({ target: input });
  assert.equal(f.editor.getDocument().rows[0].text, 'Alpha!');
  assert.equal(f.inputs()[0], input);
  assert.equal(f.dom.activeElement.selectionStart, 6);
  assert.equal(f.changes.length, 1);
});

test('Enter creates a sibling, focuses it; Backspace returns to previous row', () => {
  const f = fixture();
  assert.equal(f.event('Enter', f.inputs()[0]).prevented, true);
  assert.equal(f.inputs().length, 2);
  const blank = f.inputs()[1]; assert.equal(f.dom.activeElement, blank);
  assert.equal(f.event('Backspace', blank).prevented, true);
  assert.equal(f.inputs().length, 1);
  assert.equal(f.dom.activeElement, f.inputs()[0]);
  assert.equal(f.dom.activeElement.selectionStart, 5);
});

test('IME Enter and modified Enter do not create unwanted rows', () => {
  const f = fixture(); const input = f.inputs()[0];
  f.event('Enter', input, { isComposing: true });
  f.event('Enter', input, { keyCode: 229 });
  f.event('Enter', input, { ctrlKey: true });
  assert.equal(f.editor.getDocument().rows.length, 1);
  assert.equal(f.changes.length, 0);
});

test('mutation hooks see old and new documents; custom key handler can act through boundary', () => {
  const seen = [];
  const f = fixture(undefined, {
    beforeChange(doc) { seen.push(doc.rows[0].text); },
    afterChange(doc) { seen.push(doc.rows[0].text); },
    onKeyDown(event, context) {
      if (event.key !== 'Tab') return false;
      context.change((doc) => ({ ...doc, rows: [{ ...doc.rows[0], text: 'Changed' }] }));
      return true;
    },
  });
  assert.equal(f.event('Tab', f.inputs()[0]).prevented, true);
  assert.deepEqual(seen, ['Alpha', 'Changed']);
  assert.equal(f.changes.length, 1);
});

test('arrow navigation only crosses rows at text boundaries', () => {
  const f = fixture({ rows: [{ id: 'a', text: 'Alpha', children: [] }, { id: 'b', text: 'Beta', children: [] }] });
  const [a, b] = f.inputs(); a.focus(); a.setSelectionRange(2, 2);
  f.event('ArrowDown', a); assert.equal(f.dom.activeElement, a);
  a.setSelectionRange(5, 5);
  f.event('ArrowDown', a); assert.equal(f.dom.activeElement, b);
  assert.equal(b.selectionStart, 4);
});

test('empty outlines receive a persistent editable row; destroy removes listeners and DOM', () => {
  const f = fixture({ title: 'Empty', rows: [] });
  assert.equal(f.inputs().length, 1);
  assert.ok(f.editor.getDocument().rows[0].id);
  assert.equal(f.changes.length, 1);
  f.editor.destroy();
  assert.equal(f.element.children.length, 0);
  assert.equal(Object.keys(f.root.listeners).length, 0);
});

test('Tab and Shift+Tab move subtrees through editor and preserve text selection', () => {
  const descendant = { id: 'c', text: 'Child', children: [] };
  const f = fixture({ rows: [
    { id: 'a', text: 'Alpha', children: [], collapsed: true },
    { id: 'b', text: 'Beta', children: [descendant] },
  ] });
  const input = f.inputs()[1]; input.focus(); input.setSelectionRange(1, 3, 'backward');
  assert.equal(f.event('Tab', input).prevented, true);
  assert.equal(f.editor.getDocument().rows[0].children[0].id, 'b');
  assert.equal(f.editor.getDocument().rows[0].collapsed, false);
  assert.equal(f.editor.getDocument().rows[0].children[0].children[0], descendant);
  assert.deepEqual(f.editor.getSelection(), { id: 'b', offset: 1, end: 3, direction: 'backward' });
  assert.equal(f.event('Tab', f.dom.activeElement, { shiftKey: true }).prevented, true);
  assert.deepEqual(f.editor.getDocument().rows.map(r => r.id), ['a', 'b']);
  assert.deepEqual(f.editor.getSelection(), { id: 'b', offset: 1, end: 3, direction: 'backward' });
  assert.equal(f.changes.length, 2);
});

test('indent boundaries retain row focus and do not create a change', () => {
  const f = fixture(); const input = f.inputs()[0]; input.focus(); input.setSelectionRange(2, 2);
  assert.equal(f.event('Tab', input).prevented, true);
  assert.equal(f.event('Tab', input, { shiftKey: true }).prevented, true);
  assert.equal(f.dom.activeElement, input);
  assert.equal(input.selectionStart, 2);
  assert.equal(f.changes.length, 0);
});
test('undo and redo typing use document history and restore the pre-input caret', () => {
  const f = fixture();
  const input = f.inputs()[0]; input.focus(); input.setSelectionRange(2, 4, 'backward');
  f.root.listeners.beforeinput({ target: input, inputType: 'insertText' });
  input.value = 'Al!a'; input.setSelectionRange(3, 3);
  f.root.listeners.input({ target: input });
  assert.equal(f.event('z', input, { ctrlKey: true }).prevented, true);
  assert.equal(f.editor.getDocument().rows[0].text, 'Alpha');
  assert.equal(f.dom.activeElement.selectionStart, 2);
  assert.equal(f.dom.activeElement.selectionEnd, 4);
  assert.equal(f.dom.activeElement.selectionDirection, 'backward');
  f.event('Z', f.inputs()[0], { metaKey: true, shiftKey: true });
  assert.equal(f.editor.getDocument().rows[0].text, 'Al!a');
  assert.equal(f.dom.activeElement.selectionStart, 3);
  assert.equal(f.changes.length, 3);
});

test('history toolbar state follows Enter, deletion, undo and redo', () => {
  const f = fixture();
  const [undo, redo] = f.root.children[0].children;
  assert.equal(undo.disabled, true); assert.equal(redo.disabled, true);
  f.inputs()[0].focus();
  f.event('Enter', f.inputs()[0]);
  assert.equal(undo.disabled, false); assert.equal(redo.disabled, true);
  const blankId = f.inputs()[1].dataset.rowId;
  f.event('Backspace', f.inputs()[1]);
  undo.listeners.click();
  assert.equal(f.inputs().length, 2);
  assert.equal(f.dom.activeElement.dataset.rowId, blankId);
  undo.listeners.click();
  assert.equal(f.inputs().length, 1);
  assert.equal(undo.disabled, true); assert.equal(redo.disabled, false);
  redo.listeners.click();
  assert.equal(f.inputs().length, 2);
  assert.equal(f.inputs()[1].dataset.rowId, blankId);
});

test('all extension commands use history and outline replacement clears it', () => {
  const f = fixture({ rows: [{ id: 'a', text: 'Alpha', children: [], custom: { color: 'blue' } }] });
  f.inputs()[0].focus();
  f.editor.change((doc) => ({ ...doc, rows: [{ ...doc.rows[0], collapsed: true }] }), { focus: { id: 'a', offset: 1 } });
  assert.equal(f.editor.getHistoryState().canUndo, true);
  f.editor.undo();
  assert.equal(f.editor.getDocument().rows[0].collapsed, undefined);
  assert.deepEqual(f.editor.getDocument().rows[0].custom, { color: 'blue' });
  f.editor.redo();
  assert.equal(f.editor.getDocument().rows[0].collapsed, true);
  f.editor.replaceDocument({ rows: [{ id: 'b', text: 'Other file', children: [] }] }, { notify: false });
  assert.deepEqual(f.editor.getHistoryState(), { canUndo: false, canRedo: false });
  assert.equal(f.editor.undo(), false);
  assert.equal(f.editor.getDocument().rows[0].id, 'b');
});

test('browser beforeinput history command bypasses native textarea undo', () => {
  const f = fixture(); f.inputs()[0].focus();
  f.event('Enter', f.inputs()[0]);
  const event = { target: f.inputs()[1], inputType: 'historyUndo', preventDefault() { this.prevented = true; } };
  f.root.listeners.beforeinput(event);
  assert.equal(event.prevented, true);
  assert.equal(f.inputs().length, 1);
  f.root.listeners.beforeinput({ ...event, inputType: 'historyRedo' });
  assert.equal(f.inputs().length, 2);
});

test('Alt move and delete commands preserve subtrees and caret and undo restores deletion', () => {
  const child = { id: 'c', text: 'Child', children: [] };
  const f = fixture({ rows: [{ id: 'a', text: 'Alpha', children: [child] }, { id: 'b', text: 'Beta', children: [] }] });
  const input = f.inputs()[0]; input.focus(); input.setSelectionRange(1, 3, 'backward');
  assert.equal(f.event('ArrowDown', input, { altKey: true }).prevented, true);
  assert.deepEqual(f.editor.getDocument().rows.map(r => r.id), ['b', 'a']);
  assert.deepEqual(f.editor.getSelection(), { id: 'a', offset: 1, end: 3, direction: 'backward' });
  assert.equal(f.event('Delete', f.dom.activeElement, { altKey: true }).prevented, true);
  assert.deepEqual(f.editor.getDocument().rows.map(r => r.id), ['b']);
  assert.equal(f.dom.activeElement.dataset.rowId, 'b');
  f.editor.undo();
  assert.equal(f.editor.getDocument().rows[1].children[0].id, 'c');
  assert.deepEqual(f.editor.getSelection(), { id: 'a', offset: 1, end: 3, direction: 'backward' });
  f.editor.undo();
  assert.deepEqual(f.editor.getDocument().rows.map(r => r.id), ['a', 'b']);
  assert.equal(f.changes.length, 4);
});

test('delete-row button removes subtree through history while plain text Delete stays native', () => {
  const f = fixture({ rows: [{ id: 'a', text: 'Alpha', children: [{ id: 'c', text: 'Child', children: [] }] }, { id: 'b', text: 'Beta', children: [] }] });
  f.inputs()[0].focus();
  assert.equal(f.event('Delete', f.inputs()[0]).prevented, undefined);
  const descendants = el => el.children.flatMap(child => [child, ...descendants(child)]);
  const button = descendants(f.root).find(el => el.className === 'outliner-delete-row');
  button.focus(); // The button is also usable directly from keyboard navigation.
  button.listeners.click();
  assert.deepEqual(f.editor.getDocument().rows.map(r => r.id), ['b']);
  f.editor.undo();
  assert.equal(f.editor.getDocument().rows[0].children[0].id, 'c');
  assert.equal(f.dom.activeElement.dataset.rowId, 'a');
});
test('timestamp toolbar remembers a text range after focus moves and supports undo', () => {
  const f = fixture(undefined, { timestamp: { date: new Date('2026-10-24T14:05:00Z'), locale: 'en-GB', timeZone: 'UTC' } });
  const input = f.inputs()[0]; input.tagName = 'TEXTAREA'; input.focus(); input.setSelectionRange(1, 4, 'backward');
  f.root.listeners.focusout({ target: input });
  const toolbar = f.root.children[0];
  const select = toolbar.children.find((node) => node.tag === 'select');
  const insert = toolbar.children.find((node) => node.textContent === 'Insert timestamp');
  select.focus(); select.value = 'time'; insert.focus(); insert.listeners.click();
  assert.equal(f.editor.getDocument().rows[0].text, 'A14:05a');
  assert.equal(f.dom.activeElement.dataset.rowId, 'a');
  assert.equal(f.dom.activeElement.selectionStart, 6);
  assert.equal(f.changes.length, 1);
  f.editor.undo();
  assert.equal(f.editor.getDocument().rows[0].text, 'Alpha');
  assert.deepEqual(f.editor.getSelection(), { id: 'a', offset: 1, end: 4, direction: 'backward' });
});

const selectionRows = () => ({ title: 'Plan', rows: [
  { id: 'a', text: 'Alpha', children: [] },
  { id: 'b', text: 'Beta', children: [{ id: 'b1', text: 'Child', children: [], custom: 'keep' }] },
  { id: 'c', text: 'Gamma', children: [] },
  { id: 'd', text: 'Delta', children: [] },
] });
function clickRow(f, id, modifiers = {}) {
  const input = f.inputs().find(input => input.dataset.rowId === id);
  const event = { target: input, preventDefault() { this.prevented = true; }, ...modifiers };
  f.root.listeners.click(event); return event;
}
function selectedButton(f, label) { return f.root.children[0].children.find(button => button.textContent === label); }
test('modified clicks select disjoint rows and ranges, while plain text clicks and Escape clear', () => {
  const f=fixture(selectionRows());
  clickRow(f,'a'); clickRow(f,'c',{ctrlKey:true});assert.deepEqual(f.editor.getSelectedRowIds(),['a','c']);
  clickRow(f,'a',{metaKey:true});assert.deepEqual(f.editor.getSelectedRowIds(),['c']);
  clickRow(f,'d',{shiftKey:true});assert.deepEqual(f.editor.getSelectedRowIds(),['a','b','b1','c','d']);
  assert.equal(f.changes.length,0);assert.deepEqual(f.editor.getHistoryState(),{canUndo:false,canRedo:false});
  f.event('Escape',f.dom.activeElement);assert.deepEqual(f.editor.getSelectedRowIds(),[]);
  clickRow(f,'b',{ctrlKey:true});clickRow(f,'a');assert.deepEqual(f.editor.getSelectedRowIds(),[]);
});
test('Shift arrows extend and contract through visible rows and ignore IME composition', () => {
  const initial=selectionRows();initial.rows[1].collapsed=true;
  const f=fixture(initial); const a=f.inputs()[0];a.focus();
  f.event('ArrowDown',a,{shiftKey:true,isComposing:true});assert.deepEqual(f.editor.getSelectedRowIds(),[]);
  assert.equal(f.event('ArrowDown',a,{shiftKey:true}).prevented,true);
  assert.deepEqual(f.editor.getSelectedRowIds(),['a','b']);
  f.event('ArrowDown',f.dom.activeElement,{shiftKey:true});assert.deepEqual(f.editor.getSelectedRowIds(),['a','b','c']);
  f.event('ArrowUp',f.dom.activeElement,{shiftKey:true});assert.deepEqual(f.editor.getSelectedRowIds(),['a','b']);
  assert.equal(f.changes.length,0);
});
test('bulk deletion records one history/autosave change, removes subtrees once and restores selection on undo', () => {
  const f=fixture(selectionRows());
  clickRow(f,'b');clickRow(f,'c',{shiftKey:true});
  assert.deepEqual(f.editor.getSelectedRowIds(),['b','b1','c']);
  selectedButton(f,'Delete selected').listeners.click();
  assert.deepEqual(f.editor.getDocument().rows.map(r=>r.id),['a','d']);
  assert.equal(f.changes.length,1);assert.deepEqual(f.editor.getSelectedRowIds(),[]);
  f.editor.undo();assert.equal(f.editor.getDocument().rows[1].children[0].custom,'keep');
  assert.deepEqual(f.editor.getSelectedRowIds(),['b','b1','c']);
  f.editor.redo();assert.deepEqual(f.editor.getDocument().rows.map(r=>r.id),['a','d']);
});
test('group and ungroup selected rows preserve caret, tree identity and undo as single edits', () => {
  const f=fixture(selectionRows());
  clickRow(f,'b');clickRow(f,'c',{ctrlKey:true});
  const c=f.inputs().find(input=>input.dataset.rowId==='c');
  c.focus();c.setSelectionRange(2,4,'backward');
  const group=selectedButton(f,'Group selected');
  assert.equal(group.disabled,false);
  group.listeners.click();
  let grouped=f.editor.getDocument();
  assert.deepEqual(grouped.rows.map(row=>row.id),['a',grouped.rows[1].id,'d']);
  const wrapper=grouped.rows[1];
  assert.deepEqual(wrapper.children.map(row=>row.id),['b','c']);
  assert.equal(wrapper.children[0].children[0].custom,'keep');
  assert.deepEqual(f.editor.getSelectedRowIds(),['b','c']);
  assert.equal(f.dom.activeElement.dataset.rowId,'c');
  assert.equal(f.dom.activeElement.selectionStart,2);assert.equal(f.dom.activeElement.selectionEnd,4);
  assert.equal(f.changes.length,1);

  f.editor.focusRow(wrapper.id);
  clickRow(f,wrapper.id,{ctrlKey:true});
  assert.deepEqual(f.editor.getSelectedRowIds(),['b','c',wrapper.id]);
  assert.equal(selectedButton(f,'Ungroup selected').disabled,false);
  selectedButton(f,'Ungroup selected').listeners.click();
  assert.deepEqual(f.editor.getDocument().rows.map(row=>row.id),['a','b','c','d']);
  assert.equal(f.editor.getDocument().rows[1].children[0].custom,'keep');
  assert.equal(f.changes.length,2);
  f.editor.undo();
  assert.equal(f.editor.getDocument().rows[1].id,wrapper.id);
  assert.deepEqual(f.editor.getSelectedRowIds(),['b','c',wrapper.id]);
  f.editor.redo();
  assert.deepEqual(f.editor.getDocument().rows.map(row=>row.id),['a','b','c','d']);
});
test('multi-row Tab, Alt movement and toolbar status changes share history and preserve metadata', () => {
  const f=fixture(selectionRows());clickRow(f,'b');clickRow(f,'c',{shiftKey:true});
  f.event('Tab',f.dom.activeElement);assert.deepEqual(f.editor.getDocument().rows[0].children.map(r=>r.id),['b','c']);
  f.event('Tab',f.dom.activeElement,{shiftKey:true});assert.deepEqual(f.editor.getDocument().rows.map(r=>r.id),['a','b','c','d']);
  f.event('ArrowDown',f.dom.activeElement,{altKey:true});assert.deepEqual(f.editor.getDocument().rows.map(r=>r.id),['a','d','b','c']);
  selectedButton(f,'Check selected').listeners.click();
  const b=f.editor.getDocument().rows[2];assert.equal(b.checked,true);assert.equal(b.children[0].checked,true);
  assert.equal(b.children[0].custom,'keep');assert.equal(f.editor.getDocument().rows[3].checked,true);
  assert.equal(f.changes.length,4);f.editor.undo();assert.equal(f.editor.getDocument().showCheckboxes,undefined);
  f.editor.replaceDocument({rows:[{id:'z',text:'Other file',children:[]}]});assert.deepEqual(f.editor.getSelectedRowIds(),[]);
});
test('search restricts selected rows to displayed matches and keyboard range skips hidden rows', () => {
  const f=fixture(selectionRows());clickRow(f,'a');clickRow(f,'d',{shiftKey:true});
  const search=f.root.children[1].children[0];search.value='Alpha';search.listeners.input();
  assert.deepEqual(f.editor.getSelectedRowIds(),['a']);
  assert.equal(f.changes.length,0);selectedButton(f,'Delete selected').listeners.click();
  assert.deepEqual(f.editor.getDocument().rows.map(r=>r.id),['b','c','d']);
});
