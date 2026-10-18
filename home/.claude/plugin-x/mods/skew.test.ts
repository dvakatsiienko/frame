import { describe, expect, it } from 'vitest';

import {
    byVersion,
    eventsOf,
    hookedEvents,
    verdict,
    versionOf,
} from './skew.ts';

const TYPES = `// Written by Claude Code 2.1.299.
  export type EngineEventOf = {
    'session.start': { cwd: string };
    'ui.render'?: Render;
    'tool.call': {
      'not.an.event': string;
    };
  };
  type StopHookInput = { hook_event_name: 'Stop' };`;

describe('the engine side', () => {
    it('reads the version off the first line', () => {
        expect(versionOf(TYPES)).toBe('2.1.299');
    });

    it('lists every dotted key as an event', () => {
        expect([...eventsOf(TYPES)].sort()).toEqual([
            'classic.Stop',
            'not.an.event',
            'session.start',
            'tool.call',
            'ui.render',
        ]);
    });

    it('sorts versions by number, not by text', () => {
        expect(['2.1.300', '2.1.299', '2.1.30'].sort(byVersion)).toEqual([
            '2.1.30',
            '2.1.299',
            '2.1.300',
        ]);
    });
});

describe('the mod side', () => {
    it('drops the matcher braces, a comma inside them included, and skips the hooks.json header', () => {
        expect([
            ...hookedEvents(
                'Validating hooks: /m/hooks/hooks.json\n  ❯ ./register.tsx hooks: session.start, ui.render{component=Pane, requestId=x}, tool.call',
            ),
        ]).toEqual(['session.start', 'ui.render', 'tool.call']);
    });
});

describe('verdict', () => {
    const engine = new Set(['session.start', 'tool.call']);

    it('is red when a live engine lacks an event a mod hooks, naming both', () => {
        const r = verdict(
            { 'x-mod-a': new Set(['session.start', 'prompt.change']) },
            { '2.1.299': engine },
        );
        expect(r.isRed).toBe(true);
        expect(r.lines[0]).toBe(
            'mods:skew: x-mod-a hooks prompt.change, unknown to 2.1.299: a session on 2.1.299 refuses the whole mod',
        );
    });

    it('is green when every live engine knows every event, and names an unchecked one', () => {
        expect(
            verdict(
                { 'x-mod-a': new Set(['tool.call']) },
                { '2.1.295': undefined, '2.1.299': engine },
            ),
        ).toEqual({
            isRed: false,
            lines: [
                'mods:skew: 1 mods fit 2.1.299 — unchecked, no types on disk: 2.1.295',
            ],
        });
    });

    it('is red when no live engine could be checked at all', () => {
        expect(
            verdict(
                { 'x-mod-a': new Set(['tool.call']) },
                { '2.1.295': undefined },
            ).isRed,
        ).toBe(true);
    });
});
