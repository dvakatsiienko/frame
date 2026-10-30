import {
    type Command,
    type Context,
    type Refusal,
    commandsDeep,
    hasFlag,
    operands,
    resolve,
} from './command.ts';

// `backlog task edit <id> --notes` replaces the task's notes whole, so a note already there is wiped without a word
// (PK-150); `--append-notes` keeps it
export type NotesEdit = { id: string; root: string };

function notesEdit(c: Command, ctx: Context): NotesEdit | undefined {
    const [verb, sub, id] = operands(c.args);
    if (c.name !== 'backlog' || verb !== 'task' || sub !== 'edit' || !id)
        return undefined;
    if (!hasFlag(c.args, ['--notes'])) return undefined;
    const cwd = c.assigns
        .find((a) => a.startsWith('BACKLOG_CWD='))
        ?.slice('BACKLOG_CWD='.length);
    const dir = resolve(c.dir, '/', ctx);
    return { id, root: cwd ? resolve(cwd, dir, ctx) : dir };
}

// what lookUp reads off disk for each edit: the key the rule finds in ctx.notedTasks
export const notedKey = (e: NotesEdit) => `${e.root}\n${e.id.toLowerCase()}`;

export function notesEdits(command: string, cwd: string, ctx: Context = {}) {
    return commandsDeep(command, cwd).flatMap((c) => {
        const e = notesEdit(c, ctx);
        return e ? [e] : [];
    });
}

// a task file's notes block holds text
export function hasNotes(task: string) {
    return /<!-- SECTION:NOTES:BEGIN -->\s*(?!<!-- SECTION:NOTES:END -->)\S/.test(
        task,
    );
}

export function notes(c: Command, ctx: Context): Refusal | undefined {
    const e = notesEdit(c, ctx);
    if (!e || !ctx.notedTasks?.has(notedKey(e))) return undefined;
    return {
        door: `backlog task edit ${e.id} --append-notes <text>`,
        rule: 'notes-replace',
        targets: ['--notes'],
        why: `--notes replaces the notes ${e.id} already holds, a silent wipe`,
    };
}
