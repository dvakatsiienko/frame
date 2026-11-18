// Pictures waiting over the quill until sent. A pasted screenshot is saved here as a png and goes the way a dropped
// picture does, by its path (FRM-613): never into Claude's own prompt, so × edits only our list. The png is its own
// preview, kept per thread in shots.json, so a chat reload still shows what waits.
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { appHome, exec } from 'herdr';

// image() loads from the app's own directory, so the previews live under it
export const SHOTS_DIR = 'data/x-herdr-chat/shots';
const storePath = () => `${appHome()}/data/x-herdr-chat/shots.json`;

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

/** @typedef {Record<string, string[]>} ShotStore thread (its transcript file) → preview paths under the app dir */

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

/**
 * the store after a thread's waiting files change: the ones in our own dir (a pasted png) under `<thread> files`, so
 * a reload brings them back; a file dropped from elsewhere stays out
 * @param {ShotStore} store @param {string} thread @param {string[]} files @param {string} home
 * @returns {ShotStore}
 */
export function withWaitingFiles(store, thread, files, home) {
    const own = `${home}/`;
    const kept = files
        .filter((p) => p.startsWith(own))
        .map((p) => p.slice(own.length));
    const key = `${thread} files`;
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

// a picture's square thumb under the app dir: one file per path
export const THUMBS_DIR = 'data/x-herdr-chat/thumbs';
/** @param {string} path */
export const thumbName = (path) => {
    // two independent 32-bit hashes: one alone let `Aa` and `BB` share a file
    let h = 0;
    let f = 0x811c9dc5;
    for (const c of path) {
        const code = c.codePointAt(0) ?? 0;
        h = (h * 31 + code) >>> 0;
        f = Math.imul(f ^ code, 0x01000193) >>> 0;
    }
    return `${THUMBS_DIR}/${h.toString(36)}-${f.toString(36)}.png`;
};

/** a picture's size in pixels, read by sips @param {string} path @returns {Promise<{ w: number, h: number } | null>} */
async function sizeOf(path) {
    const got = await exec('sips', [
        '-g',
        'pixelWidth',
        '-g',
        'pixelHeight',
        path,
    ]).catch(/** @returns {null} */ () => null);
    const w = Number(/pixelWidth: (\d+)/.exec(got?.stdout ?? '')?.[1]);
    const h = Number(/pixelHeight: (\d+)/.exec(got?.stdout ?? '')?.[1]);
    return w && h ? { h, w } : null;
}

// a square is drawn at 96 points: three pixels a point keep it sharp on a retina screen, zoomed too
export const SQUARE_PX = 288;

/**
 * a picture as a sharp square that fills its frame: scaled so its short side fits, the middle cut out
 * @param {string} path @returns {Promise<string | null>} its rel under the app dir
 */
export async function saveSquareThumb(path) {
    const rel = thumbName(path).replace(`${THUMBS_DIR}/`, `${THUMBS_DIR}/sq-`);
    const out = `${appHome()}/${rel}`;
    const size = await sizeOf(path);
    if (!size) return null;
    await mkdir(`${appHome()}/${THUMBS_DIR}`, { recursive: true });
    const side = size.w < size.h ? '--resampleWidth' : '--resampleHeight';
    const scaled = await exec('sips', [
        '-s',
        'format',
        'png',
        side,
        String(SQUARE_PX),
        path,
        '--out',
        out,
    ]).catch(/** @returns {null} */ () => null);
    if (scaled?.code !== 0) return null;
    const cut = await exec('sips', [
        '-c',
        String(SQUARE_PX),
        String(SQUARE_PX),
        out,
    ]).catch(/** @returns {null} */ () => null);
    return cut?.code === 0 ? rel : null;
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

/**
 * the previews that are copies this chat made, safe to remove: a dropped picture's scaled copy. a pasted picture is its
 * own preview, the only file of a shot he took, and is never among them: it stays until his word (five of his shots
 * were lost on 2026-11-16 to a sweep that removed them at each load of the mod)
 * @param {{ path: string, rel: string | null | undefined }[]} pictures each picture waiting in a box and its preview
 * @param {string} home the app dir
 * @returns {string[]}
 */
export function previewCopies(pictures, home) {
    return pictures.flatMap(({ path, rel }) =>
        rel && path !== `${home}/${rel}` ? [rel] : [],
    );
}

// removes preview copies this chat made (see previewCopies): never anything outside SHOTS_DIR
/** @param {string[]} rels */
export async function deletePreviewCopies(rels) {
    await Promise.all(
        rels
            .filter((rel) => rel.startsWith(`${SHOTS_DIR}/shot-`))
            .map((rel) => unlink(`${appHome()}/${rel}`).catch(() => {})),
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

// a picture the viewer shows, whole: image() reads only under the app dir, so one from elsewhere is copied there once
export const VIEW_DIR = 'data/x-herdr-chat/view';

/** @param {string} path @returns {Promise<{ rel: string, w: number, h: number } | null>} */
export async function viewCopy(path) {
    const own = `${appHome()}/`;
    const ext = /\.\w+$/.exec(path)?.[0] ?? '.png';
    const rel = path.startsWith(own)
        ? path.slice(own.length)
        : `${VIEW_DIR}/${thumbName(path).slice(THUMBS_DIR.length + 1, -4)}${ext}`;
    if (!path.startsWith(own)) {
        await mkdir(`${appHome()}/${VIEW_DIR}`, { recursive: true });
        const copied = await exec('cp', [path, `${appHome()}/${rel}`]).catch(
            /** @returns {null} */ () => null,
        );
        if (copied?.code !== 0) return null;
    }
    const size = await sizeOf(`${appHome()}/${rel}`);
    return size ? { ...size, rel } : null;
}

// a picture onto the clipboard as an image, the way CleanShot's copy puts one (JXA, read only from the file)
const MAC_COPY_IMAGE = `ObjC.import("AppKit");
function run(argv) {
  const image = $.NSImage.alloc.initWithContentsOfFile(argv[0]);
  if (!image || image.isNil()) return "";
  const pb = $.NSPasteboard.generalPasteboard;
  pb.clearContents;
  return pb.writeObjects($([image])) ? "copied" : "";
}`;

/** @param {string} path @returns {Promise<boolean>} */
export async function copyPicture(path) {
    const r = await exec('osascript', [
        '-l',
        'JavaScript',
        '-e',
        MAC_COPY_IMAGE,
        path,
    ]).catch(/** @returns {null} */ () => null);
    return r?.code === 0 && r.stdout.trim() === 'copied';
}
