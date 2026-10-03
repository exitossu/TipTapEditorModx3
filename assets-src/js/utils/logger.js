/**
 * Debug logger: silent unless tiptapeditor.debug is on. Never log sensitive data.
 */
export function createLogger(enabled) {
    const logger = {
        enabled,
        debug: (...args) => {
            if (logger.enabled) {
                console.debug('[TipTapEditor]', ...args);
            }
        },
    };
    return logger;
}
