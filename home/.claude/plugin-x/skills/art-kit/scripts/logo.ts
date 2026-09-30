// official product logos: svgl first (color, light/dark, wordmarks), simple-icons as the mono fallback
// usage: node logo.ts <name> [--light|--dark] [--wordmark] [--mono] [--out <dir>]
//        node logo.ts --manifest <logos.json>   re-fetch every entry, print what changed
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
        dark: { type: 'boolean' },
        light: { type: 'boolean' },
        manifest: { type: 'string' },
        mono: { type: 'boolean' },
        out: { default: '.', type: 'string' },
        wordmark: { type: 'boolean' },
    },
});

const fetchText = async (url: string) => {
    const res = await fetch(url);
    return res.ok ? res.text() : null;
};

const pickRoute = (route: SvglRoute, theme: Theme) =>
    typeof route === 'string' ? route : route[theme];

const fromSvgl = async (name: string, theme: Theme, wordmark: boolean) => {
    const res = await fetch(
        `https://api.svgl.app?search=${encodeURIComponent(name)}`,
    );
    if (!res.ok) return null;
    const hits = (await res.json()) as SvglEntry[];
    const exact = hits.find(
        (hit) => hit.title.toLowerCase() === name.toLowerCase(),
    );
    const entry = exact ?? (hits.length === 1 ? hits[0] : undefined);
    if (!entry) {
        console.error(
            hits.length > 1
                ? `svgl: ${hits.length} matches, name one exactly: ${hits.map((hit) => hit.title).join(', ')} — trying simple-icons (mono)`
                : `svgl: no «${name}» — trying simple-icons (mono)`,
        );
        return null;
    }
    const route = wordmark ? entry.wordmark : entry.route;
    if (!route) {
        console.error(`svgl: «${entry.title}» has no wordmark`);
        return null;
    }
    const url = pickRoute(route, theme);
    const svg = await fetchText(url);
    return svg ? { source: url, svg } : null;
};

const fromSimpleIcons = async (slug: string) => {
    const url = `https://api.iconify.design/simple-icons/${slug}.svg`;
    const svg = await fetchText(url);
    return svg ? { source: url, svg } : null;
};

const fetchLogo = async ({
    name,
    theme = 'light',
    wordmark = false,
    mono = false,
}: LogoSpec) =>
    (mono ? null : await fromSvgl(name, theme, wordmark)) ??
    (await fromSimpleIcons(name.toLowerCase().replace(/[^a-z0-9]/g, '')));

const slugOf = ({ name, theme, wordmark, mono }: LogoSpec) =>
    [
        name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        wordmark && 'wordmark',
        theme === 'dark' && 'dark',
        mono && 'mono',
    ]
        .filter(Boolean)
        .join('-');

if (values.manifest) {
    const manifestPath = resolve(values.manifest);
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<
        string,
        LogoSpec
    >;
    for (const [file, spec] of Object.entries(manifest)) {
        const target = join(dirname(manifestPath), file);
        const logo = await fetchLogo(spec);
        if (!logo) {
            console.log(`✗ ${file}: no hit`);
            continue;
        }
        const before = existsSync(target) ? readFileSync(target, 'utf8') : null;
        if (before === logo.svg) console.log(`= ${file}`);
        else {
            writeFileSync(target, logo.svg);
            console.log(
                `${before === null ? '+' : '~'} ${file} ← ${logo.source}`,
            );
        }
    }
} else {
    const name = positionals.join(' ');
    if (!name) {
        console.error(
            'usage: node logo.ts <name> [--light|--dark] [--wordmark] [--mono] [--out <dir>]',
        );
        process.exit(2);
    }
    const spec: LogoSpec = {
        mono: values.mono,
        name,
        theme: values.dark ? 'dark' : 'light',
        wordmark: values.wordmark,
    };
    const logo = await fetchLogo(spec);
    if (!logo) {
        console.error(
            `no logo for «${name}» in svgl or simple-icons — try the product's exact title or its simple-icons slug (nextdotjs)`,
        );
        process.exit(1);
    }
    mkdirSync(values.out, { recursive: true });
    const target = join(values.out, `${slugOf(spec)}.svg`);
    writeFileSync(target, logo.svg);
    console.log(`${target} ← ${logo.source}`);
    console.log(
        `manifest entry: "${slugOf(spec)}.svg": ${JSON.stringify(spec)}`,
    );
}

/* Types */

type Theme = 'light' | 'dark';
type SvglRoute = string | Record<Theme, string>;

interface SvglEntry {
    route: SvglRoute;
    title: string;
    wordmark?: SvglRoute;
}

interface LogoSpec {
    mono?: boolean;
    name: string;
    theme?: Theme;
    wordmark?: boolean;
}
