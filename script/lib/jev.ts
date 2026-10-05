/* Core */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

const endpoint = 'https://api.typesafe.ai/v1/systemone';

// pinned on purpose: thresholds are tuned per version, `jev-latest` moves under them
export const model = 'jev-1.13.0';

// the spend gate (FRM-308): dima runs jev on the free credit only, $5 a month from the 18th.
// input tokens are the whole bill (docs.typesafe.ai/models); the cap leaves $0.50 of slack
const USD_PER_TOKEN = 0.042 / 1_000_000;
export const CAP_USD = 4.5;
const CYCLE_DAY = 18;
// one line per paid call: `ts · input tokens · usd`; JEV_SPEND_LOG points tests and probes elsewhere
const spendLog = () =>
    process.env.JEV_SPEND_LOG ??
    join(homedir(), '.claude', 'shelf', 'jev', 'spend.log');

/** a refused call: the cycle is over its cap, or typesafe answered 402 — callers fail soft on it */
export class JevBudgetError extends Error {}

// a 402 means the account is empty: no later call in this process tries again
let isRefused = false;

export async function judge<Q extends Record<string, Question>>(
    state: unknown,
    questions: Q,
) {
    const apiKey = process.env.TYPESAFE_API_KEY;
    if (!apiKey)
        throw new Error(
            'TYPESAFE_API_KEY missing — run through script/op-run.sh',
        );
    if (isRefused)
        throw new JevBudgetError('jev refused earlier in this run (402)');
    const spent = cycleSpend(new Date());
    if (spent >= CAP_USD)
        throw new JevBudgetError(
            // sv-SE prints the local date as yyyy-mm-dd; toISOString shifts it into UTC
            `jev budget spent: $${spent.toFixed(2)} of $${CAP_USD.toFixed(2)} since ${cycleStart(new Date()).toLocaleDateString('sv-SE')}`,
        );

    for (let attempt = 0; ; attempt++) {
        const res = await fetch(endpoint, {
            body: JSON.stringify({ model, questions, state }),
            headers: {
                authorization: `Bearer ${apiKey}`,
                'content-type': 'application/json',
            },
            method: 'POST',
        });
        if (res.ok) {
            const out = (await res.json()) as JevResponse<Q>;
            const tokens = out.usage.input_tokens;
            // the call is paid already: a missing log dir must not lose its answer
            mkdirSync(dirname(spendLog()), { recursive: true });
            appendFileSync(
                spendLog(),
                `${new Date().toISOString()}\t${tokens}\t${(tokens * USD_PER_TOKEN).toFixed(6)}\n`,
            );
            return out;
        }
        if (res.status === 402) {
            isRefused = true;
            throw new JevBudgetError(`jev 402: ${await res.text()}`);
        }
        if ((res.status === 429 || res.status === 529) && attempt < 3) {
            await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
            continue;
        }
        throw new Error(`jev ${res.status}: ${await res.text()}`);
    }
}

/** the cycle a moment falls in starts on the 18th — this month's, or last month's before it */
export function cycleStart(now: Date) {
    const month =
        now.getDate() >= CYCLE_DAY ? now.getMonth() : now.getMonth() - 1;
    return new Date(now.getFullYear(), month, CYCLE_DAY);
}

/** dollars the spend log holds since the current cycle began */
export function cycleSpend(now: Date, path = spendLog()) {
    if (!existsSync(path)) return 0;
    const since = cycleStart(now).getTime();
    return readFileSync(path, 'utf8')
        .split('\n')
        .filter(Boolean)
        .reduce((sum, line) => {
            const [ts = '', , usd = '0'] = line.split('\t');
            return Date.parse(ts) >= since ? sum + Number(usd) : sum;
        }, 0);
}

/* Types */

export type Question =
    | {
          type: 'noul';
          instructions: string;
          criteria?: { true: string; false: string };
      }
    | {
          type: 'choice';
          instructions: string;
          criteria: Record<string, string | null>;
      }
    | { type: 'score'; instructions: string; criteria: readonly string[] };

type Answer<Q extends Question> = Q extends { type: 'noul' }
    ? { type: 'noul'; noul: number }
    : Q extends { type: 'choice'; criteria: infer C }
      ? {
            type: 'choice';
            choice: keyof C & string;
            probabilities: Record<keyof C & string, number>;
            confidence: number;
        }
      : {
            type: 'score';
            score: number;
            legend: string;
            probabilities: Record<string, number>;
            confidence: number;
        };

export type JevResponse<Q extends Record<string, Question>> = {
    model: string;
    answers: { [K in keyof Q]: Answer<Q[K]> };
    usage: { input_tokens: number; output_tokens: number };
};
