import { useEffect, useRef } from 'react';
import { effect, frame, init, surface } from 'vgpu';

import auroraShader from './aurora.wgsl';

// The strip above the deck: the rail's eight colours as slow aurora bands, drawn on the GPU.
// Built on vgpu, which owns the parts that were boilerplate here — the adapter and device, the
// fullscreen vertex stage, the pipeline and its blend state, the uniform buffer and bind group,
// and keeping the canvas sized to its box. What is left is the fragment shader and when to run
// it. It is still by default: one frame at mount, and it only moves for a bounded moment after
// the layer turns, a drag starts, or a rebind lands. A browser without WebGPU gets the plain
// deck, exactly as before.
//
// 📌 Two vgpu defaults differ from what this strip needs and are set explicitly below: a pass
// clears with `target.clearColor`, which is OPAQUE BLACK by default, and this canvas has to
// stay transparent; and the uv handed to the fragment runs the other way up (see `fs` in aurora.wgsl).
//
// The shader lives in `aurora.wgsl`: since vgpu 0.6 `effect()` takes only a prepared
// ShaderSource, which `wgslVitePlugin` builds from the import at bundle time.

export const Aurora = (props: AuroraProps) => {
    const canvas = useRef<HTMLCanvasElement | null>(null);
    const drawRef = useRef<((time: number) => void) | null>(null);

    useEffect(() => {
        const element = canvas.current;

        if (!(element && navigator.gpu)) return;

        let disposed = false;
        let dispose: (() => void) | null = null;

        (async () => {
            const gpu = await init({ label: 'aurora' });

            if (disposed) {
                gpu.dispose();
                return;
            }

            // since vgpu 0.6 a frame() after device loss throws at once; the strip goes still
            // instead of throwing on every pointer move
            void gpu.lost.then(() => {
                drawRef.current = null;
            });

            // clearColor is the one that bites: a pass clears with it by default, and vgpu's
            // default is opaque black. This strip is transparent everywhere the bands are not.
            const view = surface(gpu, element, {
                alphaMode: 'premultiplied',
                clearColor: [0, 0, 0, 0],
                dpr: [1, 2],
            });
            const band = effect(gpu, auroraShader, {
                blend: 'premultiplied',
                label: 'aurora',
            });

            // Bindings go by their WGSL name, so the `Uniforms` struct in aurora.wgsl is the only
            // place the uniform layout is written down — no Float32Array packed in field order.
            drawRef.current = (time) => {
                if (disposed) return;

                band.set({
                    u: {
                        // Computed, so the media query and a forced data-theme both count.
                        dark:
                            getComputedStyle(element).colorScheme === 'dark'
                                ? 1
                                : 0,
                        height: view.size[1],
                        hover: pointer.current.hover,
                        px: pointer.current.x,
                        py: pointer.current.y,
                        seed: props.seed,
                        time,
                        width: view.size[0],
                    },
                });
                frame(gpu, (pass) => pass.pass(view, band));
            };

            // The surface watches its own box, so this replaces the window resize listener. It
            // fires once on subscribe — the first draw — and then from inside vgpu's own frame,
            // where a second frame() throws «Nested frame», so the redraw waits for the next one.
            let queued = 0;
            const redraw = () => {
                cancelAnimationFrame(queued);
                queued = requestAnimationFrame(() =>
                    drawRef.current?.(lastTime.current),
                );
            };
            const stopResize = view.onResize(redraw);
            const scheme = matchMedia('(prefers-color-scheme: dark)');

            scheme.addEventListener('change', redraw);

            dispose = () => {
                cancelAnimationFrame(queued);
                scheme.removeEventListener('change', redraw);
                stopResize();
                view.dispose();
                gpu.dispose();
            };
        })();

        return () => {
            disposed = true;
            drawRef.current = null;
            dispose?.();
        };
    }, [props.seed]);

    // The light: where the pointer is over the strip, in uv, and whether it is there at all.
    // A move redraws one frame; leaving eases the light back to rest over a few frames.
    const pointer = useRef({ hover: 0, x: 0.72, y: 0.35 });
    const settle = useRef(0);

    const onPointerMove = (event: { clientX: number; clientY: number }) => {
        const element = canvas.current;

        if (!element) return;

        const box = element.getBoundingClientRect();

        pointer.current = {
            hover: 1,
            x: (event.clientX - box.left) / box.width,
            y: 1 - (event.clientY - box.top) / box.height,
        };
        cancelAnimationFrame(settle.current);
        drawRef.current?.(lastTime.current);
    };

    const onPointerLeave = () => {
        const rest = { x: 0.72, y: 0.35 };
        const step = () => {
            const at = pointer.current;
            const next = {
                hover: at.hover * 0.82,
                x: at.x + (rest.x - at.x) * 0.12,
                y: at.y + (rest.y - at.y) * 0.12,
            };

            pointer.current = next;
            drawRef.current?.(lastTime.current);
            if (next.hover > 0.02) settle.current = requestAnimationFrame(step);
        };

        settle.current = requestAnimationFrame(step);
    };

    // A bounded run: `props.wake` changes → ~900ms of frames, then still again. Nothing loops
    // while the page is idle.
    const lastTime = useRef(0);

    useEffect(() => {
        if (!props.wake) return;
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        const started = performance.now();
        const base = lastTime.current;
        let frame = 0;

        const tick = (now: number) => {
            const elapsed = (now - started) / 1000;

            lastTime.current = base + elapsed;
            drawRef.current?.(lastTime.current);
            if (elapsed < 0.9) frame = requestAnimationFrame(tick);
        };

        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [props.wake]);

    return (
        <canvas
            aria-hidden
            className='block h-[26px] w-full'
            onPointerLeave={onPointerLeave}
            onPointerMove={onPointerMove}
            ref={canvas}
        />
    );
};

/* Types */
interface AuroraProps {
    // Which layer is showing; each layer gets its own field.
    seed: number;
    // A value that changes whenever the strip should move for a moment.
    wake: string;
}
