# Glossary

Terms used in `SPEC.md`. One meaning each.

| Term | Meaning |
|---|---|
| Outline | One document in this app: a tree of rows, saved as one OPML file. |
| Row | One line of an outline. It has text, and may have a note and children. |
| Parent / children | A row's children are the rows indented directly under it; it is their parent. Moving a parent moves its children. |
| Note | Free text attached to a row, shown under it, which can be hidden per row. |
| Collapse / expand | Hide or show a row's children. The state is saved in the file. |
| Outlines folder | The fixed folder `Outlines/` in each user's own Nextcloud Files, created on first use, where outlines live. |
| OPML | The open outline file format used for storage and import; OmniOutliner can export it. |
| Publish to Doc | The button that turns an outline into an `.odt` document by the heading rule and opens it in Nextcloud Office. The outline stays the source. |
| Heading rule | Top-level rows become Heading 1; a second-level row that has children becomes Heading 2; every deeper row, and a second-level row without children, becomes a nested bullet; a note becomes a paragraph under its row. |
| Nextcloud Office | The Collabora-based office suite inside Nextcloud that opens `.odt` files. |
| Version | A saved earlier state of an outline file, from Nextcloud's own file versions. A named version is never cleaned up. |
| Autosave | Saving on its own shortly after typing stops and when the page is left, with no Save button. |
| Dogfood week | A week of real use in the app on a real Nextcloud server, the last check before 1.0. |
