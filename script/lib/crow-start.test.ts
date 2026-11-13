import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

import {
    SESSION_NAME,
    claudeArgs,
} from '../../home/.claude/plugin-x/skills/crew-adviser/scripts/lib.ts';

// x brief summon refuses a -n that is not the display x draws for the role, so crow's pane start must pass this one
test("crow's name is the display x draws for the adviser role", () => {
    const roles = JSON.parse(
        readFileSync(
            join(import.meta.dirname, '../../x/go/roles.json'),
            'utf8',
        ),
    ) as { id: string; display?: string }[];

    expect(SESSION_NAME).toBe(
        roles.find((role) => role.id === 'adviser')?.display,
    );
});

// crow builds its own claude line, past x brief summon's argv: its settings carry the same suggestion switch
test("crow's own claude settings switch prompt suggestions off", () => {
    const args = claudeArgs('opus');
    const settings = JSON.parse(args[args.indexOf('--settings') + 1] ?? '{}');

    expect(settings.promptSuggestionEnabled).toBe(false);
});
