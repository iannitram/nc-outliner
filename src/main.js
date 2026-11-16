import { installErrorBuffer } from 'craft-bugreport-web'
import { createApp } from 'vue'
import App from './App.vue'
import { attachVueErrorHandler, installCrashLog } from './services/crashLog.js'

import '@nextcloud/dialogs/style.css'

// TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
installCrashLog(document.getElementById('nc_outliner')?.dataset)
installErrorBuffer()

const app = createApp(App)
attachVueErrorHandler(app) // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
app.mount('#nc_outliner')
