/* ── yt-transcript ─────────────────────────────────────────────────────────
 * The same pipeline `x:yt-transcript` describes for cc, run here instead of
 * described. Desktop has no shell of its own, so a tool is the only door that
 * does not need Desktop Commander cooperating with this server.
 *
 * One process holds its own variables, so the skill's "shell state does not
 * survive between calls" workarounds are deliberately NOT ported: no fixed
 * .work dir, no re-derived VID. The hard-won yt-dlp details ARE ported.
 */

/* Core */
import { execFileSync } from 'node:child_process';
import {
    existsSync,
    mkdirSync,
    readdirSync,
    renameSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import {
    CLAUDE_HOME,
    readOrNull,
    run,
    sizeLabel,
    statOrNull,
    text,
} from './shared.js';

const TRANSCRIPT_DIR = join(homedir(), '.claude', 'shelf', 'yt-transcripts');
const TRANSCRIPT_SCRIPTS = join(
    CLAUDE_HOME,
    'plugin-x',
    'skills',
    'yt-transcript',
    'scripts',
);

export function registerTranscriptTools(server: McpServer) {
    server.registerTool(
        'yt_transcript_fetch',
        {
            description:
                'YOUTUBE VIDEOS — THE DEFAULT ONE. Download the spoken words of a YouTube video and return them as text. ' +
                'Use whenever the user shares a youtube.com or youtu.be link and wants what was said in it — summarising a talk, quoting it, answering questions about it, or pulling it into the conversation. ' +
                'Use this unless the user explicitly asks not to keep the video; a plain request for a transcript means this tool, not yt_transcript_transit. ' +
                'Prefer this over running yt-dlp yourself: it writes to the shared shelf on the mac, so cc and cloud-chat see the same transcripts, it dedupes against what is already there, and the file still exists tomorrow. ' +
                'Nothing to do with session handoffs or CSTs.',
            inputSchema: {
                url: z.string().describe('The YouTube video url'),
            },
            title: 'Download a YouTube transcript',
        },
        async ({ url }) => transcriptRun(url, false),
    );

    server.registerTool(
        'yt_transcript_transit',
        {
            description:
                'YOUTUBE VIDEOS — THE EXCEPTION, NOT THE DEFAULT. Download the spoken words of a YouTube video, return them as text, then delete the files immediately. ' +
                'ONLY use this when the user says so — "do not keep it", "just read it to me", "throw it away after". A plain "get me the transcript" is NOT this tool: use yt_transcript_fetch. ' +
                'The user picks videos he already judged worth keeping, so keeping is the norm; discarding by default would leave yt_transcript_recall with nothing to recall. ' +
                'Safe when it is asked for: captions re-download in seconds, so nothing is lost. Nothing to do with session handoffs or CSTs.',
            inputSchema: {
                url: z.string().describe('The YouTube video url'),
            },
            title: 'Transcript, read and discard',
        },
        async ({ url }) => transcriptRun(url, true),
    );

    server.registerTool(
        'yt_transcript_recall',
        {
            description:
                'YOUTUBE VIDEOS. Read the words of a YouTube video already downloaded, found by a word from its title, its channel name, or its YouTube video id. ' +
                'Read-only: downloads nothing and deletes nothing. Use when the user refers back to a video fetched earlier, in this conversation or another one. ' +
                'Nothing to do with session handoffs or CSTs.',
            inputSchema: {
                query: z
                    .string()
                    .describe(
                        'A word from the title or channel, or the YouTube video id',
                    ),
            },
            title: 'Recall a stored transcript',
        },
        async ({ query }) => {
            const hits = transcriptDirs().filter((name) =>
                name.toLowerCase().includes(query.toLowerCase()),
            );
            if (hits.length === 0)
                return text(
                    `Nothing on the shelf matches "${query}". ${transcriptDirs().length} transcript(s) stored; call yt_transcript_list to see them, or yt_transcript_fetch to download a new one.`,
                );
            if (hits.length > 1)
                return text(
                    `Several match "${query}" — ask which:\n${hits.map((h) => `- ${h}`).join('\n')}`,
                );

            const dir = join(TRANSCRIPT_DIR, hits[0]);
            const body = readOrNull(join(dir, 'transcript.txt'));
            if (body === null)
                return text(
                    `${hits[0]} exists but has no transcript.txt — an incomplete fetch. Re-run yt_transcript_fetch on its url.`,
                );
            return text(
                `${transcriptHeader(dir, hits[0])}\nRead only — nothing was downloaded or deleted.\n\n${body}`,
            );
        },
    );

    server.registerTool(
        'yt_transcript_list',
        {
            description:
                'YOUTUBE VIDEOS. List the YouTube videos already downloaded as text — channel, title and size per entry. ' +
                'Read-only. Use when the user asks which videos have been transcribed, or before fetching one that may already be stored. ' +
                'Nothing to do with session handoffs or CSTs.',
            inputSchema: {},
            title: 'List stored transcripts',
        },
        async () => {
            const dirs = transcriptDirs();
            if (dirs.length === 0)
                return text(
                    'No transcripts on the shelf yet. yt_transcript_fetch downloads one from a YouTube url.',
                );
            const rows = dirs.map((name) => {
                const meta = transcriptMeta(join(TRANSCRIPT_DIR, name));
                const size = statOrNull(
                    join(TRANSCRIPT_DIR, name, 'transcript.txt'),
                );
                return `- ${meta?.channel ?? 'unknown channel'} — ${meta?.title ?? name} (${size ? sizeLabel(size.size) : 'no transcript.txt'})\n  dir: ${name}`;
            });
            return text(
                `${dirs.length} transcript(s) on the shelf. Nothing read into this thread.\n\n${rows.join('\n')}`,
            );
        },
    );
}

/* Helpers */
type TranscriptMeta = {
    channel?: string;
    duration_seconds?: number;
    title?: string;
    url?: string;
    video_id?: string;
};

function transcriptDirs(): string[] {
    if (!existsSync(TRANSCRIPT_DIR)) return [];
    return readdirSync(TRANSCRIPT_DIR, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
        .map((entry) => entry.name)
        .sort();
}

function transcriptMeta(dir: string): TranscriptMeta | null {
    const raw = readOrNull(join(dir, 'metadata.json'));
    if (raw === null) return null;
    try {
        return JSON.parse(raw) as TranscriptMeta;
    } catch {
        return null;
    }
}

function transcriptHeader(dir: string, name: string) {
    const meta = transcriptMeta(dir);
    const size = statOrNull(join(dir, 'transcript.txt'));
    const minutes = meta?.duration_seconds
        ? `${Math.round(meta.duration_seconds / 60)} min`
        : 'unknown length';
    return [
        `${meta?.title ?? name}`,
        `channel: ${meta?.channel ?? 'unknown'} · ${minutes} · ${size ? sizeLabel(size.size) : 'unknown size'}`,
        `source: ${meta?.url ?? 'unknown url'}`,
    ].join('\n');
}

/** One code, never a pattern: a pattern makes yt-dlp fetch many tracks and YouTube answers 429. */
function pickLang(info: {
    automatic_captions?: Record<string, unknown>;
    subtitles?: Record<string, unknown>;
}) {
    const manual = Object.keys(info.subtitles ?? {});
    if (manual.length > 0) return manual.includes('en') ? 'en' : manual[0];
    const auto = Object.keys(info.automatic_captions ?? {});
    const orig = auto.find((key) => key.endsWith('-orig'));
    if (orig) return orig;
    return auto.includes('en') ? 'en' : (auto[0] ?? null);
}

async function transcriptRun(url: string, transit: boolean) {
    for (const binary of ['yt-dlp', 'python3']) {
        try {
            execFileSync('which', [binary], { stdio: 'ignore' });
        } catch {
            return text(
                `\`${binary}\` is not on PATH, so no transcript can be produced. Tell the user; do not retry.`,
            );
        }
    }

    const raw = run('yt-dlp', ['-J', '--skip-download', url]);
    let info: {
        automatic_captions?: Record<string, unknown>;
        channel?: string;
        duration?: number;
        id?: string;
        subtitles?: Record<string, unknown>;
        title?: string;
        upload_date?: string;
        uploader?: string;
    };
    try {
        info = JSON.parse(raw);
    } catch {
        return text(
            `yt-dlp returned no usable metadata for ${url}. The url may be wrong, private, or region-blocked. Tell the user; do not retry.`,
        );
    }
    if (!info.id)
        return text(`No video id came back for ${url} — nothing to fetch.`);

    // Anchored on the trailing id: the id is always the tail after a hyphen, so
    // this can only ever hit the same video. An unanchored test would match a
    // slug that merely contains those letters.
    const existing = transcriptDirs().find((name) =>
        name.endsWith(`-${info.id}`),
    );
    if (existing && !transit) {
        const dir = join(TRANSCRIPT_DIR, existing);
        const body = readOrNull(join(dir, 'transcript.txt'));
        if (body !== null)
            return text(
                `${transcriptHeader(dir, existing)}\nAlready on the shelf — reused, nothing downloaded.\n\n${body}`,
            );
    }

    const lang = pickLang(info);
    if (!lang)
        return text(
            `"${info.title ?? url}" has no captions in any language. Only the whisper tier could transcribe it, and that is not built. Tell the user.`,
        );

    const channel = info.channel ?? info.uploader ?? '';
    // Built and checked separately: an inlined failure would leave the path at
    // the store root and download into it.
    const name = run('python3', [
        join(TRANSCRIPT_SCRIPTS, 'sanitize_title.py'),
        channel,
        info.title ?? '',
        info.id,
    ]).trim();
    if (!name || name.includes('/'))
        return text(
            `Could not build a safe directory name for "${info.title ?? url}". Nothing was written.`,
        );

    const dir = join(TRANSCRIPT_DIR, name);
    mkdirSync(dir, { recursive: true });
    // Both flags: manual and auto captions are separate, and a video can have
    // one without the other.
    run(
        'yt-dlp',
        [
            '--skip-download',
            '--write-subs',
            '--write-auto-subs',
            '--sub-langs',
            lang,
            '--sub-format',
            'vtt',
            '-o',
            'captions',
            url,
        ],
        dir,
    );

    const vtt = readdirSync(dir).find(
        (file) => file.startsWith('captions.') && file.endsWith('.vtt'),
    );
    if (!vtt) {
        if (transcriptDirs().includes(name)) rmSync(dir, { recursive: true });
        return text(
            `The caption download produced no file for "${info.title ?? url}" (language ${lang}). Nothing was kept. Tell the user; do not retry the same language.`,
        );
    }
    renameSync(join(dir, vtt), join(dir, 'captions.vtt'));
    // The cleaner also repairs mangled filenames, and it reads its vocabulary from
    // the video's own title/description/chapters/tags. Handing it the raw -J dump
    // keeps that algorithm in one place instead of restating it in TypeScript.
    const dump = join(dir, '.ytdlp.json');
    writeFileSync(dump, raw);
    run(
        'python3',
        [
            join(TRANSCRIPT_SCRIPTS, 'clean_captions.py'),
            'captions.vtt',
            'transcript.txt',
            dump,
        ],
        dir,
    );
    rmSync(dump, { force: true });

    const body = readOrNull(join(dir, 'transcript.txt'));
    if (body === null) {
        rmSync(dir, { recursive: true });
        return text(
            `Captions downloaded but cleaning produced nothing for "${info.title ?? url}". Nothing was kept.`,
        );
    }

    writeFileSync(
        join(dir, 'metadata.json'),
        `${JSON.stringify(
            {
                caption_lang: lang,
                channel: channel || null,
                duration_seconds: info.duration ?? null,
                fetched_at: new Date().toISOString(),
                source: 'captions',
                title: info.title ?? null,
                upload_date: info.upload_date ?? null,
                url,
                video_id: info.id,
            },
            null,
            2,
        )}\n`,
    );

    const header = transcriptHeader(dir, name);
    if (transit) {
        rmSync(dir, { recursive: true });
        return text(
            `${header}\nTransit — the files were deleted after reading. Captions re-download in seconds if it is wanted again.\n\n${body}`,
        );
    }
    return text(`${header}\nKept on the shelf as \`${name}\`.\n\n${body}`);
}
