import { describe, expect, test } from 'vitest';

import { verdict } from './fresh-eyes-blind.ts';

const shots = '/tmp/fe/shots';
const bash = (command: string) => verdict('Bash', { command }, shots);

describe('fresh-eyes-blind', () => {
    test('lets a plain agent-browser call on the local build through', () => {
        expect(bash('agent-browser open http://localhost:7373/')).toBeUndefined();
        expect(bash('agent-browser click @e3')).toBeUndefined();
    });

    test.each([
        ['cat src/App.tsx', 'only agent-browser or the x cli'],
        ['agent-browser open file:///Users/dima/x.html', 'source'],
        ['agent-browser open view-source:http://localhost:7373/', 'source'],
        ['agent-browser open http://localhost:7373/src/main.tsx', 'source'],
        ['agent-browser open http://localhost:7373/assets/index.js.map', 'source'],
        ['agent-browser eval document.body.innerHTML', 'eval'],
        ['agent-browser open https://github.com/a/b', 'local build'],
        ['agent-browser snapshot; cat src/a.ts', 'chaining'],
    ])('refuses %s', (command, why) => {
        expect(bash(command)).toContain(why);
    });

    test('reads the x cli through its help only', () => {
        expect(bash('x')).toBeUndefined();
        expect(bash('x lane')).toBeUndefined();
        expect(bash('x schema linear')).toBeUndefined();
        expect(bash('x lane push --help')).toBeUndefined();
        expect(bash('x lane push')).toContain('--help');
        expect(bash('x linear set FRM-1 --state Done')).toContain('--help');
    });

    test('reads only its own shots', () => {
        expect(verdict('Read', { file_path: '/tmp/fe/shots/1.png' }, shots)).toBeUndefined();
        expect(verdict('Read', { file_path: '/tmp/fe/shots/../app/src/a.ts' }, shots)).toContain('screenshots');
        expect(verdict('Read', { file_path: '/Users/dima/projects/bytes/apps/chords/src/App.tsx' }, shots)).toContain('screenshots');
    });

    test('refuses any other tool', () => {
        expect(verdict('Grep', {}, shots)).toContain('no Grep');
    });
});
