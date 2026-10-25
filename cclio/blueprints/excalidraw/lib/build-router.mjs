import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const css = readFileSync(
    new URL(
        '../node_modules/@excalidraw/excalidraw/dist/prod/index.css',
        import.meta.url,
    ),
    'utf8',
);

const dir = new URL('.', import.meta.url).pathname;
await build({
    entryPoints: [`${dir}editor.entry.mjs`],
    outfile: `${dir}editor.bundle.js`,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    define: {
        'process.env.NODE_ENV': '"production"',
        'import.meta.env': '{}',
        __EDITOR_CSS__: JSON.stringify(css),
    },
    loader: {
        '.woff2': 'dataurl',
        '.woff': 'dataurl',
        '.ttf': 'dataurl',
        '.png': 'dataurl',
        '.svg': 'dataurl',
    },
    logLevel: 'warning',
});
console.log(`${dir}editor.bundle.js built`);
