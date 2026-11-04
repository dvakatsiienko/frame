import {
    existsSync,
    readFileSync,
    readdirSync,
    renameSync,
    unlinkSync,
    writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const DAY_FILE = /^(\d{4}-\d{2}-\d{2})\.jsonl(\.gz)?$/;
const DAY_MS = 86_400_000;
// cc's own default when the setting is absent
const CC_DEFAULT_DAYS = 30;

// the transcripts' retention, read at each run, so otel and the transcripts age out on one setting
export function retentionDays(
    settingsPath = join(homedir(), '.claude/settings.json'),
) {
    try {
        const days = JSON.parse(
            readFileSync(settingsPath, 'utf8'),
        ).cleanupPeriodDays;
        return typeof days === 'number' && days > 0 ? days : CC_DEFAULT_DAYS;
    } catch {
        return undefined;
    }
}

export function housekeep(
    dir: string,
    now: Date,
    keepDays: number | undefined,
) {
    const today = now.toISOString().slice(0, 10);
    const report = { deleted: [] as string[], zipped: [] as string[] };
    for (const name of readdirSync(dir)) {
        const match = DAY_FILE.exec(name);
        if (!match?.[1] || match[1] >= today) continue;
        const path = join(dir, name);
        const ageDays = (Date.parse(today) - Date.parse(match[1])) / DAY_MS;
        if (keepDays !== undefined && ageDays > keepDays) {
            unlinkSync(path);
            report.deleted.push(name);
            continue;
        }
        if (match[2] || existsSync(`${path}.gz`)) continue;
        // the rename is the commit: a crash leaves the plain day whole and at most a stray .tmp
        writeFileSync(`${path}.gz.tmp`, gzipSync(readFileSync(path)));
        renameSync(`${path}.gz.tmp`, `${path}.gz`);
        unlinkSync(path);
        report.zipped.push(name);
    }
    return report;
}
