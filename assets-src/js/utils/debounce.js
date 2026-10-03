/**
 * Trailing debounce with flush() and cancel().
 */
export function debounce(fn, wait) {
    let timer = null;
    let pendingArgs = null;

    const debounced = (...args) => {
        pendingArgs = args;
        clearTimeout(timer);
        timer = setTimeout(debounced.flush, wait);
    };
    debounced.flush = () => {
        clearTimeout(timer);
        timer = null;
        if (pendingArgs) {
            const args = pendingArgs;
            pendingArgs = null;
            fn(...args);
        }
    };
    debounced.cancel = () => {
        clearTimeout(timer);
        timer = null;
        pendingArgs = null;
    };
    debounced.pending = () => pendingArgs !== null;

    return debounced;
}
