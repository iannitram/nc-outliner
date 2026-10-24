import { normalizeFormats } from './richtext.js';

/** Contenteditable with the UTF-16 value and selection interface of a textarea. */
export function createRichInput(dom, text, ranges) {
  if (!dom.createRange) {
    const input = dom.createElement('textarea');
    input.value = text;
    return input;
  }
  const input = dom.createElement('div');
  input.contentEditable = 'true';
  input.dataset.richInput = 'true';
  input.setAttribute('role', 'textbox');
  input.setAttribute('aria-multiline', 'true');
  function selection() {
    const sel = dom.getSelection();
    if (!sel?.rangeCount || !input.contains(sel.anchorNode) || !input.contains(sel.focusNode)) return [0, 0, 'none'];
    const offset = (node, at) => {
      const r = dom.createRange();
      r.selectNodeContents(input);
      r.setEnd(node, at);
      return r.toString().length;
    };
    const a = offset(sel.anchorNode, sel.anchorOffset),
      b = offset(sel.focusNode, sel.focusOffset);
    return [Math.min(a, b), Math.max(a, b), a > b ? 'backward' : 'forward'];
  }
  Object.defineProperties(input, {
    value: {
      get: () => input.textContent,
      set: (value) => {
        input.textContent = value;
      },
    },
    selectionStart: { get: () => selection()[0] },
    selectionEnd: { get: () => selection()[1] },
    selectionDirection: { get: () => selection()[2] },
  });
  input.setSelectionRange = (start, end = start, direction = 'none') => {
    const point = (offset) => {
      const walker = dom.createTreeWalker(input, 4);
      let node;
      while ((node = walker.nextNode())) {
        if (offset <= node.length) return [node, offset];
        offset -= node.length;
      }
      return [input, input.childNodes.length];
    };
    const a = point(start),
      b = point(end);
    dom.getSelection().setBaseAndExtent(...(direction === 'backward' ? [...b, ...a] : [...a, ...b]));
  };
  input.paint = (value, formats) => {
    input.replaceChildren();
    let offset = 0;
    for (const r of normalizeFormats(formats, value.length)) {
      input.appendChild(dom.createTextNode(value.slice(offset, r.start)));
      const span = dom.createElement('span');
      span.className = r.marks.map((mark) => 'outliner-format-' + mark).join(' ');
      span.textContent = value.slice(r.start, r.end);
      input.appendChild(span);
      offset = r.end;
    }
    input.appendChild(dom.createTextNode(value.slice(offset)));
    // Chromium needs a final line box to retain a trailing newline while typing.
    if (value.endsWith('\n')) input.appendChild(dom.createElement('br'));
  };
  function insertPlain(text) {
    input.dispatchEvent(
      new dom.defaultView.InputEvent('beforeinput', { bubbles: true, inputType: 'insertText', data: text }),
    );
    const sel = dom.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const node = dom.createTextNode(text);
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    input.dispatchEvent(
      new dom.defaultView.InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }),
    );
  }
  input.addEventListener('paste', (event) => {
    event.preventDefault();
    insertPlain(event.clipboardData.getData('text/plain').replace(/\r\n?/g, '\n'));
  });
  input.addEventListener('drop', (event) => event.preventDefault());
  input.addEventListener('beforeinput', (event) => {
    if (event.isComposing) return;
    if (['insertParagraph', 'insertLineBreak'].includes(event.inputType)) {
      event.preventDefault();
      insertPlain('\n');
    }
  });
  input.paint(text, ranges);
  return input;
}
