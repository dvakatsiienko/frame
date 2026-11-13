// Pictures waiting over the quill until sent. A pasted screenshot is saved here as a png and goes the way a dropped
// picture does, by its path (FRM-613): never into Claude's own prompt, so × edits only our list. The png is its own
// preview, kept per thread in shots.json, so a chat reload still shows what waits.
import { mkdir, readFile, readdir, unlink, writeFile } from 'fs/promises';
import { appHome, exec } from 'herdr';

// image() loads from the app's own directory, so the previews live under it
export const SHOTS_DIR = 'data/x-herdr-chatter/shots';
const storePath = () => `${appHome()}/data/x-herdr-chatter/shots.json`;

// what a paste with no text found, read only: files copied in Finder print «files» and their paths, one a line
// (their pasteboard also holds the file's icon, never the picture); else the image (a screenshot is PNG or TIFF) is
// written as a PNG to argv[0] and «image» printed. argv[1] names a private pasteboard, for a probe that must leave
// his clipboard alone. JXA from shepherdr's mods/chat/attach.js (MIT).
export const MAC_CLIPBOARD_IMAGE = `ObjC.import("AppKit");
function run(argv) {
  const pb = argv[1] ? $.NSPasteboard.pasteboardWithName(argv[1]) : $.NSPasteboard.generalPasteboard;
  const urls = pb.readObjectsForClassesOptions($([$.NSURL]), $({ NSPasteboardURLReadingFileURLsOnlyKey: true }));
  if (urls && !urls.isNil() && urls.count > 0) {
    const paths = [];
    for (let i = 0; i < urls.count; i++) paths.push(urls.objectAtIndex(i).path.js);
    return ["files", ...paths].join("\\n");
  }
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

// a preview's paste time, from its name (readClipboard writes shot-<ms>.png)
/** @param {string} rel */
const shotTime = (rel) => Number(/shot-(\d+)\.png$/.exec(rel)?.[1] ?? 0);

/**
 * the store after a thread's waiting files change: the ones in our own dir (a pasted png) under `<address> files`, so
 * a reload brings them back and the sweep spares them; a file dropped from elsewhere stays out
 * @param {ShotStore} store @param {string} address @param {string[]} files @param {string} home
 * @returns {ShotStore}
 */
export function withWaitingFiles(store, address, files, home) {
    const own = `${home}/`;
    const kept = files
        .filter((p) => p.startsWith(own))
        .map((p) => p.slice(own.length));
    const key = `${address} files`;
    const { [key]: _old, ...rest } = store;
    return kept.length ? { ...rest, [key]: kept } : rest;
}

/**
 * each thread's waiting files as paths, read back from the store
 * @param {ShotStore} store @param {string} home @returns {[string, string[]][]}
 */
export const waitingFiles = (store, home) =>
    Object.entries(store)
        .filter(([key]) => key.endsWith(' files'))
        .map(([key, rels]) => [
            key.slice(0, -' files'.length),
            rels.map((r) => `${home}/${r}`),
        ]);

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

/** @typedef {{ rel: string } | { paths: string[] } | null} ClipboardRead */

/** what the script printed: an image saved at `rel`, files by their paths, or nothing to attach @returns {ClipboardRead} */
export function clipboardRead(
    /** @type {string} */ stdout,
    /** @type {string} */ rel,
) {
    const [head, ...rest] = stdout.split('\n').filter(Boolean);
    if (head === 'image') return { rel };
    if (head === 'files' && rest.length) return { paths: rest };
    return null;
}

// a paste with no text, read off the clipboard (never written): its image saved as a png under the app dir, or the
// files copied in Finder
/** @param {string} [board] a private pasteboard's name, for a probe @returns {Promise<ClipboardRead>} */
export async function readClipboard(board) {
    const rel = `${SHOTS_DIR}/shot-${Date.now()}.png`;
    await mkdir(`${appHome()}/${SHOTS_DIR}`, { recursive: true });
    const r = await exec('osascript', [
        '-l',
        'JavaScript',
        '-e',
        MAC_CLIPBOARD_IMAGE,
        `${appHome()}/${rel}`,
        ...(board ? [board] : []),
    ]).catch(() => null);
    return r?.code === 0 ? clipboardRead(r.stdout, rel) : null;
}
