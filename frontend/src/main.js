import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createHead } from '@unhead/vue/client'
import router from './router'
import Toast from 'vue-toastification'
import 'vue-toastification/dist/index.css'
import './styles.css'
import App from './App.vue'

const app = createApp(App)
const head = createHead()

app.use(createPinia())
app.use(router)
app.use(head)
app.use(Toast)
app.mount('#app')