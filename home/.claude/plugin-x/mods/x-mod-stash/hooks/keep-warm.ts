// 🔥 keep warm: `hot:<sid>`, this session's ping clock, `{ since }` on, `{ off: true }` dima's off
export const HOT = 'hot:';

// off is a written value, so a seat's default arms only a key never written
export const hotOf = (key: unknown) =>
    key && (key as { off?: boolean }).off !== true
        ? (key as { since: number })
        : undefined;
