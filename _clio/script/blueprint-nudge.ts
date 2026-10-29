// PostToolUse hook: an edit of a file a mapped board draws names that board, once per board per session
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

import { boardMaps, frame, mappedBoards } from './blueprint-drift.ts';

const event = JSON.parse(readFileSync(0, 'utf8')) as {
    session_id?: string;
    tool_input?: { file_path?: string };
};
const abs = event.tool_input?.file_path ?? '';
// ~/.claude and ~/frame/home/.claude are one tree through the mirror symlink
const real = abs.replace(
    path.join(homedir(), '.claude/'),
    path.join(frame, 'home/.claude/'),
);
const file = path.relative(frame, real);
if (!abs || file.startsWith('..')) process.exit(0);

const stateDir = path.join(homedir(), '.local/state/clio/blueprint-nudge');
const hits = mappedBoards().filter((board) => {
    if (!boardMaps(board.sources, file)) return false;
    const mark = path.join(
        stateDir,
        `${event.session_id ?? 'none'}-${board.url.split('/').pop()}`,
    );
    if (existsSync(mark)) return false;
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(mark, file);
    return true;
});
if (hits.length === 0) process.exit(0);

const boards = hits.map((b) => `${b.name} (${b.url})`).join('; ');
console.log(
    JSON.stringify({
        hookSpecificOutput: {
            additionalContext: `🗺️ ${file} is drawn on the blueprint ${boards}. the board is our main flow reference: put «update the board» in your phases now, and redraw it once this change's steers and tweaks land — never skip it (dima, 2026-10-22, PK-103 W94–W96).`,
            hookEventName: 'PostToolUse',
        },
    }),
);
