// draw.io XML -> a flat cell list: absolute boxes, style map, displayed text as runs, dima* notes.
import { DOMParser } from '@xmldom/xmldom';

const NOTE = /^dima/;
const ENTITIES = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
};

const decode = (s) =>
    s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => {
        if (e[0] === '#')
            return String.fromCodePoint(
                e[1] === 'x' || e[1] === 'X'
                    ? Number.parseInt(e.slice(2), 16)
                    : Number(e.slice(1)),
            );
        return ENTITIES[e.toLowerCase()] ?? m;
    });

const styleMap = (style = '') =>
    Object.fromEntries(
        style
            .split(';')
            .filter(Boolean)
            .map((p) =>
                p.includes('=') ? p.split(/=(.*)/s).slice(0, 2) : [p, '1'],
            ),
    );

const styleOf = (tag) => {
    const m = /([\w-]+)\s*:\s*([^;"]+)/g;
    const out = {};
    for (const [, k, v] of tag.matchAll(m)) out[k] = v.trim();
    return out;
};

/** @returns {{text:string,size:number,color:string}[][]} one array of runs per html line */
export const htmlRuns = (html, baseSize, baseColor) => {
    const lines = [[]];
    const stack = [{ size: baseSize, color: baseColor }];
    for (const [, close, name, attrs, text] of html.matchAll(
        /<(\/?)([a-z0-9]+)([^>]*)>|([^<]+)/gi,
    )) {
        if (text !== undefined) {
            const t = decode(text).replace(/\s+/g, ' ');
            if (t)
                lines.at(-1).push({
                    text: t,
                    size: stack.at(-1).size,
                    color: stack.at(-1).color,
                });
            continue;
        }
        const tag = name.toLowerCase();
        if (tag === 'br') lines.push([]);
        else if (close) {
            if (stack.length > 1) stack.pop();
            if (tag === 'div' || tag === 'p') lines.push([]);
        } else {
            const css = styleOf(attrs);
            const top = stack.at(-1);
            stack.push({
                size: css['font-size']
                    ? Number.parseFloat(css['font-size'])
                    : top.size,
                color: css.color ?? top.color,
            });
        }
    }
    return lines.filter((l) => l.length);
};

const kindOf = (cell, s) => {
    if (cell.getAttribute('edge') === '1') return 'edge';
    if (s.container === '1') return 'container';
    if (s.rhombus) return 'diamond';
    if (s.fillColor === 'none' && s.strokeColor === 'none') return 'label';
    return 'tile';
};

export const parseDrawio = (xml) => {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const root = doc.getElementsByTagName('root')[0];
    const raw = [];
    for (const el of Array.from(root.childNodes).filter(
        (n) => n.nodeType === 1,
    )) {
        const wrapped = el.tagName !== 'mxCell';
        const cell = wrapped ? el.getElementsByTagName('mxCell')[0] : el;
        const id = el.getAttribute('id');
        if (!cell.getAttribute('vertex') && !cell.getAttribute('edge'))
            continue;
        const geo = cell.getElementsByTagName('mxGeometry')[0];
        const num = (k) => Number(geo?.getAttribute(k) ?? 0);
        const style = styleMap(cell.getAttribute('style'));
        const value = wrapped
            ? (el.getAttribute('label') ?? '')
            : (cell.getAttribute('value') ?? '');
        const notes = wrapped
            ? Array.from(el.attributes)
                  .filter((a) => NOTE.test(a.name))
                  .map((a) => [a.name, a.value])
            : [];
        raw.push({
            id,
            kind: kindOf(cell, style),
            parent: cell.getAttribute('parent'),
            style,
            value,
            notes,
            source: cell.getAttribute('source'),
            target: cell.getAttribute('target'),
            x: num('x'),
            y: num('y'),
            w: num('width'),
            h: num('height'),
        });
    }
    const byId = new Map(raw.map((c) => [c.id, c]));
    const absolute = (c) => {
        const p = byId.get(c.parent);
        if (!p || c.abs) return;
        absolute(p);
        c.x += p.x;
        c.y += p.y;
        c.abs = true;
    };
    for (const c of raw) {
        if (c.kind !== 'edge') absolute(c);
        const size = Number(c.style.fontSize ?? 12);
        const color = c.style.fontColor ?? '#000000';
        const shown = c.style.noLabel === '1' ? '' : c.value;
        c.runs =
            c.style.html === '1'
                ? htmlRuns(shown, size, color)
                : shown
                      .split('\n')
                      .filter(Boolean)
                      .map((text) => [{ text, size, color }]);
        c.plain = c.runs
            .map((l) => l.map((r) => r.text).join(''))
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
    return { cells: raw, byId };
};
