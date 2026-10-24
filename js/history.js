/** Document history shared by every editor command. Snapshots retain extension data. */
export function createHistory(initial, { limit = 100 } = {}) {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError('History limit must be positive');
  const copy = (value) => structuredClone(value);
  let present = copy(initial);
  let past = [];
  let future = [];
  const listeners = new Set();
  const state = () => ({ canUndo: past.length > 0, canRedo: future.length > 0 });
  const emit = () => listeners.forEach((listener) => listener(state()));
  return {
    getState: state,
    getSnapshot: () => copy(present),
    /** Selection changes alone never create an undo entry or discard redo. */
    record(next, previousSelection = present.selection) {
      if (JSON.stringify(next.document) === JSON.stringify(present.document)) {
        present.selection = copy(next.selection);
        return false;
      }
      present.selection = copy(previousSelection);
      past.push(copy(present));
      if (past.length > limit) past.shift();
      present = copy(next);
      future = [];
      emit();
      return true;
    },
    undo() {
      if (!past.length) return null;
      future.push(present);
      present = past.pop();
      emit();
      return copy(present);
    },
    redo() {
      if (!future.length) return null;
      past.push(present);
      present = future.pop();
      emit();
      return copy(present);
    },
    reset(next) {
      present = copy(next);
      past = [];
      future = [];
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(state());
      return () => listeners.delete(listener);
    },
  };
}

/** Return a history command only for an unambiguous platform shortcut. */
export function historyCommand(event) {
  if (event.isComposing || event.altKey || !(event.ctrlKey || event.metaKey)) return null;
  const key = event.key.toLowerCase();
  if (key === 'z') return event.shiftKey ? 'redo' : 'undo';
  if (key === 'y' && event.ctrlKey && !event.metaKey && !event.shiftKey) return 'redo';
  return null;
}
