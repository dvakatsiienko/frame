// the page's one door to the admin server; the shapes mirror x-speak's config.swift

export const LANGS = [
    ['en', 'english'],
    ['uk', 'українська'],
    ['ru', 'русский'],
] as const;

export const ENGINES = [
    'elevenlabs',
    'kokoro',
    'system',
    'fish',
    'gemini',
] as const;

export const ENGINE_LABELS: Record<Engine, string> = {
    elevenlabs: 'ElevenLabs',
    fish: 'Fish',
    gemini: 'Gemini',
    kokoro: 'Kokoro (local)',
    system: 'macOS voice',
};

export const speaks = (engine: Engine, lang: Lang) =>
    engine !== 'kokoro' || lang === 'en';

export const voiceOf = (config: Config, engine: Engine, lang: Lang) => {
    const voice = config.engines[engine]?.voice ?? {};
    return voice[lang] ?? voice['*'] ?? '';
};

const call = async <T>(
    method: string,
    path: string,
    payload?: unknown,
): Promise<T> => {
    const response = await fetch(path, {
        body: payload === undefined ? undefined : JSON.stringify(payload),
        headers: { 'content-type': 'application/json' },
        method,
    });
    return response.json();
};

export const api = {
    config: () => call<Config>('GET', '/api/config'),
    favourites: (engine: Engine, favourites: string[]) =>
        call<Reply>('PUT', '/api/favourites', { engine, favourites }),
    pause: () => call<Reply>('POST', '/api/pause'),
    preview: (payload: Preview) => call<Reply>('POST', '/api/preview', payload),
    save: (config: Config) => call<Reply>('PUT', '/api/config', config),
    status: () => call<Status & Reply>('GET', '/api/status'),
    stop: () => call<Reply>('POST', '/api/stop'),
    voices: () => call<Voices>('GET', '/api/voices'),
};

/* Types */

export type Lang = (typeof LANGS)[number][0];
export type Engine = (typeof ENGINES)[number];

export interface EngineSettings {
    model?: string;
    // voice ids dima hearted; the daemon ignores them, the admin sorts them to the top
    favourites?: string[];
    voice?: Partial<Record<Lang | '*', string>>;
    speed?: number;
    gain?: number;
}

export interface Config {
    chain: Partial<Record<Lang, Engine[]>>;
    firstAudioMs: number;
    meterGlideMs?: number;
    meterFlowMs?: number;
    engines: Partial<Record<Engine, EngineSettings>>;
}

export interface Reply {
    error?: string;
    ok?: boolean;
}

export interface Status {
    accessibility?: boolean;
    speaking?: boolean;
    paused?: boolean;
    engines?: Partial<
        Record<
            Engine,
            {
                state: 'live' | 'benched' | 'no key' | 'no quota';
                until?: string;
                // the provider's own words on a quota refusal
                note?: string;
            }
        >
    >;
}

export interface SystemVoice {
    id: string;
    name: string;
    lang: string;
    quality: string;
}

export type Voices = Record<Exclude<Engine, 'system'>, [string, string][]> & {
    system: SystemVoice[];
};

export interface Preview {
    engine: Engine;
    text: string;
    settings: EngineSettings;
}
