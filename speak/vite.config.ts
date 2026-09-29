import { fileURLToPath } from 'node:url';
import vitePluginTailwind from '@tailwindcss/vite';
import vitePluginReact from '@vitejs/plugin-react';
import { type Plugin, defineConfig } from 'vite';

import { speakDevPort, speakPort } from './ports.ts';

// the dev tab wears a marker so it never reads as the served page beside it
const devTitle = (): Plugin => ({
    apply: 'serve',
    name: 'speak-dev-title',
    transformIndexHtml: (html) =>
        html.replace('<title>speak</title>', '<title>speak: dev</title>'),
});

export default defineConfig({
    plugins: [vitePluginReact(), vitePluginTailwind(), devTitle()],
    resolve: {
        alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
        port: speakDevPort,
        // every api call goes to the admin server: it alone writes config.json and reaches the daemon
        proxy: { '/api': `http://127.0.0.1:${speakPort}` },
        strictPort: true,
    },
});
