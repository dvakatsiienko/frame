// a theme colour made see-through: the one colour helper every view of the chat shares

/** @typedef {import('./chat-types.js').Color} Color */

/** @param {Color} color a 6-digit hex theme colour @param {string} alpha two hex digits @returns {Color} */
export const tint = (color, alpha) => `#${color.slice(1, 7)}${alpha}`;
