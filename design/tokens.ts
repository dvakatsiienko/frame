import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import StyleDictionary from 'style-dictionary';

import { tokensShape } from './lib/roles.ts';

const usage = `design:tokens <dtcg.json> — DTCG tokens → a tailwind v4 @theme block on stdout

  every token becomes one css variable named by its path: color.fg.text → --color-fg-text,
  so a top-level group named after a tailwind namespace (color, spacing, text, font, radius)
  lands in that namespace and its utilities (text-fg-text, bg-bg-base) exist for free.
  a {color.fg.text} alias stays a var() reference.

${tokensShape}`;

const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { help: { short: 'h', type: 'boolean' } },
});
const [file] = positionals;
if (values.help || !file) {
    console.log(usage);
    process.exit(values.help ? 0 : 2);
}

const dictionary = new StyleDictionary({
    log: { verbosity: 'silent' },
    platforms: {
        css: {
            files: [
                {
                    destination: 'theme.css',
                    format: 'css/variables',
                    options: {
                        outputReferences: true,
                        selector: '@theme',
                        showFileHeader: false,
                    },
                },
            ],
            transformGroup: 'css',
        },
    },
    tokens: JSON.parse(readFileSync(file, 'utf8')),
});

const [output] = await dictionary.formatPlatform('css');
console.log(String(output?.output ?? '').trim());
