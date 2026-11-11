import { describe, expect, it, vi } from 'vitest';

vi.mock('herdr', () => ({ appHome: () => '/app', exec: vi.fn() }));
const { parseShots, shotsWith, shotsWithout } = await import('./shots.js');

describe('parseShots', () => {
    it('reads a store of thread addresses to preview paths', () => {
        expect(parseShots('{"t1": ["data/a.png"]}')).toEqual({
            t1: ['data/a.png'],
        });
    });
    it('reads a missing file as empty', () => {
        expect(parseShots(null)).toEqual({});
    });
    it('reads a broken file as empty', () => {
        expect(parseShots('{"t1": [')).toEqual({});
    });
    it('drops a thread whose list is not all paths', () => {
        expect(parseShots('{"t1": [1], "t2": "x", "t3": ["ok.png"]}')).toEqual({
            t3: ['ok.png'],
        });
    });
    it('reads an array as empty', () => {
        expect(parseShots('["a.png"]')).toEqual({});
    });
});

describe('the store per thread', () => {
    it('adds a paste after the thread’s earlier ones', () => {
        expect(shotsWith({ t1: ['a.png'] }, 't1', 'b.png')).toEqual({
            t1: ['a.png', 'b.png'],
        });
    });
    it('clears one thread and keeps the others', () => {
        expect(shotsWithout({ t1: ['a.png'], t2: ['b.png'] }, 't1')).toEqual({
            t2: ['b.png'],
        });
    });
});
