import { describe, expect, test } from 'vitest';

import { openTarget } from './links.js';

describe('a clicked link opens through macOS open', () => {
    test('a file link opens its path', () => {
        expect(
            openTarget(
                'file:///Users/dima/.local/state/looks/PK-363/1506-stacked-crop.png',
            ),
        ).toBe('/Users/dima/.local/state/looks/PK-363/1506-stacked-crop.png');
    });

    test('a file link with an encoded space opens the real path', () => {
        expect(openTarget('file:///Users/dima/My%20Shots/a.png')).toBe(
            '/Users/dima/My Shots/a.png',
        );
    });

    test('a web link stays a url', () => {
        expect(openTarget('https://linear.app/x-com/issue/FRM-573')).toBe(
            'https://linear.app/x-com/issue/FRM-573',
        );
    });
});
