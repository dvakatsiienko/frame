// a tab names its seat by the session name, with the member word after the badges dropped: the badge already says
// who, and at a tab's width «⚡ 🔧 codie…» three times told nothing apart; the whole name stays on hover

/**
 * @param {string} name
 * @returns {string}
 */
export function tabLabel(name) {
    const parts = /^([^\p{L}\p{N}]*[^\s\p{L}\p{N}]\s*)[^:]+:\s*(.+)$/u.exec(
        name,
    );
    return parts ? `${parts[1]}${parts[2]}` : name;
}
