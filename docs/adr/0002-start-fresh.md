# 0002: Start fresh

Date: 2026-10-25. Decided in the spec interview.

**Decision.** The code now on main (plain-JavaScript editor, PHP storage, OPML and .odt code) and the 16-PR stack built on it are not carried forward. 1.0 is rebuilt from `SPEC.md`.

**Why.** The front end moves to Vue (ADR 0001), and the earlier code was written before there was an approved spec.

**Consequence.** The open PRs of the stack are closed as superseded once the spec is approved; their branches are kept for reference. Nothing is deleted.
