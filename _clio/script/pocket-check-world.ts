import { checkPocket } from './pocket-check.ts';

export const config = [
    'statuses: ["open", "claimed", "waiting", "done"]',
    'labels: ["xs", "s", "m", "l"]',
    'priorities: ["now", "next", "later"]',
    'types: ["task", "idea"]',
].join('\n');

export const today = '2026-10-09';

export function task(
    fields: Record<string, string | string[]>,
    description = 'body',
) {
    const rows = Object.entries({
        id: 'PK-1',
        labels: ['m'],
        ordinal: '10000',
        priority: 'next',
        status: 'open',
        type: 'task',
        updated_date: '2026-10-09 10:00',
        ...fields,
    }).map(([key, value]) =>
        Array.isArray(value)
            ? `${key}:\n${value.map((item) => `  - ${item}`).join('\n')}`
            : `${key}: '${value}'`,
    );
    return {
        name: 'pk-1.md',
        text: `---\n${rows.join('\n')}\n---\n\n## Description\n\n<!-- SECTION:DESCRIPTION:BEGIN -->\n${description}\n`,
    };
}

export const flyway = (
    fields: Record<string, string | string[]>,
    body = 'body',
) =>
    checkPocket(
        config,
        [
            task(
                {
                    labels: ['m', 'clio-wing-1'],
                    ordinal: '1001',
                    priority: 'now',
                    title: 'flyway: wing 1',
                    ...fields,
                },
                body,
            ),
        ],
        today,
    ).join('\n');
