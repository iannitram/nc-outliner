# nc-outliner

A Nextcloud app for outlining, modeled on OmniOutliner. Write a nested outline in the browser. When it's ready, **Publish to Doc** turns it into a document in your Nextcloud files and opens it in Nextcloud Office (Collabora).

Status: **design.** No code yet. Project notes and status live in the vault at `Workspaces/Outliner/PROJECT.md`; the tracker is project `cc-kaylee-nc-outliner-2026` on `queue-kaylee`.

## What v1 does

- **Outline editor:** rows you can indent, outdent, collapse, drag to reorder, and drive from the keyboard (Enter, Tab, Shift+Tab). Any row can carry a note.
- **Per-user:** the app works as the signed-in Nextcloud user, reading and writing only that user's own Files.
- **Storage:** each outline is an `.opml` file in a fixed `Outlines/` folder in the user's Files, created on first use.
- **Publish asks where to save:** a Nextcloud folder picker over the user's own Files. The outline remembers where it was last published, and re-publishing offers that spot again. It syncs to every device, gets Nextcloud's version history, and imports outlines exported from OmniOutliner.
- **Publish to Doc:** writes an `.odt` (Nextcloud Office's native format) and opens it in Collabora.
  - Top-level rows become Heading 1.
  - A second-level row that has children becomes Heading 2 (to be confirmed with a sample doc).
  - Everything deeper becomes nested bullets.
  - A row's note becomes a paragraph under it.

## Decisions

| Date | Decision | By |
|---|---|---|
| 2026-10-22 | v1 is the nested outline only. Columns (checkboxes, dates, numbers) come later, and the file layout must leave room for them | Ian |
| 2026-10-22 | Main use is planning, school and work notes, so publishing uses the headings + bullets layout | Ian |
| 2026-10-22 | Nothing suitable in the Nextcloud app store to fork (551 apps checked; nearest are MeeTree, a tree of note pages, and files_mindmap) | Kaylee |
| 2026-10-22 | Private repo; dev tree on Hyperion at `B:\dev\nc-outliner` | Ian |
| 2026-10-22 | Per-user app; one fixed `Outlines/` folder in each user's Files | Ian |
| 2026-10-22 | Publish copies: the outline stays the source, and re-publishing overwrites the doc (Nextcloud keeps the old versions) | Ian |
| 2026-10-22 | Desktop browser only for v1; phone comes later | Ian |
| 2026-10-22 | Publish asks where to save (folder picker); re-publish offers the last spot | Ian |
| 2026-10-22 | Goal is feature parity with OmniOutliner; see `ROADMAP.md` | Ian |

## Open questions

1. Front end: plain JS with no build step (the Quote Database app's approach) or Vue (the usual Nextcloud app stack)? Kaylee leans toward plain JS for v1.

## Layout (planned)

- `appinfo/` holds `info.xml` and routes.
- `lib/` holds the PHP controllers and the OPML → ODT publisher.
- `js/` and `css/` hold the editor.
- `templates/` holds the page shell.

The app deploys as a folder copy into the Nextcloud container's `custom_apps/` on Hyperion. A deploy needs Ian's yes.
