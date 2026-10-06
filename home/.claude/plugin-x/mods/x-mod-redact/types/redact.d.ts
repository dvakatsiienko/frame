// placeholder → secret, for one session
export type RedactVault = Record<string, string>;

declare module 'claude-code' {
    interface PluginState {
        'x-mod-redact': { vault: RedactVault };
        // the mod's name before the x-mod rename: its vault is read once at start, so a session's placeholders still restore
        redact: { vault: RedactVault };
    }
}
