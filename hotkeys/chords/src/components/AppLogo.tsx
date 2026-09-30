import * as logos from '@frame/logos';

/**
 * A product's own mark beside its name, so an app reads at a glance instead of blending into the
 * text around it. The marks live in frame's `@frame/logos` store — brand svgs fetched by art-kit's
 * logo.ts, a mac app's own icon for the rest; this file only says which store mark a name means.
 *
 * Decorative: the name always sits beside the mark, so the image carries no alt text.
 */
export const AppLogo = (props: AppLogoProps) => {
    const name = markOf(props.name, props.bundleId);
    const box = { height: props.size, width: props.size };

    if (!name) {
        if (props.fallback === 'none') return null;
        return props.fallback === 'glyph' ? (
            // a filled square with the initial: an empty outline read as an unchecked checkbox
            <span
                aria-hidden='true'
                className='grid shrink-0 select-none place-items-center rounded-[4px] bg-line font-mono text-[10px]/none font-semibold text-ink-2 uppercase'
                style={box}>
                {initialOf(props.name)}
            </span>
        ) : (
            <span
                aria-hidden='true'
                className='inline-block shrink-0'
                style={box}
            />
        );
    }

    const light = logos.logoOf(name, 'light');
    const dark = logos.logoOf(name, 'dark');

    return light === dark ? (
        <img
            alt=''
            className='inline-block shrink-0 select-none'
            draggable={false}
            src={light}
            style={box}
        />
    ) : (
        <>
            <img
                alt=''
                className='logo-light shrink-0 select-none'
                draggable={false}
                src={light}
                style={box}
            />
            <img
                alt=''
                className='logo-dark shrink-0 select-none'
                draggable={false}
                src={dark}
                style={box}
            />
        </>
    );
};

/* Helpers */
export const hasLogo = (name: string) => markOf(name) !== undefined;

// a name the page prints, else the app's bundle id (a mac app icon in the store), else the name as a mark
const markOf = (name: string, bundleId?: string) => {
    const lower = name.toLowerCase();
    return (
        aliases[lower] ??
        (bundleId ? logos.appLogo(bundleId) : undefined) ??
        logos.appLogo(name) ??
        (logos.hasLogo(lower) ? lower : undefined)
    );
};

// a bundle id printed as the name keeps its name last (com.apple.finder → f); hide.me stays h
const initialOf = (name: string) => {
    const parts = name.split('.');
    return (parts.length > 2 ? parts.at(-1) : name)?.[0] ?? '?';
};

// the names chords prints — an app name, a bundle id macOS gave no name, a launcher's action — that
// differ from their store mark's name
const aliases: Record<string, logos.LogoName> = {
    'app store': 'app-store',
    'battle.net': 'battledotnet',
    calendar: 'com-apple-ical',
    'ch.protonmail.desktop': 'proton-mail',
    claude: 'claude-ai',
    'com.github.githubclient': 'github',
    'com.todesktop.230313mzl4w4u92': 'cursor',
    finder: 'com-apple-finder',
    'google chrome': 'chrome',
    'google drive': 'google-drive',
    'notion.id': 'notion',
    spark: 'com-readdle-smartemail-mac',
    things3: 'things',
    'wispr flow': 'com-electron-wispr-flow',
    'zoom.us': 'zoom',
};

/* Types */
interface AppLogoProps {
    name: string;
    // an app row's bundle id: the store keeps a mac app's own icon under it
    bundleId?: string;
    size: number;
    // what an unknown name shows: a neutral app glyph, an empty slot that keeps a list's labels
    // aligned, or nothing where no neighbour needs the alignment
    fallback: 'glyph' | 'blank' | 'none';
}
