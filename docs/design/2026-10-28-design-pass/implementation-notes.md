# nc-outliner design pass (#174): implementation issues

For the PM to file **after the owner approves the mockups** (`mockups.html`, `brief.md`). Each one is independent unless "Needs" says otherwise. Sizes are this repo's: Easy, Medium, Hard. Section letters (A–H) point to the mockups.

Order for tonight's install: issues 1 and 2 fix visible bugs and are small. Issues 3–5 are the core of the new look. The rest can follow.

---

1. **Mount every dialog at page level so the navigation can't cover it**
   - Files: `src/components/VersionsPanel.vue`, `src/components/ConflictDialog.vue` (both pass `:container="null"` to NcDialog). Check the Publish picker too.
   - Size: Easy
   - Done when: with the navigation open at 1024 px, the Versions and Conflict dialogs (until issue 7 replaces Versions) show their full rows, and their backdrop covers the navigation. A browser test or screenshot is attached to the PR. (Mockups E-1, F-2.)

2. **Version preview shows rows, never raw OPML**
   - Files: `src/components/VersionsPanel.vue` (`parseRows`, the `<pre>` fallback). Find out why `parseRows` returned null in the live test (cause not confirmed: check the server's response type and the XML namespace or `querySelector('body')` on the XML document). Replace the `<pre>` fallback with the "This version can't be opened" message.
   - Size: Easy
   - Done when: previewing a real version made by the app shows its rows indented by level. A unit test feeds `parseRows` a real saved file, with the `nco:` namespace and `_note`, and gets rows back. Raw XML can't appear in the UI. (Mockup F-1. The full styled preview is issue 7.)

3. **Level typography, bands, gutter triangles and hover-only row controls**
   - Files: `src/components/OutlineRow.vue`, `src/components/OutlineEditor.vue`. The level class follows the heading rule (ADR 0003): depth 0 → `level-1`; depth 1 with children → `level-2`; everything else → `body`.
   - Size: Medium
   - Done when: the outline looks like mockup A-Proposed in light and dark. Level 1 is 19 px/650 on a `--band-1` tint and the level-2 parent is 16 px/600 on `--band-2`. Both bands are `color-mix()` of `--color-primary-element` into `--color-main-background`, and nothing is hard-coded. Text boxes show no border until focused. The drag handle and add-note icon show only on hover, focus-within and keyboard focus. The triangle in the gutter still toggles collapse (M4) and the handle still drags (M9). All existing editor tests pass, and a test checks the level class for each depth.

4. **Inline notes: muted, borderless, toggled from the row**
   - Files: `src/components/OutlineRow.vue`.
   - Size: Medium
   - Done when: a note shows under its row as muted 13.5 px text, aligned with the row text, with a border only while focused. The "Add note / Show note / Hide note" text button is replaced by the row's note icon: hover shows it, and a row with a hidden note shows it all the time. `noteHidden` (M6) still round-trips through save and reload. The existing note tests are updated and pass. (Mockup A-4, A-6.)

5. **Slim top bar and status line**
   - Files: `src/views/OutlineView.vue`, new `src/components/OutlineTopBar.vue`, new `src/components/StatusLine.vue` (absorbs `SaveStatus.vue`), `src/components/PublishButton.vue`.
   - Size: Medium
   - Done when: the top bar is the title (one line, cut off with "…"), then Publish, the Versions icon button and ⋯ (NcActions), with room left for the navigation toggle. The status line shows Saved, Saving… or "Can't save. Retrying" (only that one in warning colours), the row and word counts, and the last-published link. At under 760 px of content width, Publish becomes an icon with a tooltip. The `role="status"` and `aria-live` on the save state are kept. Checked at 1280, 1024 with the navigation open, and 390. (Mockups A-2, A-7, G.)
   - Needs: none (issue 6 adds the Publish states).

6. **Publish: picker title, button states, success toast with Open document**
   - Files: `src/components/PublishButton.vue`.
   - Size: Easy
   - Done when: the picker title reads `Publish "<name>.odt" to…`. The button goes Publish → Publishing… (disabled) → Published ✓ for 3 seconds. Success shows a toast with the path, and the status line keeps an "Open document" link (`openUrl`) instead of the link beside the button. The starting folder, default name and save-first behaviour are unchanged, and the existing PublishButton tests pass. (Mockup E.)
   - Needs: 5 for the status-line link.

7. **Versions in the right sidebar, with the preview in the main area**
   - Files: `src/components/VersionsPanel.vue` (NcDialog → NcAppSidebar), `src/views/OutlineView.vue` (preview mode and banner), `src/components/OutlineEditor.vue` / `OutlineRow.vue` (a read-only mode).
   - Size: Hard
   - Done when: the clock button toggles the sidebar. The list is grouped Today / Yesterday / Earlier, with Current first, named versions tagged, and unreadable versions marked with no Restore. Clicking a version shows it read-only in the main area, in the same row style, under the banner "Restore this version / Back to current". The ⋯ menu holds Restore and "Name this version", and naming happens in place. After a restore, the green banner offers to name the before-restore state. Every M10 rule and test still holds (save first, keep the before-restore state, refuse while unsaved, Escape closes). On a phone the sidebar is full-screen. (Mockup F.)
   - Needs: 2, 3.

8. **Outline list in the navigation; open the last outline; empty state**
   - Files: `src/App.vue`, `src/views/OutlineList.vue`.
   - Size: Medium
   - Done when: the navigation shows a "New outline" button (NcAppNavigationNew) and the outlines newest first, each with its name and edited time, the open one highlighted. Opening the app goes to the last-opened outline (localStorage), else the newest one, else the empty state. The empty state is NcEmptyContent with "New outline", and "Import OPML…" is hidden until #27 merges. Switching outlines still runs `beforeLeave()` (flush) first, and the M1 two-user check still passes. (Mockup C.)

9. **Theme setting inside Outliner settings**
   - Files: `src/components/ThemeSetting.vue`, `src/App.vue`.
   - Size: Easy
   - Done when: "Outliner settings" at the bottom of the navigation (NcAppNavigationSettings) holds three radio choices: Follow Nextcloud, Light, Dark. The stored values stay `auto`, `light` and `dark`, so no migration. A failed save rolls back and shows the error, as today. (Mockup C, close-up.)
   - Needs: 8 (the navigation layout).

10. **Empty outline: a placeholder first row and the keyboard card**
    - Files: `src/views/OutlineView.vue` (remove "Add first row"), `src/components/OutlineEditor.vue`, new `src/components/KeyboardHints.vue`.
    - Size: Medium
    - Done when: an outline with no rows shows one focused placeholder row ("Type your first heading"). The first keystroke creates a real row through History, and one undo removes it. The keyboard card lists Enter, Tab, Shift+Tab, Alt+↑/↓, ←/→ and Ctrl+Z (⌘ and ⌥ on a Mac). It hides itself at 5 or more rows, and "Hide" is remembered per browser. Tests cover create-on-type, undo, and hiding the card. (Mockup D.)

11. **Sort moves into the ⋯ menu as a dialog**
    - Files: `src/components/OutlineEditor.vue` (remove the sort bar), new `src/components/SortDialog.vue`, `src/components/OutlineTopBar.vue` (menu entry).
    - Size: Easy
    - Done when: no sort controls are visible until you choose ⋯ → "Sort rows…". The dialog offers Row text, Note or Checkbox (from imported files), and A→Z or Z→A, and calls the existing `sortRows` through History, so one Ctrl+Z undoes it. The sort tests are updated and pass. (Mockup H.)
    - Needs: 5.

12. **Narrow-width rules**
    - Files: `src/components/OutlineEditor.vue`, `src/components/OutlineRow.vue`, `src/components/OutlineTopBar.vue`.
    - Size: Easy
    - Done when: the column is `max-width: 820px` with padding of 44 px, then 24 px, then 8 px, set by container width. Below 600 px the indent is 16 px per level and Level 1 is 18 px. Long rows wrap and stay aligned with their own text. Drag handles are hidden on touch (`@media (hover: none)`). No horizontal scroll at 1024 px with the navigation open, at 700 px, or at 390 px; a screenshot of each is in the PR. (Mockup G.)
    - Needs: 3, 5.

---

**Not in this pass (after 1.0, already on the roadmap):** level styles and numbering (F32), text styling and highlights (F33), sections sidebar (F42), sort selected rows only (#31). **Same pass for nc-projects:** owner ruling, 2026-10-28; separate brief.
