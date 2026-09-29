import { readFileSync } from 'node:fs';
import { parse } from 'culori';

export const roleGroups = ['bg', 'fg', 'ui'] as const;

export const tokensShape = `tokens file — DTCG json, colour roles grouped under color.bg / color.fg / color.ui:

  { "color": { "$type": "color",
      "bg": { "base": { "$value": "#ffffff" } },
      "fg": { "text": { "$value": "#1a1a1a" }, "muted": { "$value": "#6b6b6b" } },
      "ui": { "border": { "$value": "#8a8a8a" } } } }

  bg — surfaces · fg — text, needs 4.5:1 on every bg · ui — borders, icons, focus rings, needs 3:1
  groups nest freely; a node with "$value" is a token, named by its path (fg.text)
  a value is a css colour string or an alias to another token: "{color.fg.text}"
  example: design/fixtures/tokens.json`;

export function readRoles(file: string): Roles {
    const tree: unknown = JSON.parse(readFileSync(file, 'utf8'));
    const color = isNode(tree) ? tree.color : undefined;
    if (!isNode(color)) fail(`${file}: no "color" group`);

    const roles: Roles = { bg: [], fg: [], ui: [] };
    for (const group of roleGroups) collect(color[group], group, roles[group]);
    if (roles.bg.length === 0 || roles.fg.length === 0) {
        fail(`${file}: needs at least one color.bg and one color.fg token`);
    }
    for (const role of Object.values(roles).flat())
        role.value = resolve(tree, role);
    return roles;
}

function resolve(tree: unknown, role: Role, seen: string[] = []): string {
    const alias = role.value.match(/^\{(.+)\}$/)?.[1];
    if (!alias) {
        if (!parse(role.value))
            fail(`${role.name}: cannot parse colour ${role.value}`);
        return role.value;
    }
    if (seen.includes(alias))
        fail(`${role.name}: alias loop through {${alias}}`);
    const target = alias
        .split('.')
        .reduce<unknown>(
            (node, key) => (isNode(node) ? node[key] : undefined),
            tree,
        );
    const value = isNode(target) ? target.$value : undefined;
    if (typeof value !== 'string')
        fail(`${role.name}: {${alias}} names no string colour token`);
    return resolve(tree, { name: role.name, value }, [...seen, alias]);
}

export function fail(problem: string): never {
    console.error(`${problem}\n\n${tokensShape}`);
    process.exit(2);
}

function collect(node: unknown, path: string, into: Role[]): void {
    if (!isNode(node)) return;
    if ('$value' in node) {
        if (typeof node.$value !== 'string') {
            fail(
                `${path}: object colour values are not supported yet, use a hex or css colour string`,
            );
        }
        into.push({ name: path, value: node.$value });
        return;
    }
    for (const [key, child] of Object.entries(node)) {
        if (!key.startsWith('$')) collect(child, `${path}.${key}`, into);
    }
}

function isNode(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/* Types */

export type Role = { name: string; value: string };
export type Roles = Record<(typeof roleGroups)[number], Role[]>;
