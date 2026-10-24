# Frontend code map

[Map index](../../CODEMAP.md) · [Backend](backend.md) · [Tests](testing.md)

## Startup and ownership

[PageController](../../lib/Controller/PageController.php) supplies `apiBase`, `appJs`, `webroot` and `uid`. [templates/main.php](../../templates/main.php) escapes them into `#outliner-app` data attributes and loads the bootstrap script and both stylesheets.

[main.js](../../js/main.js) waits for DOM readiness, dynamically imports `data-app-js`, and calls `start(el)`. [app.js](../../js/app.js) creates the file browser, shell regions and open-file controls. It mounts an editor when available and has a read-only fallback for the earlier file-foundation branch.

| File | Responsibility and main interface |
|---|---|
| [app.js](../../js/app.js) | `start()` owns list/create/open/import/export/conflict UI and one autosave instance per open outline. `createApi()` sends same-origin JSON requests, CSRF token, optional strong `If-Match`, and keepalive options. |
| [shell.js](../../js/shell.js) | `mountShell()` returns navigation, toolbar, content and live-status regions, plus `destroy()`. |
| [editor.js](../../js/editor.js) | `mountEditor(element, document, onChange, options)` owns rendering, keyboard/input handlers, note/topic selection, search UI, feature controls and history. |
| [model.js](../../js/model.js) | Stable row creation, lookup, visible/full preorder, immutable text updates, sibling insertion, and safe empty-leaf deletion. |
| [history.js](../../js/history.js) | `createHistory()` keeps cloned document/selection snapshots, up to 100 undo entries by default. `historyCommand()` recognizes platform shortcuts. |
| [autosave.js](../../js/autosave.js) | `createAutosave()` debounces edits, serializes requests, tracks saved revision and ETag, retries transient failures, and pauses on conflict. |
| [theme.js](../../js/theme.js) | Appearance selector and `/theme` API. Auto removes app overrides and inherits Nextcloud variables; explicit choice is saved per user on the server. |
| [import.js](../../js/import.js) | `parseOutlineText()`, filename validation, create-then-save workflow, paste/file import form. |
| [export.js](../../js/export.js) | Current-document snapshots, text/Markdown formatting, OPML API request, safe download names and Blob URL cleanup. |

## Row features

| Module | Editing or display behavior |
|---|---|
| [drag-drop.js](../../js/drag-drop.js) | Native draggable handles and Before/Inside/After targets move complete subtrees through history. Rejects external drags, self/descendant cycles and no-op placements; handle Alt+arrows offer keyboard moves. |
| [indent.js](../../js/indent.js) | Tab/Shift+Tab move complete subtrees. Boundary operations keep the document identity unchanged. |
| [collapse.js](../../js/collapse.js) | Disclosure buttons, leaf bullets, visible preorder and boundary-aware left/right navigation. Supplies default editor hooks. |
| [expansion.js](../../js/expansion.js) | Recursive whole-outline/subtree expansion, toolbar controls, Alt+Left/Right, and visible-focus correction. |
| [row-actions.js](../../js/row-actions.js) | Explicit subtree deletion and sibling movement; buttons, Alt+Delete and Alt+Up/Down. |
| [notes.js](../../js/notes.js) | Immutable note/visibility edits and per-row note controls. Shift+Enter opens a note; Escape returns to the topic. |
| [checkboxes.js](../../js/checkboxes.js) | Document visibility toggle, checked-state edits and accessible per-row checkboxes. Hiding retains checked states. |
| [search.js](../../js/search.js) | `matchingRowIds()` returns literal case-insensitive matches plus ancestors. Editor filtering reveals matching paths without changing saved collapse state. |
| [timestamp.js](../../js/timestamp.js) | Localized date/time formats and insertion into the last selected topic or note range. Uses the shared edit/history boundary. |

## Editor contract

`mountEditor()` returns `getDocument`, `getSelection`, `change`, `replaceDocument`, `focusRow`, `render`, `undo`, `redo`, `getHistoryState` and `destroy`.

Selections are `{ id, offset, end, direction }`, with `field: 'note'` for a note. `focusRow(id, offset, end, direction, field)` restores the appropriate textarea. Topic inputs use `data-row-id`; note inputs use `data-note-id`. Toolbar focus tracking retains the last text selection for bulk actions and timestamps.

`change(mutator, meta)` applies an immutable document updater. A same-reference return is a no-op. Metadata carries the edit type, prior selection, target focus, optional render/notification suppression and history replay flag. Successful edits render as needed, record history, call hooks, and notify `onChange(document)`.

`replaceDocument()` resets history for an ordinary replacement; history replay uses its `replay` option. File switching destroys and remounts the editor. Options expose `beforeChange`, `afterChange`, `onKeyDown`, `renderRow`, `shouldRenderChildren` and timestamp formatting settings. Defaults come from the collapse extension; supplied options replace matching hook properties rather than automatically composing them.

## Persistence and file operations

```mermaid
sequenceDiagram
    participant User
    participant Editor
    participant App
    participant Autosave
    participant Server
    User->>Editor: Edit topic, note, checkbox or structure
    Editor->>Editor: change + history + caret
    Editor->>App: onChange(document)
    App->>Autosave: update(document)
    Note over Autosave: 1500 ms debounce; one request at a time
    Autosave->>App: save(snapshot, etag, options)
    App->>Server: PUT outline + strong If-Match
    alt Saved
        Server-->>Autosave: New ETag
    else Conflict (409/412)
        Autosave->>App: Pause writes; show Reload / Keep mine as a copy
    else Other failure
        Note over Autosave: Retain edits; retry after 3000 ms
    end
```

Switching files first flushes pending edits and asks before discarding remaining unsaved changes. Visibility/page-leave handlers request a keepalive flush; pending changes retain a leave-page prompt. Keepalive delivery is subject to browser limits.

Import validates text and waits for the app's unsaved-change policy before creating a distinct file, then saves using that new file's ETag. Export snapshots the current editor document, including unsaved edits: text and Markdown are client-side; OPML goes to the server to preserve original XML extensions.

[css/outliner.css](../../css/outliner.css) owns editor/feature styles and scoped appearance palettes. [css/shell.css](../../css/shell.css) owns page regions, scrolling, skip-link and layout. `--ol-*` colors inherit Nextcloud variables in Auto mode.
