// the one look of keyboard focus across our herdr mods (FRM-620 slice 5c): a text box holding the keyboard draws its
// border in the theme's accent, else its own; a focus change repaints nothing by itself, so the owner reads its box's
// focus and blur events and repaints

/**
 * @param {boolean} isFocused @param {{ accent: `#${string}` }} t @param {`#${string}`} rest the border when unfocused
 * @returns {`#${string}`}
 */
export const focusBorder = (isFocused, t, rest) =>
    isFocused ? t.accent : rest;
