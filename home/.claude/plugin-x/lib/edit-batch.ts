/**
 * ? edit-batch — many anchored edits in one call, all or nothing.
 * ?
 * ? The batch is a text file, so a model writes it through a quoted heredoc with nothing to
 * ? escape; json would need every newline and quote escaped, the trap this exists to avoid:
 * ?
 * ?   @@@ apps/web/src/a.ts
 * ?   @@ anchor
 * ?   const a = 1;
 * ?   @@ replacement
 * ?   const a = 2;
 * ?
 * ? An anchor or replacement is every line between its marker and the next one, joined by
 * ? newlines, with no newline at its end. Edits to one file apply in order, each against the
 * ? text the previous one left.
 */

/* Instruments */
import { editAnchored } from './edit-anchored.ts';

export type Edit = { file: string; anchor: string; replacement: string };

type Batch = { edits: Edit[]; error: null } | { edits: []; error: string };

type Applied =
    | { texts: Map<string, string>; hits: string[]; error: null }
    | { texts: Map<string, string>; hits: string[]; error: string };

export function parseBatch(text: string): Batch {
    const edits: Edit[] = [];
    let current:
        | { file: string; anchor?: string[]; replacement?: string[] }
        | undefined;
    let section: 'anchor' | 'replacement' | undefined;

    const close = (): string | null => {
        if (!current) return null;
        if (!current.anchor || !current.replacement) {
            return `${current.file}: an edit needs both «@@ anchor» and «@@ replacement»`;
        }
        edits.push({
            anchor: current.anchor.join('\n'),
            file: current.file,
            replacement: current.replacement.join('\n'),
        });
        return null;
    };

    for (const line of text.replace(/\n$/, '').split('\n')) {
        if (line.startsWith('@@@ ')) {
            const error = close();
            if (error) return { edits: [], error };
            current = { file: line.slice(4).trim() };
            section = undefined;
        } else if (line === '@@ anchor' || line === '@@ replacement') {
            if (!current)
                return {
                    edits: [],
                    error: `«${line}» before any «@@@ <file>»`,
                };
            section = line === '@@ anchor' ? 'anchor' : 'replacement';
            current[section] = [];
        } else if (current && section) {
            current[section]?.push(line);
        } else if (line.trim() !== '') {
            return {
                edits: [],
                error: `a line outside any section: «${line}»`,
            };
        }
    }
    const error = close();
    if (error) return { edits: [], error };
    if (edits.length === 0)
        return { edits: [], error: 'the batch holds no edits' };
    return { edits, error: null };
}

export function applyBatch(
    edits: Edit[],
    read: (file: string) => string,
): Applied {
    const texts = new Map<string, string>();
    const hits: string[] = [];
    for (const edit of edits) {
        const before = texts.get(edit.file) ?? read(edit.file);
        const edited = editAnchored(before, edit.anchor, edit.replacement);
        if (edited.error !== null) {
            return { error: `${edit.file}: ${edited.error}`, hits, texts };
        }
        texts.set(edit.file, edited.text);
        hits.push(`${edit.file}:${edited.line}`);
    }
    return { error: null, hits, texts };
}
