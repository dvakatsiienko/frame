// every skill a seat can load, for the / menu: the transcript's own listing misses plugin skills (clio's own never showed),
// so the chat also reads the plugins enabled for the seat's folder, through the settings layers Claude Code reads:
// the user's settings, then the project's settings and its local settings, a later layer winning for a plugin

/**
 * @typedef {{ read: (path: string) => Promise<string | null>, list: (dir: string) => Promise<string[]> }} SkillFs
 */

/** @param {string | null} text */
const json = (text) => {
    try {
        return text ? JSON.parse(text) : null;
    } catch {
        return null;
    }
};

/**
 * a SKILL.md's name and description from its frontmatter; a folded description (`>-`) joins its indented lines
 * @param {string} text
 * @returns {{ name: string | null, description: string }}
 */
export function skillHead(text) {
    const front = /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? '';
    const lines = front.split('\n');
    const name = /^name:\s*(.+)$/m.exec(front)?.[1].trim() ?? null;
    const at = lines.findIndex((l) => /^description:/.test(l));
    if (at < 0) return { description: '', name };
    const first = lines[at].replace(/^description:\s*/, '').trim();
    if (!/^[>|]-?$/.test(first))
        return { description: first.replace(/^["']|["']$/g, ''), name };
    const folded = [];
    for (const line of lines.slice(at + 1)) {
        if (!/^\s+\S/.test(line)) break;
        folded.push(line.trim());
    }
    return { description: folded.join(' '), name };
}

/**
 * the plugin keys (`name@marketplace`) enabled for a folder: user settings, then the folder's project and local
 * settings, a later layer winning
 * @param {SkillFs} fs
 * @param {string} home
 * @param {string} cwd
 */
async function enabledPlugins(fs, home, cwd) {
    /** @type {Record<string, boolean>} */
    const on = {};
    for (const path of [
        `${home}/.claude/settings.json`,
        `${cwd}/.claude/settings.json`,
        `${cwd}/.claude/settings.local.json`,
    ])
        Object.assign(on, json(await fs.read(path))?.enabledPlugins ?? {});
    return Object.keys(on).filter((key) => on[key] === true);
}

/**
 * every skill of the plugins enabled for the seat's folder, as `plugin:skill` → what it does
 * @param {SkillFs} fs
 * @param {{ home: string, cwd: string }} seat
 * @returns {Promise<Map<string, string>>}
 */
export async function loadableSkills(fs, { home, cwd }) {
    /** @type {Map<string, string>} */
    const skills = new Map();
    const installed =
        json(await fs.read(`${home}/.claude/plugins/installed_plugins.json`))
            ?.plugins ?? {};
    for (const key of await enabledPlugins(fs, home, cwd)) {
        /** @type {{ scope?: string, projectPath?: string, installPath?: string }[]} */
        const installs = installed[key] ?? [];
        const install = installs.find(
            (i) => i.scope !== 'project' || i.projectPath === cwd,
        );
        if (!install?.installPath) continue;
        const plugin = key.split('@')[0];
        const dir = `${install.installPath}/skills`;
        for (const entry of await fs.list(dir)) {
            const text = await fs.read(`${dir}/${entry}/SKILL.md`);
            if (!text) continue;
            const head = skillHead(text);
            skills.set(`${plugin}:${head.name ?? entry}`, head.description);
        }
    }
    return skills;
}
