import type { Hotkey } from '@hotkeys/manual.ts';

import { AppLogo } from '@/components/AppLogo.tsx';
import { Info } from '@/components/Info.tsx';

import type { FeatureStat } from '@/api.ts';
import { chordCost, layoutKeys, showChord } from '@/keyboard.ts';
import { H2 } from '@/ui.ts';

// The rebind advisor: the busiest features belong on the cheapest keys. It suggests a move to a
// cheaper free key on the same layer, or a swap with a quieter feature that holds a cheaper one.
// Only the layers dima owns are searched — hyper, the bare f-keys, cmd+ctrl+opt — because an app
// hides its own shortcuts everywhere else and a «free» key there may not be free.
export const Advisor = (props: AdvisorProps) => {
    const suggestionListJSX = advise(props.features, props.hotkeys).map(
        (each) => {
            return (
                <li
                    className='grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 border-b border-line py-[5px] text-[13px]'
                    key={each.id}>
                    <span className='flex items-center gap-2 overflow-hidden'>
                        <AppLogo
                            fallback='blank'
                            name={each.feature}
                            size={16}
                        />
                        <span
                            className='truncate'
                            title={`${each.feature} ${each.move}`}>
                            <span className='font-mono'>{each.feature}</span>{' '}
                            <span className='text-ink-2'>{each.move}</span>
                        </span>
                    </span>
                    <span className='font-mono tabular-nums text-[12px] text-ink-2'>
                        {each.presses.toLocaleString('en')} presses
                    </span>
                </li>
            );
        },
    );

    return (
        <section className='grid gap-2.5'>
            <h2 className={H2}>
                rebind advisor{' '}
                <Info text='no ai: each key costs its distance from the resting hands plus a cost per held modifier, and the busiest features should sit on the cheapest keys' />
            </h2>
            {suggestionListJSX.length > 0 ? (
                <ul className='m-0 grid list-none p-0'>{suggestionListJSX}</ul>
            ) : (
                <p className='text-[13px] text-ink-2'>
                    nothing to move — every busy feature already sits on a cheap
                    key
                </p>
            )}
        </section>
    );
};

/* Helpers */
const OWNED_LAYERS = new Set(['hyper', '', 'ctrl+opt+cmd']);
const FKEYS = new Set([
    'f1',
    'f2',
    'f3',
    'f4',
    'f5',
    'f6',
    'f7',
    'f8',
    'f9',
    'f10',
    'f11',
    'f12',
]);
// a move must save at least one held modifier's worth of reach to be worth the relearning
const WORTH = 0.75;

const canHold = (layer: string, key: string) =>
    layer === '' ? FKEYS.has(key) : /^([a-z0-9]|[-=[\];',./`]|f\d+)$/.test(key);

const advise = (
    features: readonly FeatureStat[],
    hotkeys: readonly Hotkey[],
): Suggestion[] => {
    const bound = new Set(
        hotkeys.map((hotkey) => `${hotkey.mods}|${hotkey.key}`),
    );
    const presses = new Map(features.map((row) => [row.feature, row.count]));
    const placed = hotkeys.flatMap((hotkey) => {
        const feature = hotkey.feature ?? hotkey.action;
        const cost = chordCost(hotkey.mods, hotkey.key);
        const count = presses.get(feature) ?? 0;
        return OWNED_LAYERS.has(hotkey.mods) &&
            canHold(hotkey.mods, hotkey.key) &&
            cost !== undefined
            ? [{ cost, count, feature, key: hotkey.key, mods: hotkey.mods }]
            : [];
    });

    // each free key is handed out once, busiest feature first
    const taken = new Set(bound);
    const moves = [...placed]
        .sort((a, z) => z.count - a.count)
        .flatMap((each): Suggestion[] => {
            const target = layoutKeys
                .filter(
                    (key) =>
                        canHold(each.mods, key) &&
                        !taken.has(`${each.mods}|${key}`),
                )
                .map((key) => ({
                    cost: chordCost(each.mods, key) ?? Infinity,
                    key,
                }))
                .sort((a, z) => a.cost - z.cost)[0];
            if (
                !(
                    target &&
                    each.count >= 20 &&
                    each.cost - target.cost >= WORTH
                )
            )
                return [];
            taken.add(`${each.mods}|${target.key}`);
            return [
                {
                    feature: each.feature,
                    gain: each.count * (each.cost - target.cost),
                    id: `move-${each.feature}`,
                    move: `${showChord(chordOf(each))} → free ${showChord(chordOf({ key: target.key, mods: each.mods }))}`,
                    presses: each.count,
                },
            ];
        });

    const swaps = placed.flatMap((busy): Suggestion[] =>
        placed
            .filter(
                (quiet) =>
                    quiet.mods === busy.mods &&
                    busy.count >= 20 &&
                    busy.count > quiet.count * 2 &&
                    busy.cost - quiet.cost >= WORTH,
            )
            .map((quiet) => ({
                feature: busy.feature,
                gain: (busy.count - quiet.count) * (busy.cost - quiet.cost),
                id: `swap-${busy.feature}-${quiet.feature}`,
                move: `${showChord(chordOf(busy))} ⇄ ${showChord(chordOf(quiet))}, swap with ${quiet.feature} (${quiet.count.toLocaleString('en')})`,
                partner: quiet.feature,
                presses: busy.count,
            })),
    );

    // one suggestion per feature — its best — so a single busy key does not fill the list
    // and a swap partner is traded once
    const best = new Map<string, Suggestion>();
    const partners = new Set<string>();
    for (const each of [...moves, ...swaps].sort((a, z) => z.gain - a.gain)) {
        if (
            best.has(each.feature) ||
            (each.partner && partners.has(each.partner))
        )
            continue;
        best.set(each.feature, each);
        if (each.partner) partners.add(each.partner);
    }
    return [...best.values()].slice(0, 6);
};

const chordOf = (place: { mods: string; key: string }) =>
    place.mods === '' ? place.key : `${place.mods}+${place.key}`;

/* Types */
interface AdvisorProps {
    features: readonly FeatureStat[];
    hotkeys: readonly Hotkey[];
}

interface Suggestion {
    id: string;
    feature: string;
    move: string;
    presses: number;
    gain: number;
    partner?: string;
}
