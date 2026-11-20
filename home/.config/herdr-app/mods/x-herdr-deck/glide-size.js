// glide's block under antenna (FRM-618 slice C): herdr sizes a block by px or weight only, so glide measures its cards
// and sizes its own block to them; past GLIDE_MAX_PX the cards scroll and antenna keeps the sidebar above. a 0 px block
// never draws, so with no lane glide keeps a 1 px seam and still hears a lane join (live, 17:13)

export const GLIDE_MAX_PX = 480;
const SEAM_PX = 1;

/**
 * the px glide's block should ask for, or null when the block already has it; read against the block's own measured
 * height, so a resize herdr dropped, or a drag of its edge, is asked again
 * @param {{ lanes: number, contentPx: number, blockPx: number }} measured
 * @returns {number | null}
 */
export function glideResize({ lanes, contentPx, blockPx }) {
    const want =
        lanes === 0 ? SEAM_PX : Math.min(Math.ceil(contentPx), GLIDE_MAX_PX);
    return Math.abs(want - blockPx) < 1 ? null : want;
}
