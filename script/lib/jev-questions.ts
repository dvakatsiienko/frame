import type { Question } from './jev.ts';

// every rubric the fleet sends to jev lives here, so a wording change is a reviewable diff.
// criteria carry the fleet's meaning: jev knows no word we do not define (playground, 2026-09-19:
// null criteria → 73 % ticket; defined criteria → 89 % flowlog on the same line).

export const inboxQuestions = {
    lane: {
        criteria: {
            answer: 'Dima wants a reply: a question, or an idea filed under the `💡` ideas section, where he expects a reaction and a suggestion, not a build.',
            drop: 'Nothing to do and nothing to record: an observation or a thought with no action wanted.',
            flowlog:
                'A concrete todo an agent can finish this session or the next, alongside other work, with no plan and no decision from dima: a freebie, a check, a leftovers sweep, a deletion or cleanup job dima describes step by step and wants done now, or an fyi whose only action is updating a file, a map, or a list the fleet keeps. Logged in the flowlog with a status.',
            fold: 'Attaches to an existing ticket or a thread already tracked: the text names a ticket id (FRM-N, BYT-N, or an old DOT-N) or links the ticket, or says «+1», «add this», «fold», «resolve <id>». No new ticket, even when the ask is large.',
            ticket: 'New work that needs its own session: a plan, a design, a decision from dima, or a coder spawned for it. Becomes a new linear ticket.',
        },
        instructions:
            'Which lane should the coordinator route `item` to? `section` is the inbox heading dima filed it under and says what he expects back. A freebie is a small change an agent can finish in one pass without approval.',
        type: 'choice',
    },
    needsVerdict: {
        criteria: {
            false: 'The item states what to do clearly enough that an agent can act and report.',
            true: 'The item leaves a choice open (which option, whether at all, how much) that an agent must not guess.',
        },
        instructions:
            'Does resolving `item` require a decision only dima can make before an agent acts?',
        type: 'noul',
    },
} as const satisfies Record<string, Question>;

// a flawlog line at the halt flush: where does it go? (the flawlog skill's own rule: fixed in place
// → never logged; only what survives the attempt reaches the log, and the flush places each line)
export const flawlogQuestions = {
    lane: {
        criteria: {
            drop: 'A line opening with «good:» or «good find» whose subject is a mechanism that worked or a cheaper command — no felt sense of dima in it. Already resolved in the same session, or a one-off with nothing transferable: the line names a fix that was applied (a script rewritten, a command corrected, a hook that caught it), says «drop» or «fixed», or records a good find with no rule behind it. A resolved line stays drop even when it describes a tool trap — the trap is closed. Also drop: a line whose lesson an existing rule or reminder already states (it names that rule, skill or reminder) — a second copy is not a new rule.',
            memory: 'A standing fact or habit ONE agent role keeps — the coordinator, a coder, a cw thread: a convention that only that role meets, a thing that belongs in its memory leaf, an AGENTS.md or a skill. A tool behaviour any session in any repo could hit (pnpm, vercel, github, git, macos) is not memory, it is rule. Also memory: a lesson about HOW the agent proves a claim (a check tested on one branch of its rule, a typecheck standing in for a build) — it stays memory even when the one instance was fixed, because the fix closes the instance, not the habit — unless the line itself names the leaf or rule that already holds the lesson («already in …»), which is drop.',
            rule: 'A hazard or floor that can bite ANY session in ANY repo and is NOT yet fixed — a measured tool behaviour (pnpm, vercel, github, git, macos, the bash sandbox), a trap that reads green, a delete or write shape that lost data: it belongs in a fleet-wide rules file such as fleet-hazards, whichever session found it — and it can be stated in one line without writing code; a lesson whose close is a script, a build or a fix to one of our tools is ticket. A fact about how one of OUR tools or spawns behaves (the coordinator daemon, a coder brief, a skill) is memory, not rule.',
            story: "Only a catch where DIMA's felt sense arrived before the reason — he sensed something was off before anyone could say why — kept in dima-stories, never as a rule. A comparison or measurement (reviewer A vs verifier B, counts, timings), a tool's behaviour, or an agent's own lesson is never story, even when it reads as a good outcome: those are vet, rule or memory.",
            ticket: 'Needs code, a script, a build, or a decision from dima before it is closed: work with its own session, tracked in linear. A line whose lesson is «fix the script», «the watcher must read X», «build Y» is ticket even when it also describes a hazard — the hazard line is written when the fix lands.',
        },
        instructions:
            'Where should the coordinator place `line` at the flawlog flush? `log` is the session log it came from.',
        type: 'choice',
    },
} as const satisfies Record<string, Question>;

// bands from the self-consistency cookbook: below → act, between → dima's ⏳ block, above → act
export const verdictBand = { high: 0.7, low: 0.3 } as const;
