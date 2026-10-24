# Batch two review record

Ten issues were implemented in separate agent worktrees, reviewed by the parent, and assembled as incremental draft PRs. The issues were linked and closed at the maintainer's request; closing an issue does not mean its code has merged.

| Issue | PR | Change |
|---|---|---|
| [#8](https://github.com/iannitram/nc-outliner/issues/8) | [#58](https://github.com/iannitram/nc-outliner/pull/58) | Add persistent row notes with keyboard editing |
| [#13](https://github.com/iannitram/nc-outliner/issues/13) | [#59](https://github.com/iannitram/nc-outliner/pull/59) | Add persistent outline checklist controls |
| [#11](https://github.com/iannitram/nc-outliner/issues/11) | [#60](https://github.com/iannitram/nc-outliner/pull/60) | Delete and move row subtrees from the keyboard |
| [#16](https://github.com/iannitram/nc-outliner/issues/16) | [#61](https://github.com/iannitram/nc-outliner/pull/61) | Expand or collapse whole outlines and row subtrees |
| [#17](https://github.com/iannitram/nc-outliner/issues/17) | [#62](https://github.com/iannitram/nc-outliner/pull/62) | Filter outline rows with a non-destructive search field |
| [#28](https://github.com/iannitram/nc-outliner/issues/28) | [#63](https://github.com/iannitram/nc-outliner/pull/63) | Insert localized timestamps into row and note selections |
| [#36](https://github.com/iannitram/nc-outliner/issues/36) | [#64](https://github.com/iannitram/nc-outliner/pull/64) | Import plain text and Markdown as new outlines |
| [#37](https://github.com/iannitram/nc-outliner/issues/37) | [#65](https://github.com/iannitram/nc-outliner/pull/65) | Export current outline edits as text, Markdown, or OPML |
| [#10](https://github.com/iannitram/nc-outliner/issues/10) | [#66](https://github.com/iannitram/nc-outliner/pull/66) | Add per-user Auto, Light, and Dark appearance settings |
| [#3](https://github.com/iannitram/nc-outliner/issues/3) | [#67](https://github.com/iannitram/nc-outliner/pull/67) | Autosave outlines with If-Match conflict protection |

Review and merge in the table order, after the foundation stack ending at PR #7. Each PR targets its predecessor's branch. Retarget to main after that predecessor merges.

## Verification

- `npm run check` passed the combined JavaScript suite, PHP syntax checks, and six standalone PHP test files using `nextcloud:33.0.10-apache`.
- After the final search/note caret regression, `node --test --test-isolation=none tests/js/*.test.mjs` passed **122 tests**.
- The PHP files contain **31 passing checks**, including per-user isolation, OPML notes/checklist round trips, strong If-Match validation, conflict-copy safety, theme preferences, and export without source-file mutation.
- Desktop Chromium checks passed for theme preferences; note timestamps and checklist autosave; search with note caret retention; keyboard row movement/deletion and undo; bulk expansion; text/Markdown/OPML downloads; Markdown import; save conflicts with copy and reload; transient retry; and page-leave flushing.

Browser HTTP checks used a mocked API. PHP storage tests used Nextcloud Files API doubles in the pinned Nextcloud image. No live Nextcloud instance was changed or used for validation. Browser keepalive requests remain subject to browser request-size and page-lifetime limits; unsaved changes retain the leave-page prompt.

## Overlapping work

Partial PR #57 has a different theme-helper implementation, overlapping PR #66. Partial PR #56 has a different autosave engine, overlapping PR #67. Reconcile the implementations before merging both alternatives.

