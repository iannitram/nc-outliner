# 0004: Versions go through Nextcloud's WebDAV versions endpoint, from the browser

Date: 2026-10-28. Decided in issue #4 (T10a) after a spike on a throwaway Nextcloud 33 (Files Versions app 1.26.0).

**Decision.** Way (b): the browser talks WebDAV to `remote.php/dav/versions/<user>/versions/<fileId>`, as the Files app's versions tab does. #4 becomes a small client module, `src/api/versions.js` (`listVersions`, `readVersion`, `restoreVersion`, `nameVersion`), with vitest tests. There is **no** `VersionService`, **no** `VersionController` and **no** new route.

**Why.**
1. The endpoint already does all four jobs for the signed-in user only (the path carries the user; another user's id gets a 404 or 403), so a PHP route would only repeat it.
2. The PHP API is the thinner one for us: `IVersionManager` has `getVersionsForFile` and `rollback` (through `IVersionBackend`), but no label setter. Setting a label is `INameableVersionBackend::setVersionLabel` or `IMetadataVersionBackend::setMetadataValue`, which are implemented by `VersionManager` and not exposed on the interface, and every call needs a `FileInfo` and an `IUser` we would have to rebuild. Using them would mean a hard dependency on app internals that may move between releases; the DAV properties are the public surface the Files app itself relies on.
3. Restore behaves as the spec needs with nothing added (see evidence).

**Observed behaviour.**
- Retention: `versions_retention_obligation` is unset, which means `auto` (min and max both `auto`): versions are never expired by age, only purged when the user's quota needs room; the expiry runs as files are written (`Storage::expire`) and `occ versions:expire` prints "Auto expiration is configured" and does nothing in this mode. Versions with a non-empty `label` metadata value are skipped by both `Storage::expire` and `expireOlderThanMaxForUser` (`Storage.php` lines ~594 and ~937). To prove it I set `"0, 0"` (min 0, max 0 days) on the throwaway server, ran `occ versions:expire admin`, then deleted the setting again.
- The list holds every revision, newest first. The newest entry is the file as it is now; a GET on it answers 404 (read the file itself). Older entries read fine.
- Restore (`MOVE` to `.../restore/target`) answers 201, and the state the file was in before the restore shows up in the list as a version and reads back (spike: file `v5-current`, restore of `v2`, afterwards a version holding `v5-current`).
- **Caveat, not fixed here:** the pre-restore version is not named, so a later expiry (a size purge, or an admin max age) can still remove it. In the spike a `"0, 0"` run removed every unnamed version, the pre-restore one too. The panel (#111) may offer to name it; it needs no server work.
- Autosave makes many versions. With `auto` the default thinning is Nextcloud's own (`Storage::expire` keeps fewer old versions as they age), and named versions are exempt.

**Evidence (spike, `curl` as the admin of the throwaway server, `$V` = `http://127.0.0.1:8133/remote.php/dav/versions/admin`).**

```
occ config:system:get versions_retention_obligation   -> (empty, exit 1: unset, so auto)
PUT spike.opml 4 times, 1 s apart; PROPFIND Depth 1 $V/versions/76 -> 4 entries (3 old + the current one)
GET  $V/versions/76/<oldest>                          -> v1
PROPPATCH $V/versions/76/<2nd> nc:version-label=keep me -> 200
MOVE $V/versions/76/<oldest>  Destination: $V/restore/target -> 201; file now reads v1
PUT v5-current; MOVE <2nd> to restore/target -> 201; file reads v2;
  list afterwards: <current-entry> reads "v5-current"   (pre-restore state is findable)
occ config:system:set versions_retention_obligation --value="0, 0"; occ versions:expire admin
  list afterwards: the 'keep me' version only (unnamed ones are gone)
```

**Evidence (the real `src/api/versions.js` run against the throwaway server through vitest with the Node http adapter; a temporary test, removed).**

```
LIST after edits (newest first, id = seconds, label shown):
  17:54:20 id=1793210060 label=""   ...   17:54:03 id=1793210043 label="keep me"
READ oldest            -> "one"
(PUT "five-current"; nameVersion(oldest,'keep me'); restoreVersion(oldest))
FILE after restore     -> "one"
LIST after restore     -> new top entry 17:54:22 id=1793210062; read of it -> "five-current"
retention "0, 0" + occ versions:expire admin:
  before: 10 entries, one labelled "keep me" (id 1793210043)
  after:  versions/84/1793210043 with label "keep me" only
```

Nothing was installed in the container: there is no server code to install.

**Consequences.** CODEMAP "Versions" and "API" say no server route exists. The panel (#111) imports `src/api/versions.js`. `@nextcloud/auth` is now a direct dependency (it was already installed through `@nextcloud/axios`).
