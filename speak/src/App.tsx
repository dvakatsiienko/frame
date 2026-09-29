import { useEffect, useRef, useState } from 'react';
import { move } from '@dnd-kit/helpers';
import { DragDropProvider } from '@dnd-kit/react';
import { useQuery } from '@tanstack/react-query';
import { ErrorBoundary } from 'react-error-boundary';

import { Column } from '@/components/Column.tsx';
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
    // polled while the tab is visible; react-query stops it with the tab
    const status = useQuery({
        queryFn: api.status,
        queryKey: ['status'],
        refetchInterval: 5000,
    });
    const [draft, setDraft] = useState<Config>();
    const [samples, setSamples] = useState<Record<Lang, string>>(SAMPLES);
    const dragStart = useRef<Config>(undefined);
    const [message, setMessage] = useState<{
        text: string;
        kind?: 'ok' | 'error';
    }>({ text: 'no changes' });

    useEffect(() => {
        if (saved.data && !draft) setDraft(saved.data);
    }, [saved.data, draft]);

    if (!draft)
        return (
            <p className='p-4 text-muted'>
                {saved.error
                    ? `the admin server is not answering — ${saved.error.message}`
                    : 'reading config.json…'}
            </p>
        );

    const isDirty = draft !== saved.data;
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
    const setFavourite = (
        engine: Engine,
        voice: string,
        isFavourite: boolean,
    ) => {
        const current = draft.engines[engine]?.favourites ?? [];
        setEngine(engine, {
            favourites: isFavourite
                ? [...current, voice]
                : current.filter((each) => each !== voice),
        });
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
        : `daemon up · accessibility ${statusData.accessibility ? 'granted' : 'missing'}${statusData.speaking ? ' · speaking' : ''}`;

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
                    onFavourite={setFavourite}
                    onPreview={(engine) => void preview(engine, lang)}
                    onSample={(sample) =>
                        setSamples({ ...samples, [lang]: sample })
                    }
                    onSettings={setEngine}
                    onVoice={(engine, voice) => setVoice(engine, lang, voice)}
                    sample={samples[lang]}
                    status={statusData}
                    title={title}
                    voices={voices.data}
                />
            </ErrorBoundary>
        );
    });

    return (
        <>
            <header className='mx-auto flex max-w-[1280px] flex-wrap items-center gap-4 p-4'>
                <h1 className='m-0 text-lg'>
                    <a
                        className='font-bold text-ink no-underline hover:underline'
                        href='/'>
                        🔊 speak voices
                    </a>
                </h1>
                <label className='text-sm text-muted'>
                    first audio budget{' '}
                    <input
                        className='w-22 rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink'
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
                <span className='text-sm text-muted'>{healthText}</span>
                <button
                    className={buttonClass}
                    onClick={() => void api.stop()}
                    type='button'>
                    ■ stop
                </button>
            </header>
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
                <main className='mx-auto grid max-w-[1280px] grid-cols-1 gap-4 p-4 min-[900px]:grid-cols-3'>
                    {columnListJSX}
                </main>
            </DragDropProvider>
            <footer className='sticky bottom-0 mx-auto flex max-w-[1280px] flex-wrap items-center gap-3 border-t border-line bg-bg p-4'>
                <button
                    className={`${buttonClass} border-accent bg-accent font-semibold text-on-accent hover:bg-accent hover:brightness-110`}
                    disabled={!isDirty}
                    onClick={() => void save()}
                    type='button'>
                    save
                </button>
                <span
                    className={`select-text text-sm ${message.kind === 'error' ? 'text-bad' : message.kind === 'ok' ? 'text-ok' : ''}`}
                    role='status'>
                    {message.text}
                </span>
            </footer>
        </>
    );
};

/* Styles */
const buttonClass =
    'min-h-8 min-w-8 rounded-md border border-line bg-surface-2 px-3 py-1 text-sm hover:border-muted hover:bg-surface disabled:opacity-50';

/* Helpers */
const SAMPLES: Record<Lang, string> = {
    en: 'FRM-266 shipped in v0.3.85 → see `speak/`',
    ru: 'FRM-266 вышел в v0.3.85 → смотри `speak/`',
    uk: 'FRM-266 вийшов у v0.3.85 → дивись `speak/`',
};
