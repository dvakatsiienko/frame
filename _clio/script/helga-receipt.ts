// one helga receipt line into its trial's receipt log, above `## rounds` (PK-133): helga stops hand-typing them
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const MARK = '\n## rounds';

export function addReceipt(body: string, fields: string[], day: string) {
    const at = body.indexOf(MARK);
    if (at < 0) throw new Error('no «## rounds» heading to write above');
    const line = `- ${[day, ...fields].join(' · ')}\n`;
    const head = body.slice(0, at).replace(/\n*$/, '\n');
    return `${head}${line}${body.slice(at)}`;
}

if (import.meta.main) {
    const fields = process.argv.slice(2);
    if (fields.length !== 4) {
        console.error(
            'usage: node helga-receipt.ts <class> <first pass> <rework> <note>',
        );
        process.exit(2);
    }
    const file = path.resolve(
        import.meta.dirname,
        '../../docs/test-drive/helga.md',
    );
    const day = new Date().toLocaleDateString('sv');
    writeFileSync(file, addReceipt(readFileSync(file, 'utf8'), fields, day));
    console.log(`helga-receipt: ${fields[0]} logged`);
}
