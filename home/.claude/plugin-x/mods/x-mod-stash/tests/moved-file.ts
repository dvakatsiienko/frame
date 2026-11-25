// a world's `mv -f <from> <to>`: a write that lands whole, moved over its file
export function movedFile(
    files: Record<string, string>,
    argv: readonly string[],
) {
    const [cmd, , from, to] = argv;
    if (cmd !== 'mv' || !from || !to) return;
    files[to] = files[from] ?? '';
    delete files[from];
}
