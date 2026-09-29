// voices read prose well and tech text badly: ids, versions, paths, code and symbols come out as
// «vee zero three eighty-five» or a spelled url. no engine fixes this for us (FRM-269 research),
// so every engine is fed text rewritten here first.

const LETTER_ACRONYMS = [
    'api',
    'cli',
    'css',
    'html',
    'mcp',
    'npm',
    'pnpm',
    'pr',
    'sdk',
    'ssh',
    'tts',
    'ui',
    'url',
    'ux',
] as const;

const WORD_ACRONYMS: Record<string, string> = {
    json: 'jason',
    sql: 'sequel',
    yaml: 'yammel',
};

const UNITS: Record<string, string> = {
    gb: 'gigabytes',
    hz: 'hertz',
    kb: 'kilobytes',
    khz: 'kilohertz',
    mb: 'megabytes',
    ms: 'milliseconds',
    px: 'pixels',
};

const MONTHS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
] as const;

const spell = (letters: string) => letters.toUpperCase().split('').join(' ');

function stripMarkdown(text: string) {
    return text
        .replace(/```[\s\S]*?```/g, ' code block. ')
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/^\s{0,3}#{1,6}\s+/gm, '')
        .replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, '')
        .replace(/^\s*>\s?/gm, '')
        .replace(/(\*\*|__|~~|`)/g, '')
        .replace(/(^|\s)[*_]([^*_\n]+)[*_](?=\s|[.,!?]|$)/g, '$1$2');
}

function rewriteLatin(text: string) {
    return text
        .replace(/\bhttps?:\/\/(?:www\.)?([^/\s]+)\S*/gi, '$1')
        .replace(
            /\b(\d{4})-(\d{2})-(\d{2})\b/g,
            (whole, year: string, month: string, day: string) => {
                const name = MONTHS[Number(month) - 1];
                return name ? `${name} ${Number(day)}, ${year}` : whole;
            },
        )
        .replace(
            /\b([A-Z]{2,6})-(\d+)\b/g,
            (_, key: string, n: string) => `${spell(key)} ${n}`,
        )
        .replace(/\bv?(\d+(?:\.\d+){1,3})\b/g, (whole, digits: string) =>
            whole.startsWith('v') || digits.split('.').length > 2
                ? `version ${digits.split('.').join(' point ')}`
                : whole,
        )
        .replace(
            /(\d)\s?(khz|hz|ms|kb|mb|gb|px)\b/gi,
            (_, n: string, unit: string) => `${n} ${UNITS[unit.toLowerCase()]}`,
        )
        .replace(/(?:~|\.{1,2})?\/?(?:[\w.-]+\/)+[\w.-]*/g, (path) =>
            path
                .split('/')
                .filter(
                    (part) =>
                        part && part !== '~' && part !== '.' && part !== '..',
                )
                .join(' '),
        )
        .replace(
            /\b(\w+)\.(ts|tsx|js|md|json|sh|py|swift|go|yaml|toml)\b/g,
            '$1 dot $2',
        )
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/(\w)[_](?=\w)/g, '$1 ')
        .replace(/#(\d+)/g, 'number $1')
        .replace(/\b[a-z]+\b/gi, (word) => {
            const lower = word.toLowerCase();
            if ((LETTER_ACRONYMS as readonly string[]).includes(lower))
                return spell(lower);
            return WORD_ACRONYMS[lower] ?? word;
        });
}

function rewriteSymbols(text: string) {
    return text
        .replace(/\s*(?:→|->|=>|⇒|·|\||—|–)\s*/g, ', ')
        .replace(/\s&\s/g, ' and ')
        .replace(/\s@(\w)/g, ' at $1')
        .replace(/[«»"“”]/g, '')
        .replace(/[()[\]{}<>*_=+^~\\]/g, ' ')
        .replace(/\s*,(\s*,)+/g, ',')
        .replace(/[ \t]+/g, ' ')
        .replace(/\s+([.,!?;:])/g, '$1')
        .trim();
}

const CYRILLIC = /\p{Script=Cyrillic}/u;
const LATIN = /\p{Script=Latin}/u;

// a run changes language only on a letter; digits, spaces and punctuation stay with the run they sit in
export function splitRuns(text: string): Run[] {
    const runs: Run[] = [];
    const cyrillicLang = /[іїєґ]/iu.test(text)
        ? 'uk'
        : /[ыэъё]/iu.test(text)
          ? 'ru'
          : 'uk';
    for (const char of text) {
        const lang = CYRILLIC.test(char)
            ? cyrillicLang
            : LATIN.test(char)
              ? 'en'
              : undefined;
        const last = runs.at(-1);
        if (!last) runs.push({ lang: lang ?? 'en', text: char });
        else if (lang === undefined || lang === last.lang) last.text += char;
        else if (!/\p{L}/u.test(last.text)) {
            last.lang = lang;
            last.text += char;
        } else runs.push({ lang, text: char });
    }
    return runs
        .map((run) => ({ ...run, text: run.text.trim() }))
        .filter((run) => /[\p{L}\d]/u.test(run.text));
}

export function normalize(text: string): Run[] {
    return splitRuns(stripMarkdown(text))
        .map((run) => ({
            ...run,
            text: rewriteSymbols(
                run.lang === 'en' ? rewriteLatin(run.text) : run.text,
            ),
        }))
        .filter((run) => run.text);
}

/* Types */

export type Lang = 'en' | 'uk' | 'ru';

export interface Run {
    lang: Lang;
    text: string;
}
