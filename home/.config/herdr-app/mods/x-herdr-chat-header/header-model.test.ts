import { describe, expect, test } from 'vitest';

import {
    type HeaderInput,
    type PaneLike,
    headerOf,
    pressOf,
} from './header-model.js';

const claude: PaneLike = {
    app: 'claude-code',
    cwd: '/Users/d/frame',
    pane: 'p1',
    program: { agent: true, name: 'Claude Code', shell: false },
    status: 'idle',
    terminal: 't1',
    title: '⚡ 🔧 herdr | FRM-648',
    zoomed: false,
};

const zsh: PaneLike = {
    ...claude,
    app: null,
    program: { agent: false, name: 'zsh', shell: true },
    title: 'd@mac:~/frame',
};

const input = (over: Partial<HeaderInput> = {}): HeaderInput => ({
    hasTabButtons: true,
    hasViews: true,
    home: '/Users/d',
    isFindOpen: false,
    isFirstOfTab: true,
    pane: claude,
    panels: ['files', 'changes'],
    shownPanel: null,
    view: 'chat',
    ...over,
});

const kinds = (i: HeaderInput) => headerOf(i).controls.map((c) => c.kind);
const control = (i: HeaderInput, kind: string) =>
    headerOf(i).controls.find((c) => c.kind === kind);

describe('the thread on the left', () => {
    test('an agent shows its thread title', () => {
        expect(headerOf(input()).name).toBe('⚡ 🔧 herdr | FRM-648');
    });

    test('an agent with no title yet shows its program', () => {
        expect(headerOf(input({ pane: { ...claude, title: '' } })).name).toBe(
            'Claude Code',
        );
    });

    test('a shell shows its program, never the title it sets', () => {
        expect(headerOf(input({ pane: zsh })).name).toBe('zsh');
    });

    test('the folder prints from home as ~', () => {
        expect(headerOf(input()).place).toBe('~/frame');
    });

    test('a title that already names the folder drops it', () => {
        const vim: PaneLike = {
            ...claude,
            program: { agent: false, name: 'vim', shell: false },
            title: 'vim ~/frame/x.ts',
        };
        expect(headerOf(input({ pane: vim })).place).toBe('');
    });

    test('an idle thread shows no status mark', () => {
        expect(headerOf(input()).status).toBeNull();
    });

    test('a working thread shows no spinner: the agents list has one', () => {
        expect(
            headerOf(input({ pane: { ...claude, status: 'working' } })).status,
        ).toBeNull();
    });

    test('a blocked thread shows it needs him', () => {
        expect(
            headerOf(input({ pane: { ...claude, status: 'blocked' } })).status,
        ).toBe('blocked');
    });
});

describe('the buttons each view shows', () => {
    test('the Chat view: tab, panels, search, settings', () => {
        expect(kinds(input())).toEqual([
            'new-tab',
            'files',
            'changes',
            'search',
            'settings',
        ]);
    });

    test('the Terminal view: pane buttons, tab, panels, settings, no search', () => {
        expect(kinds(input({ view: 'terminal' }))).toEqual([
            'split-right',
            'split-down',
            'zoom',
            'close',
            'new-tab',
            'files',
            'changes',
            'settings',
        ]);
    });

    test('the pane buttons show only on hover', () => {
        const shown = headerOf(input({ view: 'terminal' })).controls;
        expect(shown.filter((c) => c.isHoverOnly).map((c) => c.kind)).toEqual([
            'split-right',
            'split-down',
            'zoom',
            'close',
        ]);
    });

    test('a zoomed pane offers unzoom', () => {
        const zoomed = { ...claude, zoomed: true };
        expect(
            control(input({ pane: zoomed, view: 'terminal' }), 'zoom')?.label,
        ).toBe('Unzoom');
    });

    test('a split tab draws the tab buttons in its first pane only', () => {
        expect(
            kinds(input({ isFirstOfTab: false, view: 'terminal' })),
        ).not.toContain('new-tab');
    });

    test('a layout with a tab bar of its own gets no tab buttons here', () => {
        expect(kinds(input({ hasTabButtons: false }))).toEqual([
            'search',
            'settings',
        ]);
    });

    test('a panel switched off in herdr settings has no button', () => {
        expect(kinds(input({ panels: ['changes'] }))).not.toContain('files');
    });

    test('the shown panel reads as on', () => {
        expect(control(input({ shownPanel: 'files' }), 'files')?.isOn).toBe(
            true,
        );
    });

    test('an open find reads as on', () => {
        expect(control(input({ isFindOpen: true }), 'search')?.isOn).toBe(true);
    });

    test('a plain terminal has no chat settings', () => {
        expect(kinds(input({ pane: zsh, view: 'terminal' }))).not.toContain(
            'settings',
        );
    });

    test('a plain terminal has no switch', () => {
        expect(headerOf(input({ pane: zsh, view: 'terminal' })).hasSwitch).toBe(
            false,
        );
    });

    test('a layout with no Chat / Terminal stack has no switch', () => {
        expect(headerOf(input({ hasViews: false })).hasSwitch).toBe(false);
    });

    test('a Claude thread in the stack has the switch', () => {
        expect(headerOf(input()).hasSwitch).toBe(true);
    });
});

describe('a chat with no thread yet', () => {
    test('keeps the tab buttons, so the row never strands him', () => {
        expect(kinds(input({ pane: null }))).toEqual([
            'new-tab',
            'files',
            'changes',
            'search',
        ]);
    });

    test('keeps the way to Terminal', () => {
        expect(headerOf(input({ pane: null })).hasSwitch).toBe(true);
    });

    test('shows no name', () => {
        expect(headerOf(input({ pane: null })).name).toBe('');
    });
});

describe('a mod pane, which has no program', () => {
    test('shows its title', () => {
        const files: PaneLike = {
            pane: 'p9',
            terminal: null,
            title: 'Files',
            zoomed: false,
        };
        expect(headerOf(input({ pane: files, view: 'terminal' })).name).toBe(
            'Files',
        );
    });
});

describe('what a press does', () => {
    const at = {
        isFindOpen: false,
        other: 'main',
        pane: claude,
        shownPanel: null,
        stack: 'views',
    };

    test('split right splits this pane, never the focused one', () => {
        expect(pressOf('split-right', at)).toEqual([
            { run: ['pane.split', { direction: 'right', pane: 'p1' }] },
        ]);
    });

    test('the switch with no thread only shows the other view', () => {
        expect(pressOf('switch', { ...at, pane: null })).toEqual([
            { run: ['layout.select', { child: 'main', stack: 'views' }] },
        ]);
    });

    test('a pane button with no pane does nothing', () => {
        expect(pressOf('close', { ...at, pane: null })).toEqual([]);
    });

    test('close names this pane', () => {
        expect(pressOf('close', at)).toEqual([
            { run: ['pane.close', { pane: 'p1' }] },
        ]);
    });

    test('a hidden panel shows on its press', () => {
        expect(pressOf('files', at)).toEqual([
            { run: ['layout.select', { child: 'files', stack: 'panel-body' }] },
            { run: ['layout.show', { id: 'panel' }] },
        ]);
    });

    test('the shown panel hides on its press', () => {
        expect(pressOf('files', { ...at, shownPanel: 'files' })).toEqual([
            { run: ['layout.hide', { id: 'panel' }] },
        ]);
    });

    test('search asks the chat to open find', () => {
        expect(pressOf('search', at)).toEqual([{ ask: 'find' }]);
    });

    test('search over an open find closes it', () => {
        expect(pressOf('search', { ...at, isFindOpen: true })).toEqual([
            { ask: 'escape' },
        ]);
    });

    test('the switch shows the other view on this thread', () => {
        expect(pressOf('switch', at)).toEqual([
            { run: ['pane.focus', { terminal: 't1' }] },
            { run: ['layout.select', { child: 'main', stack: 'views' }] },
        ]);
    });

    test('settings opens the chat look popover', () => {
        expect(pressOf('settings', at)).toEqual([
            {
                overlay: expect.objectContaining({
                    kind: 'popup',
                    mod: 'x-herdr-chat-settings',
                }),
            },
        ]);
    });
});
