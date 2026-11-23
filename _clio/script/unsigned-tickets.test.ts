import { describe, expect, test } from 'vitest';

import { type Ticket, unsignedTickets } from './unsigned-tickets.ts';

const ticket = (
    id: string,
    description: string,
    over: Partial<Ticket> = {},
): Ticket => ({
    description,
    id,
    labels: [],
    state: 'Todo',
    title: `title of ${id}`,
    ...over,
});
const signedBody =
    '## wish\n\nx\n\n## signed\n\n✍️ signed 2026-11-23 · body abc';
const redIds = (tickets: Ticket[]) =>
    unsignedTickets(tickets).red.map((t) => t.id);

describe('unsignedTickets', () => {
    test('a signed block with a signed or re-signed line is no red', () => {
        const reSigned =
            '## signed\n\n✍️ signed 2026-11-20 · body a\n✍️ re-signed 2026-11-23 · body b';
        expect(
            redIds([ticket('FRM-1', signedBody), ticket('FRM-2', reSigned)]),
        ).toEqual([]);
    });

    test('a body with no signed block, or a sign line outside it, is red', () => {
        const outside =
            '✍️ signed 2026-11-23\n\n## signed\n\nnothing yet\n\n## out\n\n✍️ signed 2026-11-23';
        expect(
            redIds([ticket('FRM-1', '## wish\n\nx'), ticket('FRM-2', outside)]),
        ).toEqual(['FRM-1', 'FRM-2']);
    });

    test('Triage, Backlog, Done and Canceled are not checked', () => {
        const states = ['Triage', 'Backlog', 'Done', 'Canceled'];
        expect(
            redIds(states.map((state, i) => ticket(`FRM-${i}`, '', { state }))),
        ).toEqual([]);
    });

    test('In Progress is checked', () => {
        expect(redIds([ticket('BYT-1', '', { state: 'In Progress' })])).toEqual(
            ['BYT-1'],
        );
    });

    test.each(['standing', 'someday', 'snoozed', 'human'])(
        'a %s ticket is skipped',
        (label) => {
            expect(
                redIds([ticket('FRM-1', '', { labels: ['agent', label] })]),
            ).toEqual([]);
        },
    );

    test('a grill postponed line moves the ticket from red to postponed', () => {
        const { postponed, red } = unsignedTickets([
            ticket('FRM-1', '## wish\n\n⏸️ grill postponed 2026-11-23 — dima'),
            ticket('FRM-2', 'plain'),
        ]);
        expect(postponed.map((t) => t.id)).toEqual(['FRM-1']);
        expect(red.map((t) => t.id)).toEqual(['FRM-2']);
    });

    test('a postponed mark does not cover a ticket that started work', () => {
        const marked = '⏸️ grill postponed 2026-11-23 — dima';
        expect(
            redIds([ticket('FRM-1', marked, { state: 'In Progress' })]),
        ).toEqual(['FRM-1']);
    });
});
