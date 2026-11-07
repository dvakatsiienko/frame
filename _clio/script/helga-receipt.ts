// one helga receipt line into its trial's receipt log, above `## rounds` (PK-133), and into clio's receipts log,
// which the siesta card reads, so a green receipt never has to wake her (FRM-494)
import {
    appendFileSync,
    mkdirSync,
    readFileSync,
    writeFileSync,
} from 'node:fs';
import path from 'node:path';

const MARK = '\n## rounds';

export function addReceipt(body: string, fields: string[], day: string) {
    const at = body.indexOf(MARK);
    if (at < 0) throw new Error('no «## rounds» heading to write above');
    const line = `- ${[day, ...fields].join(' · ')}\n`;
    const head = body.slice(0, at).replace(/\n*$/, '\n');
    return `${head}${line}${body.slice(at)}`;
}

export function logReceipt(home: string, fields: string[], at: Date) {
    const dir = path.join(home, '.local/state/clio/grooms');
    mkdirSync(dir, { recursive: true });
    appendFileSync(
        path.join(dir, 'receipts.log'),
        `${[at.toISOString(), ...fields].join('\t')}\n`,
    );
}

if (import.meta.main) {
    // a receipt is one row in both logs, so a multi-line note flattens here
    const fields = process.argv
        .slice(2)
        .map((field) => field.replace(/\s+/g, ' ').trim());
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
    logReceipt(process.env.HOME ?? '', fields, new Date());
    console.log(`helga-receipt: ${fields[0]} logged`);
}
