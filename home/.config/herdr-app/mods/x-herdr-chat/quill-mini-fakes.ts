// the quill-mini tests' fake herdr: an element that records what was built on it, and the state the mocks share

type Handler = (...args: never[]) => unknown;
export type El = {
    handlers: Map<string, Handler>;
    id: string | null;
    kids: unknown[];
    tooltip: string | null;
    top?: number;
    opacity?: number;
    moved?: string[];
};
export const at = {
    box: {
        focused: 0,
        on: new Map<string, (event: unknown, cx: unknown) => void>(),
        range: { end: 0, start: 0 },
        text: '',
    },
    handles: [] as { focus: () => unknown }[],
    held: null as unknown,
    keys: [] as { action: string; context: string; keystroke: string }[],
    timers: [] as { ms: number; run: () => void }[],
    zoom: 1,
};

export function make(id?: unknown): unknown {
    const el: El = {
        handlers: new Map(),
        // a Button is made with its id
        id: id === undefined ? null : String(id),
        kids: [],
        tooltip: null,
    };
    const self: unknown = new Proxy(el, {
        get(target, name) {
            if (name === 'raw') return target;
            return (...args: unknown[]) => {
                if (name === 'id') target.id = String(args[0]);
                else if (name === 'top') target.top = Number(args[0]);
                else if (name === 'opacity') target.opacity = Number(args[0]);
                else if (name === 'transition')
                    target.moved = [...(target.moved ?? []), String(args[0])];
                else if (name === 'tooltip') target.tooltip = String(args[0]);
                else if (name === 'child') target.kids.push(args[0]);
                else if (name === 'children')
                    target.kids.push(...(args[0] as unknown[]));
                else if (name === 'when') {
                    if (args[0]) (args[1] as (el: unknown) => void)(self);
                } else if (String(name).startsWith('on_'))
                    target.handlers.set(
                        name === 'on_action'
                            ? String(args[0])
                            : name === 'on_mouse_down' || name === 'on_mouse_up'
                              ? `${String(name)}_${args[0]}`
                              : String(name),
                        args.at(-1) as Handler,
                    );
                return self;
            };
        },
    });
    return self;
}
