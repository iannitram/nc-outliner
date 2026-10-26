import { createAppConfig } from '@nextcloud/vite-config'

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
