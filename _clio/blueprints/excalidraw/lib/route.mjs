import { existsSync } from 'node:fs';

const BUNDLE = new URL('editor.bundle.js', import.meta.url).pathname;

export const routeArrows = async (page, elements) => {
    if (!existsSync(BUNDLE))
        throw new Error(
            'editor.bundle.js missing: run `pnpm --dir out build:router`',
        );
    if (!(await page.evaluate(() => typeof window.route === 'function')))
        await page.addScriptTag({ path: BUNDLE });
    return page.evaluate((els) => window.route(els), elements);
};
