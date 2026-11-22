// the send path: a click or Enter marks the quill's words to join the thread's turn (the magic send), a hold or
// cmd+Enter pushes them now; the hold's fill, the marks against the thread's state, a send that did not go coming
// back. the rules live in magic.js, joins.js and send.js

import { exec, hc, home, readTextFile, writeTextFile } from 'herdr';

import { withPaths } from './attach.js';
import {
    HOLD_DELAY_MS,
    HOLD_PUSH_MS,
    JOINED_SHOWN_MS,
    JOINS_DIR,
    JOIN_TAKE_MS,
    holdSend,
} from './joins.js';
import { createMagic, retextWait } from './magic.js';
import { clearKeys, isVimNormal, pulledBack, sendArgs } from './queued.js';
import { sendBlocked } from './send.js';
import { sidOf } from './thread.js';

/** @typedef {import('./chat-types.js').Context} Context */

const NOT_IN_HERDR = 'This thread does not run in herdr: nothing was sent';

/** the join file's doors in herdr: a mkdir lock dir, its age from macOS stat, a write over the text it read */
/** @type {import('./joins.js').JoinIo} */
const joinIo = {
    lock: async (path) =>
        (await exec('mkdir', [path]).catch(() => null))?.code === 0,
    lockAge: async (path) => {
        const out = await exec('stat', ['-f', '%m', path]).catch(() => null);
        const at = Number(out?.stdout.trim());
        return out?.code === 0 && at ? Date.now() - at * 1000 : null;
    },
    now: () => Date.now(),
    read: (path) => readTextFile(path),
    sleep: async (ms) => {
        await exec('sleep', [String(ms / 1000)]);
    },
    unlock: async (path) => {
        await exec('rmdir', [path]);
    },
    write: (path, body, expected) => writeTextFile(path, body, expected),
};

const newId = () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) =>
        (c === 'x'
            ? Math.floor(Math.random() * 16)
            : Math.floor(Math.random() * 4) + 8
        ).toString(16),
    );

/** herdr's window answers only inside a call it made; a timer tick may get a throw, read as «still active» */
function isWindowActive() {
    try {
        return window.is_window_active() !== false;
    } catch {
        return true;
    }
}

/**
 * @param {{
 *   shownFile: () => string | null,
 *   shownAddress: () => string | null,
 *   quillBox: () => import('gpui-base').TextareaState | null,
 *   quills: ReturnType<typeof import('./quill.js').createQuills>,
 *   attachments: ReturnType<typeof import('./attachments.js').createAttachments>,
 *   pushed: (text: string, at: number) => void,
 *   say: (note: string | null, cx: Context) => void,
 *   typingInto: Set<string>,
 *   popped: () => string[],
 *   resetPopped: () => void,
 *   editorMode: () => unknown,
 * }} deps the shown thread's transcript and terminal, the quill's box, every thread's quill and its waiting files,
 *   the row model told of a slash command it will see queued, the note under the quill, and the threads a send or a
 *   pick types into now (one owner: the chat), and whether the shown thread is in a turn
 */
export function createSendPath({
    shownFile,
    shownAddress,
    quillBox,
    quills,
    attachments,
    pushed,
    say,
    typingInto,
    popped,
    resetPopped,
    editorMode,
}) {
    /** the marks of the magic send: words waiting in the quill to join a turn */
    const magic = createMagic({
        dir: `${home()}/${JOINS_DIR}`,
        io: joinIo,
        newId,
        quills,
    });
    /** what the shown thread's state lists of its joins; null: joins are off for it @type {import('./magic.js').Joins | null} */
    let joins = null;
    /** a press on send under way @type {import('./joins.js').Hold | null} */
    let hold = null;
    let holdFill = 0;
    /** @type {{ cancel: () => void } | null} */
    let holdTask = null;
    /** how long a hold takes to push: his two settings rows */
    let timing = { delay: HOLD_DELAY_MS, push: HOLD_PUSH_MS };
    let lastKeyAt = 0;

    /** the mark of the shown thread against its state: taken by a turn, or by none in a minute @param {Context} cx */
    function settle(cx) {
        const file = shownFile();
        if (!file) return;
        showSettled(magic.settle(file, joins), cx);
    }

    /**
     * a settled mark on screen: the quill already keeps only what he typed after the taken words; the taken mark
     * shows for a moment
     * @param {import('./magic.js').Settled | null} settled
     * @param {Context} cx
     */
    function showSettled(settled, cx) {
        const file = shownFile();
        if (!settled || !file) return;
        say(settled.note, cx);
        // the files its row carried went with the words
        for (const path of settled.files ?? []) attachments.remove(file, path);
        // the taken mark shows for a moment, then the button rests
        if (!settled.note)
            cx.timer.after(JOINED_SHOWN_MS, (later) => {
                magic.forget(file, settled.id);
                later.notify();
            });
        cx.notify();
    }

    /**
     * a click on send, or Enter: the quill's words are marked to join the thread's turn, or the mark is taken off; a
     * thread that takes no joins, or a slash command, gets them as a plain send
     * @param {import('gpui-base').TextareaState} box
     * @param {Context} cx
     */
    function click(box, cx) {
        const file = shownFile();
        const text = box.value().trim();
        if (!file) return;
        const files = waitingPaths(file);
        if (!text && !files.length) return;
        if (!shownAddress()) return say(NOT_IN_HERDR, cx);
        const answer = magic.click(file, sidOf(file), text, joins, files);
        cx.notify();
        cx.spawn(async (cx) => {
            const { act, note } = await answer;
            if (shownFile() !== file) return;
            if (act === 'push') return send(text, note, cx);
            // a mark no turn takes in a minute comes off by itself
            if (act === 'marked')
                cx.timer.after(JOIN_TAKE_MS + 500, (later) => settle(later));
            say(note, cx);
        });
    }

    /**
     * a hold on send, or cmd+Enter: the quill's words go now and a turn starts; words marked to join leave the join
     * file first, so they never go twice
     * @param {import('gpui-base').TextareaState} box
     * @param {Context} cx
     * @param {string | null} [note] why it went as a push
     */
    function push(box, cx, note = null) {
        const file = shownFile();
        const text = box.value().trim();
        if (!file || (!text && !attachments.of(file).length)) return;
        if (!shownAddress()) return say(NOT_IN_HERDR, cx);
        cx.spawn(async (cx) => {
            // checked right before the mark comes off, so a refused push keeps his words marked
            const address = shownAddress();
            const blocked = address && sendBlocked(address, typingInto);
            if (blocked) return say(blocked, cx);
            const why = await magic.release(file, joins);
            if (shownFile() !== file) return;
            if (why) return say(why, cx);
            // the words go as the quill holds them once the row is out: an edit he made meanwhile is what he sends,
            // and the quill empties, never keeping words that already went
            send(box.value().trim() || text, note, cx);
        });
    }

    /**
     * the words leave the quill for the thread shown, as its Claude's next prompt, or wait in its queue while it
     * works. a message that did not go comes back to the quill
     * @param {string} text
     * @param {string | null} note why it went this way
     * @param {Context} cx
     */
    function send(text, note, cx) {
        const address = shownAddress();
        const file = shownFile();
        if (!address) return;
        const blocked = sendBlocked(address, typingInto);
        if (blocked) return say(blocked, cx);
        // what he typed while a mark was taken back stays: only the words sent leave
        quills.apply(file, { said: text, type: 'sent' });
        // the files waiting go after the words, each path on its line as a terminal drop types it (FRM-613)
        const files = file ? attachments.take(file) : [];
        const message = withPaths(text, files);
        // Claude Code queues a slash command with no text: the model takes its words from here to draw it waiting
        if (message.startsWith('/')) pushed(message, Date.now());
        say(note, cx);
        cx.spawn(async (cx) => {
            const sent = await hc(sendArgs(address, message)).catch(
                (/** @type {unknown} */ error) => ({
                    code: 1,
                    stderr: String(error),
                }),
            );
            if (sent.code === 0) return;
            // his words come back before what he typed since, and his files with them, never lost, on screen or not
            quills.apply(file, { said: text, type: 'returned' });
            if (file && files.length) attachments.add(file, files);
            if (shownFile() !== file) return;
            say(`Not sent: ${sent.stderr.trim() || 'herdr refused it'}`, cx);
        });
    }

    /**
     * the × on a waiting message (FRM-563 b+c, the old chatter's pull, 507b178f): ↑ in Claude Code's empty prompt
     * pulls every queued message of his into its input; the chat empties that input, puts the crossed one back in his
     * quill and sends the others again in their order. offered only while its screen says ↑ edits the queue
     * @param {string} queued the crossed message as Claude Code queued it @param {Context} cx
     */
    function unsend(queued, cx) {
        const address = shownAddress();
        const file = shownFile();
        if (!address || !file || typingInto.has(address)) return;
        typingInto.add(address);
        say('Taking it back…', cx);
        cx.spawn(async (cx) => {
            try {
                const screen = (await hc(['read', address, '--lines', '40']))
                    .stdout;
                if (!/up to edit queued messages/i.test(screen))
                    return say('It joined the turn first', cx);
                resetPopped();
                await hc(['keys', address, 'up']);
                // ↑ pulls every message of his: the records are in once they stop coming, 2.5 s at most
                let seen = 0;
                for (let i = 0, still = 0; i < 25 && still < 3; i++) {
                    await cx.sleep(100);
                    const n = popped().length;
                    still = n && n === seen ? still + 1 : 0;
                    seen = n;
                }
                const pulled = [...popped()];
                if (!pulled.length) return say('It joined the turn first', cx);
                const isNormal = isVimNormal(
                    (await hc(['read', address])).stdout,
                    editorMode(),
                );
                await hc(['keys', address, ...clearKeys(pulled, isNormal)]);
                const { rest, words } = pulledBack(pulled, queued);
                if (words)
                    quills.apply(file, { said: words, type: 'returned' });
                for (const text of rest) await hc(sendArgs(address, text));
                say(words ? null : 'It joined the turn first', cx);
            } catch (error) {
                say(`Not taken back: ${String(error)}`, cx);
            } finally {
                typingInto.delete(address);
                cx.notify();
            }
        });
    }

    /** @param {string} file @returns {string[]} */
    function waitingPaths(file) {
        return attachments.of(file).map((w) => w.path);
    }

    /**
     * a file came or went under a mark: its join row carries the files waiting now, or the mark comes off when nothing
     * is left to send
     * @param {string} file @param {Context} cx
     */
    function filesUnderMark(file, cx) {
        const mark = magic.markOf(file);
        if (mark?.state !== 'pending') return;
        cx.spawn(async (cx) => {
            const isChanged = await magic.typed(
                file,
                quillBox()?.value().trim() ?? mark.said,
                joins,
                waitingPaths(file),
            );
            if (isChanged) cx.notify();
        });
    }

    /**
     * he typed under a mark: once his keys rest, the join row carries the quill's words; an emptied quill unmarks
     * @param {import('gpui-base').TextareaState} box
     * @param {Context} cx
     */
    function typedUnderMark(box, cx) {
        const file = shownFile();
        if (magic.markOf(file)?.state !== 'pending' || !file) return;
        const at = Date.now();
        lastKeyAt = at;
        const text = box.value().trim();
        if (!retextWait(text)) {
            // the mark drops before the take-back's write, so 🍕 goes in this draw
            cx.spawn(async (cx) => {
                const isChanged = await magic.typed(
                    file,
                    '',
                    joins,
                    waitingPaths(file),
                );
                if (isChanged) cx.notify();
            });
            cx.notify();
            return;
        }
        cx.timer.after(retextWait(text), (later) => {
            if (lastKeyAt !== at || shownFile() !== file) return;
            later.spawn(async (cx) => {
                const isChanged = await magic.typed(
                    file,
                    box.value().trim(),
                    joins,
                    waitingPaths(file),
                );
                if (isChanged) cx.notify();
            });
        });
    }

    /**
     * a press on send starts the hold: a release before its delay is a click, a hold to its end pushes
     * @param {import('gpui-base').TextareaState} box
     * @param {Context} cx
     * @param {import('./joins.js').Hold['by']} [by]
     */
    function press(box, cx, by = 'pointer') {
        // an empty quill has nothing to send: no hold, no disc
        const file = shownFile();
        if (!file || (!box.value().trim() && !waitingPaths(file).length))
            return;
        cancelHold();
        hold = holdSend(null, 'press', Date.now(), timing, by).hold;
        holdTask = cx.timer.every(33, (later) => holdStep(box, 'tick', later));
    }

    /**
     * @param {import('gpui-base').TextareaState} box
     * @param {'tick' | 'release' | 'cancel'} event
     * @param {Context} cx
     */
    function holdStep(box, event, cx) {
        if (!hold) return;
        // a window that lost focus cuts the hold, as a pointer that left the button does
        const step = holdSend(
            hold,
            event === 'tick' && !isWindowActive() ? 'cancel' : event,
            Date.now(),
            timing,
        );
        hold = step.hold;
        holdFill = step.hold ? step.fill : 0;
        if (!step.hold) cancelHold();
        if (step.act === 'push') push(box, cx);
        else if (step.act === 'join') click(box, cx);
        cx.notify();
    }

    function cancelHold() {
        holdTask?.cancel();
        holdTask = null;
        hold = null;
        holdFill = 0;
    }

    return {
        /** his settings rows the hold reads @param {Record<string, unknown>} values */
        applySettings(values) {
            timing = {
                delay: Number(values['chatter.send.holdDelay']),
                push: Number(values['chatter.send.holdPush']),
            };
        },
        cancelHold,
        click,
        filesUnderMark,
        hold: () => hold,
        holdFill: () => holdFill,
        holdStep,
        magic,
        press,
        push,
        settle,
        showSettled,
        /** the shown thread's joins, as its state lists them; null: joins are off for it @param {import('./magic.js').Joins | null} next */
        takeJoins(next) {
            joins = next;
        },
        typedUnderMark,
        unsend,
        waitingPaths,
    };
}
