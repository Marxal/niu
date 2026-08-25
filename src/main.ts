/*
 * Boots the app. Deliberately tiny: mount Svelte, then start the two things that
 * make it installable. Both are fire-and-forget — if either fails, Niu still runs
 * as an ordinary website.
 */

import { mount } from 'svelte'
import App from './App.svelte'
import './styles/global.css'
import { watchInstallPrompt } from './lib/install.svelte'
import { registerServiceWorker } from './lib/pwa'

const target = document.getElementById('app')
if (!target) throw new Error('Missing #app element in index.html')

const app = mount(App, { target })

watchInstallPrompt()
void registerServiceWorker()

export default app
