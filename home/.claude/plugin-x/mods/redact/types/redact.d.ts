// placeholder → secret, for one session
export type RedactVault = Record<string, string>;

declare module 'claude-code' {
    interface PluginState {
        redact: { vault: RedactVault };
    }
}
