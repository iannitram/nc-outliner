/** Serialized, revision-aware persistence. A conflict pauses writes until resolved. */
export function createAutosave({ document, etag, save, onStatus = () => {}, onConflict = () => {}, delay = 1500, retryDelay = 3000, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let latest = structuredClone(document);
  let saved = JSON.stringify(document);
  let currentEtag = etag;
  let timer = null;
  let flight = null;
  let conflicted = false;
  let disposed = false;
  const pending = () => JSON.stringify(latest) !== saved;
  const cancelTimer = () => { if (timer !== null) clearTimer(timer); timer = null; };
  function schedule(ms) {
    cancelTimer();
    if (!disposed && !conflicted) timer = setTimer(() => { timer = null; void flush(); }, ms);
  }
  async function flush({ keepalive = false } = {}) {
    cancelTimer();
    if (disposed || conflicted) return false;
    if (flight) { await flight; return flush({ keepalive }); }
    if (!pending()) return true;
    const snapshot = structuredClone(latest);
    onStatus('Saving');
    flight = (async () => {
      try {
        const result = await save(snapshot, currentEtag, { keepalive });
        currentEtag = result.etag;
        saved = JSON.stringify(snapshot);
        if (!disposed) {
          onStatus(pending() ? 'Saving' : 'Saved');
          if (pending()) schedule(delay);
        }
        return true;
      } catch (error) {
        if (disposed) return false;
        if (error.status === 409 || error.status === 412) {
          conflicted = true;
          onStatus('Changed elsewhere');
          onConflict(error);
        } else {
          onStatus("Can't save (retrying)");
          schedule(retryDelay);
        }
        return false;
      }
    })();
    const result = await flight;
    flight = null;
    if (result && keepalive && pending()) return flush({ keepalive });
    return result;
  }
  return {
    update(next) {
      if (disposed) return;
      latest = structuredClone(next);
      if (!conflicted && pending()) { onStatus('Saving'); schedule(delay); }
      else if (!pending()) { cancelTimer(); onStatus('Saved'); }
    },
    flush,
    hasPending: pending,
    isConflicted: () => conflicted,
    getDocument: () => structuredClone(latest),
    getEtag: () => currentEtag,
    dispose() { disposed = true; cancelTimer(); },
  };
}
