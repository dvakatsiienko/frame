// a link clicked in a message: TextView opens web links itself and does nothing for a file:// one, so the chat takes every
// click and hands it to macOS `open`: a png opens in Preview, a dir in Finder, a web link in the browser

/**
 * what `open` gets for a clicked link: a file:// url as its decoded path, any other url as it is
 * @param {string} url
 * @returns {string}
 */
export function openTarget(url) {
    if (!url.startsWith('file://')) return url;
    return decodeURIComponent(
        url.slice('file://'.length).replace(/^localhost/, ''),
    );
}
