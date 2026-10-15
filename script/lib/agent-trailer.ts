// the `Agent: <role> · <model>` trailer, derived from the session registry name and the transcript's model id
export function roleFor(sessionName: string) {
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
    ['🦉', 'cclio'],
    ['🔧', 'coder'],
    ['🔎', 'verifier'],
    ['🎼', 'composer'],
    ['🎨', 'designer'],
    ['🐦', 'ccrow'],
    ['☁️', 'cloud'],
] as const;
