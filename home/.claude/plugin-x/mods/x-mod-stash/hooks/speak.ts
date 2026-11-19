import type { EngineInterface } from 'claude-code';

// x-speak from the board: the play state its 🔊 ⏯️ ⏹️ buttons draw, kept in `$.state` speaking, and the one door to its
// control socket

// speak's own answer to `status`: reading and not paused draws ⏸️ on every play button, else ▶️ (dima, 15:51)
const SPEAKING = { key: 'speaking', plugin: 'x-mod-stash' } as const;
export async function refreshSpeaking($: EngineInterface) {
    const r = await speak($, { op: 'status' });
    let isPlaying = false;
    try {
        const v = JSON.parse(r ?? '{}') as {
            speaking?: unknown;
            paused?: unknown;
        };
        isPlaying = v.speaking === true && v.paused !== true;
    } catch {}
    if ((await $.state.get(SPEAKING)).value !== isPlaying)
        await $.state.set(SPEAKING, isPlaying).catch(() => undefined);
}

// one json line to x-speak's control socket; the text rides argv, never the shell's words
export async function speak(
    $: EngineInterface,
    request: Record<string, string>,
) {
    const socket = `${await $.env.get('HOME')}/.local/share/x-speak/control.sock`;
    const r = await $.process
        .run([
            'sh',
            '-c',
            'printf "%s\\n" "$1" | nc -U -w 2 "$2"',
            'sh',
            JSON.stringify(request),
            socket,
        ])
        .catch(() => undefined);
    if (!r || r.exitCode !== 0 || r.stdout.includes('"error"')) {
        $.ui.log(
            `x-mod-stash orbit: speak did not take ${request.op}: ${r?.stdout.trim() || r?.stderr.trim() || 'no answer'}`,
        );
        return undefined;
    }
    return r.stdout;
}

// a play press: pause or resume what reads, or read this row when nothing does; the status is read again after it
export async function playPress($: EngineInterface, text: string) {
    const isPlaying = (await $.state.get(SPEAKING)).value === true;
    const status = isPlaying ? undefined : await speak($, { op: 'status' });
    const isPaused = status ? /"paused":true/.test(status) : false;
    const isSpeaking = status ? /"speaking":true/.test(status) : false;
    await speak(
        $,
        isPlaying || (isSpeaking && isPaused)
            ? { op: 'pause' }
            : { op: 'read', text },
    );
    await refreshSpeaking($);
}

export async function isSpeakingNow($: EngineInterface) {
    return (await $.state.get(SPEAKING)).value === true;
}
