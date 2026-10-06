import type { On } from 'claude-code';

// x-mod-guard's $.store as a Map the test reads back: mock.store copies its entries and hands none back
export function liveStore(on: On) {
    const store = new Map<string, unknown>();
    on('store.get', (_$, e) => ({ value: store.get(e.key) }));
    on('store.set', (_$, e) => {
        store.set(e.key, e.value);
        return { value: undefined };
    });
    on('store.keys', () => ({ value: [...store.keys()] }));
    on('store.delete', (_$, e) => {
        store.delete(e.key);
        return { value: undefined };
    });
    return store;
}
