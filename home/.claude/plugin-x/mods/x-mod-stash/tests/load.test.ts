import { expect, test } from 'claude-code/testing';

import { registered, start, world } from './orbit-world.ts';

// the hook entry loads the way cc loads it and its start registers the orbit tool and /board, so a split of
// register.tsx that loses a module or throws at load turns this red first (FRM-662 exit 2)
test('a session start registers the orbit tool and the /board command', async ($, on) => {
    const commands: string[] = [];
    on('command.register', (_$, e) => {
        commands.push(e.name);
        return { value: { command: e.name } };
    });
    world(on);
    await start($);
    expect([registered.described.startsWith('orbit:'), commands]).toEqual([
        true,
        expect.arrayContaining(['board']),
    ]);
});
