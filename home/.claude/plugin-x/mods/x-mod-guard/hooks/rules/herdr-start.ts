import type { Command, Context, Refusal } from './command.ts';

// a second Herdr app start while dima's window runs reloads that window, and the text he was typing there is lost: the
// herdr codie's 8 probe starts 18:48–18:56 (2026-11-11), each `HERDR_APP_HOME=<dir> nohup …/Herdr.app/Contents/MacOS/Herdr &`
// (dima's o47); his 19:09 «warn me» is the ⚠️ ask x-mod-stash puts on his board, whose tick lets one start run
// twin herdr-start-ask — a copy lives in x-mod-stash, which puts this ask on his board; twins.test.ts holds them equal
export const HERDR_START_ASK =
    '⚠️ a seat wants a second Herdr window: save your typed text first';
// twin end

const HERDR_APP = /^(?:.*\/)?Herdr(?:\.app)?\/?$/i;
const HERDR_BUNDLE = 'dev.herdr.app';
// `open`'s options that take the next word as their value
const OPEN_VALUED = new Set([
    '-a',
    '-b',
    '-s',
    '-u',
    '--arch',
    '--env',
    '--stderr',
    '--stdin',
    '--stdout',
]);

// what this command starts of Herdr's app, or undefined: the app's own binary, `herdr-app` with no word (it opens the
// window), or `open -n` naming the app
export function herdrStartOf(c: Command) {
    const words = c.args.map((w) => w.text);
    const base = c.name.split('/').at(-1) ?? c.name;
    if (base === 'Herdr') return c.name;
    if (base === 'herdr-app') return words.length ? undefined : 'herdr-app';
    if (base !== 'open') return undefined;
    let isNew = false;
    let isHerdr = false;
    for (let i = 0; i < words.length; i++) {
        const w = words[i] ?? '';
        if (w === '--args') break;
        if (w === '--new') isNew = true;
        else if (/^-[a-zA-Z]+$/.test(w)) {
            if (w.includes('n')) isNew = true;
            const valued = w.at(-1);
            if (valued === 'a' || valued === 'b') {
                const v = words[++i] ?? '';
                if (valued === 'a' ? HERDR_APP.test(v) : v === HERDR_BUNDLE)
                    isHerdr = true;
            } else if (OPEN_VALUED.has(`-${valued}`)) i++;
        } else if (OPEN_VALUED.has(w)) i++;
        else if (
            !w.startsWith('-') &&
            /Herdr\.app(?:\/Contents\/MacOS\/Herdr)?\/?$/i.test(w)
        )
            isHerdr = true;
    }
    return isNew && isHerdr ? 'open -n Herdr' : undefined;
}

// a start passes when his window is not up; an unread window counts as up
export function herdrStart(c: Command, ctx: Context): Refusal | undefined {
    const start = herdrStartOf(c);
    if (!start || ctx.isHerdrOpen === false) return undefined;
    return {
        door: 'test in the Herdr window that runs, or wait: x-mod-stash put a ⚠️ ask on dima’s board, and his tick there lets one start run',
        rule: 'herdr-start',
        targets: [start],
        why: `\`${start}\` starts a second Herdr app while dima's window runs: his window reloads and his typed draft is lost (8 probe starts did it, 18:48–18:56)`,
    };
}
