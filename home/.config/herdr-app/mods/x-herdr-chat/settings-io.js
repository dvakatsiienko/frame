// x-herdr-settings' doors: the settings file, the second wind notes' defaults, Apple's Metal HUD and his
// keys.json. each read or write here is one place, so the window and the chat never reach a file another way
import { appHome, exec, home, readTextFile, writeTextFile } from 'herdr';

import { OUR_KEYS, keysWithOurs } from './hotkeys.js';
import { settingRows } from './settings-model.js';
import {
    SETTINGS_DIR,
    SETTINGS_FILE,
    settingsOf,
    settingsText,
} from './settings-store.js';

export const settingsPath = () => `${home()}/${SETTINGS_FILE}`;
export const settingsDir = () => `${home()}/${SETTINGS_DIR}`;

/** every row's value as the file holds it now, a missing or unfit one at its default */
export const readSettings = async () =>
    settingsOf(
        await readTextFile(settingsPath()).catch(
            () => /** @type {string | null} */ (null),
        ),
    );

// every value lands in the file, defaults included, so no other reader keeps defaults of its own; writeTextFile
// refuses a file changed since its read, so a change made meanwhile is read again, never lost
/** @param {Record<string, unknown>} [change] @returns {Promise<string>} the file's text after the write */
export async function writeSettings(change) {
    const made = await exec('mkdir', ['-p', settingsDir()]);
    if (made.code !== 0) throw new Error(made.stderr.trim() || 'mkdir failed');
    for (let tries = 2; ; tries--) {
        const text = await readTextFile(settingsPath()).catch(
            () => /** @type {string | null} */ (null),
        );
        const next = settingsText(settingRows, text, change);
        try {
            if (next !== text) await writeTextFile(settingsPath(), next, text);
            return next;
        } catch (err) {
            if (tries <= 1) throw err;
        }
    }
}

// the second wind notes' defaults as x-mod-stash keeps them in its second-wind store, by row name; the mod's own
// store and code are never read
const WIND_STORE = '.claude/shelf/second-wind.json';
/** @returns {Promise<Record<string, string>>} */
export async function windDefaults() {
    try {
        const file = JSON.parse(
            (await readTextFile(`${home()}/${WIND_STORE}`)) ?? '',
        );
        return Object.fromEntries(
            Object.entries(file?.rows ?? {})
                .filter(([, row]) => typeof row?.default === 'string')
                .map(([name, row]) => [name, row.default]),
        );
    } catch {
        return {};
    }
}

// Apple's Metal HUD is a macOS default for herdr's bundle, never our file: its row reads the default at every load
// and writes it on a press, so a flip made in a shell shows here too
const HUD = ['dev.herdr.app', 'MetalForceHudEnabled'];
export async function metalHudNow() {
    const r = await exec('defaults', ['read', ...HUD]);
    return r.code === 0 && r.stdout.trim() === '1';
}
/** @param {boolean} isOn */
export async function setMetalHud(isOn) {
    const r = await exec('defaults', [
        'write',
        ...HUD,
        '-bool',
        isOn ? 'YES' : 'NO',
    ]);
    if (r.code !== 0)
        throw new Error(r.stderr.trim() || 'defaults write failed');
}

/** @typedef {Record<string, Record<string, unknown>>} KeysFile */

const keysPath = () => `${appHome()}/keys.json`;
/** @returns {Promise<{ keys: KeysFile, text: string | null }>} */
export async function readKeys() {
    const text = await readTextFile(keysPath()).catch(
        () => /** @type {string | null} */ (null),
    );
    return { keys: JSON.parse(text ?? '{}'), text };
}

/**
 * his keys.json rewritten as `keys`, the file as it was kept in data/x-herdr-chat/keys-before first; false when
 * nothing changes. writeTextFile refuses a file changed since `text` was read, and the caller reads again
 * @param {string | null} text @param {KeysFile} keys
 */
export async function saveKeys(text, keys) {
    if (
        text !== null &&
        JSON.stringify(JSON.parse(text)) === JSON.stringify(keys)
    )
        return false;
    if (text !== null) {
        const dir = `${appHome()}/data/x-herdr-chat/keys-before`;
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const made = await exec('mkdir', ['-p', dir]);
        if (made.code !== 0)
            throw new Error(made.stderr.trim() || 'mkdir failed');
        await writeTextFile(`${dir}/keys.json-${stamp}`, text, null);
    }
    await writeTextFile(keysPath(), `${JSON.stringify(keys, null, 2)}\n`, text);
    // the save drops every mod's bind_keys: the keys door reloads each x-herdr mod, this one too (FRM-569)
    const reloaded = await exec('pnpm', ['exec', 'node', KEYS_DOOR, 'reload'], {
        cwd: `${home()}/frame`,
        timeout: 10 * 1000,
    });
    if (reloaded.code !== 0)
        throw new Error(
            `saved, mods not reloaded: ${reloaded.stderr.trim() || 'the keys door failed'}`,
        );
    return true;
}

const KEYS_DOOR = 'home/.claude/plugin-x/skills/herdr/scripts/keys-change.ts';

/**
 * what the Keys page draws, read from his keys.json: ours where they sit now (a refused one keyless), then herdr's own
 * @param {KeysFile} his
 */
export function keysView(his) {
    const global = his.global ?? {};
    const at = new Map(Object.entries(global).map(([k, a]) => [a, k]));
    const { refused } = keysWithOurs(his, OUR_KEYS);
    return {
        herdr: Object.entries(global)
            .filter(([, a]) => !String(a).startsWith('x-herdr-'))
            .map(
                ([k, a]) =>
                    /** @type {[string, string]} */ ([
                        k,
                        typeof a === 'string' ? a : JSON.stringify(a),
                    ]),
            ),
        ours: OUR_KEYS.map((k) => ({
            ...k,
            key: /** @type {string} */ (at.get(k.action) ?? k.key),
            takenBy: at.has(k.action)
                ? null
                : (refused.find((r) => r.action === k.action)?.takenBy ?? null),
        })),
    };
}
