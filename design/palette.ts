import { parseArgs } from 'node:util';
import type { CssColor } from '@adobe/leonardo-contrast-colors';
import { BackgroundColor, Color, Theme } from '@adobe/leonardo-contrast-colors';
import { converter } from 'culori';

const usage = `design:palette <seed> --ratios 3,4.5,7 [--bg #ffffff] [--name brand]

  a ramp of the seed hue, interpolated in oklch, one step per WCAG 2 ratio against the
  background. prints DTCG json: color.bg.base (the background the ramp was fit to —
  leonardo snaps it to a whole HSLuv lightness, so a dark bg can move by a hair) and
  color.<name>.100, .200, … one step per ratio, in the order given.`;

const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
        bg: { default: '#ffffff', type: 'string' },
        help: { short: 'h', type: 'boolean' },
        name: { default: 'brand', type: 'string' },
        ratios: { type: 'string' },
    },
});
const [seed] = positionals;
const ratios = values.ratios?.split(',').map(Number) ?? [];
if (
    values.help ||
    !seed ||
    ratios.length === 0 ||
    ratios.some((ratio) => !(ratio >= 1 && ratio <= 21))
) {
    console.log(usage);
    process.exit(values.help ? 0 : 2);
}

const lightness = converter('lab65')(values.bg)?.l;
if (lightness === undefined)
    throw new Error(`--bg: cannot parse colour ${values.bg}`);

const theme = new Theme({
    backgroundColor: new BackgroundColor({
        colorKeys: [values.bg as CssColor],
        name: 'bg',
        ratios: [],
    }),
    colors: [
        new Color({
            colorKeys: [seed as CssColor],
            colorSpace: 'OKLCH',
            name: values.name,
            ratios,
        }),
    ],
    lightness: Math.round(lightness),
    output: 'HEX',
});
const [background, ramp] = theme.contrastColors;
if (
    !background ||
    !('background' in background) ||
    !ramp ||
    !('values' in ramp)
) {
    throw new Error('leonardo returned no ramp');
}

const steps = Object.fromEntries(
    ramp.values.map((step, index) => [
        String((index + 1) * 100),
        { $description: `${step.contrast}:1 on bg.base`, $value: step.value },
    ]),
);
const tokens = {
    color: {
        $type: 'color',
        bg: { base: { $value: background.background } },
        [values.name]: steps,
    },
};
console.log(JSON.stringify(tokens, null, 4));
