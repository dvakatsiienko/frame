import { expect, mock, test } from 'claude-code/testing';
import { EXERCISES, exerciseOf } from '../hooks/breath/exercises.ts';
import { meterSvg } from '../hooks/meter.ts';

const working = { bodyColumns: 100, hasSurvey: false, isWorking: true, maxRows: 9, scroll: { bodyRows: 40, offset: 0 }, view: {} };

test('draws the breathing client on the terminal while claude works', async ($, on) => {
    mock.clock(on);
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
    const ui = await $.ui.mount({ component: 'AbovePrompt', plugin: 'x-mod-breather', props: working, surface: 'terminal' });
    expect(await ui.find({ type: 'Client' })).toBeTruthy();
});

test('draws the breathing meter as an svg on the desktop while claude works', async ($, on) => {
    mock.clock(on);
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
    const ui = await $.ui.mount({ component: 'AbovePrompt', plugin: 'x-mod-breather', props: working, surface: 'desktop' });
    expect(await ui.find({ type: 'Svg' })).toBeTruthy();
});

test('draws nothing while claude is idle', async ($, on) => {
    mock.clock(on);
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
    const ui = await $.ui.mount({ component: 'AbovePrompt', plugin: 'x-mod-breather', props: { ...working, isWorking: false }, surface: 'desktop' });
    expect(await ui.find({ type: 'Svg' })).toBeFalsy();
});

test('the meter breathes on the exercise cycle', () => {
    expect(meterSvg(exerciseOf('box'))).toContain('dur="16.00s"');
});

test('the meter glides between levels instead of stepping', () => {
    expect(meterSvg(exerciseOf('hrv'))).toContain('calcMode="linear"');
});

test('every exercise fits the engine svg limit', () => {
    for (const ex of EXERCISES) expect(meterSvg(ex).length).toBeLessThan(131072);
});
