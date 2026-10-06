import { expect, mock, test } from 'claude-code/testing';
import { exerciseOf } from '../hooks/breath/exercises.ts';
import { orbSvg } from '../hooks/orb.ts';

const working = { bodyColumns: 100, hasSurvey: false, isWorking: true, maxRows: 9, scroll: { bodyRows: 40, offset: 0 }, view: {} };

test('draws the breathing client on the terminal while claude works', async ($, on) => {
    mock.clock(on);
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
    const ui = await $.ui.mount({ component: 'AbovePrompt', plugin: 'x-mod-breather', props: working, surface: 'terminal' });
    expect(await ui.find({ type: 'Client' })).toBeTruthy();
});

test('draws the breathing orb as an svg on the desktop while claude works', async ($, on) => {
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

test('the orb breathes on the exercise cycle', () => {
    expect(orbSvg(exerciseOf('box'))).toContain('dur="16.0s"');
});
