import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

// files and dirs: the absolute paths on disk
function world(on: On, files: string[] = [], dirs: string[] = []) {
    mock.clock(on, { now: 1_000_000 });
    mock.store(on);
    const ran: string[] = [];
    on('session.id', () => ({ value: 'a1a1a1a1-0000' }));
    on('session.cwd', () => ({ value: '/repo' }));
    on('env.get', (_$, e) => ({
        value: e.name === 'HOME' ? '/home' : undefined,
    }));
    on('fs.exists', (_$, e) => ({
        value: files.includes(e.path) || dirs.includes(e.path),
    }));
    on('fs.stat', (_$, e) => ({
        value: {
            isLink: false,
            kind: dirs.includes(e.path) ? 'dir' : 'file',
            mtimeMs: 0,
            size: 1,
        },
    }));
    on('tool.call', (_$, e) => {
        ran.push('command' in e ? String(e.command) : '');
        return { result: {}, text: 'ran' };
    });
    return { ran };
}

const bash = ($: Engine, command: string) =>
    $.tool.call({ command, tool: 'Bash' });

// group, command, the door its refusal names, the files on disk
const REFUSED = [
    ['system', 'sudo', 'sudo pmset -a sleep 0', 'hand dima the command', []],
    [
        'system',
        'diskutil erase',
        'diskutil eraseDisk APFS X disk4',
        'ask cclio',
        [],
    ],
    ['system', 'dd of=/dev', 'dd if=img of=/dev/disk4 bs=1m', 'ask cclio', []],
    ['system', 'mkfs', 'mkfs.ext4 /dev/sdb1', 'ask cclio', []],
    ['system', 'chmod -R on ~', 'chmod -R 700 ~', 'the one path you mean', []],
    [
        'system',
        'chown -R on ~',
        'chown -R dima "$HOME"',
        'the one path you mean',
        [],
    ],
    ['system', 'csrutil', 'csrutil disable', 'hand dima the step', []],
    ['system', 'spctl', 'spctl --master-disable', 'hand dima the step', []],
    ['system', 'tccutil reset', 'tccutil reset All', 'hand dima the step', []],
    [
        'overwrite',
        ': > file',
        ': > notes.md',
        'the Write tool',
        ['/repo/notes.md'],
    ],
    [
        'overwrite',
        'cp /dev/null',
        'cp /dev/null log.txt',
        'the Write tool',
        ['/repo/log.txt'],
    ],
    [
        'overwrite',
        '> onto a file',
        'echo x > a.ts',
        'the Write tool',
        ['/repo/a.ts'],
    ],
    [
        'overwrite',
        '2> onto a file',
        'make 2> err.log',
        'the Write tool',
        ['/repo/err.log'],
    ],
    [
        'overwrite',
        'mv onto a file',
        'mv a.ts b.ts',
        'mv -n',
        ['/repo/a.ts', '/repo/b.ts'],
    ],
    [
        'overwrite',
        'mv into a dir onto a file',
        'mv a.ts src',
        'mv -n',
        ['/repo/a.ts', '/repo/src/a.ts'],
    ],
    [
        'overwrite',
        'cp -f onto a file',
        'cp -f a.ts b.ts',
        'cp -n',
        ['/repo/a.ts', '/repo/b.ts'],
    ],
    ['history', 'git filter-repo', 'git filter-repo --path x', 'ask cclio', []],
    [
        'history',
        'git filter-branch',
        'git filter-branch --tree-filter x',
        'ask cclio',
        [],
    ],
    ['history', 'git gc --prune=now', 'git gc --prune=now', 'ask cclio', []],
    ['prune', 'brew cleanup', 'brew cleanup', 'name it in your report', []],
    [
        'prune',
        'pnpm store prune',
        'pnpm store prune',
        'name it in your report',
        [],
    ],
    [
        'prune',
        'docker system prune',
        'docker system prune -af',
        'name it in your report',
        [],
    ],
    ['prune', 'crontab -r', 'crontab -r', 'name it in your report', []],
    [
        'remote',
        'gh repo delete',
        'gh repo delete x-com/old --yes',
        'ask cclio',
        [],
    ],
    ['remote', 'gh release delete', 'gh release delete v1', 'ask cclio', []],
    ['remote', 'vercel rm', 'vercel rm my-app --yes', 'ask cclio', []],
    [
        'remote',
        'vercel env rm',
        'vercel env rm KEY production',
        'ask cclio',
        [],
    ],
    ['remote', 'op item delete', 'op item delete x-golden', 'ask cclio', []],
    [
        'remote',
        'security delete-*',
        'security delete-generic-password -s x',
        'ask cclio',
        [],
    ],
    [
        'remote',
        'linear issue delete',
        'linear issue delete FRM-1',
        'cancel it',
        [],
    ],
    [
        'remote',
        'an issueDelete mutation',
        `curl -d '{"query":"mutation { issueDelete(id: \\"x\\") { success } }"}' https://api.linear.app/graphql`,
        'cancel it',
        [],
    ],
    ['top dir', 'trash ~', 'trash ~', 'the files inside it', []],
    [
        'top dir',
        'trash ~/Documents',
        'trash ~/Documents/',
        'the files inside it',
        [],
    ],
    [
        'top dir',
        'trash the vault root',
        `trash "/home/Library/Mobile Documents/iCloud~md~obsidian/Documents/Vault"`,
        'the files inside it',
        [],
    ],
    [
        'top dir',
        'defaults delete <domain>',
        'defaults delete com.apple.dock',
        'one key',
        [],
    ],
    ['top dir', 'defaults delete -g', 'defaults delete -g', 'one key', []],
] as const;

for (const [group, shape, command, door, files] of REFUSED)
    test(`${group}: ${shape} is refused with its door`, async ($, on) => {
        const w = world(on, [...files], ['/repo/src']);
        expect((await bash($, command)).deny).toContain(door);
        expect(w.ran).toEqual([]);
    });

// the nearest harmless form of each group
const RUNS = [
    ['system', 'diskutil list', 'diskutil list', []],
    ['system', 'dd to a file', 'dd if=/dev/zero of=blob bs=1k count=1', []],
    ['system', 'chmod -R inside ~', 'chmod -R 700 ~/frame/build', []],
    ['system', 'csrutil status', 'csrutil status', []],
    ['overwrite', '> onto a new file', 'echo x > new.ts', []],
    ['overwrite', '>> onto a file', 'echo x >> a.ts', ['/repo/a.ts']],
    ['overwrite', '> /dev/null and 2>&1', 'ls > /dev/null 2>&1', []],
    ['overwrite', 'mv onto a new name', 'mv a.ts b.ts', ['/repo/a.ts']],
    ['overwrite', 'mv into a dir', 'mv a.ts src', ['/repo/a.ts']],
    ['overwrite', 'cp onto a new name', 'cp -f a.ts c.ts', ['/repo/a.ts']],
    ['history', 'git gc', 'git gc', []],
    ['prune', 'brew list', 'brew list', []],
    ['prune', 'crontab -l', 'crontab -l', []],
    ['remote', 'gh release view', 'gh release view v1', []],
    ['remote', 'vercel env ls', 'vercel env ls', []],
    ['remote', 'a linear issue read', 'linear issue view FRM-1', []],
    [
        'top dir',
        'trash of a file in ~/Documents',
        'trash ~/Documents/old.pdf',
        [],
    ],
    [
        'top dir',
        'trash of a note in the vault',
        `trash "/home/Library/Mobile Documents/iCloud~md~obsidian/Documents/Vault/a.md"`,
        [],
    ],
    [
        'top dir',
        'defaults delete of one key',
        'defaults delete com.apple.dock autohide',
        [],
    ],
] as const;

for (const [group, shape, command, files] of RUNS)
    test(`${group}: ${shape} runs`, async ($, on) => {
        const w = world(on, [...files], ['/repo/src']);
        expect((await bash($, command)).deny).toBeUndefined();
        expect(w.ran).toEqual([command]);
    });

test('sudo ahead of a floor command keeps the floor door', async ($, on) => {
    world(on);
    expect((await bash($, 'sudo rm -rf /opt/x')).deny).toContain('trash');
});
