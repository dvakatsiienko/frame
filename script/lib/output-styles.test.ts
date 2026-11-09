import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const dir = join(import.meta.dirname, '..', '..', 'home/.claude/output-styles');
const read = (name: string) => readFileSync(join(dir, `${name}.md`), 'utf8');

const voiceOf = (text: string) => {
    const start = text.indexOf('# Voice');
    const end = text.indexOf('\n# ', start + 1);
    return text.slice(start, end === -1 ? undefined : end).trimEnd();
};

describe('output styles', () => {
    it('glados carries the crew voice word for word, so the two never drift', () => {
        expect(voiceOf(read('output-glados'))).toBe(
            voiceOf(read('output-crew')),
        );
    });

    it('a style holds tone only: no length or grammar rule, those live in the rules', () => {
        for (const name of ['output-crew', 'output-glados']) {
            expect(read(name)).not.toMatch(
                /sacrifice grammar|extremely concise/i,
            );
        }
    });
});
