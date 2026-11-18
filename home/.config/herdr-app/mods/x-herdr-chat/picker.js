// the model and effort the shown thread runs at, read from its transcript with Claude's settings behind it, and a pick
// made in Claude Code's own /model or /effort picker with its «s» key (this session only)

import { EFFORTS, effortAfterStamp, pickTaken } from './effort.js';
import { clearKeys, commandKeys, isVimNormal } from './queued.js';

// as Claude's /model list names them, biggest first (dima, 2026-11-13 14:56); the alias is how settings.json's
// "model" names the default
export const MODELS = [
    ['fable', 'Fable 5.2'],
    ['opus', 'Opus 5.5'],
    ['sonnet', 'Sonnet 5.5'],
    ['haiku', 'Haiku 5.5'],
];

/** «claude-opus-5-5» → «Opus 5.5»; a display name stays as it is @param {string | null | undefined} m */
export function modelLabel(m) {
    const id = /^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?:-\d{6,})?$/.exec(
        m ?? '',
    );
    if (!id?.[1]) return m || null;
    const name = id[1];
    return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${id[2]}${id[3] ? `.${id[3]}` : ''}`;
}

/** @param {string} label */
const modelId = (label) =>
    `claude-${label.toLowerCase().replace(/[ .]/g, '-')}`;

/**
 * @typedef {{ isPicked?: boolean, level: string, model: string | null }} Effort the level /effort or a reply set, and
 *   the model it was set on
 * @typedef {{ model: string | null, effort: Effort | null, appliedAt: number | null }} RunsAt
 * @typedef {{ model?: unknown, effortLevel?: unknown, modelSettings?: Record<string, { effortLevel?: unknown }>, editorMode?: unknown } | null} ClaudeSettings
 */

/** @type {RunsAt} */
export const NO_RUNS_AT = { appliedAt: null, effort: null, model: null };

const COMMAND_OUTPUT =
    /^\s*<local-command-stdout>([\s\S]*?)<\/local-command-stdout>\s*$/;

/**
 * one transcript line folded in: a reply's model and the effort Claude Code stamped on it, or what /model and /effort
 * printed. a picked effort holds over replies still at the old one; the first reply at it is when it applied
 * @param {RunsAt} runsAt @param {string} line @param {number} now
 * @returns {RunsAt}
 */
export function runsAtAfter(runsAt, line, now) {
    /** @type {any} */
    let entry;
    try {
        entry = JSON.parse(line);
    } catch {
        return runsAt;
    }
    if (entry?.isSidechain) return runsAt;
    if (entry?.type === 'assistant') {
        const id = entry.message?.model;
        const model = /^claude-/.test(id ?? '') ? modelLabel(id) : runsAt.model;
        if (!EFFORTS.includes(entry.effort))
            return model === runsAt.model ? runsAt : { ...runsAt, model };
        const next = effortAfterStamp(runsAt.effort, entry.effort);
        return {
            appliedAt: next.isApplied ? now : runsAt.appliedAt,
            effort: { isPicked: next.isPicked, level: next.level ?? '', model },
            model,
        };
    }
    const content = entry?.message?.content;
    if (entry?.type !== 'user' || typeof content !== 'string') return runsAt;
    const out = COMMAND_OUTPUT.exec(content)?.[1]?.trim() ?? '';
    const model = /^(?:Set model to|Kept model as) `([^`]+)`/.exec(out)?.[1];
    if (model) return { ...runsAt, model: modelLabel(model) };
    const level = /^Set effort level to (\w+)/.exec(out)?.[1];
    return level
        ? { ...runsAt, effort: { level, model: runsAt.model } }
        : runsAt;
}

/** the model: as the transcript last named it, else the default in Claude's settings @param {RunsAt} runsAt @param {ClaudeSettings} settings */
export function modelNow(runsAt, settings) {
    if (runsAt.model) return runsAt.model;
    const m = typeof settings?.model === 'string' ? settings.model : '';
    return (
        MODELS.find(([alias]) => alias === m)?.[1] ??
        (m.startsWith('claude-') ? modelLabel(m) : null)
    );
}

/** the effort: what was set on this model, else the default Claude's settings keep for it @param {RunsAt} runsAt @param {ClaudeSettings} settings */
export function effortNow(runsAt, settings) {
    const model = modelNow(runsAt, settings);
    if (!model) return null;
    if (runsAt.effort && (runsAt.effort.model ?? model) === model)
        return runsAt.effort.level;
    const level =
        settings?.modelSettings?.[modelId(model)]?.effortLevel ??
        settings?.effortLevel;
    return typeof level === 'string' ? level : null;
}

// Claude Code's permission modes, in the order Shift+Tab cycles them (probed 2026-11-17 00:35 on a throwaway thread,
// started in bypass): each read off the mode line at the foot of its screen. a change applies live, mid-turn too
export const PERMISSIONS = [
    {
        id: 'bypassPermissions',
        label: 'Full access',
        shows: /bypass permissions on/,
    },
    { id: 'auto', label: 'Auto', shows: /auto mode on/ },
    { id: 'default', label: 'Ask', shows: /manual mode on/ },
    { id: 'acceptEdits', label: 'Accept edits', shows: /accept edits on/ },
    { id: 'plan', label: 'Plan', shows: /plan mode on/ },
];

/** the mode the thread runs in, from the last mode line on its screen; null with none @param {string} screen */
export function permissionOf(screen) {
    const lines = screen.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
        const found = PERMISSIONS.find((p) => p.shows.test(lines[i] ?? ''));
        if (found) return found.id;
    }
    return null;
}

/**
 * Shift+Tab until the mode line reads `mode`, one press per redraw seen. it stops on the mode it started in once the
 * cycle comes round (a thread's cycle can lack a mode), on a screen with no mode line, on a footer that never redraws,
 * and before any press while the thread asks a question: a key there would answer it. resolves with the mode it ends at
 * @param {string} mode @param {PermissionIo} io
 * @returns {Promise<string | null>}
 */
export async function permissionIn(mode, io) {
    const start = permissionOf(await io.screen());
    let now = start;
    for (
        let i = 0;
        i < PERMISSIONS.length && now !== null && now !== mode;
        i++
    ) {
        if (io.isBlocked()) break;
        const was = now;
        await io.keys(['shift+tab']);
        for (let wait = 0; wait < REDRAW_READS && now === was; wait++) {
            await io.sleep(REDRAW_MS);
            now = permissionOf(await io.screen());
        }
        if (now === was || now === start) break;
    }
    return now;
}

const REDRAW_READS = 20;
const REDRAW_MS = 50;

/**
 * @typedef {object} PermissionIo the thread, as a mode change reaches it
 * @property {(keys: string[]) => Promise<void>} keys
 * @property {() => Promise<string>} screen
 * @property {(ms: number) => Promise<void>} sleep
 * @property {() => boolean} isBlocked
 */

/**
 * @typedef {object} PickIo the thread, as a pick reaches it
 * @property {(keys: string[]) => Promise<void>} keys
 * @property {() => Promise<string>} screen
 * @property {(ms: number) => Promise<void>} sleep
 * @property {() => string | undefined} status
 * @property {unknown} editorMode
 */

/**
 * types the command, waits for its picker, picks, answers Claude's «switch?» with the pick, and says whether Claude
 * Code took it: mid-turn it writes nothing to the transcript and runs the pick from the next turn
 * @param {'model' | 'effort'} kind @param {string} value @param {PickIo} io
 * @returns {Promise<boolean>}
 */
export async function pickIn(kind, value, io) {
    const isNormal = async () => isVimNormal(await io.screen(), io.editorMode);
    /** @param {string} command @param {(screen: string) => boolean} ready @param {string} what */
    const inPicker = async (command, ready, what) => {
        await io.keys(commandKeys(command, await isNormal()));
        await io.keys(['enter']);
        for (let i = 0; i < 20; i++) {
            await io.sleep(150);
            if (ready(await io.screen())) return;
        }
        // Esc mid-turn would stop the turn: only an idle thread gets one to close a stray picker
        if (io.status() !== 'working') await io.keys(['esc']);
        // the typed command leaves Claude's prompt too, or his next send glues onto it (21:46)
        await io.keys(clearKeys([command], await isNormal()));
        throw new Error(`Claude's ${what} picker didn't open`);
    };
    if (kind === 'model') {
        // rows «N.  Opus 5.5   …», row 1 «Default (recommended)»; Home goes to row 1
        const row = new RegExp(
            `^\\s*(?:❯\\s*)?(\\d+)\\.\\s+${value.replace(/\./g, '\\.')}\\s`,
            'm',
        );
        await inPicker(
            '/model',
            (s) => /Select model/.test(s) && row.test(s),
            'model',
        );
        const n = Number(row.exec(await io.screen())?.[1] ?? 0);
        if (!n) throw new Error(`${value} isn't in Claude's /model list`);
        await io.keys(['home', ...Array(n - 1).fill('down')]);
        await io.sleep(100);
        // only on the right row (the list could have moved): else it is left untouched
        const at = /^\s*❯\s*\d+\.\s+(.*?)\s{2,}/m.exec(await io.screen())?.[1];
        if (at?.replace(/\s*✔$/, '') !== value) {
            await io.keys(['esc']);
            throw new Error(`Couldn't select ${value}`);
        }
        await io.keys(['s']);
    } else {
        // the slider starts at the current level; ← five times is low
        await inPicker(
            '/effort',
            (s) => /Faster[\s\S]*Smarter/.test(s),
            'effort',
        );
        await io.keys([
            ...Array(5).fill('left'),
            ...Array(EFFORTS.indexOf(value)).fill('right'),
            's',
        ]);
    }
    // mid-conversation Claude asks first («Change effort level?», «Switch model?» over «❯ 1. Yes…»): the pick was the answer
    for (let i = 0; i < 8; i++) {
        await io.sleep(200);
        const s = await io.screen();
        if (
            /^\s*❯\s*1\.\s+Yes, switch/m.test(s) ||
            (/Switch model\?/.test(s) && /❯\s*1\.\s*Yes/.test(s))
        ) {
            await io.keys(['enter']);
            break;
        }
    }
    for (let i = 0; i < 8; i++) {
        if (pickTaken(kind, await io.screen())) return true;
        await io.sleep(200);
    }
    return false;
}
