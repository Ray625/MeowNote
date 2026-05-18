import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './styles/reset.css'
import './styles/theme.css'
import './styles/buttons.css'

const app = createApp(App)

app.use(createPinia())

app.mount('#app')
