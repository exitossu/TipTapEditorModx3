/**
 * Embeds (iframes): which attributes and hosts are allowed, and video providers that turn a
 * page URL into an embed URL. Providers are plain functions registered from JS
 * (TipTapEditor.registerEmbedProvider); nothing here comes from configuration as code.
 */

export const DEFAULT_IFRAME_ATTRIBUTES = 'src,width,height,allow,allowfullscreen,loading,title,name,referrerpolicy,frameborder,class,id,style';

const EVENT_HANDLER = /^on/i;
const TEMPLATE_TAG = /\[\[|\{[$/a-z_]/i;

/** Allowed iframe attribute names (lower case). Event handlers are never allowed. */
export function allowedAttributes(setting) {
    const names = String(setting || DEFAULT_IFRAME_ATTRIBUTES).toLowerCase().split(',')
        .map((name) => name.trim()).filter((name) => name && !EVENT_HANDLER.test(name));
    if (!names.includes('src')) {
        names.push('src');
    }
    return new Set(names);
}

/** Allowed hosts (lower case); empty = any host. */
export function allowedHosts(setting) {
    return String(setting ?? '').toLowerCase().split(/[\s,]+/).map((host) => host.trim().replace(/^\*\./, '')).filter(Boolean);
}

/** Host of an iframe src, or null when it is not an http(s) or protocol-relative URL. */
export function hostOf(src) {
    const value = String(src ?? '').trim();
    if (!/^(https?:)?\/\//i.test(value)) {
        return null;
    }
    try {
        return new URL(value, 'https://example.invalid/').hostname.toLowerCase();
    } catch {
        return null;
    }
}

/**
 * Whether a src may be shown as an embed: an http(s) URL on an allowed host, or a URL made
 * from MODX/Fenom tags ([[++site_url]]video/, {$video}), which the server resolves later.
 */
export function isAllowedSrc(src, hosts = []) {
    const value = String(src ?? '').trim();
    if (!value) {
        return false;
    }
    if (TEMPLATE_TAG.test(value) && !/^\s*(javascript|vbscript|data):/i.test(value)) {
        return hosts.length === 0;
    }
    const host = hostOf(value);
    if (!host) {
        return false;
    }
    return hosts.length === 0 || hosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

const providers = [];

/**
 * Adds a provider: { name, match(url) => string | { src, width?, height? } | null }.
 * Later registrations are tried first.
 */
export function registerEmbedProvider(provider) {
    if (!provider || typeof provider.match !== 'function' || !provider.name) {
        throw new TypeError('An embed provider needs a name and a match(url) function');
    }
    providers.unshift(provider);
}

registerEmbedProvider({
    name: 'rutube',
    match: (url) => {
        const id = /rutube\.ru\/(?:video|play\/embed)\/([0-9a-f]{32})/i.exec(url)?.[1];
        return id ? `https://rutube.ru/play/embed/${id}` : null;
    },
});

registerEmbedProvider({
    name: 'vk',
    match: (url) => {
        const match = /(?:vk\.com|vkvideo\.ru)\/(?:[\w.]+\?z=)?video(-?\d+)_(\d+)/i.exec(url);
        return match ? `https://vk.com/video_ext.php?oid=${match[1]}&id=${match[2]}&hd=2` : null;
    },
});

registerEmbedProvider({
    name: 'youtube',
    match: (url) => {
        const match = /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([\w-]{11})/i.exec(url);
        if (!match) {
            return null;
        }
        const start = /[?&#](?:t|start)=(\d+)s?/.exec(url)?.[1];
        return `https://www.youtube.com/embed/${match[1]}${start ? `?start=${start}` : ''}`;
    },
});

/**
 * What the user typed into the embed dialog: a video page URL, an embed URL or an
 * <iframe …> code. Returns { src, attributes } (attributes from pasted code) or null.
 */
export function parseEmbedInput(input) {
    const value = String(input ?? '').trim();
    if (!value) {
        return null;
    }
    if (/^<iframe\b/i.test(value)) {
        // Parsed in an inert document: nothing is loaded or run.
        const doc = document.implementation.createHTMLDocument('');
        doc.body.innerHTML = value;
        const iframe = doc.querySelector('iframe');
        if (!iframe?.getAttribute('src')) {
            return null;
        }
        const attributes = {};
        for (const name of iframe.getAttributeNames()) {
            attributes[name.toLowerCase()] = iframe.getAttribute(name);
        }
        return { src: attributes.src, attributes };
    }
    for (const provider of providers) {
        try {
            const result = provider.match(value);
            if (result) {
                return typeof result === 'string' ? { src: result, attributes: {} } : { src: result.src, attributes: { ...result } };
            }
        } catch {
            // a broken provider is skipped
        }
    }
    return { src: value, attributes: {} };
}

/**
 * Attributes of an iframe to write, in the given order, filtered: only allowed names,
 * never event handlers.
 */
export function filterAttributes(attributes, allowed) {
    const result = {};
    for (const [name, value] of Object.entries(attributes || {})) {
        const lower = name.toLowerCase();
        if (allowed.has(lower) && !EVENT_HANDLER.test(lower) && value !== null && value !== undefined) {
            result[lower] = String(value);
        }
    }
    return result;
}
