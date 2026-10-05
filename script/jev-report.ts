/**
 * jev:report — how jev did today, one block per flow (`script/lib/jev-report.ts` renders). the halt
 * prints it right after the flush verdicts; `/cclio:report` on «how did jev do». `--health` prints
 * only the health facts and exits non-zero on a failure — the boot digest's jev check.
 */

/* Core */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* Instruments */
import { JevBudgetError, judge } from './lib/jev.ts';
import { inboxQuestions } from './lib/jev-questions.ts';
import {
    isRouterOff,
    latencyStats,
    reportLines,
    routeRead,
    routerHealth,
    runsRead,
    verdictsRead,
} from './lib/jev-report.ts';
import { VET_DIR, registryRead } from './lib/jev-vet.ts';

const today = new Date().toISOString().slice(0, 10);

// one fixture line through the live api: key present, api answering, the lane still right
const probe = async () => {
    const key = Boolean(process.env.TYPESAFE_API_KEY);
    if (!key)
        return {
            api: false,
            fixture: false,
            key,
            why: 'TYPESAFE_API_KEY missing',
        };
    const first =
        readFileSync(
            join(VET_DIR, 'fixtures', 'inbox-lanes.jsonl'),
            'utf8',
        ).split('\n')[0] ?? '';
    const fx = JSON.parse(first) as {
        state: Record<string, string>;
        expect: string;
    };
    try {
        const res = await judge(fx.state, inboxQuestions);
        const fixture = res.answers.lane.choice === fx.expect;
        return {
            api: true,
            fixture,
            key,
            why: fixture
                ? ''
                : `fixture laned ${res.answers.lane.choice}, want ${fx.expect}`,
        };
    } catch (e) {
        if (e instanceof JevBudgetError)
            return {
                api: false,
                budget: e.message,
                fixture: false,
                key,
                why: e.message,
            };
        return {
            api: false,
            fixture: false,
            key,
            why: e instanceof Error ? e.message : String(e),
        };
    }
};

const router = routerHealth(isRouterOff(), latencyStats(routeRead(today)));
const health = { ...(await probe()), router };
if (process.argv.includes('--health')) {
    // a spent budget is a known state until the 18th, not a broken api
    const isOk =
        Boolean(health.budget) || (health.api && health.key && health.fixture);
    console.log(
        health.budget
            ? `${health.budget} (api not probed), ${router}`
            : isOk
              ? `api ok, key ok, fixture probe ok, ${router}`
              : health.why,
    );
    process.exit(isOk ? 0 : 1);
}

const registry = registryRead();
for (const line of reportLines(
    registry,
    runsRead(today),
    verdictsRead(registry, today),
    today,
    health,
))
    console.log(line);
