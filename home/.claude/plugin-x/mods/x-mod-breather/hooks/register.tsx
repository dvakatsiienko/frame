/* @jsx h */
import { exerciseOf } from './breath/exercises.ts';
import { METER_HEIGHT, meterSvg } from './meter.ts';
import type { Register } from 'claude-code';

import {
    type Config,
    DEFAULTS,
    applyCommand,
    readConfig,
} from './breath/config.ts';

// The hooks module. While a turn runs it draws the meter above the prompt: ./breathe.tsx on the
// terminal, ./meter.ts on the desktop (the band's
// `isWorking` prop is the trigger, so the band appears when Claude starts and goes when Claude
// stops) and reads the breath's phase into the spinner line. /breathe changes the settings,
// kept in $.store.

const BAND_ROWS = 3;

let config: Config = DEFAULTS;
// the running turn: when it started
let turn: { startedAt: number } | undefined;
// the breath the band last posted, for the spinner
let phase: { word: string; exercise: string } | undefined;
const STASH_BOARD = { key: 'board', plugin: 'x-mod-stash' } as const;

const log =
    ($: { ui: { log: (text: string) => void } }, what: string) =>
    (err: unknown) =>
        $.ui.log(`x-mod-breather: ${what}: ${err}`);

export const register: Register = (on) => {
    on('session.start', async ($, e, next) => {
        const r = await next(e);
        const saved = await $.store
            .get('config')
            .catch(log($, 'store read failed'));
        config = readConfig(saved);
        await $.command
            .register({
                argumentHint:
                    '[on | off | hrv | sigh | box | 478 | delay <s> | help]',
                description:
                    'Breathing exercises above the prompt while Claude works: on, off, hrv, sigh, box, 478, delay (mindful-claude)',
                immediate: true,
                name: 'breathe',
            })
            .catch(log($, '/breathe not registered'));
        return r;
    });

    on('command.run', { command: 'breathe' }, async ($, e) => {
        const applied = applyCommand(config, e.args);
        if (applied.config !== config) {
            config = applied.config;
            await $.store
                .set('config', config)
                .catch(log($, 'store write failed'));
            $.ui.invalidate('ui.render');
        }
        return { text: applied.text };
    });

    on('turn.start', async ($, e, next) => {
        turn = { startedAt: await $.clock.now() };
        phase = undefined;
        // the band is drawn from a delay on: wake the render hook when it has passed
        if (config.delay > 0)
            $.clock.after(config.delay * 1000, () =>
                $.ui.invalidate('ui.render'),
            );
        $.ui.invalidate('ui.render');
        return next(e);
    });

    on('turn.complete', async ($, e, next) => {
        const r = await next(e);
        // a subagent's run ends inside the main turn: the band keeps breathing
        if (e.agentId) return r;
        turn = undefined;
        phase = undefined;
        $.ui.invalidate('ui.render');
        return r;
    });

    // the band posts its phase whenever the line changes (once a second): the spinner reads it
    on('ui.message', async ($, e, next) => {
        const data = e.data as { word?: unknown; exercise?: unknown } | null;
        if (
            typeof data?.word === 'string' &&
            typeof data.exercise === 'string'
        ) {
            phase = { exercise: data.exercise, word: data.word };
            if (config.spinner) $.ui.invalidate('ui.render');
        }
        return next(e);
    });

    on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
        // terminal and desktop both draw a Client; vscode and mobile do not
        if (
            (e.surface !== 'terminal' && e.surface !== 'desktop') ||
            !config.enabled ||
            !e.props.isWorking ||
            e.props.hasSurvey
        )
            return next(e);
        const now = await $.clock.now();
        // a turn the hook saw start; else one that is working anyway (started before the plugin loaded)
        const running = turn ?? (turn = { startedAt: now });
        const elapsedMs = now - running.startedAt;
        if (elapsedMs < config.delay * 1000) return next(e);
        if (e.surface === 'desktop') {
            // read to subscribe: the desktop rebuilds this svg on every /board redraw, and a rebuild from a source drawn
            // earlier jumps the breath back to that moment; with the read, each board write draws a fresh phase (FRM-354)
            await $.state.get(STASH_BOARD).catch(() => undefined);
            // the desktop refuses a Client module (10 s, csp); an Svg's own SMIL clock needs no host tick
            const { Box, Svg } = $.ui.resolve(e);
            const exercise = exerciseOf(config.exercise);
            return (
                <Box flexDirection='column'>
                    <Svg
                        alt={`breathing guide: ${exercise.name}, ${exercise.pattern}`}
                        height={METER_HEIGHT}
                        isInteractive
                        key={`meter:${running.startedAt}:${config.exercise}`}
                        source={meterSvg(exercise, elapsedMs - config.delay * 1000)}
                    />
                    {await next(e)}
                </Box>
            );
        }
        const { Box, Client } = $.ui.resolve(e);
        const rows = Math.min(BAND_ROWS, e.props.maxRows);
        if (rows < 1) return next(e);
        // the key names the turn: one instance per turn, remounted when the settings change mid-turn
        const key = `breathe:${running.startedAt}:${config.exercise}`;
        return (
            <Box flexDirection='column'>
                <Client
                    height={rows}
                    key={key}
                    module='./breathe.tsx'
                    props={{ elapsedMs, exercise: config.exercise }}
                    width={e.props.bodyColumns}
                />
                {await next(e)}
            </Box>
        );
    });

    // the spinner's word becomes the breath: `✻ Breathe in 4s…`
    on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
        if (!config.enabled || !config.spinner || !phase) return next(e);
        return next({ ...e, props: { ...e.props, message: phase.word } });
    });
};
