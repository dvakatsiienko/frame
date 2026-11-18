import { describe, expect, test, vi } from 'vitest';

import { SENT_DIR, createSentPictures, decodeBase64 } from './sent-pictures.js';

const inline = (id: string, data: string) => ({
    data,
    id,
    media: 'image/jpeg',
    path: null,
});

function rig(names: string[] = []) {
    const io = {
        home: '/app',
        list: vi.fn(async () => names),
        thumb: vi.fn(async (path: string) => `thumbs/${path.length}.png`),
        write: vi.fn(async (_rel: string, _bytes: Uint8Array) => true),
    };
    return { io, sent: createSentPictures(io) };
}

describe('base64 decodes to the bytes herdr writes', () => {
    test.each([
        ['', []],
        ['TQ==', [77]],
        ['TWE=', [77, 97]],
        ['TWFu', [77, 97, 110]],
        ['TWFu\nTWE=', [77, 97, 110, 77, 97]],
        ['/+8=', [255, 239]],
    ])('%j', (text, bytes) => {
        expect([...decodeBase64(text)]).toEqual(bytes);
    });
});

describe('each sent picture gets one file image() can draw (FRM-638 slice 5)', () => {
    test('an inline picture is written once from its bytes, then drawn from its file', async () => {
        const { io, sent } = rig();
        const picture = inline('u-1-0', 'TWFu');
        expect(sent.relOf(picture)).toBeNull();
        expect(await sent.make([picture])).toBe(true);
        expect(sent.pathOf(picture)).toBe(`/app/${SENT_DIR}/u-1-0.jpg`);
        expect(io.thumb).toHaveBeenCalledWith(`/app/${SENT_DIR}/u-1-0.jpg`);
        expect(sent.relOf(picture)).toBe(
            `thumbs/${`/app/${SENT_DIR}/u-1-0.jpg`.length}.png`,
        );
        expect(await sent.make([picture])).toBe(false);
        expect(io.write).toHaveBeenCalledTimes(1);
        expect([...(io.write.mock.calls[0]?.[1] ?? [])]).toEqual([77, 97, 110]);
    });

    test('after a reload, a picture already written is never written again', async () => {
        const { io, sent } = rig(['u-1-0.jpg']);
        await sent.make([inline('u-1-0', 'TWFu')]);
        expect(io.write).not.toHaveBeenCalled();
        expect(sent.pathOf(inline('u-1-0', ''))).toBe(
            `/app/${SENT_DIR}/u-1-0.jpg`,
        );
    });

    test('a picture sent by path gets its square from the file itself', async () => {
        const { io, sent } = rig();
        const picture = {
            data: null,
            id: 'u-2-0',
            media: null,
            path: '/a.png',
        };
        await sent.make([picture]);
        expect(io.thumb).toHaveBeenCalledWith('/a.png');
        expect(sent.relOf(picture)).toBe('thumbs/6.png');
        expect(sent.pathOf(picture)).toBe('/a.png');
    });

    test('a write that fails leaves the picture undrawn, and the next one still made', async () => {
        const { io, sent } = rig();
        io.write.mockResolvedValueOnce(false);
        const [a, b] = [inline('u-3-0', 'TQ=='), inline('u-3-1', 'TQ==')];
        expect(await sent.make([a, b])).toBe(true);
        expect(sent.relOf(a)).toBeNull();
        expect(sent.relOf(b)).not.toBeNull();
    });
});

describe('a picture that failed is made on a later pass (macroscope, slice 5)', () => {
    test('its square is tried again', async () => {
        const { io, sent } = rig();
        io.thumb.mockResolvedValueOnce(null);
        const picture = {
            data: null,
            id: 'u-4-0',
            media: null,
            path: '/c.png',
        };
        expect(await sent.make([picture])).toBe(false);
        expect(await sent.make([picture])).toBe(true);
        expect(sent.relOf(picture)).toBe('thumbs/6.png');
    });
});
