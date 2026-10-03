/**
 * Thrown when content must stay in the plain textarea because the editor cannot show it
 * without changing it. The textarea keeps working; nothing is lost.
 */
export class ContentKeptAsSource extends Error {
    constructor(reason, details = []) {
        super(reason);
        this.name = 'ContentKeptAsSource';
        this.reason = reason;
        this.details = details;
    }
}
