// files he attaches by a paste or a drop, the chat's quill and the deck's steer boxes alike (FRM-676): a pasted image
// is saved as a png and goes by its path, files copied in Finder by theirs, each file once
import { mkdir } from 'fs/promises';
import { appHome, exec } from 'herdr';

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

/**
 * a paste with no text, read off the clipboard (never written): its image saved as a png in `dir` under the app dir,
 * or the files copied in Finder
 * @param {string} dir @param {string} [board] a private pasteboard's name, for a probe @returns {Promise<ClipboardRead>}
 */
export async function readClipboard(dir, board) {
    const rel = `${dir}/shot-${Date.now()}.png`;
    await mkdir(`${appHome()}/${dir}`, { recursive: true });
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

/** a list with new paths added once each, in the order he gave them @param {string[]} list @param {string[]} added */
export const withFiles = (list, added) => [
    ...list,
    ...added.filter((p, i) => !list.includes(p) && added.indexOf(p) === i),
];
