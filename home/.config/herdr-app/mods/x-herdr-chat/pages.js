// older history, one page at a time: the one owner of whether a page is being read and whether the thread's start is
// reached. a fast scroll or a held key at the top asks again and again; only one read is ever in flight (FRM-638 slice 6b)

/** @typedef {{ hasEarlier: () => boolean, readEarlier: () => Promise<string[]> }} PageDoor */

/** @param {PageDoor} reader the thread's reader: what lies above the lines it handed on */
export function createPages(reader) {
    /** @type {Promise<string[]> | null} */
    let reading = null;
    let isClosed = false;

    return {
        /** the thread is left: a page still read lands as nothing, and none is asked again */
        close() {
            isClosed = true;
        },
        isReading: () => reading !== null,
        /** whether the thread's first line is read: no page lies above */
        isStart: () => !reader.hasEarlier(),
        /** the next older page, or null while one is read or at the start @returns {Promise<string[]> | null} */
        next() {
            if (isClosed || reading || !reader.hasEarlier()) return null;
            const read = reader
                .readEarlier()
                .then((lines) => (isClosed ? [] : lines))
                .finally(() => {
                    reading = null;
                });
            reading = read;
            return read;
        },
    };
}
