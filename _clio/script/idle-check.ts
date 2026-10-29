// on an idle notice: is the member stalled or fine? its last assistant text, its tree, its last commit, one verdict
// usage: node idle-check.ts <registry name or a part of it>
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { liveSessions, transcriptOf } from './session-registry.ts';

const query = process.argv[2] ?? '';
if (!query) fail('usage: node idle-check.ts <registry name or a part of it>');

const matches = liveSessions().filter((s) => s.name?.includes(query));
const [session] = matches;
if (!session || matches.length > 1)
    fail(
        `«${query}» matched ${matches.length} live sessions: ${matches.map((s) => s.name).join(', ') || 'none'}`,
    );

const transcript = transcriptOf(session.sessionId);
const lastText = transcript ? lastAssistantText(transcript) : '';
const tree = git(session.cwd, ['status', '--short']);
const lastCommit = git(session.cwd, ['log', '-1', '--format=%h %cr %s']);

const reasons = [
    /[?⏳]\s*$/.test(lastText) && 'its last text ends on a question or a ⏳',
    tree && `uncommitted changes (${tree.split('\n').length} paths)`,
].filter(Boolean);

console.log(`${session.name} · ${session.cwd}`);
console.log(
    `last text: ${lastText.slice(-300).replace(/\s+/g, ' ') || '(none)'}`,
);
console.log(`last commit: ${lastCommit || '(not a git tree)'}`);
console.log(
    reasons.length
        ? `🟡 stall? ${reasons.join('; ')} — nudge it with the next step`
        : '🟢 fine — clean tree, no open question',
);

function lastAssistantText(path: string): string {
    const lines = readFileSync(path, 'utf8').trim().split('\n').reverse();
    for (const line of lines) {
        const record = JSON.parse(line) as Partial<TranscriptRecord>;
        if (record.type !== 'assistant') continue;
        const text = (record.message?.content ?? [])
            .filter((part) => part.type === 'text')
            .map((part) => part.text)
            .join('\n')
            .trim();
        if (text) return text;
    }
    return '';
}

function git(cwd: string, args: string[]): string {
    try {
        return execFileSync('git', ['-C', cwd, ...args], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
    } catch {
        return '';
    }
}

function fail(message: string): never {
    console.error(message);
    process.exit(1);
}

/* Types */

interface TranscriptRecord {
    type: string;
    message: { content: { type: string; text?: string }[] };
}
