// official product logos into a logo store: svgl first (color, light/dark, wordmarks), simple-icons as
// the mono fallback, and --app for an installed mac app's own icon when neither catalogue carries it
// usage: node logo.ts <name> [--dark] [--wordmark] [--mono] [--store <dir>]
//        node logo.ts --app <bundle id> [--size <px>] [--store <dir>]
//        node logo.ts --refresh [--store <dir>]   re-fetch every entry, print what changed
// a store is a dir of marks with logos.json beside them, defaulting to the repo's logos/marks; after a
// write, the store package's own build (../build.ts) runs when it exists
import { execFileSync } from 'node:child_process';
import {
    existsSync,
    mkdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
        app: { type: 'string' },
        dark: { type: 'boolean' },
        mono: { type: 'boolean' },
        refresh: { type: 'boolean' },
        size: { default: '64', type: 'string' },
        store: { type: 'string' },
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
    // a lone fuzzy hit is taken, but said out loud: «calendar» silently became google calendar once
    if (!exact)
        console.error(
            `svgl: «${name}» matched «${entry.title}» — check it is the product you meant`,
        );
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

const fetchSvg = async ({
    name,
    theme = 'light',
    wordmark = false,
    mono = false,
}: SvgSpec) =>
    (mono ? null : await fromSvgl(name, theme, wordmark)) ??
    (await fromSimpleIcons(name.toLowerCase().replace(/[^a-z0-9]/g, '')));

// NSWorkspace draws the icon the Finder shows, Assets.car apps included; sips scales it. same bytes every run
const fromApp = ({ app, size }: AppSpec) => {
    const path = execFileSync(
        'mdfind',
        [`kMDItemCFBundleIdentifier == '${app}'`],
        { encoding: 'utf8' },
    )
        .split('\n')
        .find((line) => line.endsWith('.app'));
    if (!path) return null;
    const full = join(tmpdir(), `logo-${process.pid}.png`);
    execFileSync('osascript', ['-l', 'JavaScript', '-e', ICON_JXA, path, full]);
    execFileSync('sips', ['-Z', String(size), full, '--out', `${full}.small`], {
        stdio: 'ignore',
    });
    const png = readFileSync(`${full}.small`);
    rmSync(full);
    rmSync(`${full}.small`);
    return { png, source: path };
};

const ICON_JXA = `ObjC.import('AppKit');
function run(argv) {
    const icon = $.NSWorkspace.sharedWorkspace.iconForFile(argv[0]);
    const rep = $.NSBitmapImageRep.imageRepWithData(icon.TIFFRepresentation);
    rep.representationUsingTypeProperties($.NSBitmapImageFileTypePNG, $()).writeToFileAtomically(argv[1], true);
}`;

const slugOf = (spec: Spec) =>
    'app' in spec
        ? `${spec.app.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`
        : `${[
              spec.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
              spec.wordmark && 'wordmark',
              spec.theme === 'dark' && 'dark',
              spec.mono && 'mono',
          ]
              .filter(Boolean)
              .join('-')}.svg`;

const fetchMark = async (spec: Spec) => {
    if ('app' in spec) {
        const icon = fromApp(spec);
        return icon ? { data: icon.png, source: icon.source } : null;
    }
    const logo = await fetchSvg(spec);
    return logo ? { data: Buffer.from(logo.svg), source: logo.source } : null;
};

const storeDir = resolve(
    values.store ??
        join(
            execFileSync('git', ['rev-parse', '--show-toplevel'], {
                encoding: 'utf8',
            }).trim(),
            'logos',
            'marks',
        ),
);
const manifestPath = join(storeDir, 'logos.json');
if (!existsSync(storeDir)) {
    console.error(
        `no logo store at ${storeDir} — pass --store <dir>, the dir that holds the marks and logos.json`,
    );
    process.exit(2);
}
const manifest: Record<string, Spec> = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, 'utf8'))
    : {};

const saveAndBuild = () => {
    const sorted = Object.fromEntries(
        Object.entries(manifest).sort(([a], [z]) => a.localeCompare(z)),
    );
    writeFileSync(manifestPath, `${JSON.stringify(sorted, null, 4)}\n`);
    const build = join(storeDir, '..', 'build.ts');
    if (existsSync(build)) execFileSync('node', [build], { stdio: 'inherit' });
};

if (values.refresh) {
    for (const [file, spec] of Object.entries(manifest)) {
        const target = join(storeDir, file);
        const mark = await fetchMark(spec);
        if (!mark) {
            console.log(`✗ ${file}: no hit`);
            continue;
        }
        const before = existsSync(target) ? readFileSync(target) : null;
        if (before?.equals(mark.data)) console.log(`= ${file}`);
        else {
            writeFileSync(target, mark.data);
            console.log(
                `${before === null ? '+' : '~'} ${file} ← ${mark.source}`,
            );
        }
    }
    saveAndBuild();
} else {
    const name = positionals.join(' ');
    const spec: Spec | null = values.app
        ? { app: values.app, size: Number(values.size) }
        : name
          ? {
                name,
                ...(values.mono && { mono: true }),
                ...(values.dark && { theme: 'dark' as const }),
                ...(values.wordmark && { wordmark: true }),
            }
          : null;
    if (!spec) {
        console.error(
            'usage: node logo.ts <name> [--dark] [--wordmark] [--mono] | --app <bundle id> [--size <px>] | --refresh, each [--store <dir>]',
        );
        process.exit(2);
    }
    const mark = await fetchMark(spec);
    if (!mark) {
        console.error(
            'app' in spec
                ? `no installed app with bundle id «${spec.app}» — mdfind found nothing`
                : `no logo for «${spec.name}» in svgl or simple-icons — try the product's exact title or its simple-icons slug (nextdotjs)`,
        );
        process.exit(1);
    }
    // svgl ships one file for most products; a dark copy of the light file only adds a duplicate
    if (!('app' in spec) && spec.theme === 'dark') {
        const light = await fetchMark({ ...spec, theme: 'light' });
        if (light?.data.equals(mark.data)) {
            console.log(
                `= «${spec.name}» has one file for both themes — the light entry covers dark, nothing written`,
            );
            process.exit(0);
        }
    }
    mkdirSync(storeDir, { recursive: true });
    const file = slugOf(spec);
    writeFileSync(join(storeDir, file), mark.data);
    manifest[file] = spec;
    console.log(`${join(storeDir, file)} ← ${mark.source}`);
    saveAndBuild();
}

/* Types */

type Theme = 'light' | 'dark';
type SvglRoute = string | Record<Theme, string>;

interface SvglEntry {
    route: SvglRoute;
    title: string;
    wordmark?: SvglRoute;
}

interface SvgSpec {
    mono?: boolean;
    name: string;
    theme?: Theme;
    wordmark?: boolean;
}

// an installed app's bundle id: the entry is that app's own icon, a png
interface AppSpec {
    app: string;
    size: number;
}

type Spec = SvgSpec | AppSpec;
