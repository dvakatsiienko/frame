/* Core */
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';

export const FRAME = join(homedir(), 'frame');
export const CLAUDE_HOME = join(FRAME, 'home/.claude');

/**
 * Shelling out and reading files are shared by every tool family here, and the
 * store is shared with cc besides — so a file can vanish between listing it and
 * reading it. That is normal traffic, not an error, and it must never take a
 * tool call down.
 */
export function statOrNull(path: string) {
    try {
        return statSync(path);
    } catch {
        return null;
    }
}

export function readOrNull(path: string) {
    try {
        return readFileSync(path, 'utf8');
    } catch {
        return null;
    }
}

export function sizeLabel(bytes: number) {
    return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} kB`;
}

/**
 * yt-dlp exits non-zero on conditions that still produced the file, so the
 * caller judges success by what landed on disk, never by this exit code.
 */
export function run(command: string, args: string[], cwd?: string) {
    try {
        return execFileSync(command, args, {
            cwd,
            encoding: 'utf8',
            maxBuffer: 64 * 1024 * 1024,
            stdio: ['ignore', 'pipe', 'ignore'],
        });
    } catch (error) {
        const partial = (error as { stdout?: string }).stdout;
        return typeof partial === 'string' ? partial : '';
    }
}

export function text(body: string) {
    return { content: [{ text: body, type: 'text' as const }] };
}

export function promptMessage(body: string) {
    return {
        messages: [
            {
                content: { text: body, type: 'text' as const },
                role: 'user' as const,
            },
        ],
    };
}

export function completableString(description: string) {
    return z.string().optional().describe(description);
}
