import { useEffect, useRef, useState } from 'react';
import { move } from '@dnd-kit/helpers';
import { DragDropProvider } from '@dnd-kit/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary } from 'react-error-boundary';

import { Column } from '@/components/Column.tsx';
import { MsSetting } from '@/components/MsSetting.tsx';
import { SectionFallback } from '@/components/SectionFallback.tsx';

import {
    type Config,
    type Engine,
    type EngineSettings,
    LANGS,
    type Lang,
    api,
    voiceOf,
} from '@/api.ts';

export const App = () => {
    const saved = useQuery({
        queryFn: api.config,
        queryKey: ['config'],
        staleTime: Number.POSITIVE_INFINITY,
    });
    const voices = useQuery({
        queryFn: api.voices,
        queryKey: ['voices'],
        staleTime: Number.POSITIVE_INFINITY,
    });
    // the card whose ▶ started the speech; its controls follow the daemon's status until the speech ends
    const [playing, setPlaying] = useState<Playing>();
    // polled while the tab is visible (react-query stops it with the tab); fast while a card plays
    const status = useQuery({
        queryFn: api.status,
        queryKey: ['status'],
        refetchInterval: playing ? 700 : 5000,
    });
    const queryClient = useQueryClient();
    const [draft, setDraft] = useState<Config>();
    const [samples, setSamples] = useState<Record<Lang, string>>(SAMPLES);
    const dragStart = useRef<Config>(undefined);
    // the pill's infinite waveform: it plays the draft's glide and flow live, re-arms the daemon's 5-minute deadline
    // every minute, and turns off when toggled off, on unmount, or when the tab goes away
    const [isWaveOn, setIsWaveOn] = useState(false);
    const glide = draft?.meterGlideMs;
    const flow = draft?.meterFlowMs;
    useEffect(() => {
        if (isWaveOn) void api.wave({ flow, glide, on: true });
    }, [isWaveOn, glide, flow]);
    useEffect(() => {
        if (!isWaveOn) return;
        const off = () =>
            navigator.sendBeacon(
                '/api/wave',
                new Blob([JSON.stringify({ on: false })], {
                    type: 'application/json',
                }),
            );
        const keepAlive = setInterval(
            () => void api.wave({ on: true }),
            60_000,
        );
        window.addEventListener('pagehide', off);
        return () => {
            clearInterval(keepAlive);
            window.removeEventListener('pagehide', off);
            void api.wave({ on: false });
        };
    }, [isWaveOn]);
    const [message, setMessage] = useState<{
        text: string;
        kind?: 'ok' | 'error';
    }>({ text: 'no changes' });

    useEffect(() => {
        if (saved.data && !draft) setDraft(saved.data);
    }, [saved.data, draft]);

    // a preview counts as over once the daemon was seen speaking and then went quiet, or never started within 8 s
    useEffect(() => {
        if (!(playing && status.data)) return;
        if (status.data.speaking) {
            if (!playing.hasStarted)
                setPlaying({ ...playing, hasStarted: true });
        } else if (playing.hasStarted || Date.now() - playing.since > 8000) {
            setPlaying(undefined);
        }
    }, [status.data, playing]);

    if (!draft)
        return (
            <p className='p-4 text-muted'>
                {saved.error
                    ? `the admin server is not answering — ${saved.error.message}`
                    : 'reading config.json…'}
            </p>
        );

    // by content, not identity: a ♥ updates the draft and the saved copy alike, and that is no unsaved change
    const isDirty = JSON.stringify(draft) !== JSON.stringify(saved.data);
    const edit = (next: Config) => {
        setDraft(next);
        setMessage({ text: 'unsaved changes' });
    };
    const setEngine = (engine: Engine, patch: EngineSettings) => {
        edit({
            ...draft,
            engines: {
                ...draft.engines,
                [engine]: { ...draft.engines[engine], ...patch },
            },
        });
    };
    const setVoice = (engine: Engine, lang: Lang, voice: string) => {
        const current = { ...draft.engines[engine]?.voice };
        if (voice) current[lang] = voice;
        else delete current[lang];
        setEngine(engine, { voice: current });
    };
    // a ♥ saves at once, outside the save button: the file, the saved copy and the draft all take it, so it
    // never shows as an unsaved change and never carries the draft's other edits with it
    const setFavourite = async (
        engine: Engine,
        voice: string,
        isFavourite: boolean,
    ) => {
        const current = draft.engines[engine]?.favourites ?? [];
        const favourites = isFavourite
            ? [...current, voice]
            : current.filter((each) => each !== voice);
        const reply = await api.favourites(engine, favourites);
        if (reply.error)
            return setMessage({
                kind: 'error',
                text: `♥ not saved — ${reply.error}`,
            });
        const withFavourites = (config: Config): Config => ({
            ...config,
            engines: {
                ...config.engines,
                [engine]: { ...config.engines[engine], favourites },
            },
        });
        queryClient.setQueryData<Config>(
            ['config'],
            (config) => config && withFavourites(config),
        );
        setDraft(withFavourites(draft));
    };
    const preview = async (engine: Engine, lang: Lang) => {
        const voice = voiceOf(draft, engine, lang);
        const reply = await api.preview({
            engine,
            settings: {
                ...draft.engines[engine],
                voice: voice ? { [lang]: voice } : {},
            },
            text: samples[lang],
        });
        setMessage(
            reply.error
                ? { kind: 'error', text: reply.error }
                : { text: `▶ ${engine} · ${lang}` },
        );
        if (!reply.error)
            setPlaying({ engine, hasStarted: false, lang, since: Date.now() });
    };
    const pause = async () => {
        await api.pause();
        await status.refetch();
    };
    const stop = async () => {
        await api.stop();
        setPlaying(undefined);
    };
    // back to the saved config: every unsaved edit goes, nothing is written
    const reset = () => {
        setDraft(saved.data);
        setMessage({ text: 'reset to the saved config' });
    };
    const save = async () => {
        const reply = await api.save(draft);
        if (reply.error)
            return setMessage({
                kind: 'error',
                text: `rejected — ${reply.error}`,
            });
        await saved.refetch();
        setDraft(undefined);
        setMessage({ kind: 'ok', text: 'saved · the daemon loaded it' });
    };

    const statusData = status.data ?? {};
    const healthText = statusData.error
        ? statusData.error
        : `daemon up${statusData.accessibility === false ? ' · accessibility missing' : ''}${statusData.speaking ? ' · speaking' : ''}`;

    const columnListJSX = LANGS.map(([lang, title]) => {
        return (
            <ErrorBoundary
                FallbackComponent={SectionFallback}
                key={lang}
                resetKeys={[lang]}>
                <Column
                    config={draft}
                    lang={lang}
                    onChain={(chain) =>
                        edit({
                            ...draft,
                            chain: { ...draft.chain, [lang]: chain },
                        })
                    }
                    onFavourite={(engine, voice, isFavourite) =>
                        void setFavourite(engine, voice, isFavourite)
                    }
                    onPause={() => void pause()}
                    onPreview={(engine) => void preview(engine, lang)}
                    onSample={(sample) =>
                        setSamples({ ...samples, [lang]: sample })
                    }
                    onSettings={setEngine}
                    onStop={() => void stop()}
                    onVoice={(engine, voice) => setVoice(engine, lang, voice)}
                    playing={
                        playing?.lang === lang
                            ? {
                                  engine: playing.engine,
                                  isPaused: statusData.paused === true,
                              }
                            : undefined
                    }
                    sample={samples[lang]}
                    status={statusData}
                    title={title}
                    voices={voices.data}
                />
            </ErrorBoundary>
        );
    });

    const langLinkListJSX = LANGS.map(([lang, title]) => {
        return (
            <li key={lang}>
                <a
                    className='block rounded-full px-3 py-1 text-sm text-pill-muted no-underline hover:bg-pill-hover hover:text-pill-ink'
                    href={`#col-${lang}`}>
                    {title}
                </a>
            </li>
        );
    });

    return (
        <>
            <div className='sticky top-3 z-30 mx-auto mt-3 max-w-[1280px] px-4'>
                <header className={capsuleClass}>
                    <h1 className='m-0 text-lg'>
                        <a
                            className='flex items-center gap-2 rounded-full font-bold text-pill-ink no-underline hover:text-white'
                            href='/'>
                            <MeterMark />
                            speak
                        </a>
                    </h1>
                    <nav aria-label='languages'>
                        <ul className='m-0 flex list-none gap-1 p-0'>
                            {langLinkListJSX}
                        </ul>
                    </nav>
                    <span className='flex-1' />
                    <span className='select-text text-sm text-pill-muted'>
                        {healthText}
                    </span>
                    <button
                        className={pillButtonClass}
                        onClick={() => void stop()}
                        type='button'>
                        ■ stop
                    </button>
                </header>
            </div>
            <div className='mx-auto max-w-[1280px] px-4 pt-4'>
                <section
                    aria-label='playback'
                    className='flex flex-wrap items-center gap-x-8 gap-y-3 rounded-[22px] border border-line bg-surface px-5 py-3'>
                    <label className='flex items-center gap-2 text-sm text-muted'>
                        first audio budget{' '}
                        <input
                            className='w-20 rounded-md border border-line bg-surface px-2 py-1 text-right text-sm tabular-nums text-ink'
                            max={3000}
                            min={100}
                            onChange={(event) =>
                                edit({
                                    ...draft,
                                    firstAudioMs: Number(event.target.value),
                                })
                            }
                            step={50}
                            type='number'
                            value={draft.firstAudioMs}
                        />{' '}
                        ms
                    </label>
                    <MsSetting
                        hint='how long a bar takes to reach a new level; 0 jumps straight to it'
                        label='pill glide'
                        max={200}
                        onChange={(value) =>
                            edit({ ...draft, meterGlideMs: value })
                        }
                        value={draft.meterGlideMs ?? 30}
                    />
                    <MsSetting
                        hint='how long the wave holds before moving one bar outward; lower travels faster'
                        label='pill flow'
                        max={200}
                        onChange={(value) =>
                            edit({ ...draft, meterFlowMs: value })
                        }
                        value={draft.meterFlowMs ?? 40}
                    />
                    <label className='flex min-h-8 cursor-pointer select-none items-center gap-2.5 text-sm text-muted'>
                        <input
                            aria-checked={isWaveOn}
                            checked={isWaveOn}
                            className='size-4'
                            onChange={(event) =>
                                setIsWaveOn(event.target.checked)
                            }
                            role='switch'
                            type='checkbox'
                        />
                        infinite waveform
                    </label>
                </section>
            </div>
            <DragDropProvider
                // react owns the order through the whole drag: move() on every drag-over, the snapshot back on a
                // cancel. applying it only on drop fought dnd-kit's optimistic dom reorder (the page and the ranks
                // disagreed after a keyboard drag)
                onDragEnd={(event) => {
                    if (event.canceled && dragStart.current)
                        edit(dragStart.current);
                    dragStart.current = undefined;
                }}
                onDragOver={(event) => {
                    const ids = Object.fromEntries(
                        LANGS.map(([lang]) => [
                            lang,
                            (draft.chain[lang] ?? []).map(
                                (engine) => `${lang}:${engine}`,
                            ),
                        ]),
                    );
                    const moved = move(ids, event);
                    const chain = Object.fromEntries(
                        Object.entries(moved).map(([lang, list]) => [
                            lang,
                            list.map(
                                (id) => String(id).split(':')[1] as Engine,
                            ),
                        ]),
                    );
                    if (JSON.stringify(chain) !== JSON.stringify(draft.chain))
                        edit({ ...draft, chain });
                }}
                onDragStart={() => {
                    dragStart.current = draft;
                }}>
                <main className='mx-auto grid max-w-[1280px] grid-cols-1 gap-x-6 gap-y-10 px-4 pt-8 pb-28 min-[900px]:grid-cols-3'>
                    {columnListJSX}
                </main>
            </DragDropProvider>
            <div className='sticky bottom-3 z-30 mx-auto max-w-[1280px] px-4'>
                <footer className='flex flex-wrap items-center gap-2 rounded-[22px] border border-pill-line bg-pill/95 p-2 text-pill-ink shadow-lg'>
                    <button
                        className={savePillClass}
                        disabled={!isDirty}
                        onClick={() => void save()}
                        type='button'>
                        save
                    </button>
                    <button
                        className={pillButtonClass}
                        disabled={!isDirty}
                        onClick={reset}
                        type='button'>
                        reset
                    </button>
                    <span
                        className={`select-text px-2 text-sm ${message.kind === 'error' ? 'text-pill-bad' : message.kind === 'ok' ? 'text-pill-ok' : 'text-pill-muted'}`}
                        role='status'>
                        {message.text}
                    </span>
                </footer>
            </div>
        </>
    );
};

// the pill's meter as a still mark: five bars, centre-heavy, in the live indigo
const MeterMark = () => {
    const barListJSX = [0.35, 0.65, 1, 0.65, 0.35].map((height, index) => {
        return (
            <rect
                fill='var(--color-pill-accent)'
                height={16 * height}
                key={index}
                rx='1.25'
                width='2.5'
                x={3 + index * 4}
                y={12 - 8 * height}
            />
        );
    });
    return (
        <svg aria-hidden='true' className='size-6' viewBox='0 0 24 24'>
            {barListJSX}
        </svg>
    );
};

/* Styles */
// the pill's capsule: dark glass in both themes, a hairline of white, its own ink
const capsuleClass =
    'flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[22px] border border-pill-line bg-pill/95 px-3 py-1.5 text-pill-ink shadow-lg';

const pillButtonClass =
    'h-8 rounded-full border border-pill-line px-3.5 text-sm text-pill-ink hover:bg-pill-hover disabled:opacity-50';

// its own classes, not pillButtonClass plus overrides: two bg utilities on one element resolve by stylesheet order
const savePillClass =
    'h-8 rounded-full border border-pill-accent bg-pill-accent px-3.5 text-sm font-semibold text-pill hover:brightness-110 disabled:opacity-50';

/* Helpers */
const SAMPLES: Record<Lang, string> = {
    en: 'FRM-266 shipped in v0.3.85 → see `speak/`',
    ru: 'Привет! Я прочитаю вслух всё, что ты выделишь, — спокойно, чётко и без спешки.',
    uk: 'Привіт! Я прочитаю вголос усе, що ти виділиш, — спокійно, чітко і без поспіху.',
};

/* Types */
interface Playing {
    engine: Engine;
    lang: Lang;
    hasStarted: boolean;
    since: number;
}
