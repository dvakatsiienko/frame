// cc's session registry and its peer messages store a zero-width joiner as a space: «🐦‍⬛ crow» comes back as
// «🐦 ⬛ crow», two glyphs. herdr loads no module from outside a mod's folder, so every mod that draws a thread's name
// carries this same file (joined.test.ts in x-herdr-chatter holds the copies equal)
const JOINED = ['🐦‍⬛', '🐦‍🔥', '🙋‍♂️', '🧞‍♂️'];

/** @param {string} name */
export const rejoin = (name) =>
    JOINED.reduce((n, j) => n.replaceAll(j.replace('‍', ' '), j), name);
