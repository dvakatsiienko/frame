import { expect, mock, test } from 'claude-code/testing';

for (const surface of ['terminal', 'desktop'] as const) {
    test(`draws the breathing band on ${surface} while claude works`, async ($, on) => {
        mock.clock(on);
        on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
        const ui = await $.ui.mount({
            component: 'AbovePrompt',
            plugin: 'breather',
            props: {
                bodyColumns: 100,
                hasSurvey: false,
                isWorking: true,
                maxRows: 9,
                scroll: { bodyRows: 40, offset: 0 },
                view: {},
            },
            surface,
        });
        expect(await ui.find({ type: 'Client' })).toBeTruthy();
    });
}

test('draws nothing while claude is idle', async ($, on) => {
    mock.clock(on);
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
    const ui = await $.ui.mount({
        component: 'AbovePrompt',
        plugin: 'breather',
        props: {
            bodyColumns: 100,
            hasSurvey: false,
            isWorking: false,
            maxRows: 9,
            scroll: { bodyRows: 40, offset: 0 },
            view: {},
        },
        surface: 'desktop',
    });
    expect(await ui.find({ type: 'Client' })).toBeFalsy();
});
