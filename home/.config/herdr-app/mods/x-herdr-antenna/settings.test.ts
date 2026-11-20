import { describe, expect, test } from 'vitest';

import { antennaSettings, antennaSettingsText } from './settings.js';

// FRM-618 slice A exit 3: antenna's knobs live in the one settings file beside the orbit pin row
const file = JSON.stringify({ rows: { 'orbit.pin': 'top' }, v: 1 });

describe('antenna settings', () => {
    test('a file with no antenna row reads every knob at its default', () => {
        expect(antennaSettings(file)).toEqual({
            'antenna.details.context': false,
            'antenna.details.hot': true,
            'antenna.details.idle': true,
            'antenna.details.model': false,
            'antenna.details.wait': true,
            'antenna.groupBySpace': true,
            'antenna.rowHeight': 'roomy',
            'antenna.showTabs': true,
        });
    });

    test('a change is written beside the rows already there', () => {
        const text = antennaSettingsText(file, {
            'antenna.groupBySpace': false,
        });
        expect(JSON.parse(text).rows).toEqual({
            'antenna.groupBySpace': false,
            'orbit.pin': 'top',
        });
        expect(antennaSettings(text)['antenna.groupBySpace']).toBe(false);
    });

    test('a value that does not fit its knob is never written', () => {
        const text = antennaSettingsText(file, {
            'antenna.rowHeight': 'huge',
            'antenna.showTabs': 'no',
        });
        expect(JSON.parse(text).rows).toEqual({ 'orbit.pin': 'top' });
    });

    test('an unreadable file reads as the defaults and a change still lands', () => {
        expect(antennaSettings('{oops')['antenna.showTabs']).toBe(true);
        expect(
            JSON.parse(
                antennaSettingsText(null, { 'antenna.showTabs': false }),
            ),
        ).toEqual({ rows: { 'antenna.showTabs': false }, v: 1 });
    });

    test('a stored value that does not fit its knob reads as the default', () => {
        const text = JSON.stringify({
            rows: { 'antenna.rowHeight': 'huge', 'antenna.showTabs': 'no' },
            v: 1,
        });
        expect(antennaSettings(text)['antenna.rowHeight']).toBe('roomy');
        expect(antennaSettings(text)['antenna.showTabs']).toBe(true);
    });
});
