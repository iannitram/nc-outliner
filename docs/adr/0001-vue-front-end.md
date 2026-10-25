# 0001: The front end is Vue 3 on Nextcloud's own stack

Date: 2026-10-25. Decided in the spec interview.

**Decision.** Build the browser side with Vue 3, Nextcloud's own component library and its usual build tool.

**Why.** The parity goal after 1.0 (rich text, styles, columns, drag, filters) would outgrow hand-written plain JavaScript, and the Nextcloud components give the app the look and behaviour of other Nextcloud apps.

**Cost.** The app gets a build step and npm dependencies; the plain-JavaScript editor already written is not reused (ADR 0002).
