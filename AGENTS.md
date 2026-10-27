# Rules for agents in this repo

Everything you need to work here is in this repo. The full pipeline and rules live in the pipeline repo (private: `PIPELINE.md`, `RULES.md`, `RUBRIC.md`, `roles/`); this is the short copy.

1. **Find the stage** in `PIPELINE.md`. The spec is `SPEC.md`, the plan `ROADMAP.md` (all features) with the 1.0 tickets in `docs/plan/1.0-work.md`, the code map `CODEMAP.md` (check its branch scope before treating a module as merged). How to build and test: `docs/development.md`.
2. **Work from an issue.** Take one that is not `in-progress` and not blocked; add `in-progress` before you start. Its body is your brief; an Easy issue has a "Qwen brief" section with the expected results and the code map snippet.
3. **Your own platform's issues first.** Mac, Windows and Linux all matter: say which you built on.
4. **Check that it builds**, then open the PR. CI and a review by another satellite with another model do the rest.
5. **Label the PR** `by:<machine>` and `model:<model>`, and write `Closes #N`. Move the feature's row in `ROADMAP.md` (Unwritten -> PR -> Merged).
6. **A failed job** gets a comment on the issue saying what happened, and the issue moves up one size (Easy -> Medium -> Hard).
7. **Use the project's words** from `GLOSSARY.md` and the decisions in `docs/adr/`.
8. **No private details** in code, commits or PR text: no names, e-mail addresses, home paths or machine names. Commit as the no-reply identity.

## This project

- **Deploying into a live Nextcloud needs the owner's yes every time.** That covers copying the app into `custom_apps/` and `occ app:enable`. Develop in a throwaway container; never touch the live Nextcloud's compose project or its volumes.
- **The publisher only writes inside the user's own Files,** through Nextcloud's file API, never by direct filesystem writes into the data directory.
