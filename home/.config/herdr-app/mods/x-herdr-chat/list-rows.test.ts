import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const main = readFileSync(new URL('./main.js', import.meta.url), 'utf8');

/** a method's body, from its signature line to the next method's doc comment */
function methodBody(name: string) {
    const start = main.indexOf(`\n    ${name}(`);
    const end = main.indexOf('\n    /**', start + 1);
    return main.slice(start, end);
}

// herdr-app#894: a press or hover handler inside a virtual list's item blanks the whole list. FRM-587's file row
// carried one, and a reply naming a file left clio's thread empty (dima, 14:15)
describe('nothing drawn inside a list row carries a handler', () => {
    test.each(['row', 'fileRow'])(
        '%s holds no press or hover handler',
        (name) => {
            const body = methodBody(name);
            expect(body.length).toBeGreaterThan(100);
            expect(body).not.toMatch(
                /\.(?:on_click|on_mouse_down|on_mouse_up|hover)\(/,
            );
        },
    );
});
