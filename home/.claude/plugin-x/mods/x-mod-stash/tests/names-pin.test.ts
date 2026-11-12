import { expect, test } from 'claude-code/testing';

import { ticketOf } from '../hooks/parse.ts';
import { pinOf } from '../hooks/register.tsx';

// FRM-579: the pin reads a thread's role from its record, so a name, an old title or a joiner never moves it
for (const [role, pin] of [
    ['coordinator', 0],
    ['adviser', 1],
    ['wing', 2],
    ['codie', 2],
    [undefined, 2],
] as const)
    test(`the role ${role} pins as ${pin}`, () => {
        expect(pinOf(role)).toBe(pin);
    });

// a session's ticket is a team key's id, never another dashed number in its title
for (const [name, ticket] of [
    ['⚡ 🔧 codie: mods lane 4 | FRM-478', 'FRM-478'],
    ['⚡ 🔧 codie: UTF-8 names | BYT-12', 'BYT-12'],
    ['🔎 sixth sense: SHA-256 check', undefined],
] as const)
    test(`${name} names ticket ${ticket}`, () => {
        expect(ticketOf(name)).toBe(ticket);
    });
