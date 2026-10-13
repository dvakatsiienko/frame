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

- **the ⏳ fence comes back** (mods draw nothing on mobile): the reply shape is x-mod-stash's no-board reminder, which every prompt carries while this mode is on — the same one 🪐 orbit switched off sends (`register.tsx` `noBoardReminder`, one home, dima's o162). his answer by id is written back the same turn, and an orbit mark made on the mac still counts.
- **🔭 stays the reply's last line** while it is on, even if the mac moves it into the band: his phone draws no mods (dima, 2026-10-12)

mode ends on dima's word: «back at the mac», `/mobile-mode off`, or a 🛎️ or ↩️ press in the board's orbit (he is at the mac; a note, a speak press or a row's ↗ is not). a
new topic does not end it; once it ends the fence goes and the asks live in orbit again. x-mod-stash keeps the flag and
swaps the per-prompt orbit reminder for the asks-fence one while it is on.
