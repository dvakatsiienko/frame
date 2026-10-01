// archives closed tickets (done, canceled, duplicate) untouched for N days, as the cclio app.
// linear's own auto-archive never fires for us: it waits for the PROJECT to close, and our projects
// never close. the free plan caps non-archived tickets at 250, closed ones included.
// usage: pnpm linear:archive [days=14]
import { execFileSync } from 'node:child_process';

const days = Number(process.argv[2] ?? 14);
const token = execFileSync('node', [
    new URL('./linear-agent-token.ts', import.meta.url).pathname,
])
    .toString()
    .trim();

const gql = async <T>(
    query: string,
    variables: Record<string, unknown> = {},
): Promise<T> => {
    const response = await fetch('https://api.linear.app/graphql', {
        body: JSON.stringify({ query, variables }),
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        method: 'POST',
    });
    const json = (await response.json()) as { data: T; errors?: unknown };
    if (json.errors) throw new Error(JSON.stringify(json.errors));
    return json.data;
};

const { issues } = await gql<IssuesQuery>(
    `query($age: DateTimeOrDuration!) { issues(first: 250, filter: { state: { type: { in: ["completed", "canceled"] } }, updatedAt: { lt: $age } }) { nodes { id identifier } pageInfo { hasNextPage } } }`,
    { age: `-P${days}D` },
);

const failed: string[] = [];
for (const issue of issues.nodes) {
    const { issueArchive } = await gql<{ issueArchive: { success: boolean } }>(
        'mutation($id: String!) { issueArchive(id: $id) { success } }',
        { id: issue.id },
    );
    if (!issueArchive.success) failed.push(issue.identifier);
}

console.log(
    `archived ${issues.nodes.length - failed.length} of ${issues.nodes.length} closed tickets older than ${days} d${issues.pageInfo.hasNextPage ? ' (more remain, run again)' : ''}`,
);
if (failed.length) {
    console.error(`failed: ${failed.join(' ')}`);
    process.exit(1);
}

/* Types */

interface IssuesQuery {
    issues: {
        nodes: { id: string; identifier: string }[];
        pageInfo: { hasNextPage: boolean };
    };
}
