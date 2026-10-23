# nc-outliner: notes for coding sessions

- **Read first:** `README.md` here, then the vault's `J:\Nextcloud\Workspaces\Outliner\PROJECT.md` for status, roadmap and open questions. Record decisions and status in PROJECT.md, not in this repo's README.
- **Hyperion machine rules apply.** This clone lives at `B:\dev\nc-outliner`. Heavy commands (anything that compiles, runs a multi-minute test suite, or loads the GPU) go through the dev gate: `python3 "B:/dev/potn-dev/tools/dev-gate.py" run --who nc-outliner --cwd B:/dev/nc-outliner -- <one command>` (one command after the `--`, never `cd x && ...`; exit 75 = not now, nothing ran). Full rules: part 1 of `J:\Nextcloud\Workspaces\CLAUDE.md`.
- **Keep code out of the vault.** The vault workspace holds docs only.
- **Deploying into the live Nextcloud container needs Ian's yes every time.** That covers copying the app into `custom_apps/` and `occ app:enable`. Never touch the `nextcloud` compose project or its volumes.
- **The publisher only writes inside the user's own Files,** through Nextcloud's file API, never by direct filesystem writes into the data directory.
