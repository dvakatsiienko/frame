// commit-msg hook: an agent's commit gets `Agent: <role> · <model>`, written here so no model has to.
// why a hook: `attribution.commit: ""` in ~/.claude/settings.json strips claude code's own byline
// (a generic `Co-Authored-By: Claude`, no role, no exact model version), and claude code reads that
// same setting as «write no attribution lines» for every model — so the fingerprint dima keeps
// (`git log --grep='^Agent:'`, his commits vs ours) is stamped by repo config instead (dima, 2026-10-15)
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

import { modelFor, roleFor, trailerAdd } from './lib/agent-trailer.ts';

const file = process.argv[2];
if (file && process.env.CLAUDECODE === '1') {
    const role = roleFor(sessionName());
    const model = modelFor(modelId());
    writeFileSync(file, trailerAdd(readFileSync(file, 'utf8'), role, model));
}

function sessionName() {
    const registry = path.join(
        homedir(),
        '.claude/sessions',
        `${process.env.CLAUDE_PID}.json`,
    );
    if (!existsSync(registry)) return 'agent';
    return (
        (JSON.parse(readFileSync(registry, 'utf8')).name as
            | string
            | undefined) ?? 'agent'
    );
}

function modelId() {
    const id = process.env.CLAUDE_CODE_SESSION_ID;
    const projects = path.join(homedir(), '.claude/projects');
    const transcript = readdirSync(projects)
        .map((dir) => path.join(projects, dir, `${id}.jsonl`))
        .find((candidate) => existsSync(candidate));
    if (!(id && transcript)) return 'unknown model';
    const tail = readFileSync(transcript, 'utf8').slice(-400_000);
    const ids = [...tail.matchAll(/"model":"(claude-[a-z0-9-]+)"/g)];
    return ids.at(-1)?.[1] ?? 'unknown model';
}
