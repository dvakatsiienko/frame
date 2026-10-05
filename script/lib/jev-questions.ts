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
            drop: "A line opening with «fixed:» is drop — the prefix is the flawlog skill's marker that the fix already landed, even when the rest of the line still says «needs code» or names a script — unless it ends with a «lesson:» naming a habit for how an agent works next time (a check to run, a place to look), which is memory. A line opening with «good:» or «good find» whose subject is a mechanism that worked or a cheaper command — no felt sense of dima in it. Already resolved in the same session, or a one-off with nothing transferable: the line names a fix that was applied (a script rewritten, a command corrected, a hook that caught it), says «drop» or «fixed», or records a good find with no rule behind it. A resolved line stays drop even when it describes a tool trap — the trap is closed. Also drop: a line whose lesson an existing rule or reminder already states (it names that rule, skill or reminder) — a second copy is not a new rule. Also drop: a line whose fix already has a home it names — an open ticket item, a verb that now guards it (`x lane commit`), or a scheduled verdict (a test-drive date). Also drop: a skill-not-loaded line (the router vet already counts it); a tool refusal whose own message says what to do (the tool is the record); a slash command that hit a built-in when the right command is already named in the line.",
            memory: 'A standing fact or habit ONE agent role keeps — the coordinator, a coder, a cw thread: a convention that only that role meets, a thing that belongs in its memory leaf, an AGENTS.md or a skill. A tool behaviour any session in any repo could hit (pnpm, vercel, github, git, macos) is not memory, it is rule. Also memory: a lesson about HOW the agent proves a claim (a check tested on one branch of its rule, a typecheck standing in for a build) — it stays memory even when the one instance was fixed, because the fix closes the instance, not the habit — unless the line itself names the leaf or rule that already holds the lesson («already in …»), which is drop. Also memory: a «fixed:» line ending in a «lesson:» that names a habit for next time.',
            rule: 'A hazard or floor that can bite ANY session in ANY repo and is NOT yet fixed — a measured tool behaviour (pnpm, vercel, github, git, linear, macos, the bash sandbox), a trap that reads green, a delete or write shape that lost data: it belongs in a fleet-wide rules file such as fleet-hazards, whichever session found it — and it can be stated in one line without writing code; a lesson whose close is a script, a build or a fix to one of our tools is ticket. A fact about how one of OUR tools or spawns behaves (the coordinator daemon, a coder brief, a skill) is memory, not rule.',
            story: "Only a catch where DIMA's felt sense arrived before the reason — he sensed something was off before anyone could say why — kept in dima-stories, never as a rule. A comparison or measurement (reviewer A vs verifier B, counts, timings), a tool's behaviour, or an agent's own lesson is never story, even when it reads as a good outcome: those are vet, rule or memory.",
            ticket: 'Never a line opening with «fixed:» (that is drop). Needs code, a script, a build, or a decision from dima before it is closed: work with its own session, tracked in linear. A coder or verifier retro that lists several things to build for a tool or a kit (verbs, a seed, a script) is ticket, even when it also names a recipe gap or a note — the build is what the line weighs. A line whose lesson is «fix the script», «the watcher must read X», «build Y» is ticket even when it also describes a hazard — the hazard line is written when the fix lands.',
        },
        instructions:
            'Where should the coordinator place `line` at the flawlog flush? `log` is the session log it came from.',
        type: 'choice',
    },
} as const satisfies Record<string, Question>;

// bands from the self-consistency cookbook: below → act, between → dima's ⏳ block, above → act
export const verdictBand = { high: 0.7, low: 0.3 } as const;

// the skill router, docs.typesafe.ai/cookbooks/skill_suggestion: call 1 ranks the roster in one
// Choice beside the two vetoes, call 2 re-reads the top 3 against their SKILL.md
// and each may say no. 09-24 → 10-01 vet misses were a shared word tipping a load («vault»,
// «announce», «slay at halt»), so the boundary below names those shapes.

// the «needs a skill at all» gate: one condition per noul (docs.typesafe.ai/primitives/noul), a
// veto each — an ack or a later-only prompt loads nothing, whatever a skill scored. the cookbook's
// «acts now» nouls were cut: on our fixtures they dropped 5 right picks (report, yt-transcript —
// skills whose work is talking) to stop 1 needless load the `none` option did not
export const routerVetoes = {
    _ack: {
        criteria: {
            false: 'The prompt asks for new work, asks a question, or gives a steer. A verdict on something proposed — «➡️ yes», «approve», «go», «do it», a numbered list of answers — is NOT an acknowledgement: it asks for that work to happen.',
            true: 'The prompt only acknowledges, confirms or reports something already done — a ✓, «ok», «done», «connected», «stopped» — and asks for nothing new.',
        },
        instructions: '`prompt` only acknowledges or reports, with no new ask.',
        type: 'noul',
    },
    _later: {
        criteria: {
            false: 'At least one thing in the prompt is asked to happen now, in this turn.',
            true: 'Every action the prompt names is placed at a later moment — next session, session end, the halt, tomorrow — and nothing is asked to happen now.',
        },
        instructions:
            'Everything `prompt` asks for is set for a later moment, none of it for now.',
        type: 'noul',
    },
} as const satisfies Record<string, Question>;

const routerBoundary =
    'The prompt does not ask for this work in this turn. A no when: the prompt only shares a word or a topic with the skill while its task is something else (a 1Password «vault» is not a notes vault; a line in AGENTS.md is agent docs, not source code; announcing a fleet rule is not a message to a person); it asks a question about the tool or how it works; the message goes to an agent session, which is not a human; the work is set for a later moment; it only acknowledges; or it asks another session to do the work.';

export const routerWide = (roster: readonly RouterSkill[]) =>
    ({
        ...routerVetoes,
        skill: {
            criteria: {
                ...Object.fromEntries(
                    roster.map((s) => [s.name, s.description]),
                ),
                none: 'No skill fits what the prompt asks to be done now: a question, an opinion, an acknowledgement, a relay to another session, or work none of these skills covers.',
            },
            instructions:
                'Which of these skills, if any, is the right one to load for what `prompt` asks to be done now?',
            type: 'choice',
        },
    }) satisfies Record<string, Question>;

export const routerRerank = (shortlist: readonly RouterSkill[]) =>
    ({
        skill: {
            criteria: Object.fromEntries(
                shortlist.map((s) => [
                    s.name,
                    `${s.description} — ${s.excerpt}`,
                ]),
            ),
            instructions:
                'Exactly one of these skills is the right one to load for `prompt`. Which one? Read what each actually does, not just its name.',
            type: 'choice',
        },
        ...Object.fromEntries(
            shortlist.map((s) => [
                `fits:${s.name}`,
                {
                    criteria: {
                        false: routerBoundary,
                        true: `The prompt asks, for this turn, for the work this skill does: ${s.description}`,
                    },
                    instructions: `Carrying out what \`prompt\` asks for now needs the procedure of the skill \`${s.name}\`.`,
                    type: 'noul',
                } satisfies Question,
            ]),
        ),
    }) satisfies Record<string, Question>;

// the old shape, one noul per skill — the baseline `jev:test skill-router` measures against,
// kept until the router's vet goes green on the new one
export const routerNouls = (roster: readonly RouterSkill[]) =>
    ({
        ...routerVetoes,
        ...Object.fromEntries(
            roster.map((s) => [
                s.name,
                {
                    criteria: {
                        false: 'Carrying out the prompt needs none of that procedure. A prompt that only shares a word or a topic with the description while its actual task is something else is a no, and so is a question about the tool itself.',
                        true: s.description,
                    },
                    instructions: `Carrying out \`prompt\` needs the procedure of the skill \`${s.name}\`.`,
                    type: 'noul',
                } satisfies Question,
            ]),
        ),
    }) satisfies Record<string, Question>;

/* Types */
export type RouterSkill = {
    name: string;
    description: string;
    excerpt: string;
};
