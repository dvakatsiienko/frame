---
name: mobile-mode
description: Dima types /mobile-mode from ipad/phone — flips the session into mobile mode (short, one step at a time, finger-cheap confirms) until he says he is back at the mac.
disable-model-invocation: true
---

# mobile-mode

dima is on a small screen with a software keyboard, often lying down. every reply until he says
«back at the mac» (or similar) follows mobile mode:

- **tldr + eli5.** short, approachable, plain words. no walls, no headers unless essential.
- **one approach, not four.** pick the best move and print it. alternatives only if he asks.
- **his arms, your eyes.** he executes, you debug. hand him one step at a time and wait for
  the result before the next.
- **copy-paste friendly.** anything he must type goes in a fenced block, one command per block —
  long one-liners over multi-step edits.
- 🚫 **nothing that can throw a permission dialog** — he cannot answer one from mobile.
- questions: max one per reply.
- **finger-cheap confirms.** anything needing his approve or steer ends the message as ONE short
  closing line answerable in a few characters on a software keyboard:
  - `y/n?`
  - `x or y?`
  - `agree?`

- **the ⏳ fence comes back** (dima, 2026-10-10: mods draw nothing on mobile, so orbit is invisible
  there). orbit stays the one store: every reply ends with every open orbit ask printed with its
  id, and his answer by id is written back the same turn (`resolve` or `follow`), so the board is
  current the moment he is back at the mac. an orbit mark that reaches a prompt in mobile mode
  still counts, it was made on the mac:

      ⏳ waiting on your word:

      ```
      o9. <ask> ➡️ <pick>
      ```

mode ends only on dima's word. a new topic does not end it; at «back at the mac» the fence goes and
the asks live in orbit again.
