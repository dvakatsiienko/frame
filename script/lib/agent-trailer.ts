// the `Agent: <role> · <model>` trailer, derived from the session registry name and the transcript's model id
// the desktop names a fork «<parent> (fork)», a side channel renames itself «<parent> (side)»; neither commits as the parent
export function roleFor(sessionName: string): string {
    const parent = sessionName.match(
        /^(.*?)\s*\((?:fork|side)[^)]*\)\s*$/,
    )?.[1];
    if (parent !== undefined) return `${roleFor(parent)}-side`;
    const glyph = ROLES.find(([mark]) => sessionName.includes(mark));
    if (glyph) return glyph[1];
    return (
        sessionName
            .replace(/[^\p{L}\p{N}\s:-]/gu, '')
            .trim()
            .split(/\s+/)[0] || 'agent'
    );
}

export function modelFor(modelId: string) {
    const [, family, major, minor] =
        modelId.match(/^claude-([a-z]+)-(\d+)(?:-(\d+))?/) ?? [];
    if (!family) return modelId;
    const name = family.charAt(0).toUpperCase() + family.slice(1);
    return `Claude ${name} ${minor ? `${major}.${minor}` : major}`;
}

export function trailerAdd(message: string, role: string, model: string) {
    if (/^Agent:/m.test(message)) return message;
    return `${message.replace(/\s*$/, '')}\n\nAgent: ${role} · ${model}\n`;
}

/* Helpers */
const ROLES = [
    ['🦉', 'clio'],
    ['🔧', 'coder'],
    ['🔎', 'verifier'],
    ['🎀', 'helga'],
    ['🎨', 'designer'],
    ['🐦', 'crow'],
    ['☁️', 'cloud'],
] as const;
