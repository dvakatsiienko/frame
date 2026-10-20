// usage: pnpm x-changedetector:watch-remove <url>   — drops the watch that pnpm x-changedetector:watch-add made for that url
import { apiKey, watchApi, watchFor } from './watch-add.ts';

async function main(input: string | undefined) {
    if (!input) {
        console.error('usage: pnpm x-changedetector:watch-remove <url>');
        process.exit(2);
    }
    const headers = { 'x-api-key': apiKey() };
    const { url } = watchFor(input);
    const list = (await (await fetch(watchApi, { headers })).json()) as Record<
        string,
        { url: string; title?: string }
    >;
    const known = Object.entries(list).find(([, w]) => w.url === url);
    if (!known) {
        console.error(`not watched: ${url}`);
        process.exit(1);
    }
    const [uuid, watch] = known;
    const res = await fetch(`${watchApi}/${uuid}`, {
        headers,
        method: 'DELETE',
    });
    if (!res.ok) {
        console.error(
            `x-changedetector refused: ${res.status} ${await res.text()}`,
        );
        process.exit(1);
    }
    console.log(`removed: ${uuid} · ${watch.title ?? url}`);
}

if (import.meta.main) await main(process.argv[2]);
