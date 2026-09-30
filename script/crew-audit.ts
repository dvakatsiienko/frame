/**
 * crew:audit — did each coder read its lessons file before its first edit, and again after
 * every compaction? The transcript is the proof; a coder's own «i read it» is not.
 *
 *   pnpm crew:audit            coder sessions touched in the last day
 *   pnpm crew:audit --days 7   a wider window
 *
 * One line per coder session (started with /x:crew-coder): its id, its cwd, when it first read
 * how-you-work.md, when it first edited, per compaction whether a re-read followed, and how many
 * library-docs lookups it made (ctx7, the context7 mcp, web search or fetch).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
    options: { days: { default: '1', type: 'string' } },
});
const since = Date.now() - Number(values.days) * 86_400_000;
const root = join(homedir(), '.claude/projects');
const lessons = 'crew-coder/how-you-work.md';
const editTools = new Set(['Edit', 'Write', 'NotebookEdit', 'MultiEdit']);
const editBins = /\b(edit-anchored|edit-batch)\b/;

type Block = {
    type: string;
    name?: string;
    input?: { file_path?: string; command?: string };
};
type Line = {
    type?: string;
    subtype?: string;
    timestamp?: string;
    cwd?: string;
    message?: { content?: unknown };
};

const transcripts = readdirSync(root).flatMap((dir) =>
    readdirSync(join(root, dir))
        .filter((file) => file.endsWith('.jsonl'))
        .map((file) => join(root, dir, file))
        .filter((file) => statSync(file).mtimeMs >= since),
);

let coders = 0;
for (const file of transcripts) {
    const text = readFileSync(file, 'utf8');
    // a coder's opening prompt is the command; a later mention (cclio talking about it) is not a coder
    const opening =
        text.split('\n', 40).find((raw) => raw.includes('"type":"user"')) ?? '';
    if (!opening.includes('<command-name>/x:crew-coder</command-name>'))
        continue;
    coders++;

    let cwd = '';
    let firstRead: string | undefined;
    let firstEdit: string | undefined;
    const compacts: { at: string; reread: boolean }[] = [];
    const docs = { ctx7: 0, mcp: 0, web: 0 };

    for (const raw of text.split('\n')) {
        if (!raw) continue;
        const line: Line = JSON.parse(raw);
        const at = line.timestamp?.slice(11, 19) ?? '?';
        cwd ||= line.cwd ?? '';
        if (line.subtype === 'compact_boundary')
            compacts.push({ at, reread: false });
        const content = line.message?.content;
        if (!Array.isArray(content)) continue;
        for (const block of content as Block[]) {
            if (block.type !== 'tool_use') continue;
            const target = `${block.input?.file_path ?? ''} ${block.input?.command ?? ''}`;
            if (target.includes(lessons)) {
                firstRead ??= at;
                const last = compacts.at(-1);
                if (last) last.reread = true;
            }
            const isEdit =
                editTools.has(block.name ?? '') ||
                (block.name === 'Bash' && editBins.test(target));
            if (isEdit) firstEdit ??= at;
            if (block.name === 'Bash' && /\bctx7\b/.test(target)) docs.ctx7++;
            if (block.name?.startsWith('mcp__plugin_context7')) docs.mcp++;
            if (block.name === 'WebSearch' || block.name === 'WebFetch')
                docs.web++;
        }
    }

    const inOrder = firstRead && (!firstEdit || firstRead <= firstEdit);
    const compactLine = compacts
        .map((c) => `${c.reread ? '✅' : '🚫'} compact ${c.at}`)
        .join(', ');
    console.log(
        `${inOrder ? '✅' : '🚫'} ${file.split('/').at(-1)?.slice(0, 8)} ${cwd.replace(homedir(), '~')} · read ${firstRead ?? 'never'} · first edit ${firstEdit ?? 'none'} · docs ctx7 ${docs.ctx7} mcp ${docs.mcp} web ${docs.web}${compactLine ? ` · ${compactLine}` : ''}`,
    );
}
console.log(`crew:audit — ${coders} coder session(s) in ${values.days} day(s)`);
