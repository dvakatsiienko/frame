import { describe, expect, test } from 'vitest';

import {
    findNode,
    folderBeside,
    isPanelShown,
    panelPress,
    panelsEnabled,
} from './header-rules.js';

describe('the folder beside a pane title is printed once', () => {
    test.each([
        [
            'an agent title with no folder in it',
            'Claude Code',
            '~/frame',
            '~/frame',
        ],
        ['a shell title that is the folder', '~/frame', '~/frame', ''],
        ['a shell title that holds the folder', 'zsh ~/frame', '~/frame', ''],
        ['a title that is another path', '/tmp/x', '~/frame', ''],
        ['no folder known', 'zsh', '', ''],
    ])('%s', (_name, title, where, shown) => {
        expect(folderBeside(title, where)).toBe(shown);
    });
});

describe('Files and Changes toggle the side panel', () => {
    const body = { active: 'changes' };

    test('the shown one hides the panel', () => {
        expect(panelPress('changes', { hidden: false }, body)).toEqual([
            ['layout.hide', { id: 'panel' }],
        ]);
    });

    test('the other one is picked, then the panel shows', () => {
        expect(panelPress('files', { hidden: false }, body)).toEqual([
            ['layout.select', { child: 'files', stack: 'panel-body' }],
            ['layout.show', { id: 'panel' }],
        ]);
    });

    test('a hidden panel shows the pressed one', () => {
        expect(panelPress('changes', { hidden: true }, body)).toEqual([
            ['layout.select', { child: 'changes', stack: 'panel-body' }],
            ['layout.show', { id: 'panel' }],
        ]);
    });

    test('a layout with no panel block shows nothing as on', () => {
        expect(isPanelShown('files', null, null)).toBe(false);
    });
});

test('a panel he switched off in settings gets no button', () => {
    expect(panelsEnabled(['changes'])).toEqual(['changes']);
    expect(panelsEnabled(undefined)).toEqual(['files', 'changes']);
});

test('a layout node is found by id at any depth', () => {
    const tree = {
        children: [{ children: [{ hidden: true, id: 'panel' }], id: 'a' }],
        id: 'root',
    };
    expect(findNode(tree, 'panel')).toEqual({ hidden: true, id: 'panel' });
    expect(findNode(tree, 'none')).toBeNull();
});
