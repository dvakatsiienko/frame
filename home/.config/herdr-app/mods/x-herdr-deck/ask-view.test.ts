import {
    mkdirSync,
    mkdtempSync,
    realpathSync,
    symlinkSync,
    unlinkSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { macExec } from '../_shared/mac-exec.ts';

// FRM-620 slice 7: the card as it draws, on a stand-in for herdr's elements that keeps each call and child
type Drawn = {
    args: unknown[];
    calls: Map<string, unknown[]>;
    kids: unknown[];
    kind: string;
};
const at = vi.hoisted(() => ({
    opened: [] as string[][],
    urls: [] as string[],
    zoom: 1,
}));
const { element } = vi.hoisted(() => ({
    element: (kind: string, ...args: unknown[]) => {
        const drawn = {
            args,
            calls: new Map(),
            kids: [] as unknown[],
            kind,
        };
        const self: unknown = new Proxy(drawn, {
            get(_t, name: string) {
                if (name in drawn) return drawn[name as keyof typeof drawn];
                if (name === 'child' || name === 'children')
                    return (c: unknown) => {
                        drawn.kids.push(
                            ...(name === 'child' ? [c] : (c as unknown[])),
                        );
                        return self;
                    };
                if (name === 'when')
                    return (is: boolean, then: (el: unknown) => unknown) =>
                        is ? then(self) : self;
                return (...a: unknown[]) => {
                    drawn.calls.set(name, a);
                    return self;
                };
            },
        });
        return self;
    },
}));
vi.mock('gpui-kit', () => ({
    div: () => element('div'),
    image: (rel: string) => element('image', rel),
}));
vi.mock('gpui-base', () => ({
    Button: { new: (id: string) => element('button', id) },
    TextView: {
        markdown: (id: string, text: string) => element('text', id, text),
    },
    h_flex: () => element('row'),
    v_flex: () => element('column'),
}));
vi.mock('fs/promises', () => ({ mkdir: vi.fn(), unlink: vi.fn() }));
vi.mock('herdr', () => ({
    appHome: () => '/app',
    exec: async (program: string, args: string[]) => {
        if (program === 'open') {
            at.opened.push(args);
            return { code: 0, stdout: '' };
        }
        return macExec(program, args);
    },
    home: () => '/Users/me',
    layout: () => null,
    run: vi.fn(),
    setShared: vi.fn(),
    settings: () => ({ zoom: at.zoom }),
    shared: () => null,
    theme: () => ({}),
}));

const { createCardFiles } = await import('./card-files.js');
const { createOrbitView } = await import('./orbit-view.js');
const { asksOf } = await import('./orbit.js');

const theme = new Proxy({}, { get: (_t, name) => name }) as never;
// the stash's own rows: one sent in three parts, one the old way
const [look, plain] = asksOf({
    asks: [
        {
            body: 'it **opens** `it`:\n- one\n- two',
            id: 'o12',
            kind: 'look',
            pick: 'both work',
            text: 'look: 🐑 path links\n\nit **opens** `it`:\n- one\n- two',
            title: '🐑 path links',
        },
        { id: 'o3', pick: 'push it', text: 'push **FRM-1**' },
    ],
});
const row = {
    asks: [look, plain],
    name: '🦉🪽 clio: wing 1',
    sid: 's1',
} as never;
const press = vi.fn();
const files = createCardFiles({ audioApp: () => 'VLC' });
const deps = {
    chipsOf: () => [],
    files: () => files,
    keyNotes: () => new Map(),
    passedOver: () => new Set(),
    press,
    pressStateOf: () => 'open',
    presses: () => new Map(),
    steers: () => new Map(),
    tabAt: () => new Map(),
    updated: () => new Set(['s1:o12']),
};
const view = createOrbitView(deps as never);

const all = (el: unknown): Drawn[] => {
    const d = el as Drawn;
    return d?.calls ? [d, ...d.kids.flatMap(all)] : [];
};
const find = (card: unknown, id: string) => {
    const hit = all(card).find(
        (d) => d.calls.get('id')?.[0] === id || d.args[0] === id,
    );
    if (!hit) throw new Error(`${id} is not drawn`);
    return hit;
};
const ids = (card: unknown) =>
    all(card).map((d) => d.calls.get('id')?.[0] ?? d.args[0]);
const cx = () => ({
    notify: vi.fn(),
    // herdr's own throws on any other scheme
    open_url: (url: string) => {
        if (!/^https?:/.test(url)) throw new TypeError(url);
        at.urls.push(url);
    },
    spawn: (job: (cx: unknown) => Promise<unknown>) => job(cx()),
    stop_propagation: vi.fn(),
    timer: { after: vi.fn() },
    write_to_clipboard: vi.fn(),
});
/** a handler the element was given, called as herdr would */
const fire = (d: Drawn, name: string, e: unknown, c: unknown) => {
    const handler = d.calls.get(name)?.at(-1);
    if (typeof handler !== 'function') throw new Error(`no ${name}`);
    return handler(e, c);
};
/** every element that reports its width gets the one it would draw at, window pixels as herdr reports them */
const measure = (
    ask: unknown,
    widths: { card: number; pill: number; title: number },
) => {
    for (const d of all(view.ask(theme, row, ask as never))) {
        const id = String(d.calls.get('id')?.[0]);
        const width = id.startsWith('head-')
            ? widths.card - 24
            : id.startsWith('id-')
              ? widths.pill
              : id.startsWith('title-width-')
                ? widths.title
                : null;
        if (width !== null && d.calls.has('on_size_change'))
            fire(
                d,
                'on_size_change',
                {
                    height: (id.startsWith('id-') ? 18 : 24) * at.zoom,
                    width: width * at.zoom,
                },
                cx(),
            );
    }
    return view.ask(theme, row, ask as never);
};
/** the card as it draws once its widths are known */
const drawn = (ask: unknown, card = 480) =>
    measure(ask, { card, pill: 60, title: 110 });

beforeEach(() => {
    at.zoom = 1;
    at.opened.length = 0;
    at.urls.length = 0;
});

describe('an ask in three parts', () => {
    test('its title is bold on one line he can select, a look’s 👀 first', () => {
        const title = find(drawn(look), 'title-s1:o12');
        expect(title.args[1]).toBe('**👀 🐑 path links**');
        expect(title.calls.has('selectable')).toBe(true);
    });

    test('a title past the edge is one line ending in «…», whole in its tooltip', () => {
        const cut = find(drawn(look, 160), 'title-cut-s1:o12');
        expect(cut.calls.has('text_ellipsis')).toBe(true);
        expect(cut.calls.has('whitespace_nowrap')).toBe(true);
        expect(cut.calls.has('font_bold')).toBe(true);
        expect(cut.calls.get('tooltip')).toEqual(['👀 🐑 path links']);
    });

    test('a new title of the same width, which herdr does not report, stays whole', () => {
        drawn(look);
        const renamed = { ...(look as object), title: '🐑 links path' };
        const card = view.ask(theme, row, renamed as never);
        expect(find(card, 'title-s1:o12').args[1]).toBe('**👀 🐑 links path**');
    });

    test('its body is small markdown, a step smaller than the title', () => {
        const card = drawn(look);
        const body = find(card, 'body-s1:o12');
        expect(body.args[1]).toBe('it **opens** `it`\\:\n\n- one\n- two');
        expect(body.calls.get('text_color')).toEqual(['foreground']);
        expect(body.calls.get('text_size')?.[0]).toBeLessThan(
            find(card, 'title-s1:o12').calls.get('text_size')?.[0] as number,
        );
    });

    test('a path in its title or body reads as the file’s name', () => {
        const named = {
            ...(look as object),
            body: 'read /tmp/x/notes.md',
            title: '🐑 /tmp/x/a.md',
        };
        const card = drawn(named);
        expect(find(card, 'body-s1:o12').args[1]).toBe('read notes\\.md');
        expect(find(card, 'title-s1:o12').args[1]).toBe('**👀 🐑 a\\.md**');
    });

    test('its pick is the grey ➡️ line', () => {
        const pick = find(drawn(look), 'pick-s1:o12');
        expect(pick.args[1]).toBe('➡️ both work');
        expect(pick.calls.get('text_color')).toEqual(['muted']);
    });
});

test('an ask sent the old way draws as before: its id first, its text, its pick bare', () => {
    const card = drawn(plain);
    expect(find(card, 'ask-s1:o3').args[1]).toMatch(/^\s+push \*\*FRM-1\*\*$/);
    expect(find(card, 'ask-s1:o3-label').kids).toEqual(['w1·o3']);
    expect(find(card, 'pick-s1:o3').args[1]).toBe('push it');
    expect(ids(card)).not.toContain('id-s1:o3');
});

describe('the id pill', () => {
    test('sits over the card’s far top right, named by its thread, 🆕 first', () => {
        const pill = find(drawn(look), 'id-s1:o12');
        expect(pill.kids).toEqual(['🆕 w1·o12']);
        expect([...pill.calls.keys()]).toEqual(
            expect.arrayContaining(['absolute', 'top', 'right']),
        );
    });

    test('a press copies the bare id and goes no further than the pill', () => {
        const pill = find(drawn(look), 'id-s1:o12');
        const [down, click] = [cx(), cx()];
        fire(pill, 'on_mouse_down', {}, down);
        fire(pill, 'on_click', {}, click);
        expect(click.write_to_clipboard).toHaveBeenCalledWith('o12');
        expect(down.stop_propagation).toHaveBeenCalled();
        expect(click.stop_propagation).toHaveBeenCalled();
        expect(press).not.toHaveBeenCalled();
        // the ✓ takes the id's own width
        const ticked = find(view.ask(theme, row, look as never), 'id-s1:o12');
        expect(ticked.kids).toEqual(['✓']);
        expect(ticked.calls.get('w')).toEqual([60]);
    });
});

test('a second copy keeps its ✓ its own whole moment', () => {
    const ends: (() => void)[] = [];
    const clock = {
        ...cx(),
        timer: {
            after: (_ms: number, end: (c: unknown) => void) =>
                ends.push(() => end(cx())),
        },
    };
    const pill = () => find(view.ask(theme, row, look as never), 'id-s1:o12');
    fire(pill(), 'on_click', {}, clock);
    fire(pill(), 'on_click', {}, clock);
    ends[0]?.();
    expect(pill().kids).toEqual(['✓']);
    ends[1]?.();
    expect(pill().kids).toEqual(['🆕 w1·o12']);
});

// exit 3: a 45-char title and a three-digit id at each width, zoomed or not
describe.each([1, 0.8, 1.5])('at herdr’s zoom %f', (zoom) => {
    const long = {
        ...(look as object),
        id: 'o123',
        title: `🐑 ${'m'.repeat(43)}`,
    };
    test.each([
        [240, 62, true],
        [420, 62, true],
        [504, 96, true],
        [520, 62, false],
        [640, 96, false],
    ])(
        'in a card %i wide the title ends before a pill of %i',
        (card, pill, isCut) => {
            at.zoom = zoom;
            const el = measure(long, { card, pill, title: 420 });
            const padding = find(el, 'head-s1:o123').calls.get(
                'pr',
            )?.[0] as number;
            const right = find(el, 'id-s1:o123').calls.get(
                'right',
            )?.[0] as number;
            const titleEnd = card - 12 - padding;
            expect(card - right - pill - titleEnd).toBe(8);
            expect(ids(el).includes('title-cut-s1:o123')).toBe(isCut);
            // the pill's middle on the title's
            expect(find(el, 'id-s1:o123').calls.get('top')).toEqual([15]);
        },
    );
});

// exit 5: the sixth sense's find, a bare `open` ran an app an ask named
describe('a file or link an ask names opens by the chat’s rule', () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'ask-view-')));
    mkdirSync(join(dir, 'Calculator.app'));
    symlinkSync(join(dir, 'Calculator.app'), join(dir, 'notes.md'));
    writeFileSync(join(dir, 'real.md'), '');
    writeFileSync(join(dir, 'a.mp3'), '');
    const linked = (link: string) => ({ ...(look as object), id: 'o9', link });

    test.each([
        ['an app', 'Calculator.app/', ['-R', 'Calculator.app']],
        ['a symlink to one', 'notes.md', ['-R', 'Calculator.app']],
        ['an app by a file url', 'file', ['-R', 'Calculator.app']],
        ['a note', 'real.md', ['real.md']],
        [
            'a song, in the app his settings name',
            'a.mp3',
            ['-a', 'VLC', 'a.mp3'],
        ],
    ])('%s', async (_what, name, want) => {
        const link =
            name === 'file' ? `file://${dir}/Calculator.app` : `${dir}/${name}`;
        const ask = linked(link);
        await files.look([{ asks: [ask] }] as never);
        const chip = find(drawn(ask), 'chip-s1:o9-0');
        fire(chip, 'on_click', {}, cx());
        await vi.waitFor(() => expect(at.opened).toHaveLength(1));
        expect(at.opened).toEqual([
            want.map((w) => (/^-|^VLC$/.test(w) ? w : `${dir}/${w}`)),
        ]);
    });

    test.each([
        ['a page opens in his browser', 'https://a.b/c', ['https://a.b/c'], []],
        [
            'a note opens in obsidian',
            'obsidian://open?file=x',
            [],
            [['obsidian://open?file=x']],
        ],
        [
            'a ticket opens in linear',
            'linear://issue/FRM-1',
            [],
            [['linear://issue/FRM-1']],
        ],
    ])('%s', (_what, link, urls, opened) => {
        fire(find(drawn(linked(link)), 'link-s1:o9'), 'on_click', {}, cx());
        expect(at.urls).toEqual(urls);
        expect(at.opened).toEqual(opened);
    });

    test('one gone since reads «not found», a link to none too', async () => {
        symlinkSync(join(dir, 'gone.md'), join(dir, 'dangling.md'));
        const ask = linked(`${dir}/dangling.md`);
        await files.look([{ asks: [ask] }] as never);
        expect(find(drawn(ask), 'chip-s1:o9-0').kids).toEqual([
            'not found: dangling.md',
        ]);
    });

    test('one gone between the look and his click reads «not found»', async () => {
        writeFileSync(join(dir, 'brief.md'), '');
        const ask = linked(`${dir}/brief.md`);
        await files.look([{ asks: [ask] }] as never);
        unlinkSync(join(dir, 'brief.md'));
        const c = cx();
        fire(
            find(drawn(ask), 'chip-s1:o9-0'),
            'on_click',
            {},
            {
                ...c,
                spawn: (job: (cx: unknown) => Promise<unknown>) => job(c),
            },
        );
        await vi.waitFor(() => expect(c.notify).toHaveBeenCalled());
        expect(find(drawn(ask), 'chip-s1:o9-0').kids).toEqual([
            'not found: brief.md',
        ]);
    });

    test('a link that would run something draws none', () => {
        expect(
            ids(drawn(linked('shortcuts://run-shortcut?name=x'))),
        ).not.toContain('link-s1:o9');
    });
});
