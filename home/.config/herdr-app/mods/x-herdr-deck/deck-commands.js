// the deck's key commands: a keys.json action `x-herdr-deck.<command>` reaches the deck's `nextCommand()` from any focus,
// so ⌘⇧K ticks here with no relay through another mod

/**
 * every key command for the copy's life, each to its one handler
 * @param {() => Promise<string>} next herdr's `nextCommand`
 * @param {Record<string, () => void>} handlers
 */
export async function takeCommands(next, handlers) {
    for (;;) {
        const command = await next();
        handlers[command]?.();
    }
}
