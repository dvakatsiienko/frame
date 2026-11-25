export const day = '2026-10-26';

export const steer = (id: string, text: string) =>
    JSON.stringify({
        attachment: { content: [`- ${id} · his steer: «${text}»`] },
        timestamp: '2026-10-26T09:15:00Z',
        type: 'attachment',
    });
