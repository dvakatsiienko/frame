// Drives the pinned 0.18.1 editor with real mouse and keyboard events in headless Chrome: open, drag, edit, add, save.
import { existsSync } from 'node:fs';

const BUNDLE = new URL('editor.bundle.js', import.meta.url).pathname;
const VIEW = { width: 1500, height: 950 };

export const openEditor = async (page, boardJson) => {
    if (!existsSync(BUNDLE))
        throw new Error(
            'editor.bundle.js missing: run `pnpm --dir out build:router`',
        );
    const byId = new Map(JSON.parse(boardJson).elements.map((e) => [e.id, e]));
    await page.setViewportSize(VIEW);
    await page.addScriptTag({ path: BUNDLE });
    await page.evaluate((json) => window.loadBoard(json), boardJson);
    await page.waitForSelector('canvas.interactive');

    // scroll a scene point to mid-screen at zoom 1 and return where it sits
    const focusAt = async (x, y) => {
        await page.evaluate(([px, py]) => window.focusAt(px, py), [x, y]);
        return { x: VIEW.width / 2, y: VIEW.height / 2 };
    };
    const centerOf = (id) => {
        const e = byId.get(id);
        return focusAt(e.x + e.width / 2, e.y + e.height / 2);
    };

    return {
        save: () => page.evaluate(() => window.saveBoard()),
        drag: async (id, dx) => {
            const { x, y } = await centerOf(id);
            await page.mouse.move(x, y);
            await page.mouse.down();
            for (let i = 1; i <= 8; i++)
                await page.mouse.move(x + (dx * i) / 8, y, { steps: 2 });
            await page.mouse.up();
            await page.keyboard.press('Escape');
        },
        editText: async (id, text) => {
            const { x, y } = await centerOf(id);
            await page.mouse.dblclick(x, y);
            // the first double-click inside a group only selects the text; Enter starts the edit
            if (!(await page.locator('textarea.excalidraw-wysiwyg').count()))
                await page.keyboard.press('Enter');
            await page.waitForSelector('textarea.excalidraw-wysiwyg');
            await page.keyboard.press('Meta+A');
            await page.keyboard.insertText(text);
            await page.keyboard.press('Escape');
            await page.keyboard.press('Escape');
        },
        addNote: async (sceneX, sceneY, text) => {
            const { x, y } = await focusAt(sceneX, sceneY);
            await page.keyboard.press('t');
            await page.mouse.click(x, y);
            await page.waitForSelector('textarea.excalidraw-wysiwyg');
            await page.keyboard.insertText(text);
            await page.keyboard.press('Escape');
            await page.keyboard.press('Escape');
        },
    };
};
