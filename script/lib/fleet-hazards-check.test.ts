import { describe, expect, it } from 'vitest';

import { addedLines, hazardRefusals } from './fleet-hazards-check.ts';

const HEAD = [
    '# fleet-hazards',
    '',
    '## git hooks',
    '',
    '- a tagged hazard',
    '  that wraps. guard: `x lane commit`',
] as const;

// the staged file is HEAD plus `extra` appended; the diff adds exactly those lines
const stage = (...extra: string[]) => {
    const staged = [...HEAD, ...extra].join('\n');
    const diff = `@@ -6,0 +7,${extra.length} @@\n${extra.map((l) => `+${l}`).join('\n')}`;
    return hazardRefusals(staged, addedLines(diff));
};

describe('hazardRefusals', () => {
    it('refuses an added hazard with no guard tag, naming its line', () => {
        expect(stage('- a new trap with no tag')).toEqual([
            expect.objectContaining({
                line: 7,
                text: '- a new trap with no tag',
            }),
        ]);
    });

    it('passes an added hazard that names its guard', () => {
        expect(stage('- a new trap', '  guard: the `x-mod-guard` mod')).toEqual(
            [],
        );
    });

    it('refuses `guard: none` with no ticket after it', () => {
        expect(stage('- a new trap. guard: none')).toHaveLength(1);
    });

    it('passes `guard: none · FRM-N`', () => {
        expect(stage('- a new trap. guard: none · FRM-311')).toEqual([]);
    });

    it('passes a diff that only removes lines', () => {
        const staged = HEAD.slice(0, 4).join('\n');
        expect(hazardRefusals(staged, addedLines('@@ -5,2 +4,0 @@'))).toEqual(
            [],
        );
    });

    it('passes a reworded line inside a tagged hazard', () => {
        const staged = [
            ...HEAD.slice(0, 4),
            '- a tagged hazard, reworded',
            HEAD[5],
        ].join('\n');
        expect(hazardRefusals(staged, addedLines('@@ -5 +5 @@'))).toEqual([]);
    });

    it('refuses a rewording that drops the guard tag', () => {
        const staged = [
            ...HEAD.slice(0, 4),
            '- a tagged hazard',
            '  that wraps.',
        ].join('\n');
        expect(hazardRefusals(staged, addedLines('@@ -6 +6 @@'))).toHaveLength(
            1,
        );
    });

    it('ignores an untouched untagged hazard', () => {
        const staged = [...HEAD, '- an old untagged trap'].join('\n');
        expect(hazardRefusals(staged, addedLines('@@ -5 +5 @@'))).toEqual([]);
    });
});
