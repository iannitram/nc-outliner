# Changelog

Newest first. One line per change of stage, release or decision that the next session needs.

- 2026-11-09 Version 0.1.2: the Collabora paste fix (#224, #225, #226) and the bug reporter at craft-bugreport-web 89f0df8, which closes its panel after Sent and keeps it out of the navigation sidebar (craft-bugreport-web#41), and keeps app.log in reports (craft-bugreport-web#31).
- 2026-11-06 Version 0.1.1 and a supported install path. The 2026-11-06 install of #221 showed the outline rows and the top bar unstyled (title under the sidebar button). The version was still 0.1.0, so the stylesheet served or cached was from the 2026-10-28 build, and its scoped-style hashes no longer matched the components #221 changed. Styles are now built into the script (no separate stylesheet to go stale). `npm run package` refuses info.xml and package.json that disagree, uncommitted changes and a build from another commit. `npm run install:docker` refuses stray app copies, and refuses to replace a server that already runs the same version with a different script. See INSTALL.md.
- 2026-11-03 My decision: Automation added after 1.0 (command line, MCP server, scripts): F74 core #213, F75 command line `nco` #214, F76 MCP server #215, F77 scripts #216; 1.0 scope unchanged; the scripting part of F70 moves to F77, F70 keeps plug-ins.
- 2026-11-02 Code map refreshed to match main: editor key groups, saver, list, conflict dialog and admin/bug-report files marked present; missing files and routes added; Import still planned.
- 2026-10-26 End-of-night sweep: code map, roadmap and plan match main after 11 merged tickets (#85-#89, #101, #103-#106, #112); #125 resized to Medium (needs the shared bug-report module).
- 2026-10-26 Must M15 added on the owner's word: updates from the Nextcloud admin panel through the private app-store feed; issues #128-#130.
- 2026-10-26 Must M14 added on the owner's word: Report a bug, through the shared bug-report module and the bug-report drop.
- 2026-10-26 Roadmap done, now Dev Loop: CODEMAP.md maps every 1.0 module, stubs for the pure modules, CI on Mac, PC and Linux; 1.0 issues rewritten in the standard format, the big ones split (#103-#113 new); undo is snapshot History instead of per-command inverses.
- 2026-10-26 Normalized to the project's stage files at Roadmap: added PIPELINE.md, AGENTS.md, this file and the GitHub templates; status now lives only in this repo.
- 2026-10-26 Vue 3 Nextcloud app skeleton with tests, lint and CI merged (#84).
- 2026-10-25 Spec approved; Vue 3 front end (ADR 0001), fresh start (ADR 0002), publish heading rule (ADR 0003). The old plain-JavaScript PR stack was closed as superseded; its branches are kept for reading.
- 2026-10-22 Idea pitched; repo created with README and ROADMAP (72 OmniOutliner-parity features).
