// each engine speaks one run or throws before any audio plays, so the chain falls through silently.
// every child joins the player's process group — one kill of the group stops whichever engine is live.
import { type ChildProcess, spawn } from 'node:child_process';
import { Readable } from 'node:stream';

import type { Lang, Run } from './normalize.ts';

const KOKORO_URL = 'http://127.0.0.1:7383';
const KOKORO_MODEL = 'mlx-community/Kokoro-82M-bf16';
const ELEVENLABS_MODEL = 'eleven_v4';
// a premade voice: free keys get 402 paid_plan_required on library voices
const ELEVENLABS_VOICE = 'JBFqnCBsd6RMkjVDRZzb';
const GEMINI_MODEL = 'gemini-3.8-flash-tts';

// en has no -v: `say` then speaks with the Spoken Content system voice, which is where siri voice 4 lives
const SAY_VOICES = {
    en: [],
    ru: ['-v', 'Milena'],
    uk: ['-v', 'Lesya'],
} as const satisfies Record<Lang, readonly string[]>;

const exited = (child: ChildProcess) =>
    new Promise<void>((resolve, reject) =>
        child.on('exit', (code) =>
            code === 0
                ? resolve()
                : reject(new Error(`${child.spawnfile} exit ${code}`)),
        ),
    );

function playPcm(body: ReadableStream<Uint8Array>) {
    const player = spawn(
        'ffplay',
        [
            '-f',
            's16le',
            '-ar',
            '24000',
            '-ch_layout',
            'mono',
            '-nodisp',
            '-autoexit',
            '-loglevel',
            'quiet',
            '-',
        ],
        {
            stdio: ['pipe', 'ignore', 'ignore'],
        },
    );
    Readable.fromWeb(body).pipe(player.stdin);
    return exited(player);
}

async function audioResponse(url: string, init: RequestInit) {
    const response = await fetch(url, init);
    if (!(response.ok && response.body))
        throw new Error(`${new URL(url).host} ${response.status}`);
    return response.body;
}

async function elevenlabs(run: Run) {
    const key = process.env.ELEVENLABS_API_KEY;
    if (!key) throw new Error('elevenlabs: no key');
    const body = await audioResponse(
        `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE}/stream?output_format=pcm_24000`,
        {
            body: JSON.stringify({
                language_code: run.lang,
                model_id: ELEVENLABS_MODEL,
                text: run.text,
            }),
            headers: { 'content-type': 'application/json', 'xi-api-key': key },
            method: 'POST',
        },
    );
    await playPcm(body);
}

// s2.1-pro-free: no character cap, free until 2026-11-30; any non-2xx after that drops this tier by itself
async function fish(run: Run) {
    const key = process.env.FISH_API_KEY;
    if (!key) throw new Error('fish: no key');
    const body = await audioResponse('https://api.fish.audio/v1/tts', {
        body: JSON.stringify({
            format: 'pcm',
            latency: 'balanced',
            sample_rate: 24000,
            text: run.text,
        }),
        headers: {
            authorization: `Bearer ${key}`,
            'content-type': 'application/json',
            model: 's2.1-pro-free',
        },
        method: 'POST',
    });
    await playPcm(body);
}

async function kokoroReady() {
    try {
        return (await fetch(`${KOKORO_URL}/docs`)).ok;
    } catch {
        return false;
    }
}

// the server is started on first use and stays warm: ~3.7 s cold, ~0.4 s warm, ~620 MB resident (measured 2026-09-29)
async function kokoro(run: Run) {
    if (run.lang !== 'en') throw new Error('kokoro: en only');
    if (!(await kokoroReady())) {
        spawn(
            `${process.env.HOME}/.local/bin/mlx_audio.server`,
            ['--host', '127.0.0.1', '--port', '7383'],
            {
                detached: true,
                stdio: 'ignore',
            },
        ).unref();
        for (let i = 0; i < 120 && !(await kokoroReady()); i++)
            await new Promise((r) => setTimeout(r, 250));
    }
    const body = await audioResponse(`${KOKORO_URL}/v1/audio/speech`, {
        body: JSON.stringify({
            input: run.text,
            model: KOKORO_MODEL,
            response_format: 'pcm',
            voice: 'af_heart',
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
    });
    await playPcm(body);
}

async function gemini(run: Run) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('gemini: no key');
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
        {
            body: JSON.stringify({
                contents: [{ parts: [{ text: run.text }] }],
                generationConfig: {
                    responseModalities: ['AUDIO'],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: 'Kore' },
                        },
                    },
                },
            }),
            headers: {
                'content-type': 'application/json',
                'x-goog-api-key': key,
            },
            method: 'POST',
        },
    );
    if (!response.ok) throw new Error(`gemini ${response.status}`);
    const { candidates } = (await response.json()) as GeminiResponse;
    const data = candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!data) throw new Error('gemini: no audio');
    const audio = Buffer.from(data, 'base64');
    const isWav = audio.subarray(0, 4).toString() === 'RIFF';
    await playPcm(
        Readable.toWeb(
            Readable.from([isWav ? audio.subarray(44) : audio]),
        ) as ReadableStream<Uint8Array>,
    );
}

function say(run: Run) {
    return exited(
        spawn('say', [...SAY_VOICES[run.lang], run.text], { stdio: 'ignore' }),
    );
}

export const ENGINES = {
    elevenlabs,
    fish,
    gemini,
    kokoro,
    say,
} as const satisfies Record<string, (run: Run) => Promise<void>>;

// gemini sits outside the chain: a test drive only, forced with --engine gemini (its free tier trains on input)
export const CHAIN = [
    'elevenlabs',
    'fish',
    'kokoro',
    'say',
] as const satisfies readonly EngineName[];

/* Types */

export type EngineName = keyof typeof ENGINES;

interface GeminiResponse {
    candidates?: {
        content?: { parts?: { inlineData?: { data?: string } }[] };
    }[];
}
