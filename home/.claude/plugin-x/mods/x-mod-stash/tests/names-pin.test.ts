import { expect, test } from 'claude-code/testing';

import { ticketOf } from '../hooks/parse.ts';
import { isCoordinator, pinOf } from '../hooks/register.tsx';

// S5: who a name is reads through bare(): spaces and zero-width joiners never change it
for (const [name, pin] of [
    ['🦉 clio', 0],
    ['🦉‍clio', 0],
    ['cclio', 0], // read-both: a clio tab under its old title
    ['🐦‍⬛ crow', 1],
    ['🐦‍⬛crow', 1],
    ['scarecrow', 2],
    ['⚡ 🔧 codie: mods lane 4', 2],
] as const)
    test(`${JSON.stringify(name)} pins as ${pin}`, () => {
        expect(pinOf(name)).toBe(pin);
    });

test('a title that only mentions clio is not the coordinator', () => {
    expect(isCoordinator('🔧 codie for clio')).toBe(false);
});

// a session's ticket is a team key's id, never another dashed number in its title
for (const [name, ticket] of [
    ['⚡ 🔧 codie: mods lane 4 | FRM-478', 'FRM-478'],
    ['⚡ 🔧 codie: UTF-8 names | BYT-12', 'BYT-12'],
    ['🔦 sixth sense: SHA-256 check', undefined],
] as const)
    test(`${name} names ticket ${ticket}`, () => {
        expect(ticketOf(name)).toBe(ticket);
    });
