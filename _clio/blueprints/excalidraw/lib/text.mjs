// Text measured with Chrome's real Helvetica (Excalidraw fontFamily 2), so a wrap here is the wrap in the app.
export const HELVETICA = 2;
export const LINE = 1.15;

export const makeText = (page) => {
    const measure = (text, size) =>
        page.evaluate(
            ([t, font]) => {
                const c = document.createElement('canvas').getContext('2d');
                c.font = font;
                return c.measureText(t).width;
            },
            [text, `${size}px Helvetica`],
        );

    const wrap = (text, size, usable) =>
        page.evaluate(
            ([t, font, width]) => {
                const c = document.createElement('canvas').getContext('2d');
                c.font = font;
                const lines = [];
                let line = '';
                for (const word of t.split(' ')) {
                    const next = line ? `${line} ${word}` : word;
                    if (line && c.measureText(next).width > width) {
                        lines.push(line);
                        line = word;
                    } else line = next;
                }
                return [...lines, line];
            },
            [text, `${size}px Helvetica`, usable],
        );

    return { measure, wrap };
};
