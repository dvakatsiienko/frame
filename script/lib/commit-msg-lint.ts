// the commit format of x:cmt §2 and §5, checked at commit-msg. only rules that 1,000 commits of
// history never broke are refusals; a habit history shows (spaced scopes, long descriptions) stays free
const emojiCanon = ['🔧', '🐞', '✨', '🗑️', '📦', '🎨', '📡', '📜', '🍱'];
const conventionalTypes =
    /^(chore|cleanup|feat|fix|format|perf|refactor|style)$/;
const gitGenerated = /^(Merge |Revert |fixup! |squash! |amend! )/;
const closingBesideId =
    /\b(clos(e|es|ed|ing)|fix(es|ed|ing)?|resolv(e|es|ed|ing)|complet(e|es|ed|ing))\b[\s:]+(FRM|BYT|DOT)-\d+/i;
const plainCapitalWord = /^[A-Z][a-z]+(?![\w.\-_/])/;

export function commitMsgLint(message: string): Verdict {
    const text = message
        .split('\n')
        .filter((line) => !line.startsWith('#'))
        .join('\n');
    const subject = text.split('\n')[0]?.trim() ?? '';
    const verdict: Verdict = { errors: [], warnings: [] };
    if (gitGenerated.test(subject)) return verdict;

    const [, emoji = '', scope = '', description = ''] =
        subject.match(/^(\S+) (.+?): (.+)$/) ?? [];
    if (!description) {
        verdict.errors.push(
            'the subject reads `<emoji> <scope>: <description>`',
        );
    } else {
        if (!emojiCanon.map(bare).includes(bare(emoji)))
            verdict.errors.push(
                `«${emoji}» is not in the emoji canon: ${emojiCanon.join(' ')}`,
            );
        if (conventionalTypes.test(scope))
            verdict.errors.push(
                `«${scope}» is a conventional-commit type; the scope names a domain (sline, deps, clio)`,
            );
        if (description.endsWith('.'))
            verdict.errors.push('the description ends without a period');
        if (plainCapitalWord.test(description))
            verdict.warnings.push(
                'the description opens with a capital; lowercase unless it is a name',
            );
    }
    const keyword = text.match(closingBesideId);
    if (keyword)
        verdict.errors.push(
            `«${keyword[0]}» would close the ticket through linear's github sync; close it in linear instead`,
        );
    return verdict;
}

function bare(emoji: string) {
    return emoji.replaceAll('️', '');
}

/* Types */

export interface Verdict {
    errors: string[];
    warnings: string[];
}
