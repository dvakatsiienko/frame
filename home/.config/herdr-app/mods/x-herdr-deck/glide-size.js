// glide's block under antenna (FRM-618 slice C): herdr sizes a block by px or weight only, so glide measures its cards
// and sizes its own block to them; past GLIDE_MAX_PX the cards scroll and antenna keeps the sidebar above

export const GLIDE_MAX_PX = 480;

/**
 * the px glide's block asks for: its cards' measured height, none with no lane
 * @param {number} lanes @param {number} contentPx
 */
export const glideBlockPx = (lanes, contentPx) =>
    lanes === 0 ? 0 : Math.min(Math.ceil(contentPx), GLIDE_MAX_PX);
