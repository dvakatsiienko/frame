// fresh-eyes' PreToolUse hook (its card's frontmatter): the card may run the app and read its own shots, never the code
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

export const shotsDir = path.join(homedir(), 'frame/.scratch/fresh-eyes/shots');

const sourceHints = [
    'file:',
    'view-source:',
    '--allow-file-access',
    '.map',
    '/src/',
    '/@fs/',
    '/@vite/',
    '/node_modules/',
];

export function verdict(
    tool: string,
    input: { command?: string; file_path?: string },
    shots = shotsDir,
) {
    if (tool === 'Read') {
        const target = path.resolve(input.file_path ?? '');
        return target.startsWith(`${shots}${path.sep}`)
            ? undefined
            : `fresh-eyes reads only its own screenshots, under ${shots}`;
    }
    if (tool !== 'Bash') return `fresh-eyes has no ${tool}: it only runs the app`;
    const command = (input.command ?? '').trim();
    if (/[;&|`$<>\n]/.test(command))
        return 'fresh-eyes runs one call at a time, no chaining or redirection';
    if (/^x(\s|$)/.test(command)) {
        const isHelpRead =
            /^x(\s+[a-z-]+)?$/.test(command) ||
            /^x\s+schema(\s+[a-z-]+)?$/.test(command) ||
            /^x(\s+[a-z-]+){1,3}\s+--help$/.test(command);
        return isHelpRead
            ? undefined
            : 'fresh-eyes reads the x cli only through bare x, x <family>, x schema or --help';
    }
    if (!/^agent-browser\s/.test(command))
        return 'fresh-eyes runs only agent-browser or the x cli help';
    if (/\seval\s/.test(` ${command} `))
        return 'fresh-eyes never runs page javascript (eval)';
    const hint = sourceHints.find((h) => command.includes(h));
    if (hint) return `fresh-eyes never opens source: «${hint}»`;
    for (const [url] of command.matchAll(/[a-z][a-z0-9+.-]*:\/\/\S+/gi)) {
        const host = URL.parse(url)?.hostname;
        if (host !== 'localhost' && host !== '127.0.0.1')
            return `fresh-eyes opens only the local build, not ${url}`;
    }
    return undefined;
}

if (import.meta.main) {
    const { tool_name: tool, tool_input: input } = JSON.parse(
        readFileSync(0, 'utf8'),
    ) as { tool_name: string; tool_input: { command?: string; file_path?: string } };
    const reason = verdict(tool, input);
    if (reason) {
        console.log(
            JSON.stringify({
                hookSpecificOutput: {
                    hookEventName: 'PreToolUse',
                    permissionDecision: 'deny',
                    permissionDecisionReason: reason,
                },
            }),
        );
    }
}
