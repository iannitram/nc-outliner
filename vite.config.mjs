import { createAppConfig } from '@nextcloud/vite-config'
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

// Ship the source revision with the app; PHP passes it to the report form.
writeFileSync(new URL('./appinfo/build.json', import.meta.url), JSON.stringify({
	commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
}) + '\n')

// Builds src/main.js into js/nc_outliner-main.mjs, with every style injected by the script itself
// (inlineCSS). templates/main.php loads it with script(). There is no separate stylesheet on purpose:
// Vue's scoped styles are keyed by a per-component hash, so a stylesheet from another build than the
// script (a stale browser or server cache, a half-copied install) leaves the changed components unstyled.
export default createAppConfig({
	main: 'src/main.js',
}, {
	inlineCSS: true,
	extractLicenseInformation: false,
	thirdPartyLicense: false,
})
