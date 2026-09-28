import { describe, expect, it } from 'vitest';

import { refuseMutation } from './serve.ts';

const write = (remoteAddress: string) =>
    refuseMutation({
        headers: { 'content-type': 'application/json' },
        socket: { remoteAddress },
    });

describe('a write to the chords server', () => {
    it('is refused from another machine on the network', () => {
        expect(write('192.168.1.23')).toBe(
            'writes are taken from this mac only',
        );
    });

    it('is taken from this mac over ipv4', () => {
        expect(write('127.0.0.1')).toBeNull();
    });

    it('is taken from this mac over ipv6', () => {
        expect(write('::1')).toBeNull();
    });
});
