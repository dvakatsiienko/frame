import { type Segment, parse } from '../shell.ts';
import { peel } from './command.ts';

// zsh reads `[[ a == b ]]`'s operator as syntax, never as a path
const TEST_OPERATORS = new Set(['=', '==', '=~']);
type Edit = { at: number; from: string; to: string; why: string };
// a shape with one right spelling, fixed in place: `pnpm -s` and an unquoted `=`-led word
export function edits(segments: Segment[]): Edit[] {
    return segments.flatMap((s) => {
        const isTest = s.words[0]?.text === '[[';
        const peeled = peel(s.words);
        const end = peeled.args.findIndex((w) => w.text === '--');
        const pnpmFlags =
            peeled.name === 'pnpm'
                ? peeled.args.slice(0, end < 0 ? undefined : end)
                : [];
        const own = s.words.flatMap((w): Edit[] => {
            if (w.at === undefined) return [];
            if (w.text === '-s' && pnpmFlags.includes(w))
                return [
                    {
                        at: w.at,
                        from: w.text,
                        to: '--silent',
                        why: 'pnpm 12 refuses -s',
                    },
                ];
            // `--include=*.ts` matches no file, so zsh's NOMATCH aborts the command before grep sees it
            if (/^--?[A-Za-z][\w-]*=.*[*?[]/.test(w.text))
                return [
                    {
                        at: w.at,
                        from: w.text,
                        to: `'${w.text}'`,
                        why: 'zsh aborts on an option glob that matches no file',
                    },
                ];
            if (
                w.text.startsWith('=') &&
                w.text !== '=' &&
                !(isTest && TEST_OPERATORS.has(w.text))
            )
                return [
                    {
                        at: w.at,
                        from: w.text,
                        to: `'${w.text}'`,
                        why: 'zsh reads an unquoted =word as a command path',
                    },
                ];
            return [];
        });
        return [...own, ...edits(s.subst)];
    });
}
export function rewrite(command: string) {
    // a `$( … )`'s commands are segments of their own and of the word's subst: one edit per offset
    const found = [
        ...new Map(
            edits(parse(command).segments).map((e) => [e.at, e]),
        ).values(),
    ].sort((a, b) => b.at - a.at);
    let out = command;
    for (const e of found)
        out = out.slice(0, e.at) + e.to + out.slice(e.at + e.from.length);
    return {
        command: out,
        notes: found
            .reverse()
            .map((e) => `\`${e.from}\` → \`${e.to}\` (${e.why})`),
    };
}
