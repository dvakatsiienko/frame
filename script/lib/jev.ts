/* Core */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

const endpoint = 'https://api.typesafe.ai/v1/systemone';

// pinned on purpose: thresholds are tuned per version, `jev-latest` moves under them
export const model = 'jev-1.13.0';

// the spend gate (FRM-308): dima runs jev on the free credit only, $5 a month from the 18th.
// input tokens are the whole bill (docs.typesafe.ai/models); a model bump without its price
// here fails the typecheck. the cap leaves $0.50 of slack
const usdPerMtok = { 'jev-1.13.0': 0.042 } as const satisfies Record<
    string,
    number
>;
export const usdPerToken = usdPerMtok[model] / 1_000_000;
export const CAP_USD = 4.5;
const CYCLE_DAY = 18;
// one line per paid call: `ts · input tokens · usd`; JEV_SPEND_LOG points tests and probes elsewhere
const spendLog = () =>
    process.env.JEV_SPEND_LOG ??
    join(homedir(), '.claude', 'shelf', 'jev', 'spend.log');

/** a refused call: the cycle is over its cap, or typesafe answered 402 — callers fail soft on it */
export class JevBudgetError extends Error {}

// once set, no later call in this process tries: a 402 (the account is empty), or a spend log
// that cannot be written (a call nobody counts would slip past the cap)
let refusal: string | undefined;
// the log is read once per process and per cycle, then each paid call adds to it — a replay
// makes ~5k calls and would re-read the growing file for every one
let tally: { since: number; usd: number } | undefined;

export async function judge<Q extends Record<string, Question>>(
    state: unknown,
    questions: Q,
) {
    const apiKey = process.env.TYPESAFE_API_KEY;
    if (!apiKey)
        throw new Error(
            'TYPESAFE_API_KEY missing — run through script/op-run.sh',
        );
    if (refusal) throw new JevBudgetError(refusal);
    const now = new Date();
    const since = cycleStart(now).getTime();
    if (tally?.since !== since) tally = { since, usd: cycleSpend(now) };
    const cycle = tally;
    const spent = cycle.usd;
    // a hand-edited or foreign line makes the total NaN, and `NaN >= cap` is false: fail closed
    if (!Number.isFinite(spent))
        throw new JevBudgetError(
            `the jev spend log holds an amount that is not a number (${spendLog()}) — no call until it is fixed`,
        );
    // checked before each call: a pool of 4 in flight can pass the cap by three calls (~$0.003)
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
            const usd = tokens * usdPerToken;
            cycle.usd += usd;
            // the call is paid already: a log that cannot be written never loses its answer
            try {
                mkdirSync(dirname(spendLog()), { recursive: true });
                appendFileSync(
                    spendLog(),
                    `${new Date().toISOString()}\t${tokens}\t${usd.toFixed(6)}\n`,
                );
            } catch (e) {
                refusal = `the jev spend log cannot be written (${e instanceof Error ? e.message : String(e)}) — no call until it can`;
                console.error(refusal);
            }
            return out;
        }
        if (res.status === 402) {
            refusal = 'jev refused earlier in this run (402)';
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
