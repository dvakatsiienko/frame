// the thread the chat shows: which Claude the focused tab runs, its transcript read from the tail and watched for each
// new line, its state file, the earlier pages above, and his reading place brought back after a reload
import { readdir } from 'fs/promises';
import { exec, home, readTextFile, watchFolder } from 'herdr';

import { STATE_DIR } from './band.js';
import { replyIdOf } from './files.js';
import { placeOf } from './follow.js';
import { placeKey } from './message-list.js';
import { createPages } from './pages.js';
import { createReader } from './reader.js';
import { addressIn } from './send.js';
import { pidFor } from './shown.js';
import { loadableSkills } from './skills.js';
import { sidOf, transcriptPath } from './thread.js';

/** @typedef {import('./chat-types.js').Context} Context */
/** @typedef {import('./row-model.js').Row} Row */

// earlier pages read at most this many times while looking for the message he was reading
const PLACE_PAGES = 8;
// how often the shown thread's session is looked up again, as the old chat's tick did
const SHOWN_LOOK_MS = 2000;
/** @type {Row} over a thread read back to its first line: no older page is left to ask for */
export const START_ROW = {
    at: null,
    delivery: null,
    files: [],
    id: 'start-of-thread',
    isTurnStart: false,
    isWaiting: false,
    kind: 'start',
    pictures: [],
    replyId: null,
    text: '',
    tools: [],
    version: 1,
};
/** @type {import('./skills.js').SkillFs} */
const SKILL_FS = {
    list: (dir) => readdir(dir).catch(() => []),
    read: (path) => readTextFile(path).catch(() => null),
};
/** @param {unknown} error */
const readError = (error) =>
    `This thread's transcript could not be read: ${error instanceof Error ? error.message : String(error)}`;

/** @param {string} program @param {string[]} args */
async function run(program, args) {
    const out = await exec(program, args);
    if (out.code !== 0)
        throw new Error(out.stderr.trim() || `${program} failed`);
    return out.stdout;
}

/**
 * the transcript file as the reader reaches it: herdr reads no byte range itself, so the shell does
 * @param {string} file
 * @returns {import('./reader.js').FileDoor}
 */
const doorTo = (file) => ({
    lineStartAt: async (at) =>
        at +
        Number(
            (
                await run('sh', [
                    '-c',
                    'tail -c +"$1" "$2" | head -n 1 | wc -c',
                    'sh',
                    String(at + 1),
                    file,
                ])
            ).trim(),
        ),
    read: (from, max) =>
        run('sh', [
            '-c',
            'tail -c +"$1" "$2" | head -c "$3"',
            'sh',
            String(from + 1),
            file,
            String(max),
        ]),
    sizeOf: async () => {
        const out = await exec('stat', ['-f', '%z', file]);
        return out.code === 0 ? Number(out.stdout.trim()) : null;
    },
});

/**
 * @typedef {object} ThreadFeedDeps
 * @property {ReturnType<typeof import('./band-view.js').createBand>} band
 * @property {() => void} clearShown every view lets go of the old thread: its rows, ask, menu, viewer, find, quill
 * @property {ReturnType<typeof import('./find-bar.js').createFindBar>} findBar
 * @property {ReturnType<typeof import("./heights.js").createHeights>} heights
 * @property {ReturnType<typeof import('./message-list.js').createMessageList>} list
 * @property {() => import('./look.js').Look} look
 * @property {ReturnType<typeof import('./row-model.js').createRowModel>} model
 * @property {ReturnType<typeof import('./pickers.js').createPickers>} pickers
 * @property {ReturnType<typeof import('./quill-view.js').createQuill>} quill
 * @property {ReturnType<typeof import('./message-row.js').createMessageRows>} rows
 * @property {ReturnType<typeof import('./send-path.js').createSendPath>} sendPath
 * @property {ReturnType<typeof import('./sent-pictures.js').createSentPictures>} sent
 */

/** @param {ThreadFeedDeps} deps */
export function createThreadFeed(deps) {
    const feed = {
        /** where a message to the shown thread goes: its herdr address */
        address: /** @type {string | null} */ (null),
        error: /** @type {string | null} */ (null),
        file: /** @type {string | null} */ (null),
        /** the open thread's transcript has been read once */
        isRead: false,
        /** the pid the open thread was opened for; undefined before the first */
        opened: /** @type {number | null | undefined} */ (undefined),
        /** older history above what the reader handed on: the one door to its pages */
        pages: /** @type {ReturnType<typeof createPages> | null} */ (null),
        /** the pid of the thread shown, found from that terminal's Claude */
        pid: /** @type {number | null} */ (null),
        reader: /** @type {ReturnType<typeof createReader> | null} */ (null),
        /** the terminal of the focused tab, whose thread is shown */
        shownAddress: /** @type {string | null} */ (null),
        /** one more at each thread opened: a state watch of an earlier opening ends */
        stateTurn: 0,
        /** the pending wait for a change in the threads' state folder */
        stateWatch: /** @type {import('herdr').FolderWatch | null} */ (null),
        /** the pending wait for a change in the transcript's folder */
        watch: /** @type {import('herdr').FolderWatch | null} */ (null),
    };
    /** wakes the loop that opens the thread shown: a draw starts no work itself */
    let wake = () => {};

    /**
     * the session pid of the thread shown, from the Claude whose environment names its terminal; a switch made while
     * one is read wins
     * @param {string | null} address @param {Context} cx
     */
    function showThread(address, cx) {
        cx.spawn(async (cx) => {
            let pid = null;
            if (address)
                try {
                    const sessions = (
                        await readdir(`${home()}/.claude/sessions`)
                    )
                        .filter((name) => name.endsWith('.json'))
                        .map((name) => Number(name.slice(0, -5)));
                    const ps = await exec('ps', [
                        'eww',
                        '-o',
                        'pid=,etime=,command=',
                        '-p',
                        sessions.join(','),
                    ]);
                    pid = pidFor(address, ps.stdout, sessions);
                } catch {
                    // a read that failed says nothing: the thread shown stays, the next look tries again
                    return;
                }
            if (address !== feed.shownAddress || pid === feed.pid) return;
            feed.pid = pid;
            wake();
            cx.notify();
        });
    }

    /**
     * shows the thread whose Claude runs as `pid`: its transcript from the tail, then every line added to it
     * @param {number | null} pid
     * @param {Context} cx
     */
    async function open(pid, cx) {
        feed.watch?.cancel();
        feed.watch = null;
        feed.reader = null;
        feed.pages?.close();
        feed.pages = null;
        feed.file = null;
        feed.address = null;
        feed.stateWatch?.cancel();
        feed.stateWatch = null;
        feed.stateTurn += 1;
        feed.error = null;
        feed.isRead = false;
        // nothing the views hold of the old thread may act on the new one; read after the fields above, so a
        // draft shown is the one of no thread
        deps.clearShown();
        cx.notify();
        if (pid === null) return;
        try {
            const session = await readTextFile(
                `${home()}/.claude/sessions/${pid}.json`,
            );
            const file = transcriptPath(session && JSON.parse(session), home());
            if (pid !== feed.pid) return;
            if (!file) {
                feed.error = 'This thread has no session file yet';
                cx.notify();
                return;
            }
            feed.file = file;
            deps.quill.showDraft();
            cx.notify();
            const cwd = session && JSON.parse(session)?.cwd;
            if (typeof cwd === 'string')
                loadableSkills(SKILL_FS, { cwd, home: home() })
                    .then((found) => {
                        if (feed.file !== file) return;
                        deps.quill.setPluginSkills(found);
                    })
                    .catch(() => {});
            // only a send needs the address: a ps that fails leaves the thread readable
            const claude = await exec('ps', [
                'eww',
                '-o',
                'command=',
                '-p',
                String(pid),
            ]).catch(() => null);
            if (pid !== feed.pid) return;
            feed.address = addressIn(claude?.stdout ?? '');
            const turn = feed.stateTurn;
            cx.spawn((cx) => watchState(file, turn, cx));
            const reader = createReader(doorTo(file));
            feed.reader = reader;
            feed.pages = createPages(reader);
            const dir = file.slice(0, file.lastIndexOf('/'));
            const name = file.slice(dir.length + 1);
            // the wait is armed before each read, so a line written while one runs is never missed
            let watch = watchFolder(dir);
            feed.watch = watch;
            await pull(reader, cx);
            // a switch during the first read: the thread now shown is another opening's, never marked read from here
            if (feed.reader !== reader) return;
            feed.isRead = true;
            cx.notify();
            await restorePlace(reader, cx);
            while (feed.reader === reader) {
                const changed = await watch;
                if (feed.reader !== reader) return;
                watch = watchFolder(dir);
                feed.watch = watch;
                if (
                    !changed.some((path) => path === dir || path.endsWith(name))
                )
                    continue;
                // one failed read says so and keeps watching: the next change reads again
                try {
                    await pull(reader, cx);
                } catch (error) {
                    if (feed.reader !== reader) return;
                    feed.error = readError(error);
                    cx.notify();
                }
            }
        } catch (error) {
            if (pid !== feed.pid) return;
            feed.error = readError(error);
            cx.notify();
        }
    }

    /**
     * @param {ReturnType<typeof createReader>} reader
     * @param {Context} cx
     */
    async function pull(reader, cx) {
        const { lines, isRestart } = await reader.readNew();
        if (feed.reader !== reader) return;
        if (isRestart) {
            // a replaced transcript names its own model and effort, or none yet: never the removed one's
            deps.pickers.restart();
            deps.model.clear();
            deps.heights.clear();
            deps.rows.clearFiles();
            // nothing of the old rows may steer the new ones: a held place, a landing under way, the rows drawn
            deps.list.reset();
        }
        const hadError = feed.error !== null;
        feed.error = null;
        deps.pickers.takeLines(lines, cx);
        const { changed, removed } = deps.model.add(lines);
        deps.quill.learnSkills(lines);
        makePictures(cx);
        // his marked words showing as his message settle the mark in this same draw: they leave the quill as they land
        const added = new Set(changed);
        const arrived = deps.model.rows
            .filter((r) => added.has(r.id) && r.kind === 'mine' && !r.isWaiting)
            .map((r) => ({ at: r.at, text: r.text }));
        if (arrived.length && feed.file)
            deps.sendPath.showSettled(
                deps.sendPath.magic.arrived(feed.file, arrived),
                cx,
            );
        if (changed.length || removed || isRestart || hadError) cx.notify();
    }

    /**
     * the shown thread's state, read at each change of the state folder: its joins settle the quill's mark
     * @param {string} file the thread's transcript
     * @param {number} turn the opening this watch belongs to
     * @param {Context} cx
     */
    async function watchState(file, turn, cx) {
        const dir = `${home()}/${STATE_DIR}`;
        /** @param {string} path */
        const readJson = (path) =>
            readTextFile(path)
                .then((text) => JSON.parse(text ?? 'null'))
                .catch(() => null);
        const sid = sidOf(file);
        while (feed.stateTurn === turn) {
            // armed before the read, so a change during it is never missed
            const watch = watchFolder(dir);
            feed.stateWatch = watch;
            const [state, fleet] = await Promise.all([
                readJson(`${dir}/${sid}.json`),
                readJson(`${dir}/fleet.json`),
            ]);
            if (feed.stateTurn !== turn) return;
            deps.sendPath.takeJoins(state?.joins ?? null);
            const band = {
                fleet,
                thread: state
                    ? { hot: state.hot ?? null, sid, wind: state.wind ?? null }
                    : null,
            };
            // every thread's state shares the folder: only a change of this band's facts draws again
            if (deps.band.takeState(band)) {
                // a thread newly shown asks its 🍃 now, not at the next tick
                cx.spawn((cx) => deps.band.readAutoWind(cx));
                cx.notify();
            }
            deps.sendPath.settle(cx);
            await watch;
        }
    }

    /** his messages' pictures get their files; each row draws its own once made @param {Context} cx */
    function makePictures(cx) {
        const pictures = deps.rows
            .shown(deps.model.rows, deps.look())
            .flatMap((r) => (r.kind === 'file' ? r.pictures : []));
        if (!pictures.some((p) => !deps.sent.relOf(p))) return;
        cx.spawn(async (cx) => {
            if (await deps.sent.make(pictures)) cx.notify();
        });
    }

    /**
     * after a reload of the mod: the message he was reading comes back to the top, read in from above if it must be
     * @param {ReturnType<typeof createReader>} reader
     * @param {Context} cx
     */
    async function restorePlace(reader, cx) {
        const place = placeOf(
            feed.file && localStorage.getItem(placeKey(feed.file)),
        );
        // a place on the start row would read every page back to it: the thread opens at its newest instead
        if (!place || place.id === START_ROW.id) return;
        // a place on a file row is found through its reply, the row the transcript holds
        const lineId = replyIdOf(place.id);
        const pages = feed.pages;
        for (
            let page = 0;
            deps.model.indexOf(lineId) < 0 && page < PLACE_PAGES;
            page++
        ) {
            const read = pages?.next();
            if (!read) break;
            const lines = await read;
            if (feed.reader !== reader) return;
            deps.model.addEarlier(lines);
            deps.quill.learnSkills(lines);
        }
        makePictures(cx);
        // the saved line may sit inside a folded row: the place is that row
        const at = deps.model.indexOf(lineId);
        const row = deps.model.rows[at];
        if (!row) return;
        // a row he hides now (a tool call) hands the place to the next one shown
        const shown = deps.rows.shown(deps.model.rows, deps.look());
        const fileRow = shown.find((r) => r.id === place.id && r !== row);
        if (fileRow) {
            deps.list.land(fileRow.id, place.offset);
            cx.notify();
            return;
        }
        const next = shown.includes(row)
            ? row
            : deps.model.rows.slice(at + 1).find((r) => shown.includes(r));
        if (!next) return;
        deps.list.land(
            next.id,
            next === row && lineId === place.id ? place.offset : 0,
        );
        cx.notify();
    }

    /**
     * the next older page drawn above, the row he reads kept at its spot on screen; nothing while one is read or at
     * the thread's start, and a page for a thread he left is dropped
     * @param {Context} cx
     */
    function loadEarlier(cx) {
        const pages = feed.pages;
        const read = pages?.next();
        if (!read) return;
        cx.spawn(async (cx) => {
            const lines = await read.catch(() => null);
            if (feed.pages !== pages || !lines?.length) return;
            const { height, place } = deps.list.placeNow();
            const firstId = deps.model.rows[0]?.id ?? '';
            deps.model.addEarlier(lines);
            // the page's last reply may join the first row: it keeps its lines and takes the page's id
            const first = deps.model.rows[deps.model.indexOf(firstId)];
            deps.quill.learnSkills(lines);
            makePictures(cx);
            // the page's last reply joined the row he reads: that row took the page's id and grew above him
            const joined = place
                ? deps.model.rows[deps.model.indexOf(place.id)]
                : undefined;
            if (place && joined && joined.id !== place.id && height)
                deps.list.restore(joined.id, 0, height - place.offset);
            else if (place) deps.list.restore(place.id, place.offset);
            if (deps.findBar.find.state.isOpen)
                deps.findBar.find.recount(
                    deps.rows.shown(deps.model.rows, deps.look()),
                    first && first.id !== firstId
                        ? { from: firstId, to: first.id }
                        : null,
                );
            cx.notify();
        });
    }

    return {
        address: () => feed.address,
        error: () => feed.error,
        file: () => feed.file,
        /**
         * the thread of the focused tab, read each draw; a switch looks its Claude up after the draw
         * @param {string | null} address @param {Context} cx @returns {boolean} whether the tab switched
         */
        follow(address, cx) {
            if (address === feed.shownAddress) return false;
            feed.shownAddress = address;
            cx.timer.after(0, (later) => showThread(address, later));
            return true;
        },
        isRead: () => feed.isRead,
        isStart: () => feed.pages?.isStart() ?? false,
        loadEarlier,
        pid: () => feed.pid,
        reader: () => feed.reader,
        shownAddress: () => feed.shownAddress,
        /**
         * the thread is looked up again on a timer (a Claude whose session file came after its tab, or a /resume in
         * the same pane), and opened each time the pid shown changes
         * @param {Context} cx
         */
        start(cx) {
            cx.timer.every(SHOWN_LOOK_MS, (later) =>
                showThread(feed.shownAddress, later),
            );
            cx.spawn(async (cx) => {
                for (;;) {
                    const woken = new Promise((resolve) => {
                        wake = () => resolve(null);
                    });
                    // the thread to open is read after the wait is armed, so a switch during an open is never lost
                    const pid = feed.pid;
                    if (pid !== feed.opened) {
                        feed.opened = pid;
                        open(pid, cx);
                    }
                    await woken;
                }
            });
        },
    };
}
