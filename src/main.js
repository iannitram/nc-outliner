import { installErrorBuffer } from 'craft-bugreport-web'
import { createApp } from 'vue'
import App from './App.vue'

installErrorBuffer()
createApp(App).mount('#nc_outliner')
