// prints what dima dropped on the vorssaint utils shelf: one path per line, «(gone)» when the file moved;
// the app keeps the list as json inside its preferences, under shelfItems
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

type ShelfItem = { path?: string; title: string; kind: string };

const raw = execFileSync('defaults', ['export', 'com.vorssaint.utils', '-'], {
    encoding: 'utf8',
});
const json = raw.match(
    /<key>shelfItems<\/key>\s*<data>([\s\S]*?)<\/data>/,
)?.[1];
const items: ShelfItem[] = json
    ? JSON.parse(
          Buffer.from(json.replace(/\s/g, ''), 'base64').toString('utf8'),
      )
    : [];

if (process.argv.includes('--json')) {
    console.log(JSON.stringify(items));
} else if (items.length === 0) {
    console.log('shelf: empty');
} else {
    for (const { path, title, kind } of items) {
        console.log(
            path
                ? `${path}${existsSync(path) ? '' : '  (gone)'}`
                : `${kind}: ${title}`,
        );
    }
}
