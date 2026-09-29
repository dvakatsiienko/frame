import { type ReactNode, useId } from 'react';

import type { Engine } from '@/api.ts';

// an engine's identity: a 24px tile drawn in its brand's look. the brand hue lives here and in the card's top wash,
// never on a control (DESIGN.md, the one voice rule)
export const EngineMark = (props: EngineMarkProps) => {
    const id = useId();
    const glyphJSX = GLYPHS[props.engine](id);

    return (
        <svg
            aria-hidden='true'
            className={`size-6 shrink-0 rounded-md ${props.isDim ? 'opacity-55' : ''}`}
            viewBox='0 0 24 24'>
            {glyphJSX}
        </svg>
    );
};

// the hue each card's top wash takes; elevenlabs is monochrome, so it takes the ink
export const BRAND_HUE: Record<Engine, string> = {
    elevenlabs: 'var(--color-ink)',
    fish: '#0e8fd6',
    gemini: '#6f8cf2',
    kokoro: '#e0457b',
    system: '#8b5cf6',
};

/* Helpers */
const GLYPHS: Record<Engine, (id: string) => ReactNode> = {
    // two upright bars, their mark
    elevenlabs: () => {
        return (
            <>
                <rect fill='var(--color-ink)' height='24' width='24' />
                <rect
                    fill='var(--color-bg)'
                    height='12'
                    rx='0.5'
                    width='2.6'
                    x='8.4'
                    y='6'
                />
                <rect
                    fill='var(--color-bg)'
                    height='12'
                    rx='0.5'
                    width='2.6'
                    x='13'
                    y='6'
                />
            </>
        );
    },
    // a small fish in ocean blue — the brand has no mark we can draw from memory, so this one is ours
    fish: () => {
        return (
            <>
                <rect fill='#0e8fd6' height='24' width='24' />
                <path
                    d='M4.5 12c2.3-3.1 5.4-4.3 8.6-3.5 1.8.4 3.2 1.6 4.3 3.5-1.1 1.9-2.5 3.1-4.3 3.5-3.2.8-6.3-.4-8.6-3.5zm13.4 0 2.6-2.8v5.6z'
                    fill='#fff'
                />
                <circle cx='14.6' cy='11.2' fill='#0e8fd6' r='0.9' />
            </>
        );
    },
    // the four-point sparkle, blue into violet into rose
    gemini: (id) => {
        return (
            <>
                <defs>
                    <linearGradient id={`${id}g`} x1='0' x2='1' y1='0' y2='1'>
                        <stop offset='0' stopColor='#4285f4' />
                        <stop offset='0.55' stopColor='#9b72cb' />
                        <stop offset='1' stopColor='#d96570' />
                    </linearGradient>
                </defs>
                <rect fill='#131316' height='24' width='24' />
                <path
                    d='M12 3.5c.55 4.5 4 7.95 8.5 8.5-4.5.55-7.95 4-8.5 8.5-.55-4.5-4-7.95-8.5-8.5 4.5-.55 7.95-4 8.5-8.5z'
                    fill={`url(#${id}g)`}
                />
            </>
        );
    },
    // kokoro is «heart»: a white heart on rose
    kokoro: () => {
        return (
            <>
                <rect fill='#e0457b' height='24' width='24' />
                <path
                    d='M12 18.6s-6-3.6-6-7.8A3.3 3.3 0 0 1 12 8.9a3.3 3.3 0 0 1 6 1.9c0 4.2-6 7.8-6 7.8z'
                    fill='#fff'
                />
            </>
        );
    },
    // the siri orb: a glowing sphere of pink, violet, blue and teal on black
    system: (id) => {
        return (
            <>
                <defs>
                    <radialGradient cx='0.35' cy='0.35' id={`${id}s`} r='0.75'>
                        <stop offset='0' stopColor='#ffffff' />
                        <stop offset='0.25' stopColor='#ff5fd2' />
                        <stop offset='0.55' stopColor='#8b5cf6' />
                        <stop offset='0.8' stopColor='#2fb5ff' />
                        <stop offset='1' stopColor='#35e0c2' />
                    </radialGradient>
                </defs>
                <rect fill='#0b0b10' height='24' width='24' />
                <circle cx='12' cy='12' fill={`url(#${id}s)`} r='7.5' />
            </>
        );
    },
};

/* Types */
interface EngineMarkProps {
    engine: Engine;
    isDim?: boolean;
}
