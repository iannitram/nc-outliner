# nc-outliner: spec for 1.0

**Approval:** 2026-10-25, in a session with the coordinator.

Must M14 added 2026-10-26 by the owner: "Yes, a 1.0 Must (Recommended)" (the request: "New feature request for both apps - bug logging button with the same pathway as the launcher bug submission pathway"; details "Launcher set, browser version (Recommended)", "Same File Drop (Recommended)", "One shared module repo (Recommended)").

Must M15 added 2026-10-26 by the owner: "Private app store feed (Recommended)", "Yes, a 1.0 Must (Recommended)" (the requirement: "One feature that needs to work….once installed our plugins should update from the nextcloud admin panel, pulling updates automatically.").

## 1.0 means

In Nextcloud on a desktop browser, I can write a nested outline with notes, and **Publish to Doc** gives me a headed document open in Nextcloud Office; and I have used it on my production Nextcloud for a week of real school and work notes without losing anything.

## Musts

Each Must has a "done looks like" line and a check someone else can repeat. Feature IDs match the project roadmap.

| # | Must | Done looks like | Check |
|---|---|---|---|
| M1 (F01) | WHEN I open the app for the first time, THE APP SHALL create my **Outlines folder** and let me create, open and list **outlines** stored there as OPML files, as the signed-in user only. | A new user sees an empty list; a new outline appears as an `.opml` file in their Outlines folder in Files. | Sign in as two test users; each sees only their own outlines; the file opens in Files. |
| M2 (F02) | WHEN I press Enter in a **row**, THE APP SHALL add a row below and put the caret in it; typing edits the row; Backspace in an empty row deletes it. | Typing a ten-row list needs no mouse. | Scripted keyboard test plus a by-hand run. |
| M3 (F03) | WHEN I press Tab or Shift+Tab, THE APP SHALL indent or outdent the row, and its **children** move with it. | A three-level outline built from the keyboard alone. | Test: indent a parent with children; the saved file keeps the tree. |
| M4 (F04) | WHEN I click a row's disclosure triangle or use the arrow keys, THE APP SHALL **collapse** or expand it, and remember that in the file. | Collapsed rows stay collapsed after reload. | Collapse, reload, compare. |
| M5 (F05) | WHEN I undo or redo, THE APP SHALL reverse or repeat every kind of change in this list, one step at a time. | Ctrl+Z walks back any edit, move, indent or delete. | Test per change type: do, undo, redo, compare the outline. |
| M6 (F06) | WHEN I add a **note** to a row, THE APP SHALL keep it under that row and let me show or hide it per row. | Notes survive reload and Publish. | Add notes, reload, publish, read the doc. |
| M7 (F07) | WHEN I press Publish to Doc, THE APP SHALL ask where to save (folder picker over my Files; first time: the outline's folder and name; after that: the last spot), write an `.odt` by the **heading rule**, overwrite any earlier copy there, and open it in Nextcloud Office. | The doc opens in Nextcloud Office with the right headings and bullets. | Publish a sample outline; I open the sample `.odt` and approve it before this Must counts as done. |
| M8 (F08) | WHEN I delete a row or move it up or down from the keyboard, THE APP SHALL do it with its children. | Reordering needs no mouse. | Test move and delete with children. |
| M9 (F09) | WHEN I drag a row by its handle, THE APP SHALL reorder or nest it where I drop it, with its children. | Drag to a new parent works. | Drag test in a browser plus a by-hand run. |
| M10 (F24) | WHEN I open an outline's **versions**, THE APP SHALL list them with times, show any one read-only, restore one (keeping the current state as a version first), and let me name a version so it is never cleaned up. | A bad edit can be rolled back from the app. | Make edits, restore an older version, find the pre-restore state in the list. |
| M11 (F25) | WHEN I import an OPML file, including an OmniOutliner OPML export, THE APP SHALL open it as a new outline with its tree, notes and checkbox state. | My own OmniOutliner exports open. | Import a real OmniOutliner export and compare by hand. |
| M12 (F71) | WHEN Nextcloud is in dark or light mode, THE APP SHALL follow it, and SHALL let me override it (Auto, Light, Dark). Published docs always come out light. | Switching Nextcloud's theme switches the app. | Toggle each setting and look. |
| M13 (F72) | WHEN I stop typing or leave the page, THE APP SHALL **autosave** and show Saved, Saving or Can't save (retrying); and WHEN the file changed elsewhere, it SHALL never overwrite it silently, offering to reload or keep mine as a copy. | No Save button; no lost edits. | Test: edit the same outline in two tabs; the second save offers reload or copy. |
| M14 | WHEN I choose **Report a bug**, THE APP SHALL open the shared report form (craft-bugreport-web): what happened, what I expected, the app's recent errors, an optional screenshot and, only if I tick it that time, the open outline as `.opml`; it SHALL show me every file and send the report to the bug File Drop only after I press Send. | A report sent from the app lands in the File Drop with the desktop launcher's layout, and the morning bug intake reads it unchanged. | In the test container with the drop config set: make a report, check the consent screen lists every file, press Send, see the zip in the drop. |
| M15 | WHEN a new signed release of the app is published to our merged app-store feed (craft-nc-appstore), THE NEXTCLOUD ADMIN PANEL SHALL offer it on the Apps page and the scheduled job SHALL install it automatically. | Publishing a new version makes the Apps page offer it, and within the hour the server runs it; nothing is copied by hand, and the official apps still update. | On the test Nextcloud (nc-projects-test, never the live server) with craft-nc-appstore's merged feed: publish a test release, see it offered on the Apps page, wait for the scheduled job, and check `occ app:list` shows the new version; then the same with a second version. |

## Won'ts (not in 1.0)

- No columns (checkbox, number, date columns and the rest).
- No phone layout. Narrow screens must not break, but nothing is designed for them.
- No text styling: no bold, fonts, level styles or themes beyond dark and light.
- No live co-editing, and no sharing outlines with other users.

Everything else on the project roadmap comes after 1.0, in its rank order.

## Problem

I plan school and work in outlines, the way OmniOutliner works, but I need the result as a normal document in Nextcloud, where everything else of mine lives. No Nextcloud app does this (551 store apps checked, 2026-10-22).

## Solution

A per-user Nextcloud app: a keyboard-first outline editor whose files are OPML in the user's own Files (so they sync and keep versions), with one button that turns an outline into a Nextcloud Office document.

## User stories

1. I open the app and start an outline without setting anything up.
2. I write a plan from the keyboard: rows, indents, notes.
3. I fold away the parts I'm not working on.
4. I never press Save, and never lose an edit, even with two tabs open.
5. I go back to an earlier version when I've wrecked a section.
6. I bring my old OmniOutliner outlines over.
7. I press Publish to Doc and get a document I can hand in or share.
8. Another user on the same Nextcloud sees only their own outlines.

## Implementation decisions

- **Start fresh** (2026-10-25): the plain-JavaScript code on main and the 16-PR stack are not carried forward (ADR 0002).
- **Front end: Vue 3 with Nextcloud's own components and build tool** (2026-10-25, ADR 0001).
- Storage: one `.opml` file per outline in the user's Outlines folder; the format leaves room for stable row IDs, rich text, styles and columns later (OPML attributes plus an app namespace), so no migration is forced after 1.0.
- Publish copies: the outline stays the source; re-publishing overwrites the doc, and Nextcloud keeps the old versions (2026-10-22).
- Versions are Nextcloud's own file versions and version labels.
- Overwrite guard for autosave: the file's ETag, sent with If-Match on every save.
- The heading rule is locked (2026-10-25, ADR 0003).
- Desktop browser only (2026-10-22).

## Testing decisions

- Every Must's check above is the test of record.
- Automated tests run against a throwaway test Nextcloud, never production.
- The 1.0 dogfood week runs on my production Nextcloud (2026-10-25). Each deploy to production still needs my yes. "Without losing anything" means: every outline reopens as I left it, and no Can't save is left unresolved.

## Further notes

None open.
