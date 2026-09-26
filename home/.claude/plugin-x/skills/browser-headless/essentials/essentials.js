// the web ui essentials, one eval on the current page state: agent-browser eval "$(cat <dir>/essentials.js)"
// prints { pass: [...], fail: { <check>: [...] } }. every check guards a rule in essentials.md.
(async () => {
    const AXE = 'https://cdn.jsdelivr.net/npm/axe-core@4.13.0/axe.min.js';
    const INTERACTIVE =
        'button, a[href], summary, select, [role=button], [role=link], [role=tab], [role=menuitem], [role=option], [role=checkbox], [role=radio], [role=switch], input[type=checkbox], input[type=radio]';
    const THUMB = '[data-slot=slider-thumb], [role=slider]';
    const TRACK = '[data-slot=slider-track]';

    const label = (el) => {
        const text = (el.getAttribute('aria-label') || el.textContent || '')
            .trim()
            .slice(0, 30);
        const slot = el.getAttribute('data-slot');
        return `${el.tagName.toLowerCase()}${slot ? `[${slot}]` : ''}${text ? ` «${text}»` : ''}`;
    };
    const isOn = (el) =>
        !el.matches(':disabled, [aria-disabled=true]') &&
        el.getClientRects().length > 0;
    const clippers = (el) => {
        const out = [];
        for (let p = el.parentElement; p; p = p.parentElement) {
            const s = getComputedStyle(p);
            if (s.overflowX !== 'visible' || s.overflowY !== 'visible')
                out.push(p);
        }
        return out;
    };
    const ringOf = (el) => {
        const cs = getComputedStyle(el);
        const outline =
            cs.outlineStyle === 'none'
                ? 0
                : (parseFloat(cs.outlineWidth) || 0) +
                  (parseFloat(cs.outlineOffset) || 0);
        const spread = [
            ...cs.boxShadow.matchAll(
                /(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px(?!\s*inset)/g,
            ),
        ].reduce((max, m) => Math.max(max, parseFloat(m[4])), 0);
        return Math.max(outline, spread);
    };

    const checks = {};

    checks.axe = async () => {
        if (!window.axe) {
            await new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = AXE;
                s.onload = resolve;
                s.onerror = () =>
                    reject(new Error(`axe did not load from ${AXE}`));
                document.head.append(s);
            });
        }
        const r = await window.axe.run(document, {
            // target-size (wcag 2.5.8, 24 px) ships disabled in axe 4.13
            rules: { 'target-size': { enabled: true } },
            runOnly: {
                type: 'tag',
                values: [
                    'wcag2a',
                    'wcag2aa',
                    'wcag21aa',
                    'wcag22aa',
                    'best-practice',
                ],
            },
        });
        return r.violations.map(
            (v) =>
                `${v.impact} ${v.id} ×${v.nodes.length}: ${v.nodes[0].target.join(' ')}`,
        );
    };

    checks.overflow = () => {
        const wide = [...document.body.querySelectorAll('*')].filter(
            (el) => el.getBoundingClientRect().right > innerWidth + 1,
        );
        const outermost = wide.filter(
            (el) => !wide.includes(el.parentElement) && !clippers(el).length,
        );
        const page =
            document.documentElement.scrollWidth > innerWidth
                ? [
                      `page scrolls sideways: ${document.documentElement.scrollWidth} > ${innerWidth}`,
                  ]
                : [];
        return [
            ...page,
            ...outermost.map(
                (el) =>
                    `${label(el)} right edge ${Math.round(el.getBoundingClientRect().right)}`,
            ),
        ];
    };

    checks.ringClip = () => {
        const shown = document.querySelectorAll(
            '[aria-current], [aria-selected=true], [data-state=active], :focus-visible',
        );
        const cuts = [];
        for (const el of shown) {
            const ring = ringOf(el);
            if (!ring) continue;
            const a = el.getBoundingClientRect();
            for (const p of clippers(el)) {
                const b = p.getBoundingClientRect();
                const gap = {
                    bottom: b.bottom - a.bottom - ring,
                    left: a.left - ring - b.left,
                    right: b.right - a.right - ring,
                    top: a.top - ring - b.top,
                };
                // cut by less than the ring = a clipped ring; cut by more = scrolled out of view, not a defect
                const sides = Object.entries(gap).filter(
                    ([, v]) => v < 0 && v >= -ring,
                );
                for (const [side, v] of sides)
                    cuts.push(
                        `${label(el)} ${side} ${v.toFixed(1)} in ${p.getAttribute('data-slot') || p.tagName.toLowerCase()}`,
                    );
            }
        }
        return cuts;
    };

    checks.truncation = () =>
        [...document.body.querySelectorAll('*')]
            .filter((el) => {
                const cs = getComputedStyle(el);
                const clamps =
                    cs.textOverflow === 'ellipsis' ||
                    cs.webkitLineClamp !== 'none';
                const cut =
                    el.scrollWidth > el.clientWidth + 1 ||
                    el.scrollHeight > el.clientHeight + 1;
                return (
                    clamps &&
                    cut &&
                    !el.title &&
                    !el.closest('[title]') &&
                    !el.getAttribute('aria-label')
                );
            })
            .map((el) => `${label(el)} cut with no title`);

    checks.images = () =>
        [...document.images]
            .filter((i) => i.complete && i.naturalWidth === 0)
            .map((i) => `broken ${i.currentSrc || i.src}`);

    // the cursor the user sees is the one on the element on top at the control's centre,
    // so a hidden 1×1 input or a transparent input laid over a thumb is judged by what covers it
    const seenCursor = (el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) return null;
        const hit = document.elementFromPoint(
            r.left + r.width / 2,
            r.top + r.height / 2,
        );
        if (!hit || !(el.contains(hit) || hit.contains(el))) return null;
        return getComputedStyle(hit).cursor;
    };
    checks.cursor = () => {
        const wrong = [];
        const judge = (selector, wanted) => {
            for (const el of document.querySelectorAll(selector)) {
                const cursor = isOn(el) && seenCursor(el);
                if (cursor && !wanted.includes(cursor))
                    wrong.push(
                        `${label(el)} cursor ${cursor}, wants ${wanted[0]}`,
                    );
            }
        };
        judge(INTERACTIVE, ['pointer']);
        judge(TRACK, ['pointer']);
        judge(THUMB, ['grab', 'grabbing']);
        return wrong;
    };

    const pass = [];
    const fail = {};
    for (const [name, run] of Object.entries(checks)) {
        try {
            const found = await run();
            if (found.length)
                fail[name] = found
                    .slice(0, 12)
                    .concat(
                        found.length > 12
                            ? [`… ${found.length - 12} more`]
                            : [],
                    );
            else pass.push(name);
        } catch (error) {
            fail[name] = [`check crashed: ${error.message}`];
        }
    }
    return {
        fail,
        pass,
        url: location.pathname,
        viewport: `${innerWidth}×${innerHeight}`,
    };
})();
