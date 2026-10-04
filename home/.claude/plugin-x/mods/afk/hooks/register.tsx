/* @jsx h */
import type { Register } from 'claude-code';

// One afk flag in $.store, shared by every live session: a button above the prompt flips it,
// each session polls it, and while it is on every prompt carries a note telling the model so.

const KEY = 'afk';
const POLL_MS = 4000;
export const AWAY_NOTE =
    'dima is afk: nothing waits on him. take reversible steps and log them, park every ask for his return, send no ⏳ block and no ping.';

let afk = false;
let polling = false;

type Store = {
    get: (k: string) => Promise<unknown>;
    set: (k: string, v: unknown) => Promise<unknown>;
};

async function load($: { store: Store }): Promise<boolean> {
    const v = (await $.store.get(KEY)) as { on?: boolean } | undefined;
    const next = v?.on === true;
    const changed = next !== afk;
    afk = next;
    return changed;
}

export const register: Register = (on) => {
    on('session.start', async ($, e, next) => {
        await load($);
        if (!polling) {
            polling = true;
            const tick = () =>
                $.clock.after(POLL_MS, async () => {
                    if (await load($)) $.ui.invalidate('ui.render');
                    tick();
                });
            tick();
        }
        return next(e);
    });

    on('prompt.submit', async ($, e, next) => {
        await load($);
        if (!afk) return next(e);
        return next({ ...e, context: [...(e.context ?? []), AWAY_NOTE] });
    });

    on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
        if (e.surface !== 'terminal' && e.surface !== 'desktop') return next(e);
        const { Box, Button } = $.ui.resolve(e);
        const toggle = async () => {
            afk = !afk;
            await $.store.set(KEY, { at: await $.clock.now(), on: afk });
            $.ui.invalidate('ui.render');
        };
        return (
            <Box flexDirection='column'>
                <Box flexDirection='row'>
                    <Button
                        key='afk'
                        onPress={() => void toggle()}
                        {...(afk
                            ? { variant: 'primary' as const }
                            : { plain: true as const })}>
                        {afk ? '🌙 afk — away' : '☕ afk'}
                    </Button>
                </Box>
                {await next(e)}
            </Box>
        );
    });
};
