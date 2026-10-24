// Structural edits keep row IDs and extension data intact. The selected row and
// its descendants move as one subtree; unchanged rows retain their identity.
function findPath(rows, id, prefix = []) {
  for (let index = 0; index < rows.length; index += 1) {
    const path = [...prefix, index];
    if (rows[index].id === id) return path;
    const found = findPath(rows[index].children ?? [], id, path);
    if (found) return found;
  }
  return null;
}

function changeSiblings(rows, parentPath, change) {
  if (parentPath.length === 0) return change(rows);
  const [index, ...rest] = parentPath;
  return rows.map((row, i) => i === index
    ? { ...row, children: changeSiblings(row.children ?? [], rest, change) }
    : row);
}

/** Nest a row under its previous sibling and reveal the moved row. */
export function indentRow(document, id) {
  const path = findPath(document.rows, id);
  if (!path || path.at(-1) === 0) return document;
  const index = path.at(-1);
  const rows = changeSiblings(document.rows, path.slice(0, -1), (siblings) => {
    const result = siblings.slice();
    const [row] = result.splice(index, 1);
    const parent = result[index - 1];
    result[index - 1] = {
      ...parent,
      collapsed: false,
      children: [...(parent.children ?? []), row],
    };
    return result;
  });
  return { ...document, rows };
}

/** Lift a row immediately after its parent, keeping its descendants with it. */
export function outdentRow(document, id) {
  const path = findPath(document.rows, id);
  if (!path || path.length < 2) return document;
  const index = path.at(-1);
  const parentIndex = path.at(-2);
  const rows = changeSiblings(document.rows, path.slice(0, -2), (siblings) => {
    const parent = siblings[parentIndex];
    const children = parent.children.slice();
    const [row] = children.splice(index, 1);
    const result = siblings.slice();
    result.splice(parentIndex, 1, { ...parent, children }, row);
    return result;
  });
  return { ...document, rows };
}

/** Editor onKeyDown hook. Return true when Tab belongs to the outline. */
export function handleIndentKey(event, context) {
  if (event.key !== 'Tab' || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return false;
  const input = event.target;
  const id = input?.dataset?.rowId;
  if (!id) return false;
  const document = context.getDocument();
  const next = (event.shiftKey ? outdentRow : indentRow)(document, id);
  if (next !== document) {
    const selection = {
      id,
      offset: input.selectionStart ?? 0,
      end: input.selectionEnd ?? input.selectionStart ?? 0,
      direction: input.selectionDirection ?? 'none',
    };
    context.change(() => next, {
      selection,
      focus: selection,
      type: event.shiftKey ? 'outdent' : 'indent',
    });
  }
  return true;
}
