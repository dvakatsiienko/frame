// usage: node agent-born.ts [--team FRM]   the open tickets born without a word of dima's: no W-line of his, a «wish: none» or a «wish: see» line
import { execFileSync } from 'node:child_process';

const team = process.argv.includes('--team')
    ? process.argv[process.argv.indexOf('--team') + 1]
    : 'FRM';
const query = `{ issues(first: 250, filter: {team: {key: {eq: "${team}"}}, state: {type: {nin: ["completed","canceled"]}}}) { pageInfo { hasNextPage } nodes { identifier title description parent { identifier } } } }`;
const reply = JSON.parse(
    execFileSync('x', ['linear', 'api', query], { encoding: 'utf8' }),
);
const issues = (reply.data?.issues ?? reply.data?.data?.issues) as {
    pageInfo: { hasNextPage: boolean };
    nodes: {
        identifier: string;
        title: string;
        description: string | null;
        parent: { identifier: string } | null;
    }[];
};
const hisLine = /:W\d+ \([^)]*dima/;
const born = issues.nodes.filter((n) => !hisLine.test(n.description ?? ''));
for (const n of born)
    console.log(
        `${n.identifier}${n.parent ? ` (under ${n.parent.identifier})` : ''} ${n.title}`,
    );
console.log(
    `${born.length} of ${issues.nodes.length} open ${team} tickets hold no word of dima's${issues.pageInfo.hasNextPage ? ' (capped at 250)' : ''}`,
);
