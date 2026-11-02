/* ── firelink ───────────────────────────────────────────────────────────────
 * the doors of the firelink skill (plugin-x/skills/firelink) for cloud-chat, which has no
 * shell: trophy-sys verbs over psn + steam, and the steamac vm's state. the skill's own
 * scripts do the work, so cc and cloud-chat run one code path.
 */

/* Core */
import { join } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { CLAUDE_HOME, readOrNull, run, text } from './shared.js';

const SCRIPTS = join(CLAUDE_HOME, 'plugin-x', 'skills', 'firelink', 'scripts');
const STEAMAC_STATS = join(
    process.env.HOME ?? '',
    'Library/Application Support/es.fxgam.steamac/game-stats.json',
);
/** cloud-chat carries ~20k chars of a tool result inline (clio.ts measured it) */
const MAX_CHARS = 20_000;

const VERBS = [
    'profile',
    'games',
    'game',
    'news',
    'stats',
    'steam-profile',
    'steam-games',
    'steam-game',
    'steam-wishlist',
] as const;

/** a library row trimmed to what an answer needs; trophy lists stay whole */
const slim = (row: Record<string, unknown>) => {
    const { iconUrl: _icon, ...rest } = row;
    return rest;
};

export function registerFirelinkTools(server: McpServer) {
    server.registerTool(
        'firelink_tracker',
        {
            description:
                "Dima's live psn + steam library and trophies (trophy-sys). Call BEFORE any answer about what he owns, played, earned or wishlisted — never answer from memory. " +
                '`games` / `steam-games` return bare arrays: pass `match` (case-insensitive regex on name) to keep the result small. ' +
                '`game` takes an npCommId, `steam-game` an appid — read ids from `games` / `steam-games`, never guess. ' +
                "progress is base + dlc, not a platinum flag: read the platinum trophy's `earned`. `snapshot` is deliberately absent. Read-only.",
            inputSchema: {
                arg: z
                    .string()
                    .optional()
                    .describe('npCommId for `game`, appid for `steam-game`'),
                match: z
                    .string()
                    .optional()
                    .describe('regex on the name, for array verbs'),
                verb: z.enum(VERBS),
            },
            title: 'firelink — trophy-sys tracker',
        },
        async ({ arg, match, verb }) => {
            const out = `/tmp/firelink-mcp-${verb}.json`;
            const args = [join(SCRIPTS, 'trophy-sys-cli.sh'), verb];
            if (arg) args.push(arg);
            args.push('--out', out);
            const log = run('zsh', args).trim();
            const body = readOrNull(out);
            if (!body || !log.startsWith(out))
                return text(
                    `trophy-sys gave no json for \`${verb}\`. its output:\n${log.slice(0, 2000)}`,
                );
            let data: unknown = JSON.parse(body);
            let note = '';
            if (Array.isArray(data)) {
                const total = data.length;
                if (match) {
                    const re = new RegExp(match, 'i');
                    data = data.filter((row) =>
                        re.test(String((row as { name?: string }).name ?? '')),
                    );
                }
                data = (data as Record<string, unknown>[]).map(slim);
                note = `${(data as unknown[]).length} of ${total} rows${match ? ` matching /${match}/i` : ''}`;
            }
            let json = JSON.stringify(data);
            if (json.length > MAX_CHARS) {
                json = `${json.slice(0, MAX_CHARS)}…`;
                note += ` · cut at ${MAX_CHARS} chars, pass a narrower match`;
            }
            return text(
                `${verb}${arg ? ` ${arg}` : ''} — ${note || 'object'}\n${json}`,
            );
        },
    );

    server.registerTool(
        'firelink_steamac',
        {
            description:
                'The steamac vm (FX Steam Launcher: SteamOS in a libkrun vm on the mac, how Dima plays windows steam games without a pc). ' +
                "Returns whether the vm is up and the launcher's per-game session stats (fps avg / p50 / 1 % low, hitches, driver, proton). Read-only; launching stays with Dima.",
            inputSchema: {
                appid: z
                    .number()
                    .int()
                    .optional()
                    .describe('only this steam appid'),
            },
            title: 'firelink — steamac vm state',
        },
        async ({ appid }) => {
            const up =
                run('zsh', [
                    join(SCRIPTS, 'steamac-ssh.sh'),
                    'echo up',
                ]).trim() === 'up';
            const stats = readOrNull(STEAMAC_STATS);
            type Session = { ended?: string; report?: Record<string, unknown> };
            type Game = {
                appid: number;
                name: string;
                lastPlayed?: string;
                sessions?: Session[];
            };
            const games = stats
                ? ((JSON.parse(stats) as { games?: Game[] }).games ?? [])
                : [];
            const rows = games
                .filter((g) => !appid || g.appid === appid)
                .map((g) => ({
                    appid: g.appid,
                    lastPlayed: g.lastPlayed,
                    name: g.name,
                    sessions: (g.sessions ?? [])
                        .slice(0, 5)
                        .map(({ ended, report = {} }) => ({
                            driver: (
                                report.vm as { driver?: string } | undefined
                            )?.driver,
                            ended,
                            fps: report.fps,
                            play_s: report.play_s,
                            proton: report.proton,
                            res: report.res,
                        })),
                }));
            return text(
                `vm: ${up ? 'running' : 'off'}\n${JSON.stringify(rows).slice(0, MAX_CHARS)}`,
            );
        },
    );
}
