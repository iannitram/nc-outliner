# Roadmap: OmniOutliner feature parity

Goal: feature parity with OmniOutliner 6 Pro, adapted to a Nextcloud web app (Ian, 2026-10-22).

**How this file works**
- Every feature has a fixed **ID** (F01, F02, …). IDs never change, so the Notes column can name dependencies even after rows move.
- A feature moves **Unwritten → PR** when a pull request opens (add the PR link in Notes), and **PR → Merged** when it merges (add the merge date).
- **Unwritten is ordered from most likely to be used to least likely**, judged for planning, school and work notes on a desktop browser.
- **Complexity** is the predicted effort of writing the code: Low, Medium or High.
- **Notes** names what a feature depends on ("Needs F09") and anything else a builder should know.

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

## Unwritten

| Rank | ID | Feature | Complexity | Notes (dependencies) |
|---|---|---|---|---|
| 1 | F01 | **Outline files:** new, open and autosave `.opml` outlines in the user's `Outlines/` folder (created on first use), as the signed-in user | Medium | Foundation: everything depends on it. The file format needs room for row IDs, rich text, styles and columns later (OPML attributes plus an app namespace) |
| 2 | F02 | **Type rows:** Enter adds a row below, typing edits it, Backspace on an empty row deletes it | Medium | Needs F01. The editing core: keyboard handling and caret movement between rows |
| 3 | F03 | **Indent / outdent** with Tab and Shift+Tab; children move with their parent | Low | Needs F02 |
| 4 | F04 | **Expand / collapse** a row (disclosure triangle, arrow keys); a bullet for rows without children | Low | Needs F02. Collapsed state saved in the file |
| 5 | F05 | **Undo / redo** for every change | Medium | Needs F02. Build it early: every later editing feature has to go through it |
| 6 | F06 | **Row notes:** a note under any row, shown or hidden per row | Medium | Needs F02 |
| 7 | F07 | **Publish to Doc:** ask where to save (Nextcloud folder picker), write an `.odt` (top level → Heading 1, a second-level row with children → Heading 2, deeper → nested bullets, notes → paragraphs), open it in Nextcloud Office, remember the spot and offer it on re-publish (overwrites) | High | Needs F01, F03, F06. Not an Omni feature: it's this app's reason to exist. Show Ian a sample doc before locking the heading rules |
| 8 | F71 | **Dark and light mode:** follows Nextcloud's own light/dark setting automatically, with a per-user override (Auto, Light, Dark) in the app | Low | Needs F02. Ian's request (2026-10-22). Build every colour on Nextcloud's theme variables from day one, so it costs almost nothing now and a lot to retrofit. Published docs (F07) always come out light. F31 builds on it |
| 9 | F08 | **Delete rows,** and move a row up or down with the keyboard | Low | Needs F02 |
| 10 | F09 | **Drag and drop** rows by their handle to reorder or nest | Medium | Needs F03, F04 |
| 11 | F10 | **Status checkboxes:** turn any outline into a checklist, with a show/hide toggle | Low | Needs F02 |
| 12 | F11 | **Select several rows** (Shift/Ctrl+click, Shift+arrow) and act on them together | Medium | Needs F02. Needed by F12, F21, F22 |
| 13 | F12 | **Cut, copy, paste rows** with their structure, between outlines too; pasting tab-indented or bulleted text becomes rows | Medium | Needs F11 |
| 14 | F13 | **Expand all / collapse all,** and expand or collapse a row completely | Low | Needs F04 |
| 15 | F14 | **Search field:** show only rows matching the text (with their parents) | Medium | Needs F04 |
| 16 | F15 | **Bold, italic, underline, strikethrough** in row text and notes | Medium | Needs F02. Needs the rich-text storage from F01 |
| 17 | F16 | **Links in text:** paste or add a URL and it's clickable | Low | Needs F15 |
| 18 | F17 | **Calculated checkboxes:** a parent shows checked, unchecked or mixed from its children; checking a parent checks them all | Medium | Needs F10 |
| 19 | F18 | **Focus** on a row or section (hide everything else), and unfocus | Medium | Needs F04 |
| 20 | F19 | **Full keyboard set:** add inside / add outside, move left / right, toggle checkbox, edit note, focus | Low | Needs F03, F06, F10, F18 |
| 21 | F20 | **Outline file management:** rename, duplicate and move outlines; a list of recent outlines | Low | Needs F01. Uses Nextcloud's file APIs |
| 22 | F21 | **Group / ungroup:** put selected rows under a new parent, or dissolve one | Low | Needs F11 |
| 23 | F22 | **Duplicate selection** in place | Low | Needs F11, F12 |
| 24 | F23 | **Find with Next / Previous** and highlighted matches, including inside collapsed rows and notes | Medium | Needs F14. A regex option comes later |
| 25 | F24 | **Version history:** see and restore earlier versions of an outline | Low | Needs F01. Opens Nextcloud's own versions panel, the web stand-in for Time Machine |
| 26 | F25 | **Import OPML,** including OmniOutliner's own OPML exports (notes, checkbox state) | Low | Needs F01. Test against real OmniOutliner exports |
| 27 | F26 | **Insert timestamp:** short or long date, time, or both | Low | Needs F02 |
| 28 | F27 | **Print and Save as PDF:** expand all, include notes, selected rows only, flatten indentation, checked or unchecked rows only | Medium | Needs F06, F13. A print stylesheet plus a print-options dialog |
| 29 | F28 | **Export to Word (.docx),** indented and outline styles | Medium | Shares F07's publisher, with a second output format |
| 30 | F29 | **Sort rows** permanently: topic A–Z or Z–A, by status, by note | Low | Needs F11 for "selected rows" |
| 31 | F30 | **Row numbering:** 1. / a. / i. / section numbers (1.1.2), with suffix choices | Medium | Needs F01 (saved per document). Should carry into F07's output |
| 32 | F32 | **Level styles:** font, size and colour per outline level, for the whole document | Medium | Needs F15. The base of the style system |
| 33 | F31 | **Themes:** built-in looks that follow Nextcloud's light and dark mode | Medium | Needs F32, F71. Adds whole looks on top of the light/dark switch |
| 34 | F33 | **Text formatting controls:** font, size, colour, highlight, alignment, line height, row padding, space above and below children | Medium | Needs F32 |
| 35 | F34 | **Import plain text** (tab-indented or bulleted) and Markdown lists as a new outline | Low | Needs F01 |
| 36 | F35 | **Export plain text, OPML and Markdown** | Low | Needs F01. Markdown isn't in Omni, but it's a cheap win |
| 37 | F36 | **Links to a row:** copy a link to one row, and open the outline scrolled to it (Omni Links) | Medium | Needs F01 (stable row IDs). Links only work for people who can open the file |
| 38 | F37 | **Templates:** save an outline as a template, and start a new one from a template | Medium | Needs F01; worth more after F31 and F32 |
| 39 | F38 | **Attachments:** link a Nextcloud file to a row (picker), shown as a chip that opens it | Medium | Needs F02. Links to Files instead of embedding copies |
| 40 | F39 | **Inline images** in rows and notes | Medium | Needs F38 |
| 41 | F40 | **Notes display options:** inline or in a bottom pane; show or hide all notes | Low | Needs F06 |
| 42 | F41 | **Text folding:** show only a row's first line until you edit it | Low | Needs F02 |
| 43 | F42 | **Sections sidebar:** top-level rows as a list; click to jump, drag to reorder, select to focus | Medium | Needs F09, F18 |
| 44 | F43 | **Columns:** add, remove, rename and resize columns; column headers show automatically once there are two | High | Needs F01 (storage designed in from day one). Deferred by Ian until after the outline core |
| 45 | F44 | **Column types:** checkbox, number (decimal, percent, currency), date, duration, pop-up list, rich text | High | Needs F43 |
| 46 | F45 | **Column summaries** on parent rows: total, min, max, average of leaves, checkbox state (Omni's "smart columns") | Medium | Needs F44 |
| 47 | F46 | **Sort by column** and **hide or show columns** | Low | Needs F43, F29 |
| 48 | F47 | **Keep Sorted:** a display-only sort that doesn't reorder the file | Medium | Needs F29 |
| 49 | F48 | **Named styles:** reusable styles applied to rows or text; edit once, update everywhere; copy, paste and clear style; a style-precedence view | High | Needs F32, F33 |
| 50 | F49 | **Saved filters:** rule-based views (text "is like" with * and ?, status, column values), with a filter bar to edit, refresh or dismiss | High | Needs F14; column rules need F44 |
| 51 | F50 | **Print headers and footers:** six positions, master, first, odd and even pages, with page number, section title, page count, document title and print time; page break before a row | Medium | Needs F27 |
| 52 | F51 | **Document look options:** handle visibility (always, hover, never), grid lines, alternating row colours, gutter colour, child indent amount | Low | Needs F31 |
| 53 | F52 | **Zoom** 50–400% | Low | None |
| 54 | F53 | **Typewriter mode:** keep the current row centred on screen | Low | None |
| 55 | F54 | **Document metadata:** title, author, subject, keywords and the like | Low | Needs F01 (kept in the OPML head) |
| 56 | F55 | **Spell check** while typing | Low | The browser's own checker; just leave it on |
| 57 | F56 | **Export HTML:** static, and dynamic with collapsible sections | Medium | Needs F01 |
| 58 | F57 | **Export CSV and Excel (.xlsx)** | Medium | Needs F01; most useful after F43 |
| 59 | F58 | **Import OmniOutliner's native files** (`.ooutline`, `.oo3`), keeping styles and columns | High | Needs F43, F48 for full fidelity; OPML (F25) covers the structure until then |
| 60 | F59 | **Import RTF / RTFD** | Medium | Needs F15 |
| 61 | F60 | **Custom keyboard shortcuts** and shareable shortcut sets | Medium | Needs F19 |
| 62 | F61 | **Customizable toolbar,** globally or per document | Medium | None |
| 63 | F62 | **Mobile / phone layout** | Medium | Deferred by Ian until after v1 (desktop first) |
| 64 | F63 | **Audio recording** into a row | Medium | Needs F38 (saved as an attachment) |
| 65 | F64 | **Read aloud** the current row | Low | Uses the browser's speech API |
| 66 | F65 | **Right-to-left** writing direction | Low | Needs F33 |
| 67 | F66 | **Typography extras:** kerning, ligatures, superscript, subscript, baseline shift | Low | Needs F33 |
| 68 | F67 | **Regex find** | Low | Needs F23 |
| 69 | F68 | **Export PowerPoint (.pptx):** top-level rows become slides | High | Needs F07's document model |
| 70 | F69 | **Password-protected outlines** (client-side encryption) | High | Needs F01. Nextcloud's own encryption may be enough; decide before building |
| 71 | F70 | **Automation and plug-ins:** a scripting API for the outline (the Omni Automation stand-in) | High | Needs a stable internal API, so after most of the above |

---

## Not carried over (no web meaning)

| Omni feature | Why not | Stand-in |
|---|---|---|
| OmniPresence / Omni Sync Server | Nextcloud already syncs the files | Nextcloud sync |
| Time Machine "Revert To" | macOS only | F24 (Nextcloud versions) |
| Touch Bar customization | Mac hardware | None |
| LinkBack (edit embedded content in its source app) | macOS inter-app protocol | F38 opens attachments in their own Nextcloud app |
| Liquid Glass design, Apple Vision Pro app | Apple platform UI | F31 themes |
| Apple Shortcuts actions, Apple Intelligence plug-ins | Apple platform | F70 |
| Dictation, Emoji & Symbols window | Provided by the OS and browser | Works in any text field already |
| Universal licensing, free trial, Free Viewer Mode | Commercial licensing | None (private app) |
| Share to another app as plain text | macOS share sheet | F35 export, F36 row links |
