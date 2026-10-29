import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
    bundleOf,
    bundledVersion,
    byVersion,
    eventsOf,
    floorOf,
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

describe('the desktop app side', () => {
    const asar = `x;function q_(){return JSON.parse('{"version":"2.1.309","manifest":{"version":"2.1.309"}}')}`;
    const dir = mkdtempSync(join(tmpdir(), 'skew-'));

    it('reads the bundled cc version out of the app archive', () => {
        expect(bundledVersion(asar)).toBe('2.1.309');
    });

    it('names a bundle path that is not there', () => {
        expect(bundleOf(join(dir, 'missing.asar'))).toEqual({
            error: `no Claude.app archive at ${join(dir, 'missing.asar')}`,
        });
    });

    it('names an archive that holds no version', () => {
        writeFileSync(join(dir, 'empty.asar'), 'nothing here');
        expect(bundleOf(join(dir, 'empty.asar'))).toEqual({
            error: `${join(dir, 'empty.asar')} names no bundled cc version`,
        });
    });

    it('reads a real archive file', () => {
        writeFileSync(join(dir, 'app.asar'), asar);
        expect(bundleOf(join(dir, 'app.asar'))).toEqual({ version: '2.1.309' });
    });

    it('gives the oldest engine that knows every event a mod hooks', () => {
        expect(
            floorOf(new Set(['a', 'b']), {
                '2.1.296': new Set(['a']),
                '2.1.299': new Set(['a', 'b']),
                '2.1.300': new Set(['a', 'b']),
                '2.1.301': undefined,
            }),
        ).toBe('2.1.299');
    });

    it('is red, naming the floor and the bundle, when a mod needs a newer engine than the desktop ships', () => {
        const r = verdict(
            { 'x-mod-a': new Set(['a', 'b']) },
            { '2.1.299': new Set(['a']), '2.1.300': new Set(['a', 'b']) },
            { version: '2.1.299' },
        );
        expect([r.isRed, r.lines.slice(0, 3)]).toEqual([
            true,
            [
                'mods:skew: the desktop app bundles cc 2.1.299',
                'mods:skew: the mods need cc 2.1.300 or newer',
                'mods:skew: x-mod-a needs cc 2.1.300 or newer, the desktop app bundles 2.1.299',
            ],
        ]);
    });

    it('is green and names the desktop cc when every mod fits it', () => {
        const r = verdict(
            { 'x-mod-a': new Set(['a']) },
            { '2.1.299': new Set(['a']) },
            { version: '2.1.299' },
        );
        expect([r.isRed, r.lines[0], r.lines[1]]).toEqual([
            false,
            'mods:skew: the desktop app bundles cc 2.1.299',
            'mods:skew: the mods need cc 2.1.299 or newer',
        ]);
    });

    it('is red, with the reason, when the bundle cannot be read', () => {
        const r = verdict(
            { 'x-mod-a': new Set(['a']) },
            { '2.1.299': new Set(['a']) },
            { error: 'no Claude.app archive at /nowhere/app.asar' },
        );
        expect([r.isRed, r.lines[0]]).toEqual([
            true,
            'mods:skew: no Claude.app archive at /nowhere/app.asar, the desktop cc is unnamed',
        ]);
    });

    it('is red when the desktop cc has no types on disk to check against', () => {
        const r = verdict(
            { 'x-mod-a': new Set(['a']) },
            { '2.1.299': new Set(['a']), '2.1.309': undefined },
            { version: '2.1.309' },
        );
        expect([r.isRed, r.lines.join('\n')]).toEqual([
            true,
            expect.stringContaining(
                'mods:skew: the desktop cc 2.1.309 has no types on disk, unchecked',
            ),
        ]);
    });
});
