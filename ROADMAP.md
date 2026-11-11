# Roadmap: OmniOutliner feature parity

Goal: feature parity with OmniOutliner 6 Pro, adapted to a Nextcloud web app (the owner, 2026-10-22).

Updated: 2026-11-11

features:
- files: Outline files in my Outlines folder: create, open, list, rename, duplicate, move, templates, metadata, password protection (F01, F20, F37, F54, F69)
- editing: Type, indent, delete, move and drag rows from the keyboard and mouse, with undo and redo (F02, F03, F05, F08, F09, F19, F26, F55, F60)
- folding: Expand and collapse rows, expand all, focus, text folding, sections sidebar (F04, F13, F18, F41, F42)
- notes: Row notes and how they are shown (F06, F40)
- checkboxes: Status checkboxes and calculated parent checkboxes; After 1.0 (F10, F17)
- arrange: Work on several rows at once: select, cut, copy, paste, group, duplicate, sort (F11, F12, F21, F22, F29, F47)
- publish: Publish to Doc as .odt, then Word and PowerPoint output (F07, F28, F68)
- versions: Version list, preview, restore and named versions (F24)
- autosave: Autosave, save status and the overwrite guard (F72)
- import: Import OPML, plain text, Markdown, OmniOutliner native files and RTF (F25, F34, F58, F59)
- export: Export plain text, OPML, Markdown, HTML, CSV and Excel; print and Save as PDF; After 1.0 (F27, F35, F50, F56, F57)
- search: Search field, find next and previous, regex find, saved filters; After 1.0 (F14, F23, F49, F67)
- text: Rich text in rows and notes: bold and italic, links in text, links to a row, formatting controls, right-to-left, typography; After 1.0 (F15, F16, F33, F36, F65, F66)
- styles: Level styles, named styles and row numbering; After 1.0 (F30, F32, F48)
- look: Look and layout: dark and light mode, themes, the design pass, document look options, zoom, typewriter mode, toolbar, phone layout (F31, F51, F52, F53, F61, F62, F71)
- columns: Columns, column types, summaries, sort by column; After 1.0 (F43, F44, F45, F46)
- attachments: Attachments and media: linked files, inline images, audio recording, read aloud; After 1.0 (F38, F39, F63, F64)
- bug-report: Report a bug and the crash log (SPEC M14)
- updates: Updates from the admin panel through the private app-store feed (F73, SPEC M15)
- automation: Automation core, command line, MCP server, scripts and plug-ins; After 1.0 (F70, F74, F75, F76, F77)

**How this file works**
- Every feature has a fixed **ID** (F01, F02, …). IDs never change, so the Notes column can name dependencies even after rows move.
- A feature moves **Unwritten → PR** when a pull request opens (add the PR link in Notes), and **PR → Merged** when it merges (add the merge date).
- **Unwritten is ordered from most likely to be used to least likely**, judged for planning and note-taking on a desktop browser.
- **Complexity** is the predicted effort of writing the code: Low, Medium or High.
- **Notes** names what a feature depends on ("Needs F09") and anything else a builder should know.

**Where it stands (2026-10-26):** no feature is fully merged yet; the pure building blocks are on main, the server routes and every screen are not. Built: OPML read and write (#85, #103), the outline store (#88), the outline operations (#86, #104, #105), undo and redo (#89), the browser API client (#106), the ODT content writer and package (#87, #112). Open: the API routes (#108) and everything the user sees.

Sources: Omni's OmniOutliner 5 Pro reference manual (v5.1.2: menus, outline, sidebar, inspectors, import/export/print chapters), the OmniOutliner 6 product page, and the 6.1–6.3.1 release notes, all read 2026-10-22. Features with no web meaning are listed at the bottom with the reason, so nothing is dropped silently.

---

## Merged

| ID | Feature | Complexity | Notes |
|---|---|---|---|
| | *(nothing yet)* | | |

## PR

| ID | Feature | Complexity | Notes |
|---|---|---|---|
| | *(nothing yet)* | | |

### Approved O1 design polish

These refinements of existing features are in [PR #199](https://github.com/iannitram/nc-outliner/pull/199); they do not change the broader feature stages below.

| Issue | Refinement | Stage |
|---|---|---|
| #182 | Inline notes and note icon | PR |
| #188 | Empty-outline placeholder and keyboard card | PR |
| #189 | Sort rows dialog, Escape and outline-change dismissal | PR |
| #184 | Publish picker, feedback and status-line document link | PR |
| #187 | Theme radios in Outliner settings | PR |
| #190 | Container width, wrapped rows and touch controls | PR |

---

## Unwritten

| Rank | ID | Feature | Complexity | Notes (dependencies) |
|---|---|---|---|---|
| 0 | F73 | **Updates from the admin panel** (1.0, SPEC M15): signed releases through the merged app-store feed (private), offered on the Apps page and installed by its scheduled job | Medium | #128, #129, #130; needs the private app-store feed 1.0 **On main:** nothing yet; blocked on the feed's own tickets. |
| 1 | F01 | **Outline files:** create and open `.opml` outlines in the user's `Outlines/` folder (created on first use), as the signed-in user | Medium | Foundation: everything depends on it. The file format needs room for row IDs, rich text, styles and columns later (OPML attributes plus an app namespace). Old plain-JS PR #1 was merged, then its code left main in #100 under ADR 0002 (start fresh) **On main:** OPML codec (#85, #103) and `OutlineStore` (#88); the API routes (#108) and the list view (#90) are open. |
| 2 | F02 | **Type rows:** Enter adds a row below, typing edits it, Backspace on an empty row deletes it | Medium | Needs F01. The editing core: keyboard handling and caret movement between rows. Old plain-JS PR #2 closed as superseded 2026-10-25 (ADR 0002) **On main:** the model's `insertAfter`, `remove`, `updateRow` (#86, #105); the editor (#91) and keys (#107) are open. |
| 3 | F03 | **Indent / outdent** with Tab and Shift+Tab; children move with their parent | Low | Needs F02. Old plain-JS PR #5 closed as superseded 2026-10-25 (ADR 0002) **On main:** the model's `indent` and `outdent` (#104); the keys (#92) are open. |
| 4 | F24 | **Versioning:** a version list with times, preview any version read-only, restore one (the current state is kept as a version first), and name a version you care about ("Before rewrite") so it never gets cleaned up | Medium | Needs F01, F72. The owner's request (2026-10-22). Built on Nextcloud's own file versions and version labels, the web stand-in for Time Machine. Autosave creates many versions: Nextcloud thins old ones automatically, and named versions are kept. Check the build machine's version-retention setting first |
| 5 | F04 | **Expand / collapse** a row (disclosure triangle, arrow keys); a bullet for rows without children | Low | Needs F02. Collapsed state saved in the file. Old plain-JS PR #6 closed as superseded 2026-10-25 (ADR 0002) **On main:** the model's `updateRow` collapsed flag (#105) and the file's `nco:collapsed` (#85, #103); the triangle and keys (#93) are open. |
| 6 | F05 | **Undo / redo** for every change | Medium | Needs F02. Build it early: every later editing feature has to go through it. Old plain-JS PR #7 closed as superseded 2026-10-25 (ADR 0002) **On main:** History, undo and redo over the model (#89); the Ctrl/Cmd+Z keys (#107) are open. |
| 7 | F06 | **Row notes:** a note under any row, shown or hidden per row | Medium | Needs F02. Old plain-JS PR #58 closed as superseded 2026-10-25 (ADR 0002) **On main:** notes in the codec and `updateRow` (#103, #105); the note UI (#94) is open. |
| 8 | F10 | **Status checkboxes:** turn any outline into a checklist, with a show/hide toggle | Low | Needs F02. Old plain-JS PR #59 closed as superseded 2026-10-25 (ADR 0002) |
| 9 | F07 | **Publish to Doc:** ask where to save (Nextcloud folder picker), write an `.odt` (top level → Heading 1, a second-level row with children → Heading 2, deeper → nested bullets, notes → paragraphs), open it in Nextcloud Office, remember the spot and offer it on re-publish (overwrites) | High | Needs F01, F03, F06. Not an Omni feature: it's this app's reason to exist. Show the owner a sample doc before locking the heading rules **On main:** the content writer (#87) and `.odt` package (#112); the publish route (#113) and button (#9) are open, and #120 checks the result in LibreOffice and Nextcloud Office. |
| 10 | F08 | **Delete rows,** and move a row up or down with the keyboard | Low | Needs F02. Old plain-JS PR #60 closed as superseded 2026-10-25 (ADR 0002) **On main:** the model's `remove`, `moveUp`, `moveDown` (#86); the keys (#95) are open. |
| 11 | F13 | **Expand all / collapse all,** and expand or collapse a row completely | Low | Needs F04. Old plain-JS PR #61 closed as superseded 2026-10-25 (ADR 0002) |
| 12 | F09 | **Drag and drop** rows by their handle to reorder or nest | Medium | Needs F03, F04 |
| 13 | F14 | **Search field:** show only rows matching the text (with their parents) | Medium | Needs F04. Old plain-JS PR #62 closed as superseded 2026-10-25 (ADR 0002) |
| 14 | F11 | **Select several rows** (Shift/Ctrl+click, Shift+arrow) and act on them together | Medium | Needs F02. Needed by F12, F21, F22 |
| 15 | F12 | **Cut, copy, paste rows** with their structure, between outlines too; pasting tab-indented or bulleted text becomes rows | Medium | Needs F11 |
| 16 | F26 | **Insert timestamp:** short or long date, time, or both | Low | Needs F02. Old plain-JS PR #63 closed as superseded 2026-10-25 (ADR 0002) |
| 17 | F34 | **Import plain text** (tab-indented or bulleted) and Markdown lists as a new outline | Low | Needs F01. Old plain-JS PR #64 closed as superseded 2026-10-25 (ADR 0002) |
| 18 | F15 | **Bold, italic, underline, strikethrough** in row text and notes | Medium | Needs F02. Needs the rich-text storage from F01 |
| 19 | F16 | **Links in text:** paste or add a URL and it's clickable | Low | Needs F15 |
| 20 | F17 | **Calculated checkboxes:** a parent shows checked, unchecked or mixed from its children; checking a parent checks them all | Medium | Needs F10 |
| 21 | F18 | **Focus** on a row or section (hide everything else), and unfocus | Medium | Needs F04 |
| 22 | F19 | **Full keyboard set:** add inside / add outside, move left / right, toggle checkbox, edit note, focus | Low | Needs F03, F06, F10, F18 |
| 23 | F20 | **Outline file management:** rename, duplicate and move outlines; a list of recent outlines | Low | Needs F01. Uses Nextcloud's file APIs |
| 24 | F21 | **Group / ungroup:** put selected rows under a new parent, or dissolve one | Low | Needs F11 |
| 25 | F22 | **Duplicate selection** in place | Low | Needs F11, F12 |
| 26 | F23 | **Find with Next / Previous** and highlighted matches, including inside collapsed rows and notes | Medium | Needs F14. A regex option comes later |
| 27 | F25 | **Import OPML,** including OmniOutliner's own OPML exports (notes, checkbox state) | Low | Needs F01. Test against real OmniOutliner exports |
| 28 | F35 | **Export plain text, OPML and Markdown** | Low | Needs F01. Markdown isn't in Omni, but it's a cheap win. Old plain-JS PR #65 closed as superseded 2026-10-25 (ADR 0002) |
| 29 | F27 | **Print and Save as PDF:** expand all, include notes, selected rows only, flatten indentation, checked or unchecked rows only | Medium | Needs F06, F13. A print stylesheet plus a print-options dialog |
| 30 | F28 | **Export to Word (.docx),** indented and outline styles | Medium | Shares F07's publisher, with a second output format |
| 31 | F29 | **Sort rows** permanently: topic A–Z or Z–A, by status, by note | Low | Needs F11 for "selected rows" |
| 32 | F30 | **Row numbering:** 1. / a. / i. / section numbers (1.1.2), with suffix choices | Medium | Needs F01 (saved per document). Should carry into F07's output |
| 33 | F32 | **Level styles:** font, size and colour per outline level, for the whole document | Medium | Needs F15. The base of the style system |
| 34 | F31 | **Themes:** built-in looks that follow Nextcloud's light and dark mode | Medium | Needs F32, F71. Adds whole looks on top of the light/dark switch |
| 35 | F33 | **Text formatting controls:** font, size, colour, highlight, alignment, line height, row padding, space above and below children | Medium | Needs F32 |
| 36 | F71 | **Dark and light mode:** follows Nextcloud's own light/dark setting automatically, with a per-user override (Auto, Light, Dark) in the app | Low | Needs F02. The owner's request (2026-10-22). Build every colour on Nextcloud's theme variables from day one, so it costs almost nothing now and a lot to retrofit. Published docs (F07) always come out light. F31 builds on it. Old plain-JS PR #66 closed as superseded 2026-10-25 (ADR 0002) |
| 37 | F72 | **Autosave:** saves on its own a second or two after you stop typing, and again when you leave the page; a status shows Saved, Saving or Can't save (retrying). If the file changed somewhere else (another tab or device), it never overwrites it silently: it offers to reload, or to keep yours as a copy | Medium | Needs F01, F02. The owner's request (2026-10-22). Overwrite guard: Nextcloud's ETag with If-Match on every save. There's no Save button at all once this works. Old plain-JS PR #67 closed as superseded 2026-10-25 (ADR 0002) **On main:** the browser API client with the `If-Match` save (#106) and the store's etag guard (#88); the saver (#97) and conflict dialog (#110) are open. |
| 38 | F36 | **Links to a row:** copy a link to one row, and open the outline scrolled to it (Omni Links) | Medium | Needs F01 (stable row IDs). Links only work for people who can open the file |
| 39 | F37 | **Templates:** save an outline as a template, and start a new one from a template | Medium | Needs F01; worth more after F31 and F32 |
| 40 | F38 | **Attachments:** link a Nextcloud file to a row (picker), shown as a chip that opens it | Medium | Needs F02. Links to Files instead of embedding copies |
| 41 | F39 | **Inline images** in rows and notes | Medium | Needs F38 |
| 42 | F40 | **Notes display options:** inline or in a bottom pane; show or hide all notes | Low | Needs F06 |
| 43 | F41 | **Text folding:** show only a row's first line until you edit it | Low | Needs F02 |
| 44 | F42 | **Sections sidebar:** top-level rows as a list; click to jump, drag to reorder, select to focus | Medium | Needs F09, F18 |
| 45 | F43 | **Columns:** add, remove, rename and resize columns; column headers show automatically once there are two | High | Needs F01 (storage designed in from day one). Deferred by the owner until after the outline core |
| 46 | F44 | **Column types:** checkbox, number (decimal, percent, currency), date, duration, pop-up list, rich text | High | Needs F43 |
| 47 | F45 | **Column summaries** on parent rows: total, min, max, average of leaves, checkbox state (Omni's "smart columns") | Medium | Needs F44 |
| 48 | F46 | **Sort by column** and **hide or show columns** | Low | Needs F43, F29 |
| 49 | F47 | **Keep Sorted:** a display-only sort that doesn't reorder the file | Medium | Needs F29 |
| 50 | F48 | **Named styles:** reusable styles applied to rows or text; edit once, update everywhere; copy, paste and clear style; a style-precedence view | High | Needs F32, F33 |
| 51 | F49 | **Saved filters:** rule-based views (text "is like" with * and ?, status, column values), with a filter bar to edit, refresh or dismiss | High | Needs F14; column rules need F44 |
| 52 | F50 | **Print headers and footers:** six positions, master, first, odd and even pages, with page number, section title, page count, document title and print time; page break before a row | Medium | Needs F27 |
| 53 | F51 | **Document look options:** handle visibility (always, hover, never), grid lines, alternating row colours, gutter colour, child indent amount | Low | Needs F31 |
| 54 | F52 | **Zoom** 50–400% | Low | None |
| 55 | F53 | **Typewriter mode:** keep the current row centred on screen | Low | None |
| 56 | F54 | **Document metadata:** title, author, subject, keywords and the like | Low | Needs F01 (kept in the OPML head) |
| 57 | F55 | **Spell check** while typing | Low | The browser's own checker; just leave it on |
| 58 | F56 | **Export HTML:** static, and dynamic with collapsible sections | Medium | Needs F01 |
| 59 | F57 | **Export CSV and Excel (.xlsx)** | Medium | Needs F01; most useful after F43 |
| 60 | F58 | **Import OmniOutliner's native files** (`.ooutline`, `.oo3`), keeping styles and columns | High | Needs F43, F48 for full fidelity; OPML (F25) covers the structure until then |
| 61 | F59 | **Import RTF / RTFD** | Medium | Needs F15 |
| 62 | F60 | **Custom keyboard shortcuts** and shareable shortcut sets | Medium | Needs F19 |
| 63 | F61 | **Customizable toolbar,** globally or per document | Medium | None |
| 64 | F62 | **Mobile / phone layout** | Medium | Deferred by the owner until after v1 (desktop first) |
| 65 | F63 | **Audio recording** into a row | Medium | Needs F38 (saved as an attachment) |
| 66 | F64 | **Read aloud** the current row | Low | Uses the browser's speech API |
| 67 | F65 | **Right-to-left** writing direction | Low | Needs F33 |
| 68 | F66 | **Typography extras:** kerning, ligatures, superscript, subscript, baseline shift | Low | Needs F33 |
| 69 | F67 | **Regex find** | Low | Needs F23 |
| 70 | F68 | **Export PowerPoint (.pptx):** top-level rows become slides | High | Needs F07's document model |
| 71 | F69 | **Password-protected outlines** (client-side encryption) | High | Needs F01. Nextcloud's own encryption may be enough; decide before building |
| 72 | F70 | **Automation and plug-ins:** a scripting API for the outline (the Omni Automation stand-in) | High | Needs a stable internal API, so after most of the above. The scripting part moved to [Automation](#automation-after-10-added-2026-11-03-my-decision) (F77, added 2026-11-03); F70 keeps plug-ins (my own code loaded into the app) |

### Automation (after 1.0, added 2026-11-03, my decision)

Drive the outliner with no browser: a command line, an MCP server and script files, so an agent or I can test and iterate quickly, and an AI can use the outliner as a tool. It comes **right after the 1.0 work**, ahead of the after-1.0 rows in the table above, and does not change 1.0 (SPEC is unchanged).

How it fits this app: the outline operations live in the browser model (`src/model/outline.js`, `src/model/history.js`), which has no browser dependencies, so **headless** means running that same model in Node on a local `.opml` file, reading and writing OPML and `.odt` through the app's own pure PHP classes (one codec, one publisher). **Attach** means talking to a running Nextcloud through the app's own JSON API with an app password. The command line is a small Node client (`nco`), not an `occ` command: an `occ` command would need a second copy of the model in PHP and a shell on the server. Same split as our other apps (core, command line, MCP, scripts); nothing is dropped. Code map: [Automation](CODEMAP.md#automation).

Order: F74 first, then F77, then F75, then F76.

| ID | Feature | Complexity | Notes |
|---|---|---|---|
| F74 | **Automation core:** one backend contract and one table of named outline operations, with a headless backend (the model in Node on a local `.opml`) and an attach backend (a running Nextcloud through the app's API) | High | #213. Needs F01, F05, F07 (all 1.0). First check: the app's routes accept an app password from outside the browser |
| F75 | **Command line** `nco`: `list`, `show`, `run <script>`, `publish`, `mcp`; headless by default, `--attach` for a server | Medium | #214. Needs F74, F77 |
| F76 | **MCP server** over stdio: list, open and create outlines; add, edit, delete, move, indent, outdent, collapse, expand and sort rows; run a script; undo, redo, save, Publish to Doc | Medium | #215. Needs F74, F75, F77. Column tools come with F43 and checkbox tools with F10 |
| F77 | **Scripts:** a text file of outline operations, one per line, checked whole and applied as one undo step; headless, through MCP, or from the ⋯ menu in the browser | Medium | #216. Needs F74 |

**Done when** an AI agent completes 10 real editing tasks through the MCP server with no browser, and the same 10 with `--attach` against a test Nextcloud (F76's test).

---

## Not carried over (no web meaning)

| Omni feature | Why not | Stand-in |
|---|---|---|
| OmniPresence / Omni Sync Server | Nextcloud already syncs the files | Nextcloud sync |
| Time Machine "Revert To" | macOS only | F24 (Nextcloud versions) |
| Touch Bar customization | Mac hardware | None |
| LinkBack (edit embedded content in its source app) | macOS inter-app protocol | F38 opens attachments in their own Nextcloud app |
| Liquid Glass design, Apple Vision Pro app | Apple platform UI | F31 themes |
| Apple Shortcuts actions, Apple Intelligence plug-ins | Apple platform | F70 plug-ins; F75 command line and F76 MCP server |
| Dictation, Emoji & Symbols window | Provided by the OS and browser | Works in any text field already |
| Universal licensing, free trial, Free Viewer Mode | Commercial licensing | None (private app) |
| Share to another app as plain text | macOS share sheet | F35 export, F36 row links |
