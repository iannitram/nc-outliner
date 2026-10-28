import { createAppConfig } from '@nextcloud/vite-config'
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

// Ship the source revision with the app; PHP passes it to the report form.
writeFileSync(new URL('./appinfo/build.json', import.meta.url), JSON.stringify({
	commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
}) + '\n')

// Builds src/main.js into js/nc_outliner-main.mjs and one stylesheet, css/nc_outliner-style.css.
// templates/main.php loads them with script() and style(); the names follow vite-config's
// `<appName>-` prefix convention.
export default createAppConfig({
	main: 'src/main.js',
}, {
	inlineCSS: false,
	extractLicenseInformation: false,
	thirdPartyLicense: false,
	config: {
		build: {
			cssCodeSplit: false,
		},
	},
})
