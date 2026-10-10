import { readFileSync, rmSync } from 'node:fs';

import { RELAY_PATH, type Wake, spawnHarvest } from './lib.ts';

// a cclio UserPromptSubmit hook: a wake parked for a desktop-tab ccrow reaches cclio's next turn as context
let parked: (Wake & { line: string; model?: string }) | undefined;
try {
    parked = JSON.parse(readFileSync(RELAY_PATH, 'utf8'));
} catch {
    process.exit(0);
}
if (!parked) process.exit(0);
rmSync(RELAY_PATH);
spawnHarvest(parked);
console.log(
    JSON.stringify({
        hookSpecificOutput: {
            additionalContext: `🐦‍⬛ ccrow wake due: send this exact line, alone, to the session titled «🐦‍⬛ ccrow» through mcp__ccd_session_mgmt__send_message, in this turn, before anything else; no need to report it to dima unless he asks; never change ccrow's model, a switch mid-session reloads her whole context.\n${parked.line}`,
            hookEventName: 'UserPromptSubmit',
        },
    }),
);
