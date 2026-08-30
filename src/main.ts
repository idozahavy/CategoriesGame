import '@fontsource-variable/nunito';
import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { applyDir } from './lib/i18n';

applyDir();

const app = mount(App, {
  target: document.getElementById('app')!,
});

export default app;
