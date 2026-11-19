// the types every view module of the chat shares; no module imports main.js, so they live here

/** @typedef {import('gpui-kit').Color} Color */
/** @typedef {import('gpui-kit').Context} Context */
// the theme colours the chat reads, each present in every herdr theme
/** @typedef {Record<'accent' | 'accent_foreground' | 'background' | 'blocked' | 'border' | 'dim' | 'foreground' | 'hover' | 'muted' | 'popover' | 'raised' | 'selected' | 'solid' | 'solid_foreground' | 'working', Color>} Theme */

export {};
