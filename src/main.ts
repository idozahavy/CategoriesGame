import '@fontsource-variable/nunito';
import './app.css';

import { mount } from 'svelte';

import App from './App.svelte';
import { applyDir } from './lib/i18n';

applyDir();

const target = document.getElementById('app');
if (!target) throw new Error('Missing #app mount point');

const app = mount(App, { target });

export default app;
