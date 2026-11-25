// the one rule for what a click on a file opens, in the chat's replies and on an orbit card: a kind he reads, looks at or
// hears, or a plain folder; any other is shown in Finder, so a click never runs, installs or mounts. an ask's link goes by
// its own short list

import { filePath } from './file-links.js';

const AUDIO = /\.(?:mp3|m4a|aac|wav|aiff?|flac|ogg|opus)$/i;

// the kinds a click opens: what he reads, looks at or hears, never what may run, install or mount. any other is shown in
// Finder
const OPENS = new RegExp(
    String.raw`\.(?:${[
        'md|markdown|mdx|txt|text|log|rtf|csv|tsv|json|jsonl|json5|jsonc|yaml|yml|toml|ini|conf|xml|html|htm|diff|patch',
        'ts|tsx|mts|cts|js|jsx|mjs|cjs|css|scss|go|rs|swift|c|h|cpp|hpp|java|kt|lua|sql|graphql|vue|svelte|mod|sum|lock',
        'png|jpe?g|gif|webp|heic|svg|tiff?|bmp|avif|ico',
        'mp4|m4v|mov|mkv|webm|avi',
        'pdf|epub|docx?|xlsx?|pptx?|pages|numbers|key',
    ].join('|')})$`,
    'i',
);
// a folder's own name: one with a suffix may be an app or an installer that only looks like a folder
const PLAIN_FOLDER = /^\.?[^.]+$/;

/**
 * the `open` arguments for what he clicked, by what it resolves to: a symlink, a `..` or a closing slash hides nothing
 * @param {string} path resolved, `isFolder` of it @param {boolean} isFolder
 * @param {string | null} [audioApp] the app his settings open audio in (`chatter.audio.app`); null: the system's choice
 */
export function openArgs(path, isFolder, audioApp = null) {
    const name = path.slice(path.lastIndexOf('/') + 1);
    if (isFolder) return PLAIN_FOLDER.test(name) ? [path] : ['-R', path];
    if (AUDIO.test(name)) return audioApp ? ['-a', audioApp, path] : [path];
    return OPENS.test(name) ? [path] : ['-R', path];
}

/**
 * opens what he clicked, looked at on disk first
 * @param {string} path @param {string | null} audioApp
 * @param {(program: string, args: string[]) => Promise<{ code: number, stdout: string }>} exec
 * @returns {Promise<boolean>} false: it is not there
 */
export async function openPath(path, audioApp, exec) {
    const none = () => ({ code: 1, stdout: '' });
    const real = await exec('/bin/realpath', [path]).catch(none);
    const target = real.stdout.replace(/\n$/, '');
    if (real.code !== 0 || !target.startsWith('/')) return false;
    const folder = await exec('/bin/test', ['-d', target]).catch(none);
    await exec('open', openArgs(target, folder.code === 0, audioApp)).catch(
        none,
    );
    return true;
}

// a page in his browser, a note in obsidian, a ticket in linear; any other scheme may run something
const WEB = /^(?:https?|linear):\/\/\S|^obsidian:\/\/open\?/i;

/** whether a link is a page or a note a click may open @param {string} link */
export const isWebLink = (link) => WEB.test(link.trim());

/** the path a link names, `~` and `file://` read, null for any other link @param {string} link @param {string} home */
export function linkPath(link, home) {
    const text = link.trim();
    if (/^(?:\/|~\/)/.test(text)) return text.replace(/^~(?=\/)/, home);
    return filePath(text);
}

/**
 * opens a page or a note; herdr's own `open_url` takes http alone
 * @param {string} link @param {(url: string) => void} openUrl @param {(program: string, args: string[]) => Promise<unknown>} exec
 */
export function openWebLink(link, openUrl, exec) {
    const url = link.trim();
    if (!isWebLink(url)) return;
    if (/^https?:/i.test(url)) openUrl(url);
    else exec('open', [url]).catch(() => {});
}

/** the settings row that names the app audio opens in, and the app before he chose one */
export const AUDIO_APP = { default: 'IINA', key: 'chatter.audio.app' };

/** the app his settings open audio in; null: the system's choice @param {Record<string, unknown> | null | undefined} rows */
export function audioAppOf(rows) {
    const app = rows?.[AUDIO_APP.key] ?? AUDIO_APP.default;
    return typeof app === 'string' && app ? app : null;
}
