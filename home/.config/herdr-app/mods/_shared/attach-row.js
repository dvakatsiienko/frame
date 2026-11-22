// the files waiting to be sent, drawn one way wherever he attaches: the chat's quill and the deck's steer boxes (dima,
// 2026-11-22 19:11: «draw an ask image preview in the same way as image previews are drawn everywhere else»). a
// picture is a 56 px preview with its × in the corner, any other file a «📎 name» chip with its × (FRM-609)

import { h_flex } from 'gpui-base';
import { div, image } from 'gpui-kit';

const THUMB_SIZE = 56;

/**
 * @typedef {object} AttachItem
 * @property {string} path the file sent
 * @property {string | null} preview a picture's copy under the app dir; null for any other file, or while it is made
 * @property {boolean} isPicture
 */

/**
 * @param {Record<'background' | 'border' | 'foreground' | 'muted' | 'raised', import('gpui-kit').Color>} t
 * @param {{ id: string, files: AttachItem[], isLocked?: boolean,
 *   onRemove: (path: string, cx: import('gpui-kit').Context) => void,
 *   onOpen?: (path: string, cx: import('gpui-kit').Context) => void }} it
 */
export function attachRow(
    t,
    { files, id, isLocked = false, onOpen, onRemove },
) {
    /** @param {string} xid @param {string} path */
    const remove = (xid, path) =>
        div()
            .id(xid)
            .absolute()
            .top(3)
            .right(3)
            .size(18)
            .flex()
            .items_center()
            .justify_center()
            .rounded_full()
            .bg(t.background)
            .text_size(11)
            .text_color(t.foreground)
            .cursor_pointer()
            .tooltip('Remove')
            .on_click((_e, cx) => {
                cx.stop_propagation();
                onRemove(path, cx);
            })
            .child('×');
    return h_flex()
        .id(id)
        .gap(8)
        .flex_wrap()
        .items_center()
        .when(isLocked, (el) => el.opacity(0.6))
        .children(
            files.map(({ isPicture, path, preview }, i) =>
                isPicture
                    ? div()
                          .id(`${id}-thumb-${i}`)
                          .size(THUMB_SIZE)
                          .flex_none()
                          .relative()
                          .rounded(8)
                          .overflow_hidden()
                          .bg(t.raised)
                          .border(1)
                          .border_color(t.border)
                          .tooltip(onOpen ? 'Open' : path)
                          .when(Boolean(onOpen), (el) =>
                              el
                                  .cursor_pointer()
                                  .on_click((_e, cx) => onOpen?.(path, cx)),
                          )
                          .when(Boolean(preview), (el) =>
                              el.child(image(preview ?? '').size_full()),
                          )
                          .when(!isLocked, (el) =>
                              el.child(remove(`${id}-thumb-x-${i}`, path)),
                          )
                    : h_flex()
                          .id(`${id}-file-${i}`)
                          .relative()
                          .gap(6)
                          .items_center()
                          .pl(8)
                          .pr(isLocked ? 8 : 26)
                          .py(4)
                          .rounded(8)
                          .border(1)
                          .border_color(t.border)
                          .text_size(12)
                          .text_color(t.muted)
                          .tooltip(path)
                          .child(
                              `📎 ${path.split('/').filter(Boolean).pop() ?? path}`,
                          )
                          .when(!isLocked, (el) =>
                              el.child(remove(`${id}-file-x-${i}`, path)),
                          ),
            ),
        );
}
