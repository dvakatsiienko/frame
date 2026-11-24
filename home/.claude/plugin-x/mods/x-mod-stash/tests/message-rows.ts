// the messages clio's crew sent her 19–23 Nov, cut to the words the gate reads (FRM-686): the number is the audit's row, and
// what a message does is its push reason, held or logged; names, paths and shas that say nothing to the gate are out
export const MESSAGE_ROWS = [
    // needed, and held untagged on the day
    [
        25,
        'decision',
        'round 1: refuted, back to codie. Two decisions for you, no fix asked:\n- the reset on «round 1»\n- the step list',
    ],
    [
        43,
        'decision',
        'round 1: refuted on one P2, every exit line held; one decision is yours\n- keep the path, or make it tree-proof?',
    ],
    [
        84,
        'decision',
        'round 2: clean\n- one P2 decision for you: fix now or leave',
    ],
    [
        168,
        'decision',
        'slice 1: clean so far. one ruling is yours, codie raised it: exit 3 against his later word',
    ],
    [
        264,
        'decision',
        'slice A round 1: refuted, 7 P2s to codie.\ndecisions, yours:\n- reword the exit',
    ],
    [
        268,
        'decision',
        'slice A clean. a call for you: the wait line is off by default',
    ],
    [
        316,
        'decision',
        'slice D clean, 0 breaks. a look call for you, no fix asked: a wait can be a raw command',
    ],
    [
        169,
        'tag',
        'CI fix on origin/main; typecheck exit 0.\n[ask] slice 1: clean so far; the one open half is yours.\na) drop it\nb) build it',
    ],
    [
        61,
        'held',
        'correction to my escalate: nothing is lost. my edits are back on disk; what I saw was a peer’s commit in flight',
    ],
    [
        133,
        'held',
        'dima in my chat 19:04: put the ask in orbit. the landing line now says it; the brief’s land rule is yours to change',
    ],
    [
        167,
        'held',
        'rider 2 stopped by your rule: it is more than the gate order. round 3: 🌼 clean. parked.',
    ],
    [
        290,
        'held',
        'heads-up: the herdr codie has taken no turn since its compact; yours to nudge it if it should be working.',
    ],
    [
        296,
        'held',
        'wing 1: v2 is shaped and signed for monday, handed back to you.',
    ],
    [
        308,
        'held',
        'the split has landed, so the 🐕 stray may go back to x-mod-stash.',
    ],
    [
        335,
        'held',
        'pushed: it is on origin/main. please tell the herdr codie its 9 commits are out. next: the mods load slice, then park.',
    ],
    [
        447,
        'held',
        '[progress] correction to my step 01 number, before you use it as the threshold: half needs roughly all rows.',
    ],
    // dead weight
    [
        40,
        'logged',
        'sw done: handoff in the store (codie). the next me waits for your sealed section and `next:`, then a design map',
    ],
    [
        41,
        'held',
        'sw done: mods lane 8 codie picked up its handoff. FRM-661 still waits on dima’s look; ready for your next:',
    ],
    [
        51,
        'logged',
        'sw done — herdr lane 3 codie, handoff ingested (store empty for it). holding: sixth sense round 4',
    ],
    [
        245,
        'logged',
        'sw done — herdr codie picked up its handoff; slices 3–5 closed clean. parked for your next: (slice A).',
    ],
    [
        270,
        'logged',
        'sw done: handoff ingested, starting slice C of 6 at step 58.',
    ],
    [
        279,
        'logged',
        'sw done: handoff ingested, slice C ticked closed, starting slice D of 6 with your 17:30 rider.',
    ],
    [
        294,
        'logged',
        'sw done: herdr lane 3 picked up its handoff. it is on origin/main. next: slice D’s 5 review fixes.',
    ],
    [
        320,
        'logged',
        'sw done — herdr codie picked up its handoff (store holds no file of mine); starting slice E step 69 test-first.',
    ],
    [
        331,
        'logged',
        'sw done: herdr lane 3 picked up slice F; the ci-binaries test is green again, the push is running now.',
    ],
    [
        358,
        'logged',
        'sw done: handoff ingested, store empty. starting slice A step 77, test-first.',
    ],
    [
        127,
        'logged',
        'held: 🎀 helga is compacting; your message joins its next turn ',
    ],
    [
        128,
        'logged',
        "delivered: your message joined 🎀 helga's first turn after its compact ",
    ],
    [
        215,
        'logged',
        'held: 🎀 helga is compacting; your message joins its next turn',
    ],
    [
        220,
        'logged',
        "delivered: your message joined 🎀 helga's first turn after its compact",
    ],
    [
        280,
        'logged',
        'your message to ⚡ 🔧 herdr | FRM-673 is held: it is at 35 % and has not wound',
    ],
    [
        287,
        'logged',
        'your message to ⚡ 🔧 herdr | FRM-673 is held: it is at 35 % and has not wound ',
    ],
    [
        18,
        'held',
        '[progress] step 05: modules 1–7 of the split landed at 14:31; no mod errors.',
    ],
    [
        49,
        'held',
        'refresh probe: the stored seam is refused by plugin validate, so no refresh.ts.',
    ],
    [
        62,
        'held',
        'ack: only plain commits on my own paths, and the size file goes through you from now on.',
    ],
    [
        81,
        'held',
        'round 3: clean so far; exit 5’s live drag pending dima. a full clean waits on his try',
    ],
    [
        90,
        'held',
        'sw done (handoff ingested). round 5: clean; my done comment next.\nthen his 17:28 rider in my chat: a / command sends',
    ],
    [
        104,
        'held',
        'the / rider is clean at round 7, landed live 17:51; its local reviews running.',
    ],
    [
        107,
        'held',
        '[progress] sw done: handoff ingested; starting slice B move 1, orbit-store.ts.',
    ],
    [
        109,
        'held',
        'round 1: clean so far; exits 1–3 held. exit 4 pending dima: his next key change',
    ],
    [
        144,
        'held',
        'the kept-page rider clean (round 11): the page lives 10 s; your decision is closed.',
    ],
    [
        170,
        'held',
        'sw done: herdr lane 3 codie back, parked after slice 1.\n- sixth sense round 2 still out\n- open with you: exit 3',
    ],
    [
        180,
        'held',
        'handoff written (replaces the last one). It adds both slice 3 items.',
    ],
    [
        184,
        'held',
        '[progress] herdr codie: sw done, slice 2 closed, lane-plan step 23 ticked.',
    ],
    [
        185,
        'held',
        '[progress] mods codie (lane 8 pickup) sw done: handoff ingested, load 3.5. starting the lanes.ts move now.',
    ],
    [
        191,
        'held',
        'lands: 21a (a dedup, 2.3 min), 21b (2.4 min); 1879 pass each.',
    ],
    [
        192,
        'held',
        '[progress] stray-batch-7 started 13:29 on frame main; sw done.\n- read stray.md',
    ],
    [
        234,
        'held',
        'probe rings: already removed in code; they vanish the moment I land, which waits for his empty quill',
    ],
    [
        240,
        'held',
        '[progress] mods codie: sw done, handoff ingested; starting round 1’s fix list.',
    ],
    [
        254,
        'held',
        'sw done (handoff ingested). starting slice A: to-tickets, steps from 43, then [ask] lane-plan ready to greenlight',
    ],
    [
        277,
        'held',
        'slice C: exits 1, 2, 4 hold, 0 findings; 3-live and 5 wait on his look: ⌘⇧K pressed once in the chat',
    ],
    [
        282,
        'held',
        'lane plan ticked: 29 of 32 done; left: 30 the test split, 31 slice B reviewed, 32 slice C reviewed and closed.',
    ],
    [
        295,
        'held',
        'E1 noted as step 70b in slice E. shots go to you for his pick before any build.',
    ],
    [
        307,
        'held',
        '[progress] sw done (handoff ingested). the test split is landed through step 78.',
    ],
    [
        311,
        'held',
        'ticked lane-plan steps 30 and 33 (read back: both [x]); 31 and 32 stay open until the clean.',
    ],
    [
        318,
        'held',
        'E2 noted as step 70d in slice E. Second wind armed; it compacts and ingests at this turn’s end.',
    ],
    [
        330,
        'held',
        'second wind armed; it names a sha «waits for origin». «sw done» follows after the pickup.',
    ],
    [349, 'held', 'thanks: the slice F push went through.'],
    [
        356,
        'held',
        'stray batch 11 sixth sense: taken. I grade each [done] at its head, with named test files only.',
    ],
    [
        373,
        'held',
        'sixth sense: handoff written, with your two picks folded in. parked.',
    ],
    [
        439,
        'held',
        'sw done — mods-lane-9 codie picked up its handoff and is parked; no file written.\n- skills: x:crew-codie',
    ],
    [
        467,
        'held',
        'push starting: the first reset with its check, one commit; its suite is expected to be skipped',
    ],
    // a rule's word in them, and no push
    [
        27,
        'held',
        '🐦‍⬛ crow on the grill round 1: Q2 asks him again about a decision he made twice in the last 45 minutes.',
    ],
    [
        88,
        'held',
        'exit 5 taken as passed on his word. the head moved, refuted on two tiny P2s: the old names still sit in 3 places',
    ],
    // two that pushed on the day, as a control
    ['tag', 'tag', '[done] slice D is clean on main'],
    ['for dima', 'for-dima', 'the take is up, waiting on dima'],
] as const;
// what the words of these messages pushed before FRM-686, read at 84bc837f
export const PUSHED_BEFORE = 2;
