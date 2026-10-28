import { fileURLToPath } from 'node:url';
import vitePluginTailwind from '@tailwindcss/vite';
import { wgslVitePlugin } from '@vgpu/wgsl/loader-vite';
import vitePluginReact from '@vitejs/plugin-react';
import { type Plugin, defineConfig } from 'vite';

import { chordsDevPort, chordsPort } from '../ports.ts';

// Two tabs, two pages, one name — dima keeps the built page and the dev server open beside
// each other. `apply: 'serve'` is what keeps this out of the build: the shipped title stays
// `chords` and only the dev one wears the marker.
const devTitle = (): Plugin => ({
    apply: 'serve',
    name: 'chords-dev-title',
    transformIndexHtml: (html) =>
        html.replace('<title>chords</title>', '<title>chords: dev</title>'),
});

export default defineConfig({
    // wgslVitePlugin turns a `.wgsl` import into the prepared ShaderSource vgpu 0.6 requires
    plugins: [
        vitePluginReact(),
        vitePluginTailwind(),
        wgslVitePlugin(),
        devTitle(),
    ],
    // `@/` is the house alias in every bytes app; `@hotkeys/` plays the role `@ui/kit/` does
    // there — a named door to code outside this package. Without it the same two modules wear
    // two spellings, `../../` from src and `../../../` from src/components.
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
            '@hotkeys': fileURLToPath(new URL('..', import.meta.url)),
        },
    },
    server: {
        port: chordsDevPort,
        // Every api call goes to the daemon, dev or built — it is the only thing that can
        // read the press log and write manual.ts, and it is always running anyway.
        proxy: { '/api': `http://localhost:${chordsPort}` },
        // Fail rather than auto-bump: a silent bump leaves the page talking to nothing.
        strictPort: true,
    },
});
