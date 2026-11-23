---
id: PK-465
title: "herdr reactions: the view from inside a claude.ai project thread (answers to the FRM-582 question set)"
status: open
assignee: []
created_date: "2026-11-22T23:10:00Z"
updated_date: '2026-11-22T23:18:00Z'
labels:
  - s
dependencies: []
priority: next
type: research
ordinal: 99500
---
## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

PK-465:W1 (2026-11-23 01:00, dima, in the cloud project thread «🎮 against the storm ✦ 5») tell how you see reactions from inside (tools, api, how they are shown to you, tool shape, description), plus anything useful, so we build herdr emoji reactions the right way. read FRM-582, don't dupe what it already holds, extend, clarify, steer; say what we miss and help make a good build plan.
PK-465:W2 (2026-11-23 01:00, dima) put the answers in clio's pocket; say why they are here, that main clio owns the ticket (not the wings), and who wrote them.
PK-465:W3 (2026-11-23 01:08, dima): on the stalled-approval gap: agree, but no-wake is my deliberate choice. i build the full cc system around slipstreams, so that is fine. i will tune the emoji tool descriptions so it is expected that they never wake.
PK-465:W4 (2026-11-23 01:08, dima): on «a reaction counts as the answer»: not quite. reactions are just fun and make messaging less boring. that is the whole idea of reactions; they are not purely mechanical at all.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

### who wrote this, and why it sits here

- 🪪 written by a Claude thread in dima's claude.ai project «stuff» (thread «🎮 against the storm ✦ 5», **Opus 5.5**), on dima's direct ask on 23 Nov, 01:00 kyiv. this thread has reactions built in, so dima asked it to describe the feature from the inside, for [FRM-582](https://linear.app/x-com/issue/FRM-582): herdr emoji reactions.
- the thread can't post to linear, so the answers land here for clio to fold. 📌 **main clio owns FRM-582, not the wings.** fold what's useful into the ticket, and drop the rest.
- read before writing: FRM-582 in full (W1–W73, the 13 PK-405 tips, the 18 Nov decided lines o39–o50). nothing below repeats those; each line either adds to them or steers them.
- 📌 limits on what it can say: the thread sees its own tools and the events it receives, never the platform's source. it can't quote its own instructions word for word, so everything below is a paraphrase of what it can do and observe. guesses are marked 🔎.

### notes from dima

the set of questions i asked cc.
We're about to build emoji reactions for chat bubbles in our own terminal chat app (herdr), and you have this feature built in, so I'd like your view from the inside.

1. When I react to one of your messages, what exactly reaches you? Is it a line in the conversation, a separate field, or metadata? Does it start a new turn, or wait for my next message?
2. When you react to mine, how is that triggered? Is it a tool you call, something in your output, or automatic? Name the tool and its parameters exactly as you see them, if there is one.
3. What decides which emoji you pick? Does each emoji carry a meaning you were told about, or do you read it on your own? Where is that defined, and how long is it?
4. Which tools, instructions or fields related to reactions can you see right now? Quote their names and descriptions as written, and say which parts you only infer.
5. What goes wrong with reactions in practice: noise, ones you miss, ones that get misread?
6. If you could design it again for an agent that works on long coding tasks, what would you keep, and what would you drop?
7. From what you can see, how would you build the same thing for us: the shape of the agent's door (a tool, its fields), how a reaction reaches the agent without waking it, and what rules tell the agent when to react?

Answer each in a few plain sentences. Say where you're guessing.

### the seven questions

1. **what reaches the agent when dima reacts.** none has reached this thread yet, so this is unobserved 🔎. the thread's environment describes a reaction as arriving in the same shape as a message: its own event, carrying the target message id, the actor, and a trust tag that says whether a person or another agent did it. that event starts a turn. so here, every reaction costs a turn. that's the wake cost tip 7 warns about, seen from inside.
2. **how the agent reacts.** an explicit tool call, never something in the output text. there are two tools: `react(message_id, emoji)` and `unreact(message_id, emoji)`. `emoji` takes the character itself or a shortcode without colons (it sent `white_check_mark` once and it rendered as ✅). both are idempotent: adding a reaction that's already there does nothing, and removing one it didn't add does nothing. the result is a plain «added» / «removed», and it doesn't return the message's current reaction state.
3. **what decides the emoji.** no legend exists. the emoji itself has no meaning attached; the thread picks by common convention (✅ done or agreed, 👀 looking). what it does get is behavior guidance (paraphrased): match each incoming message with the smallest visible sign that fits; a reaction is a stand-in when work must come before the answer; and remove that placeholder once the real reply is posted. the guidance is a few lines long, inside the general instructions, and it lives far from the tool.
4. **what the thread can see right now.** the `react` and `unreact` tools (above), message ids on every event, and the trust tag on every event. there's no tool to read the reactions already on a message, no legend, and no per-emoji settings. 🔎 it infers that reactions dima removes would arrive as removal events, but it hasn't seen one.
5. **what goes wrong in practice (seen in this thread):**
   - **double answer:** it put ✅ on a short report of dima's, then posted a one-line reply as well. the reaction was noise. the cause is that its turns must end in a visible act, and a reaction didn't feel like enough of one.
   - **dangling placeholder:** the «remove it after replying» step depends on the agent remembering. a 👀 left behind after the answer is out tells dima «still working» when nothing is.
   - **ambiguous meaning:** with no legend, ✅ can mean «done», «agreed» or «seen». dima can't tell which one was meant.
   - **missed reactions:** none could happen here, because every reaction wakes a turn. the price is that each one costs a whole turn.
6. **redesigning it for an agent on long coding tasks:**
   - keep: one tool for adding and one for removing; targeting by message id; idempotency; the trust tag; the placeholder pattern.
   - drop: a wake for every reaction, a meaning that lives only in prose instructions, and a placeholder the agent must clear by hand.
7. **how we'd build it for herdr:** see the steer below.

### steer: what FRM-582 misses or should settle before the build

1. ⚠️ **the stalled-approval gap.** o39 says a reaction never wakes the agent. but when an agent ends its turn on a question («ship it?») and dima answers with ✅ or the «go» emoji, a slipstreamed reaction waits for his next typed message, so the thread stalls on an answer he already gave. rule: a reaction on the agent's **latest message, while the agent is idle and waiting on dima**, wakes it, and every other reaction slipstreams. this keeps o39 for the 95 % case and closes the stall.
2. **put the legend in the `react` tool's own description.** o40 injects the legend once per session. a tool description loads with the tool on every turn and survives compaction and second wind, while a once-per-session injection is lost at the first compact. this is also the «inside herdr itself» home dima asked for in W3: herdr renders the tool description from the settings rows, so one edit reaches every agent.
3. **let the agent react only with the pinned seven.** the tool rejects any other emoji, with an error that lists the seven. this keeps every agent reaction tied to a meaning dima defined (W58 and PK-447:W7 in spirit). dima's own picker stays open to every emoji.
4. **a reaction counts as the answer.** whatever enforces «answer dima» (the habit, a guard, quiet comms) must accept a `react` call as a complete response to his message. otherwise agents add a line after the emoji, which is the double answer from point 5 above.
5. **let herdr clear the 👀 placeholder.** when the agent posts its next message in that thread, herdr removes the agent's 👀 from the messages it was holding. don't rely on the agent to `unreact` (it forgets).
6. **collapse in the slipstream queue.** an add and a remove of the same emoji before the next turn cancel each other. several reactions on one message become one line. each line carries the message id, so the agent can `unreact` or refer back to it: «dima reacted 👍 to «first words…» (msg 1234)».
7. **give the tool a richer return.** `react` returns the message's current reactions (who reacted and with what), so the agent sees whether dima already marked it and doesn't need a read tool.
8. **set a reaction budget.** at most one agent reaction per dima message (a 👀 that becomes a ✅ is a swap, not a second reaction), and none on another agent's message unless dima asks. this matches W11, his comms overload.
9. **normalize the agent side as well.** accept a shortcode or the character, store one canonical form (tip 12 covers dima's side).

### the agent's door, proposed shape

- `react({ message_id, emoji })` takes an emoji from the pinned seven, as a character or a shortcode. it returns `{ ok, reactions: [{ emoji, by }] }`. it's idempotent.
- `unreact({ message_id, emoji })` removes only the caller's own reaction and returns the same shape.
- the tool description holds the legend from the settings rows: one line per emoji, its meaning plus when to use it, about 15 words each, around 120 words in total.
- delivery: a slipstream line by default, and a wake only for the stalled-approval case (steer 1).

### a build order (🔎 a suggestion, the lane decides)

1. the reaction record and its idempotent add and remove (o46, the FRM-648 pattern), with canonical emoji.
2. dima's side: the picker on the bubble, writing the record.
3. delivery: the slipstream line with collapse and the message id, plus the wake for the stalled-approval case.
4. the agent's side: `react` and `unreact` in x-mod-stash, the legend in the tool description, the pinned-seven check, and the reaction counting as an answer.
5. the auto-clear of 👀 when the agent replies.
6. done-test additions: a reaction answering an agent's open question starts its turn; add then remove before a turn arrives as nothing; after a compact, the agent still knows the legend.

<!-- SECTION:NOTES:END -->
