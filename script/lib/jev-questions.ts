import type { Question } from './jev.ts';

// every rubric the fleet sends to jev lives here, so a wording change is a reviewable diff.
// criteria carry the fleet's meaning: jev knows no word we do not define (playground, 2026-09-19:
// null criteria → 73 % ticket; defined criteria → 89 % flowlog (now `pocket`) on the same line).

export const inboxQuestions = {
    lane: {
        criteria: {
            answer: 'Dima wants a reply: a question, or an idea filed under the `💡` ideas section, where he expects a reaction and a suggestion, not a build.',
            drop: 'Nothing to do and nothing to record: an observation or a thought with no action wanted.',
            fold: 'Attaches to an existing ticket or a thread already tracked: the text names a ticket id (FRM-N, BYT-N, or an old DOT-N) or links the ticket, or says «+1», «add this», «fold», «resolve <id>». No new ticket, even when the ask is large.',
            pocket: 'A concrete todo an agent can finish this session or the next, alongside other work, with no plan and no decision from dima: a freebie, a check, a leftovers sweep, a deletion or cleanup job dima describes step by step and wants done now, or an fyi whose only action is updating a file, a map, or a list the fleet keeps. Lands in the pocket, the local work pool of clio.',
            ticket: 'New work that needs its own session: a plan, a design, a decision from dima, or codie summoned for it. Becomes a new linear ticket.',
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

// v2 (FRM-305): a verdict list («1. yes 2. later») names its work only through the reply it
// answers, so state may carry `recent_context`; the sentence below keeps a topic that lives only
// in that reply from routing on its own
const contextNote =
    ' `recent_context`, when present, is the agent reply `prompt` answers: read what a short or numbered verdict refers to through it, but route only on work `prompt` itself asks for — a topic only `recent_context` mentions asks for nothing.';

const fitsQuestion = (s: RouterSkill, hasContext: boolean) =>
    ({
        criteria: {
            false: routerBoundary,
            true: `The prompt asks, for this turn, for the work this skill does: ${s.description}`,
        },
        instructions: `Carrying out what \`prompt\` asks for now needs the procedure of the skill \`${s.name}\`.${hasContext ? contextNote : ''}`,
        type: 'noul',
    }) satisfies Question;

export const routerWide = (
    roster: readonly RouterSkill[],
    hasContext: boolean,
    gate: readonly RouterSkill[] = [],
) =>
    ({
        ...routerVetoes,
        skill: {
            criteria: {
                ...Object.fromEntries(
                    roster.map((s) => [s.name, s.description]),
                ),
                none: 'No skill fits what the prompt asks to be done now: a question, an opinion, an acknowledgement, a relay to another session, or work none of these skills covers.',
            },
            instructions: `Which of these skills, if any, is the right one to load for what \`prompt\` asks to be done now?${hasContext ? contextNote : ''}`,
            type: 'choice',
        },
        // the must-not-miss gate rides the same request: one noul per critical skill, judged alone,
        // so a near neighbour in the Choice cannot take its probability
        ...Object.fromEntries(
            gate.map((s) => [`must:${s.name}`, fitsQuestion(s, hasContext)]),
        ),
    }) satisfies Record<string, Question>;

export const routerRerank = (
    shortlist: readonly RouterSkill[],
    hasContext: boolean,
    hasNeed: boolean,
) =>
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
                fitsQuestion(s, hasContext),
            ]),
        ),
        // hermes-jev-skills' stage-2 noul: one «any skill at all» judgment over the finalists,
        // which `state.skills` carries since a noul cannot see a Choice's options
        ...(hasNeed && {
            needsSkill: {
                criteria: {
                    false: 'A capable agent does what `prompt` asks well from general knowledge: a reply, a question answered, an acknowledgement, a relay, or work set for later. None of `skills` adds steps it would otherwise miss.',
                    true: 'Doing what `prompt` asks now, well, requires the specialised instructions of one of `skills` — its procedure, conventions or commands, not only its topic.',
                },
                instructions: `Doing what \`prompt\` asks now requires the specialised instructions of one of \`skills\`.${hasContext ? contextNote : ''}`,
                type: 'noul',
            } satisfies Question,
        }),
    }) satisfies Record<string, Question>;

/* Types */
export type RouterSkill = {
    name: string;
    description: string;
    excerpt: string;
};
