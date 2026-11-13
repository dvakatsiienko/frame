// every skill a thread can load, for the / menu: the transcript's own listing misses plugin skills (clio's own never showed),
// so the chat also reads the plugins enabled for the thread's folder, through the settings layers Claude Code reads:
// the user's settings, then the project's settings and its local settings, a later layer winning for a plugin

/**
 * @typedef {{ read: (path: string) => Promise<string | null>, list: (dir: string) => Promise<string[]> }} SkillFs
 */

/**
 * the / menu's matches for what follows the «/»: a name that starts with it, then one whose part after a colon starts
 * with it (he types «boot» for `clio:boot`), then one that holds it anywhere; at most 8
 * @param {[string, string][]} all
 * @param {string} q
 */
export function menuMatches(all, q) {
    const half = (/** @type {string} */ n) =>
        n.includes(':') && n.split(':').slice(1).join(':').startsWith(q);
    const first = all.filter(([n]) => n.startsWith(q));
    const second = all.filter(([n]) => !n.startsWith(q) && half(n));
    const third = all.filter(
        ([n]) => !n.startsWith(q) && !half(n) && n.includes(q),
    );
    return [...first, ...second, ...third].slice(0, 8);
}

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
 * a plugin's skill folders: the ones its manifest lists (`.claude-plugin/plugin.json` `skills`, as Claude Code ships a
 * plugin that nests them by bucket, matt's), else every folder one level under `skills/`; never a walk deeper, so a
 * bucket the manifest leaves out (`deprecated/`, `in-progress/`) never shows (FRM-593)
 * @param {SkillFs} fs
 * @param {string} root the plugin's install path
 */
async function skillDirs(fs, root) {
    const listed = json(
        await fs.read(`${root}/.claude-plugin/plugin.json`),
    )?.skills;
    if (Array.isArray(listed))
        return listed
            .filter((p) => typeof p === 'string')
            .map((p) => `${root}/${p}`);
    return (await fs.list(`${root}/skills`)).map((e) => `${root}/skills/${e}`);
}

/**
 * every skill of the plugins enabled for the thread's folder, as `plugin:skill` → what it does
 * @param {SkillFs} fs
 * @param {{ home: string, cwd: string }} thread
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
        for (const dir of await skillDirs(fs, install.installPath)) {
            const text = await fs.read(`${dir}/SKILL.md`);
            if (!text) continue;
            const head = skillHead(text);
            const folder = dir.split('/').filter(Boolean).at(-1) ?? dir;
            skills.set(`${plugin}:${head.name ?? folder}`, head.description);
        }
    }
    return skills;
}
