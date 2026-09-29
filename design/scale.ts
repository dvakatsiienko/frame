import { parseArgs } from 'node:util';
import { calculateSpaceScale, calculateTypeScale } from 'utopia-core';

const usage = `design:scale [--min-width 320] [--max-width 1240] [--min-size 16] [--max-size 20]
             [--min-ratio 1.2] [--max-ratio 1.25]

  fluid type and space steps (utopia), each a clamp() that grows from the min viewport
  to the max one. prints a tailwind v4 @theme block: --text-<step> and --spacing-<step>.
  a type step that fails WCAG 1.4.4 (resize to 200%) carries a comment naming the widths.`;

const { values } = parseArgs({
    options: {
        help: { short: 'h', type: 'boolean' },
        'max-ratio': { default: '1.25', type: 'string' },
        'max-size': { default: '20', type: 'string' },
        'max-width': { default: '1240', type: 'string' },
        'min-ratio': { default: '1.2', type: 'string' },
        'min-size': { default: '16', type: 'string' },
        'min-width': { default: '320', type: 'string' },
    },
});
const isBadNumber = Object.values(values).some(
    (value) => typeof value === 'string' && !(Number(value) > 0),
);
if (values.help || isBadNumber) {
    console.log(usage);
    process.exit(values.help ? 0 : 2);
}

const viewport = {
    maxWidth: Number(values['max-width']),
    minWidth: Number(values['min-width']),
};
const minSize = Number(values['min-size']);
const maxSize = Number(values['max-size']);

const typeSteps = calculateTypeScale({
    ...viewport,
    labelStyle: 'tailwind',
    maxFontSize: maxSize,
    maxTypeScale: Number(values['max-ratio']),
    minFontSize: minSize,
    minTypeScale: Number(values['min-ratio']),
    negativeSteps: 2,
    positiveSteps: 5,
});
const space = calculateSpaceScale({
    ...viewport,
    maxSize,
    minSize,
    negativeSteps: [0.75, 0.5, 0.25],
    positiveSteps: [1.5, 2, 3, 4, 6],
});

console.log('@theme {');
for (const step of typeSteps) {
    const violation = step.wcagViolation
        ? ` /* fails WCAG 1.4.4 from ${step.wcagViolation.from}px to ${step.wcagViolation.to}px */`
        : '';
    console.log(`    --text-${step.label}: ${step.clamp};${violation}`);
}
for (const size of space.sizes)
    console.log(`    --spacing-${size.label}: ${size.clamp};`);
console.log('}');
