// a second-wind store file whose notice text is past the 4,000-char cap, as a hand edit could leave it
export const overCap = {
    rows: {
        'stash.wind.text.notice': {
            default: '',
            text: `second-wind ${'x'.repeat(4000)}`,
        },
    },
    v: 1,
};
