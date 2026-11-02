import { expect, test } from 'claude-code/testing';

import { refusals } from '../hooks/rules.ts';

const flagged = (command: string) =>
    refusals(command, '/repo').filter((r) => r.rule === 'opaque-head');

// the one class rule (dima's o1 and o35): each way a command's name hides, flagged with its literal spelling
for (const [shape, command, door] of [
    ['an unfilled default', '${X:-ls} -l', 'spell the command out'],
    ['a value read from stdin', 'read R; $R -l', 'spell the command out'],
    ['a loop var', 'for R in ls cat; do $R x; done', '`ls`'],
    ['a rebound var', 'R=ls; true || R=cat; $R x', '`ls`'],
    ['an echo substitution', '$(echo ls) -l', '`ls`'],
    ['a brace list', 'l{s,} -l', '`l{s,}`'],
    ['printf piped into a shell', "printf 'ls' | bash", '`ls …`'],
    ['echo piped into a shell', "echo 'ls' | sh", '`ls …`'],
    ['a sourced substitution', 'source <(echo ls)', '`ls …`'],
    ['a plain git alias', "git -c alias.s='status' s", '`git …`'],
] as const)
    test(`a hidden command name is flagged with its spelling: ${shape}`, () => {
        expect(
            flagged(command)
                .map((r) => r.door)
                .join(),
        ).toContain(door);
    });

for (const command of [
    'ls -l',
    'S=/tmp/s; $S/run.sh',
    'R=ls; $R -l',
    'bash -c "ls"',
    "cat <<'EOF' | bash\nls\nEOF",
    'f(){ "$@"; }; f ls',
    'echo $(( $(date +%s) - 5 ))',
    '"/Applications/My App/bin/x" y',
])
    test(`a command typed as it runs is not flagged: ${JSON.stringify(command)}`, () => {
        expect(flagged(command)).toEqual([]);
    });
