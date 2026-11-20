// the research log (FRM-675): one dated entry per one-off research, kept after its research doc dies
// usage: node research-log.ts prior <brief>   print the newest entries sharing the brief's topics, as «what we knew»
//        node research-log.ts stub <brief>    write today's entry stub, print its path
//        node research-log.ts check           exit 1 on an entry still pending from an earlier day
import {
    existsSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    writeFileSync,
} from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const logDir =
    process.env.RESEARCH_LOG_DIR ??
    join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'research-log');
const today = new Date().toLocaleDateString('sv-SE');

const [verb, briefPath] = process.argv.slice(2);
switch (verb) {
    case 'prior':
        printPrior(readBrief(briefPath));
        break;
    case 'stub':
        console.log(writeStub(readBrief(briefPath)));
        break;
    case 'check':
        process.exit(checkPending());
        break;
    default:
        fail('usage: research-log.ts prior <brief> | stub <brief> | check');
}

function fail(message: string): never {
    console.error(`research-log: ${message}`);
    process.exit(2);
}

function readBrief(path: string | undefined): Brief {
    if (path === undefined || !existsSync(path))
        fail(`no brief at ${path ?? '(none)'}`);
    const text = readFileSync(path, 'utf8');
    const topics = splitList(text.match(/^topics:\s*(.+)$/m)?.[1]);
    if (topics.length === 0)
        fail(
            `${path} has no «topics:» line; name the topics the log files it under`,
        );
    return {
        query: text.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? basename(path),
        topics,
        wish: text.match(/^wish:\s*(.+)$/m)?.[1]?.trim() ?? 'none',
    };
}

function splitList(value: string | undefined) {
    return (value ?? '')
        .split(',')
        .map((topic) => topic.trim().toLowerCase())
        .filter((topic) => topic !== '');
}

function readEntries(): Entry[] {
    if (!existsSync(logDir)) return [];
    return readdirSync(logDir)
        .filter((file) => /^\d{4}-\d{2}-\d{2}-.+\.md$/.test(file))
        .sort()
        .map((file) => {
            const text = readFileSync(join(logDir, file), 'utf8');
            const front = text.match(/^---\n([\s\S]*?)\n---\n?/);
            const field = (key: string) =>
                (front?.[1] ?? '')
                    .match(new RegExp(`^${key}:\\s*(.*)$`, 'm'))?.[1]
                    ?.trim() ?? '';
            return {
                body: text.slice(front?.[0].length ?? 0).trim(),
                date: file.slice(0, 10),
                file,
                follows: field('follows'),
                topics: splitList(field('topics')),
                verdict: field('verdict'),
            };
        });
}

// the newest entry of each chain on the brief's topics: an entry a later one follows is history, read on demand
function newestOnTopics(topics: string[]) {
    const entries = readEntries().filter((entry) =>
        entry.topics.some((topic) => topics.includes(topic)),
    );
    const followed = new Set(entries.map((entry) => entry.follows));
    return entries.filter((entry) => !followed.has(entry.file));
}

function printPrior(brief: Brief) {
    const newest = newestOnTopics(brief.topics);
    if (newest.length === 0) return;
    console.log('\n## what we knew — the research log\n');
    for (const entry of newest)
        console.log(
            `### ${entry.file} (${entry.date}, verdict: ${entry.verdict})\n\n${entry.body}\n`,
        );
}

function writeStub(brief: Brief) {
    mkdirSync(logDir, { recursive: true });
    const [firstTopic = 'research'] = brief.topics;
    const stem = `${today}-${firstTopic.replace(/[^a-z0-9]+/g, '-')}`;
    let file = `${stem}.md`;
    for (let n = 2; existsSync(join(logDir, file)); n += 1)
        file = `${stem}-${n}.md`;
    const follows = newestOnTopics(brief.topics).at(-1)?.file ?? 'none';
    const text = [
        '---',
        `date: ${today}`,
        `query: ${brief.query}`,
        `wish: ${brief.wish}`,
        `topics: ${brief.topics.join(', ')}`,
        'verdict: pending',
        'look-again-when:',
        `follows: ${follows}`,
        '---',
        '',
        '<!-- the summary, ~20 lines with the key links, written the day the research lands -->',
        '',
    ].join('\n');
    writeFileSync(join(logDir, file), text);
    return join(logDir, file);
}

// a stub left pending past its day is a research whose summary never landed
function checkPending() {
    const stale = readEntries().filter(
        (entry) => entry.verdict === 'pending' && entry.date < today,
    );
    for (const entry of stale)
        console.error(
            `research-log: ${entry.file} is still pending: write its summary and verdict first`,
        );
    return stale.length === 0 ? 0 : 1;
}

/* Types */

interface Brief {
    query: string;
    topics: string[];
    wish: string;
}

interface Entry {
    body: string;
    date: string;
    file: string;
    follows: string;
    topics: string[];
    verdict: string;
}
