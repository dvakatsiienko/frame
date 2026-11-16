// where a thread's transcript lives, from what Claude Code writes about a running session

/**
 * @param {unknown} session the parsed `~/.claude/sessions/<pid>.json` of the thread's Claude
 * @param {string} home his home folder
 * @returns {string | null} the transcript's path, null when the session names no conversation
 */
export function transcriptPath(session, home) {
    if (typeof session !== 'object' || session === null) return null;
    const { cwd, sessionId } = /** @type {Record<string, unknown>} */ (session);
    if (typeof cwd !== 'string' || typeof sessionId !== 'string') return null;
    if (!cwd || !sessionId) return null;
    return `${home}/.claude/projects/${cwd.replace(/[^A-Za-z0-9]/g, '-')}/${sessionId}.jsonl`;
}
