# nc-outliner: design brief for the UX/UI pass (#174)

Date: 2026-10-28. Status: **mockups for the owner's approval. No code has changed.**
Mockups: `mockups.html` (same folder). Each screen has numbered dots, and the notes under each picture match them.

## The problems (from #174 and the live test on 2026-10-28)

The owner, watching the test: *"Lots of visual bugs there. the interface doesn't seem to be properly scaling."*

1. **Crowded header.** The title, "Saved", "Publish to Doc" and "Versions" share one row at equal weight, so they squeeze or wrap in a narrow pane.
2. **Sort bar always visible.** "Sort rows by / Ascending / Sort rows" takes a full line above the rows, though sorting is rare and rearranges the whole outline.
3. **Noisy rows.** Every row shows a drag handle, a triangle or bullet, a text box and an "Add note" button, so there are four controls on every line.
4. **Flat hierarchy.** Every level looks the same. The headings only show up after Publish to Doc.
5. **Bare empty states.** An empty outline shows a lone "Add first row" button, and an empty list shows the line "No outlines yet."
6. **Navigation draws over dialogs.** The left navigation covers the start of each row in the Versions dialog. In the code, the dialog is mounted inside the content area (`:container="null"`), not at page level.
7. **Doesn't scale in a narrow pane.**
8. **Version Preview shows raw OPML/XML** instead of rows.
9. The OmniOutliner reference, in the owner's words: *"I'm not saying we need to do that exactly but compare the elegance of the interfaces."* What to borrow from it: typography instead of widgets, tinted level bands, disclosure triangles in the gutter, notes inline and muted, a slim icon-only top bar, and a quiet status line.

## Design principles

1. **The text is the interface.** A row is its text. Controls (drag handle, add-note) appear only on the row under the pointer or the one being edited.
2. **The outline previews the document.** Levels are styled by the same heading rule Publish uses (ADR 0003): top-level rows look like Heading 1, second-level parents like Heading 2, everything else like body bullets. What you see is roughly what Publish writes.
3. **Native Nextcloud first.** Use @nextcloud/vue parts where one exists: NcAppNavigation with a New button and a settings area, NcAppSidebar for Versions, NcActions for the ⋯ menu, NcEmptyContent, NcDialog mounted at page level, and Nextcloud's own file picker and toasts. Every colour comes from Nextcloud's CSS variables, so dark mode needs no separate design.
4. **Rare actions go one click deeper.** Publish and Versions stay in the top bar. Sort and Report a bug go in the ⋯ menu.
5. **Quiet status, loud trouble.** "Saved" and "Saving…" sit in a muted status line at the bottom. Only "Can't save" gets colour.
6. **Fluid by default.** A centred column up to 820 px wide, padding that shrinks with the window, a top bar that drops labels before it squeezes the title, and indents that shrink on small screens. Nothing has a fixed width that can overflow.
7. **Nothing new to learn.** The keys, autosave, conflict handling, publish rules and version rules all stay as they are. This pass changes layout and look, not behaviour, apart from the two noted below (opening the last outline on start, and a typed-into placeholder first row).

## Decisions, screen by screen

### A. Outline view (current vs proposed)

| Today | Proposed |
|---|---|
| Header row: h2 title, "Saved", "Publish to Doc" and "Versions" buttons | Slim top bar: title (16 px, semibold, cut off with "…" when long), then **Publish** (icon and label), **Versions** (clock icon) and **⋯** |
| "Saved" in the header | Status line at the bottom: `✓ Saved · 21 rows · 164 words`, and on the right `Published to … · Open document ↗` |
| Sort bar above the rows | Gone. "Sort rows…" in the ⋯ menu (section H) |
| Every row: handle, triangle or bullet, bordered input, "Add note" | Text only. A triangle in the gutter for parents, a small dot for leaves. The handle shows on hover at the far left, the add-note icon on hover at the right |
| All levels look the same | Level 1: 19 px, bold, on a tinted band. Level-2 parent: 16 px, semibold, on a lighter band. Everything else: 15 px body text |
| Notes: a bordered textarea plus a Show/Hide button | Notes: muted 13.5 px text right under the row, editable in place, with no border until it has focus. A row with a hidden note shows a small note mark. Show/Hide moves to the row's note icon |
| A folded branch looks like any row | A folded branch shows "3 rows" in muted text after its title |
| Content starts under the nav toggle | The top bar leaves room for Nextcloud's navigation toggle |

The bands are `color-mix()` of `--color-primary-element` into `--color-main-background` (about 9 % and 4 %), so they follow the server's theme colour and work in dark mode.

### B. Dark mode
No separate design: the same rules with Nextcloud's dark variables. The bands get a slightly stronger mix (13 % and 6 %) so they still show on black. The Theme setting (Auto, Light, Dark; M12) still decides, through `NcThemeProvider` as today.

### C. Outline list and empty state
- The list moves into the **left navigation**, newest first, with the name and "Edited …" time (the Notes and Deck pattern). **"New outline"** is the navigation's top button.
- **Opening the app goes to the outline you last had open**, remembered per browser. If there isn't one, it opens the newest outline. If there are no outlines, it shows the empty state.
- The empty state uses **NcEmptyContent**: icon, "No outlines yet", one sentence about where outlines are stored, a **New outline** button, and **Import OPML…** once M11 (#27) lands.
- **Theme** moves into **Outliner settings** at the bottom of the navigation (NcAppNavigationSettings), as three radio choices. "Auto" is renamed "Follow Nextcloud".

### D. New, empty outline
- The "Add first row" button goes. An outline with no rows shows **one placeholder row** with the caret in it ("Type your first heading"). Typing creates the row through History, so undo works, as `addFirstRow()` does today.
- A **keyboard card** below the rows lists the keys that exist today: Enter, Tab, Shift+Tab, Alt+↑/↓, ←/→ and Ctrl+Z (⌘ and ⌥ on a Mac). It hides itself after about five rows, and "Hide" keeps it hidden (per browser).

### E. Publish to Doc
- The top-bar **Publish** button opens Nextcloud's own folder picker, as today. Its title becomes `Publish "<name>.odt" to…`, so you know what will be written. A line in the picker says a copy already there will be replaced. If the picker can't show that line, it goes in the button's tooltip.
- The picker is mounted at page level, so its backdrop covers the navigation.
- **Button states:** Publish, then Publishing… (disabled, while it saves first and then writes), then Published ✓ for 3 seconds.
- **Success:** a toast ("Published · path · Open document"), and the status-line link stays, replacing the "Open document" link that today sits beside the button.
- The rules for the starting folder, the default name, overwriting and saving first all stay as they are.

### F. Versions
- Versions open in the **right sidebar (NcAppSidebar)**, Nextcloud's usual place for file versions, instead of a dialog. It is its own column, so it can't collide with the left navigation, and Nextcloud makes it full-screen on a phone.
- The list is grouped Today, Yesterday and Earlier. The first entry is "Current version". Named versions show their name with a tag icon. A version that can't be read says so and has no Restore.
- **Click a version to preview it:** the main area shows that version **with the same row style, read-only**, under a banner: "Version from today, 09:15 · Read-only · [Restore this version] [Back to current]". This replaces the raw-XML preview.
- Each version's **⋯** menu holds **Restore** and **Name this version**. Naming happens in a field right under the row.
- **After a restore,** a green banner offers to name the state from before the restore ("Save name" or "Not now"), which replaces today's inline form.
- The safety rules stay as they are: save first, keep the before-restore state, refuse to restore while edits are unsaved.

### G. Narrow window and phone
The spec rules out a phone layout ("Narrow screens must not break, but nothing is designed for them"), so these are rules that stop things breaking, not a separate design:
- The column is `max-width: 820px` with padding of 44 px, dropping to 24 px and then 8 px.
- Below about 760 px of content width, Publish shows as an icon with a tooltip. The title is cut off with "…" and never wraps.
- Below 600 px, the indent drops from 24 to 16 px per level and Level 1 text from 19 to 18 px.
- Long rows wrap and stay aligned with their own text.
- On touch, drag handles don't show; moving rows works from the keyboard.
- Nextcloud's navigation becomes a drawer, and the Versions sidebar becomes full-screen.

### H. Where sort lives
- The ⋯ menu holds **Sort rows…**, **Versions** (kept here as well for narrow widths) and **Report a bug** once M14 lands.
- **Sort rows…** opens a small dialog: Sort by Row text, Note, or Checkbox (from imported files); Order A→Z or Z→A; then the line "Sorts the rows under every heading, at every level. Undo with Ctrl+Z." The sorting itself (`sortRows`) and its undo stay as they are.

### Unchanged but touched
- **ConflictDialog:** same text and buttons, but mounted at page level like every other dialog (see problem 6).

## Assumptions (I could not ask, so I decided)

1. **Level styling is allowed in 1.0.** The spec's Won't list rules out *user-set* text styling and level styles (F32, F33). This pass uses one fixed hierarchy that mirrors the publish heading rule, with nothing the user can configure and nothing stored in the file. If the owner reads the Won't list as ruling this out too, the fallback is: no bands, size and weight only.
2. **System font only, no serif.** OmniOutliner's serif headings would mean adding a font ("no fonts" in Won'ts) and wouldn't feel like Nextcloud.
3. **No roman numerals or numbering.** That is level styling, F32, after 1.0.
4. **No inline text highlights.** Rich text is after 1.0.
5. **No sidebar heading tree.** That is F42, "Sections sidebar", after 1.0. The left navigation lists outlines instead, which 1.0 needs more.
6. **Rows and words in the status line** are counted in the browser from the tree. It's a small thing that copies the OmniOutliner reference. Drop it if it's unwanted.
7. **Opening the last outline on start** is a small behaviour change (Notes does the same). It is stored per browser (localStorage), not on the server.
8. Example content in the mockups ("Community garden plan", and so on) is neutral and made up.
9. The Nextcloud chrome is drawn approximately (header, rounded content area, 300 px navigation, the 34 px controls of Nextcloud 30 and later). The real app gets it from @nextcloud/vue. If the live app differs, Nextcloud's version wins.
10. The live app has to confirm that the title currently sits under the navigation toggle (problem 1 in A-Current). It is a guess from the code: `NcAppContent` has no padding and the header starts at x=0.

## What changes vs today, per file (summary; tickets in implementation-notes.md)

- `src/App.vue`: the navigation gets the New button, the outline list and settings; it opens the last outline; Theme moves into settings.
- `src/views/OutlineList.vue`: becomes the navigation list plus the empty state.
- `src/views/OutlineView.vue`: the top bar and status line; the empty-outline placeholder replaces "Add first row"; Versions opens as a sidebar.
- `src/components/OutlineRow.vue`: typography by level, bands, gutter triangle and dot, hover-only handle and note icon, inline muted notes.
- `src/components/OutlineEditor.vue`: the sort bar is removed (moves to a dialog); the width and indent rules.
- `src/components/PublishButton.vue`: icon button with responsive label and states; picker title; success toast and status-line link.
- `src/components/VersionsPanel.vue`: NcAppSidebar, grouped list, ⋯ actions, read-only preview in the main area, after-restore banner.
- `src/components/SaveStatus.vue`: becomes part of the status line.
- `src/components/ThemeSetting.vue`: radio choices inside NcAppNavigationSettings.
- `src/components/ConflictDialog.vue`: mounted at page level.
- New: `src/components/OutlineTopBar.vue`, `src/components/StatusLine.vue`, `src/components/SortDialog.vue`, `src/components/KeyboardHints.vue`.
