// happy-dom treats documents from DOMParser and createHTMLDocument as live and tries to load
// every <iframe> in them; browsers never load iframes there. Requests are answered with an
// empty page here, so tests neither reach the network nor print load errors.
const settings = globalThis.happyDOM?.settings;
if (settings) {
    settings.fetch = settings.fetch || {};
    settings.fetch.interceptor = {
        beforeAsyncRequest: async () => new Response('', { status: 200, headers: { 'Content-Type': 'text/html' } }),
        beforeSyncRequest: () => new Response('', { status: 200, headers: { 'Content-Type': 'text/html' } }),
    };
}
