import { EngineCard } from '@/components/EngineCard.tsx';

import {
    type Config,
    ENGINES,
    type Engine,
    type EngineSettings,
    type Lang,
    type Status,
    type Voices,
    speaks,
    voiceOf,
} from '@/api.ts';

// one language: its chain in order, then the engines that could join it
export const Column = (props: ColumnProps) => {
    const chain = props.config.chain[props.lang] ?? [];
    const order = [
        ...chain,
        ...ENGINES.filter(
            (engine) => speaks(engine, props.lang) && !chain.includes(engine),
        ),
    ];

    const cardListJSX = order.map((engine) => {
        const rank = chain.indexOf(engine);
        return (
            <EngineCard
                engine={engine}
                isLast={rank === chain.length - 1}
                key={engine}
                lang={props.lang}
                onFavourite={(voice, isFavourite) =>
                    props.onFavourite(engine, voice, isFavourite)
                }
                onMove={(step) => props.onChain(swap(chain, rank, rank + step))}
                onPreview={() => props.onPreview(engine)}
                onSettings={(patch) => props.onSettings(engine, patch)}
                onToggle={(isOn) =>
                    props.onChain(
                        isOn
                            ? [...chain, engine]
                            : chain.filter((each) => each !== engine),
                    )
                }
                onVoice={(voice) => props.onVoice(engine, voice)}
                rank={rank >= 0 ? rank : undefined}
                settings={props.config.engines[engine] ?? {}}
                status={props.status.engines?.[engine]}
                voice={voiceOf(props.config, engine, props.lang)}
                voiceOptions={voiceOptions(props.voices, engine, props.lang)}
            />
        );
    });

    return (
        <section id={`col-${props.lang}`}>
            <h2 className='mb-2 text-base font-semibold'>{props.title}</h2>
            <label className='mb-3 block text-sm text-muted'>
                sample line
                <input
                    className='mt-1 block w-full rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink'
                    onChange={(event) => props.onSample(event.target.value)}
                    type='text'
                    value={props.sample}
                />
            </label>
            <ol className='grid list-none gap-2 p-0'>{cardListJSX}</ol>
        </section>
    );
};

/* Helpers */
const swap = (chain: Engine[], from: number, to: number) => {
    const next = [...chain];
    [next[from], next[to]] = [next[to] as Engine, next[from] as Engine];
    return next;
};

// every engine's voices; the mac voice lists the installed female voices of this language
const voiceOptions = (
    voices: Voices | undefined,
    engine: Engine,
    lang: Lang,
): [string, string][] => {
    if (!voices) return [];
    if (engine !== 'system') return voices[engine];
    const installed = voices.system
        .filter((voice) => voice.lang === lang)
        .map((voice): [string, string] => [
            voice.id,
            `${voice.name} · ${voice.quality}`,
        ]);
    return [
        ['', lang === 'en' ? 'Spoken Content voice (Siri)' : 'best installed'],
        ...installed,
    ];
};

/* Types */
interface ColumnProps {
    config: Config;
    lang: Lang;
    title: string;
    sample: string;
    status: Status;
    voices?: Voices;
    onChain: (chain: Engine[]) => void;
    onPreview: (engine: Engine) => void;
    onSample: (sample: string) => void;
    onSettings: (engine: Engine, patch: EngineSettings) => void;
    onVoice: (engine: Engine, voice: string) => void;
    onFavourite: (engine: Engine, voice: string, isFavourite: boolean) => void;
}
