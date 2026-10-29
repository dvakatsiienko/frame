import base64, io, json, pathlib, re, shutil, subprocess
from PIL import Image
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from tour import bytes_icon, frame_icon

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / 'out'
README = OUT / 'readme'
GH = 'https://github.com/dvakatsiienko'

# ---------- inputs for redraw.ts: it draws the board and the cards, here and in the weekly action ----------
MONO_FACE = str(pathlib.Path.home() / 'Library/Fonts/Operator Mono %s Regular.otf')
AVATARS = {'clio': 'owl.png', 'codie': 'bulldog.png', 'reviewer': 'basset.png', 'sixth sense': '../avatars/fleet/sixth-sense/verifier-dalmatian-space.png'}

def export_glyphs():
    faces, upm = {}, 0
    for w in ('Book', 'Medium'):
        font = TTFont(MONO_FACE % w); gs = font.getGlyphSet(); cmap = font.getBestCmap(); upm = font['head'].unitsPerEm
        faces[w] = {}
        for c in [chr(i) for i in range(32, 127)] + ['·']:
            pen = SVGPathPen(gs); gs[cmap[ord(c)]].draw(pen)
            faces[w][c] = [gs[cmap[ord(c)]].width, pen.getCommands()]
    (HERE / 'glyphs.json').write_text(json.dumps(dict(upm=upm, faces=faces), ensure_ascii=False, separators=(',', ':')))

def export_avatars():
    def uri(name):
        im = Image.open(HERE / name).convert('RGB').resize((72, 72), Image.LANCZOS)
        buf = io.BytesIO(); im.save(buf, 'PNG', optimize=True)
        return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()
    (HERE / 'avatars.json').write_text(json.dumps({k: uri(v) for k, v in AVATARS.items()}, indent=1))

def panels(out, data):
    subprocess.run(['node', str(HERE / 'redraw.ts'), '--data', str(data), '--out', str(out)], check=True)

# ---------- stack: one grid of linked icons ----------
STACK = ('typescript swift react nextdotjs vite reactquery zustand graphql prisma drizzle convex clerk betterauth vitest prettier '
         'biome jotai nodedotjs bun pnpm turborepo homebrew tailwindcss shadcnui motion anthropic claude cursor neovim raycast linear '
         'vercel railway docker').split()
LABEL = dict(claude='claude code')
WIDE = {'jotai'}
HOME = dict(typescript='https://www.typescriptlang.org', react='https://react.dev', nextdotjs='https://nextjs.org', vite='https://vite.dev',
 reactquery='https://tanstack.com/query', graphql='https://graphql.org', prisma='https://www.prisma.io', drizzle='https://orm.drizzle.team',
 clerk='https://clerk.com', betterauth='https://www.better-auth.com', vitest='https://vitest.dev', prettier='https://prettier.io', biome='https://biomejs.dev',
 nodedotjs='https://nodejs.org', bun='https://bun.sh', pnpm='https://pnpm.io', tailwindcss='https://tailwindcss.com', shadcnui='https://ui.shadcn.com',
 neovim='https://neovim.io', claude='https://www.anthropic.com/claude-code', anthropic='https://www.anthropic.com', vercel='https://vercel.com', railway='https://railway.com', docker='https://www.docker.com',
 zustand='https://zustand.docs.pmnd.rs', jotai='https://jotai.org', swift='https://www.swift.org', convex='https://www.convex.dev',
 turborepo='https://turborepo.com', homebrew='https://brew.sh', motion='https://motion.dev', cursor='https://cursor.com',
 raycast='https://www.raycast.com', linear='https://linear.app')
NEUTRAL = dict(light='#1d2021', dark='#ebdbb2')

def lum(hex6):
    c = [int(hex6[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    c = [x / 12.92 if x <= .04045 else ((x + .055) / 1.055) ** 2.4 for x in c]
    return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]

def icon(n, k):
    v = (HERE / 'icons' / f'{n}.svg').read_text()
    hex6 = re.search(r'fill="#([0-9A-Fa-f]{6})"', v).group(1)
    if v.count('fill="#') == 1 and not .05 < lum(hex6) < .9: v = v.replace(f'fill="#{hex6}"', f'fill="{NEUTRAL[k]}"', 1)
    return re.sub(r'<title>.*?</title>', '', v)

# ---------- the readme: every image a light/dark pair unless both themes draw the same ----------
FRUIT = '🍒 hey 🥝 привіт 🍓 привет 🫐 konnichiwa 🍀'
TOUR_TITLE = 'around the camp'
TOURS = [('frame', frame_icon), ('bytes', bytes_icon)]
GAZETTE = f'{GH}/frame/tree/main/_clio/gazette'
COLS = 18  # grid units: jotai's wordmark takes two, so 34 icons fill 17 + 17

def picture(name, alt, width, light, dark=None):
    (README / 'assets' / f'{name}{"-light" if dark else ""}.svg').write_text(light)
    img = f'<img src="assets/{name}{"-light" if dark else ""}.svg" width="{width}" alt="{alt}">'
    if not dark: return img
    (README / 'assets' / f'{name}-dark.svg').write_text(dark)
    return f'<picture><source media="(prefers-color-scheme: dark)" srcset="assets/{name}-dark.svg">{img}</picture>'

def round_hero(svg, r=12):
    head, body = svg.split('>', 1)
    body = body.removesuffix('</svg>')
    return f'{head}><clipPath id="hero-round"><rect width="800" height="300" rx="{r}"/></clipPath><g clip-path="url(#hero-round)">{body}</g></svg>'

# ink box (x0, y0, x1, y1) and coverage per icon, measured once by drawing each icon on a 200 px canvas;
# re-measure after adding an icon: a missing entry fails the build
INK = {'anthropic': (0, 0.145, 1, 0.855, 0.342), 'betterauth': (0, 0.14, 1, 0.86, 0.534), 'biome': (0, 0.07, 1, 0.935, 0.378), 'bun': (0.055, 0.175, 0.945, 0.855, 0.479), 'claude': (0, 0, 1, 1, 0.397), 'clerk': (0.095, 0, 0.905, 1, 0.415), 'convex': (0.01, 0, 0.99, 1, 0.465), 'cursor': (0.06, 0, 0.94, 1, 0.474), 'docker': (0, 0.14, 1, 0.86, 0.376), 'drizzle': (0, 0.235, 1, 0.765, 0.122), 'graphql': (0.055, 0, 0.945, 1, 0.276), 'homebrew': (0.175, 0, 0.825, 1, 0.223), 'linear': (0, 0, 1, 1, 0.596), 'motion': (0, 0, 1, 1, 0.958), 'neovim': (0.09, 0, 0.91, 1, 0.364), 'nextdotjs': (0, 0, 1, 1, 0.691), 'nodedotjs': (0.055, 0, 0.945, 1, 0.296), 'pnpm': (0, 0, 1, 1, 0.697), 'prettier': (0.07, 0, 0.93, 1, 0.268), 'prisma': (0.085, 0, 0.915, 1, 0.276), 'railway': (0, 0, 1, 1, 0.595), 'raycast': (0, 0, 1, 1, 0.302), 'react': (0, 0.055, 1, 0.945, 0.294), 'reactquery': (0.075, 0.03, 0.925, 0.97, 0.576), 'shadcnui': (0, 0, 1, 1, 0.166), 'swift': (0, 0, 1, 1, 0.754), 'tailwindcss': (0, 0.2, 1, 0.8, 0.204), 'turborepo': (0, 0, 1, 1, 0.473), 'typescript': (0, 0, 1, 1, 0.816), 'vercel': (0, 0.07, 1, 0.935, 0.432), 'vite': (0, 0.02, 1, 0.98, 0.469), 'vitest': (0, 0.015, 1, 0.985, 0.475), 'zustand': (0.08, 0.12, 0.92, 0.94, 0.53)}
INK_MEDIAN = sorted(v[4] for v in INK.values())[len(INK) // 2]

def placement(n, box=32, cell=44):
    x0, y0, x1, y1, cover = INK[n]
    size = box * min(1.2, max(.8, (INK_MEDIAN / cover) ** .25))
    return cell / 2 - (x0 + x1) / 2 * size, cell / 2 - (y0 + y1) / 2 * size, size

def cell(n, k):
    w = 88 if n in WIDE else 44
    x, y, size = (6, 6, 32) if n in WIDE else placement(n)
    width = w - 12 if n in WIDE else size
    inner = re.sub(r'<svg ', f'<svg x="{x:.1f}" y="{y:.1f}" width="{width:.1f}" height="{size:.1f}" ', icon(n, k).replace(' xmlns="http://www.w3.org/2000/svg"', ''), count=1)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} 44" width="{w}" height="44">{inner}</svg>'

def readme():
    shutil.rmtree(README, ignore_errors=True); (README / 'assets' / 'stack').mkdir(parents=True)
    for k, mode in (('light', 'day'), ('dark', 'night')):
        (README / 'assets' / f'hero-{k}.svg').write_text(round_hero((HERE / f'hero-grove-{mode}.svg').read_text()))
    hero = '<picture><source media="(prefers-color-scheme: dark)" srcset="assets/hero-dark.svg"><img src="assets/hero-light.svg" width="100%" alt="a paper-cut grove: a cabin, a campfire, a castle on the hill and a t-rex; a sign says hey, welcome to my crafting place"></picture>'
    tour = ' '.join(f'<a href="{GH}/{r}">{picture(f"tour-{r}", f"{r}", "49%", art("light"), art("dark"))}</a>' for r, art in TOURS)
    shutil.copy(HERE / 'fleet.json', README / 'assets' / 'fleet.json'); panels(README / 'assets', README / 'assets' / 'fleet.json')
    rows, row, used = [], '', 0
    for n in STACK:
        span = 2 if n in WIDE else 1
        if used + span > COLS: rows.append(row); row, used = '', 0
        light, dark = cell(n, 'light'), cell(n, 'dark')
        if light == dark:
            (README / 'assets' / 'stack' / f'{n}.svg').write_text(light); img = f'<img src="assets/stack/{n}.svg" alt="{LABEL.get(n, n)}">'
        else:
            for k, v in (('light', light), ('dark', dark)): (README / 'assets' / 'stack' / f'{n}-{k}.svg').write_text(v)
            img = f'<picture><source media="(prefers-color-scheme: dark)" srcset="assets/stack/{n}-dark.svg"><img src="assets/stack/{n}-light.svg" alt="{LABEL.get(n, n)}"></picture>'
        row += f'<a href="{HOME[n]}" title="{LABEL.get(n, n)}">{img}</a>'; used += span
    rows.append(row)
    stack_md = '<br>'.join(rows)
    (README / 'README.md').write_text(f'''{hero}

<p align="center">{FRUIT}</p>

### {TOUR_TITLE}

<p align="center">{tour}</p>

### [📰 read the official gazette of dima's fleet]({GAZETTE})

<img src="assets/board.svg" width="100%" alt="fleet board: this week's agent commits, tickets and skills">
<p align="center"><img src="assets/langs.svg" width="49%" alt="top languages"> <img src="assets/lazy.svg" width="49%" alt="commits by time of day"></p>

### stack

<p>{stack_md}</p>
''')

def build():
    if pathlib.Path(MONO_FACE % 'Book').exists(): export_glyphs(); export_avatars()
    readme()
    print(f'readme: {README / "README.md"}, {sum(1 for _ in (README / "assets").rglob("*.svg"))} svgs')

if __name__ == '__main__':
    build()
