import { useEffect, useRef } from 'react';
import { effect, frame, init, surface } from 'vgpu';

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
// stay transparent; and the uv handed to the fragment runs the other way up (see the shader).
const SHADER = /* wgsl */ `
struct Uniforms { time: f32, seed: f32, width: f32, height: f32, px: f32, py: f32, hover: f32, dark: f32 };
@group(0) @binding(0) var<uniform> u: Uniforms;

fn hash(p: vec2f) -> f32 {
  return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453);
}
fn noise(p: vec2f) -> f32 {
  let i = floor(p); let f = fract(p);
  let a = hash(i); let b = hash(i + vec2f(1, 0));
  let c = hash(i + vec2f(0, 1)); let d = hash(i + vec2f(1, 1));
  let s = f * f * (3 - 2 * f);
  return mix(mix(a, b, s.x), mix(c, d, s.x), s.y);
}
fn fbm(p: vec2f) -> f32 {
  var v = 0.0; var a = 0.5; var q = p;
  for (var k = 0; k < 4; k++) { v += a * noise(q); q = q * 2.1 + 7.0; a *= 0.5; }
  return v;
}

// Pearl: a base tone shifted per channel around a phase, the way a foil's colour walks with
// the angle. The offsets are the rail's order, blue leading, red trailing.
fn pearl(phase: f32) -> vec3f {
  return 0.74 + 0.26 * cos(6.2831853 * (phase + vec3f(0.00, 0.33, 0.67)));
}

// Etched contours: nested waves whose spacing warps with a second sine, then traced as thin
// lines — the engraving under the foil.
fn etched(p: vec2f) -> f32 {
  let warp = sin(p.y * 7.0 + sin(p.x * 4.0)) * 0.085;
  let rings = sin((p.x + warp) * 22.0 + sin(p.y * 9.0) * 0.6);
  return smoothstep(0.85, 1.0, rings);
}

@fragment fn fs(@location(0) raw: vec2f) -> @location(0) vec4f {
  // vgpu injects the fullscreen vertex stage and hands down a TOP-origin uv, where v
  // grows downward. This shader was written against a bottom-origin one, so the flip
  // happens once here and the body below is untouched — their porting note says the
  // same, and it is the difference between this strip and an upside-down one.
  let uv = vec2f(raw.x, 1.0 - raw.y);
  let aspect = u.width / max(u.height, 1.0);
  let p = vec2f(uv.x * aspect, uv.y);
  let light = vec2f(u.px * aspect, u.py);
  let toLight = light - p;
  let dist = length(toLight);
  let t = u.time * 0.08;

  // Grain and slow drift keep the foil from reading as a flat gradient.
  let grain = fbm(p * 3.0 + u.seed * 3.7 + vec2f(t, -t * 0.4));
  let flow = fbm(p * 1.4 + vec2f(-t * 0.5, t * 0.2) + u.seed);

  // Diffraction: hue walks with the angle between the light and the groove direction, so it
  // fans out around the pointer instead of banding left to right.
  let groove = normalize(vec2f(1.0, 0.35 + 0.25 * sin(p.y * 6.0 + flow)));
  // The strip is ~45 times wider than tall, so toLight is almost horizontal and its direction
  // flips across the light's column — a hard seam. Fading the angle out near the light, where
  // the pool whitens anyway, keeps the hue continuous.
  let angle = dot(normalize(toLight + vec2f(0.0001, 0.0)), groove) * smoothstep(0.0, 1.5, dist);
  let phase = angle * 0.6 + p.x * 0.22 + flow * 0.35 + u.seed * 0.21;
  var color = pearl(phase);

  // The specular pool follows the pointer; when nothing hovers it rests off-centre and low.
  let pool = exp(-dist * dist * (3.5 - 2.0 * u.hover)) * (0.45 + 0.55 * u.hover);
  let lines = etched(p + flow * 0.15);
  color = mix(color, vec3f(1.0), pool * 0.55 + lines * pool * 0.35);

  let lum = 0.45 + 0.55 * (0.5 + 0.5 * flow) * (0.9 + 0.1 * grain);
  let strength = lum * (0.55 + 0.35 * u.hover) + pool * 0.3;
  // Fade at the top edge so the strip melts into the desk rather than cutting across it.
  let edge = smoothstep(0.0, 0.45, uv.y);
  // On the dark deck a pastel at half alpha mixes to mud. Dark keeps the hue deeper and the
  // band thinner, so it reads as a faint sheen rather than a grey rainbow.
  let deep = mix(color, 0.58 + 0.42 * (color - 0.74) / 0.26, u.dark);
  let a = clamp(strength, 0.0, 1.0) * edge * mix(1.0, 0.7, u.dark);
  return vec4f(deep * a, a);
}
`;

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

            // clearColor is the one that bites: a pass clears with it by default, and vgpu's
            // default is opaque black. This strip is transparent everywhere the bands are not.
            const view = surface(gpu, element, {
                alphaMode: 'premultiplied',
                clearColor: [0, 0, 0, 0],
                dpr: [1, 2],
            });
            const band = effect(gpu, SHADER, {
                blend: 'premultiplied',
                label: 'aurora',
            });

            // Bindings go by their WGSL name, so the struct above is the only place the
            // uniform layout is written down — no Float32Array packed in field order.
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
