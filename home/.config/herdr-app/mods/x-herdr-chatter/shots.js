// Screenshots pasted into the quill, shown above it until sent. Claude Code reads the clipboard
// itself on its paste key; a copy saved here is only the preview, kept per thread in shots.json
// so a chat reload still shows what waits in Claude's prompt.
import { mkdir, readFile, readdir, unlink, writeFile } from 'fs/promises';
import { appHome, exec } from 'herdr';

// image() loads from the app's own directory, so the previews live under it
export const SHOTS_DIR = 'data/x-herdr-chatter/shots';
const storePath = () => `${appHome()}/data/x-herdr-chatter/shots.json`;

// the clipboard's image (a screenshot is PNG or TIFF) written as a PNG to argv[0]; prints «image» when
// it wrote one. JXA from shepherdr's mods/chat/attach.js (MIT), cut to the image case.
const MAC_CLIPBOARD_IMAGE = `ObjC.import("AppKit");
function run(argv) {
  const pb = $.NSPasteboard.generalPasteboard;
  let png = pb.dataForType($.NSPasteboardTypePNG);
  if (!png || png.isNil()) {
    const tiff = pb.dataForType($.NSPasteboardTypeTIFF);
    if (tiff && !tiff.isNil()) png = $.NSBitmapImageRep.imageRepWithData(tiff).representationUsingTypeProperties($.NSBitmapImageFileTypePNG, $({}));
  }
  if (png && !png.isNil() && png.writeToFileAtomically(argv[0], true)) return "image";
  return "";
}`;

/** @typedef {Record<string, string[]>} ShotStore thread address → preview paths under the app dir */

/** @param {string | null} text @returns {ShotStore} */
export function parseShots(text) {
    try {
        const parsed = JSON.parse(text ?? '{}');
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? Object.fromEntries(
                  Object.entries(parsed).filter(
                      ([, list]) =>
                          Array.isArray(list) &&
                          list.every((p) => typeof p === 'string'),
                  ),
              )
            : {};
    } catch {
        return {};
    }
}

/** @param {ShotStore} store @param {string} address @param {string} rel @returns {ShotStore} */
export const shotsWith = (store, address, rel) => ({
    ...store,
    [address]: [...(store[address] ?? []), rel],
});

/** @param {ShotStore} store @param {string} address @returns {ShotStore} */
export function shotsWithout(store, address) {
    const { [address]: _gone, ...rest } = store;
    return rest;
}

// a preview's paste time, from its name (saveClipboardShot writes shot-<ms>.png)
/** @param {string} rel */
export const shotTime = (rel) => Number(/shot-(\d+)\.png$/.exec(rel)?.[1] ?? 0);

/**
 * a thread's previews pasted after `at` (his prompt that took the older ones), and the ones that go
 * @param {ShotStore} store @param {string} address @param {number} at
 * @returns {{ store: ShotStore, gone: string[] }}
 */
export function shotsAfter(store, address, at) {
    const list = store[address] ?? [];
    const kept = list.filter((rel) => shotTime(rel) > at);
    if (kept.length === list.length) return { gone: [], store };
    const gone = list.filter((rel) => !kept.includes(rel));
    return {
        gone,
        store: kept.length
            ? { ...store, [address]: kept }
            : shotsWithout(store, address),
    };
}

// a picture a reply links, as a small square in its file chip (FRM-562): one file per path, remade on each load
export const THUMBS_DIR = 'data/x-herdr-chatter/thumbs';
/** @param {string} path */
export const thumbName = (path) => {
    let h = 0;
    for (const c of path) h = (h * 31 + (c.codePointAt(0) ?? 0)) >>> 0;
    return `${THUMBS_DIR}/${h.toString(36)}.png`;
};

/** @param {string} path @returns {Promise<{ rel: string, w: number, h: number } | null>} */
export async function saveLinkThumb(path) {
    const rel = thumbName(path);
    const out = `${appHome()}/${rel}`;
    await mkdir(`${appHome()}/${THUMBS_DIR}`, { recursive: true });
    const made = await exec('sips', [
        '-Z',
        '96',
        '-s',
        'format',
        'png',
        path,
        '--out',
        out,
    ]).catch(/** @returns {null} */ () => null);
    if (made?.code !== 0) return null;
    const got = await exec('sips', [
        '-g',
        'pixelWidth',
        '-g',
        'pixelHeight',
        out,
    ]).catch(/** @returns {null} */ () => null);
    const w = Number(/pixelWidth: (\d+)/.exec(got?.stdout ?? '')?.[1]);
    const h = Number(/pixelHeight: (\d+)/.exec(got?.stdout ?? '')?.[1]);
    return w && h ? { h, rel, w } : null;
}

// a dropped picture's preview, scaled down under the app dir (image() reads only there): its path, or null
/** @param {string} path @param {number} at a stamp no other preview has @returns {Promise<string | null>} */
export async function saveFileShot(path, at) {
    const rel = `${SHOTS_DIR}/shot-${at}.png`;
    await mkdir(`${appHome()}/${SHOTS_DIR}`, { recursive: true });
    const r = await exec('sips', [
        '-Z',
        '224',
        '-s',
        'format',
        'png',
        path,
        '--out',
        `${appHome()}/${rel}`,
    ]).catch(/** @returns {null} */ () => null);
    return r?.code === 0 ? rel : null;
}

// the preview files this chat saved: never anything outside SHOTS_DIR
/** @param {string[]} rels */
export async function deleteShots(rels) {
    await Promise.all(
        rels
            .filter((rel) => rel.startsWith(`${SHOTS_DIR}/shot-`))
            .map((rel) => unlink(`${appHome()}/${rel}`).catch(() => {})),
    );
}

// previews no thread claims: a dropped picture's preview left by a reload
/** @param {ShotStore} store */
export async function sweepShots(store) {
    const kept = new Set(Object.values(store).flat());
    const names = await readdir(`${appHome()}/${SHOTS_DIR}`).catch(
        /** @returns {string[]} */ () => [],
    );
    // a fresh one is spared: a send queued in Claude Code reads its paths later
    const fresh = Date.now() - 60 * 60 * 1000;
    await deleteShots(
        names
            .map((n) => `${SHOTS_DIR}/${n}`)
            .filter((rel) => !kept.has(rel) && shotTime(rel) < fresh),
    );
}

/** @returns {Promise<ShotStore>} */
export async function loadShots() {
    return parseShots(await readFile(storePath(), 'utf8').catch(() => null));
}

/** @param {ShotStore} store */
export async function saveShots(store) {
    await mkdir(`${appHome()}/${SHOTS_DIR}`, { recursive: true });
    await writeFile(storePath(), `${JSON.stringify(store, null, 2)}\n`);
}

// the clipboard's image saved as a preview: its path under the app dir, or null when it holds none
/** @returns {Promise<string | null>} */
export async function saveClipboardShot() {
    const rel = `${SHOTS_DIR}/shot-${Date.now()}.png`;
    await mkdir(`${appHome()}/${SHOTS_DIR}`, { recursive: true });
    const r = await exec('osascript', [
        '-l',
        'JavaScript',
        '-e',
        MAC_CLIPBOARD_IMAGE,
        `${appHome()}/${rel}`,
    ]).catch(() => null);
    return r?.code === 0 && r.stdout.trim() === 'image' ? rel : null;
}
