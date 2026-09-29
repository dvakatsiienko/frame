// prints every hotkey the machine will tell us about, as json: wispr flow, cursor, macos, plus
// the hand-kept list in manual.ts.
//   node ./hotkeys/scan.ts
//
// stdout is an api — top.ts parses it — so it stays json. the same payload is also dropped
// beside this file as hotkeys.json, which is what the daemon hands the chords app over
// /api/hotkeys; the scan shells out to plutil and the page must not wait on it.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { canonical, keyCap } from './chord.ts';
import { type Hotkey, manualHotkeys } from './manual.ts';
import { cursorKeybindings, macosPreference, wisprConfig } from './sources.ts';

const modifierCodes = new Set([55, 56, 58, 59, 63]);
const modsOf = (mask: number, bits: [number, string][]) =>
    bits
        .filter(([bit]) => mask & bit)
        .map(([, name]) => name)
        .join('+');
// NX event flags, what symbolichotkeys stores
const nxMods = (mask: number) =>
    modsOf(mask, [
        [0x40000, 'ctrl'],
        [0x80000, 'opt'],
        [0x20000, 'shift'],
        [0x100000, 'cmd'],
    ]);

// wispr's config lists its in-app editing shortcuts beside its global ones, so a scan that
// takes the file wholesale credits wispr with cmd+z and the rest of the system's chords. only
// these five reach outside the app; everything else is macos, and the macos table already has
// it. `paste_event` is wispr's hook on the system paste chord, not a binding of its own. `lens`
// (ctrl+fn) is left out on purpose: dima does not use it (2026-09-29), so it is not tracked.
const wisprGlobalActions = new Set([
    'ptt',
    'dismiss',
    'paste_last_text',
    'copy_last_text',
    'open_meeting_recorder',
]);

const wispr = (): Hotkey[] => {
    const config = JSON.parse(readFileSync(wisprConfig, 'utf8'));
    const binds: { shortcut: number[]; value: string }[] =
        config.prefs.cache.splitKeybinds;
    return binds
        .filter(({ value }) => wisprGlobalActions.has(value))
        .map(({ shortcut, value }) => {
            const mods = shortcut
                .filter((c) => modifierCodes.has(c))
                .map((c) => keyCap[c]);
            const keys = shortcut
                .filter((c) => !modifierCodes.has(c))
                .map((c) => keyCap[c] ?? String(c));
            return keys.length === 0
                ? {
                      action: value,
                      app: 'wispr flow',
                      key: mods.join('+'),
                      mods: '',
                      note: 'bare modifier',
                  }
                : {
                      action: value,
                      app: 'wispr flow',
                      key: keys.join('+'),
                      mods: mods.join('+'),
                  };
        });
};

// Cursor spells keys the vscode way; the daemon and the board spell them the way keyCap does, and
// a binding that spells its key differently never joins a press.
const CURSOR_NAMES: Record<string, string> = {
    alt: 'opt',
    delete: 'del',
    enter: 'return',
    escape: 'esc',
};

const cursor = (): Hotkey[] => {
    const text = readFileSync(cursorKeybindings, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
    const binds: { key: string; command: string }[] = JSON.parse(text);
    return binds
        .filter((b) => !b.command.startsWith('-'))
        .map((b) => {
            const parts = b.key.split('+').map((p) => CURSOR_NAMES[p] ?? p);
            return {
                action: b.command,
                app: 'cursor',
                key: parts.at(-1) ?? b.key,
                mods: parts.slice(0, -1).join('+'),
            };
        });
};

const macos = (): Hotkey[] => {
    const plist = execFileSync(
        'plutil',
        ['-convert', 'json', '-o', '-', macosPreference],
        { encoding: 'utf8' },
    );
    const all: Record<
        string,
        { enabled: boolean; value?: { parameters: number[] } }
    > = JSON.parse(plist).AppleSymbolicHotKeys;
    const names: Record<string, string> = {
        79: 'space left',
        80: 'space left (drag)',
        81: 'space right',
        82: 'space right (drag)',
    };
    return Object.entries(all).flatMap(([id, v]) => {
        const action = names[id];
        const [, code, mask] = v.value?.parameters ?? [];
        if (!(v.enabled && action && code !== undefined)) return [];
        return {
            action,
            app: 'macos',
            key: keyCap[code] ?? String(code),
            mods: nxMods(mask ?? 0),
        };
    });
};

const scanned = [wispr, cursor, macos].flatMap((scan) => {
    try {
        return scan();
    } catch (error) {
        console.error(`skipped ${scan.name}: ${(error as Error).message}`);
        return [];
    }
});

const payload = JSON.stringify(
    {
        // Stamped here rather than declared in manual.ts: the two lists are only
        // distinguishable at the moment they are merged, and `macos` rows appear in both.
        hotkeys: [
            ...manualHotkeys.map((hotkey) => ({
                ...hotkey,
                source: 'manual' as const,
            })),
            ...scanned.map((hotkey) => ({
                ...hotkey,
                source: 'scan' as const,
            })),
        ].map(canonical),
        scannedAt: new Date().toISOString(),
    },
    null,
    2,
);

writeFileSync(join(import.meta.dirname, 'hotkeys.json'), `${payload}\n`);

console.log(payload);
