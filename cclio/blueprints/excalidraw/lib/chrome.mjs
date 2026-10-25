import { chromium } from 'playwright-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

export const openChrome = async () => {
    const browser = await chromium.launch({ executablePath: CHROME });
    const page = await browser.newPage();
    await page.goto('about:blank');
    return { browser, page };
};
