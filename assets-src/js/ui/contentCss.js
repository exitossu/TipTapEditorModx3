/**
 * Site CSS in the editor (tiptapeditor.content_css): the stylesheets are fetched, every selector
 * is scoped to the editing area of the editors that use them, and the result is added as one
 * <style> element per set of URLs. The manager page itself is never restyled: "body",
 * "html" and ":root" become the editing area, every other selector is prefixed with it.
 * Relative url() references are resolved against the stylesheet's URL; @import rules are
 * not followed. Text only: the CSS is never evaluated as anything but CSS.
 */

const ATTRIBUTE = 'data-tiptapeditor-css';
const loaded = new Map(); // key -> Promise<HTMLStyleElement|null>

function keyOf(urls) {
    let hash = 0;
    for (const char of urls.join('\n')) {
        hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    }
    return hash.toString(36);
}

export function scopeFor(key) {
    return `.tiptapeditor[${ATTRIBUTE}="${key}"] .tiptapeditor__content .ProseMirror`;
}

/** Splits a selector list at top-level commas (not inside :is(a, b) or [attr="a,b"]). */
export function splitSelectors(list) {
    const parts = [];
    let depth = 0;
    let quote = null;
    let current = '';
    for (const char of list) {
        if (quote) {
            if (char === quote) {
                quote = null;
            }
        } else if (char === '"' || char === "'") {
            quote = char;
        } else if (char === '(' || char === '[') {
            depth++;
        } else if (char === ')' || char === ']') {
            depth--;
        } else if (char === ',' && depth === 0) {
            parts.push(current.trim());
            current = '';
            continue;
        }
        current += char;
    }
    if (current.trim()) {
        parts.push(current.trim());
    }
    return parts;
}

/**
 * One selector scoped to the editing area. A leading html / :root / body compound (with its
 * classes: "body.page") stands for the editing area itself.
 */
export function scopeSelector(selector, scope) {
    const root = /^(?:(?:html|:root)(?![\w-])[^\s>+~]*\s*>?\s*)?(?:body(?![\w-])[^\s>+~]*)?/i.exec(selector)[0];
    if (!root) {
        return `${scope} ${selector}`;
    }
    const rest = selector.slice(root.length).trim().replace(/^>\s*/, '');
    return rest ? `${scope} ${rest}` : scope;
}

function scopeRules(rules, scope) {
    for (const rule of rules) {
        if (rule.selectorText !== undefined && rule.style) {
            rule.selectorText = splitSelectors(rule.selectorText).map((selector) => scopeSelector(selector, scope)).join(', ');
        }
        if (rule.cssRules && rule.selectorText === undefined) {
            scopeRules(rule.cssRules, scope); // @media, @supports, @layer, @container
        }
    }
}

/** Resolves relative url(...) references against the stylesheet URL. */
export function absoluteUrls(cssText, baseUrl) {
    return cssText.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (whole, quote, url) => {
        if (/^(data:|https?:|\/\/|#)/i.test(url)) {
            return whole;
        }
        try {
            return `url("${new URL(url, baseUrl).href}")`;
        } catch {
            return whole;
        }
    });
}

/** Scoped CSS text for one stylesheet. */
export function scopeCss(cssText, scope, baseUrl) {
    const sheet = new CSSStyleSheet();
    // @import is not allowed in constructed sheets; such rules are skipped.
    sheet.replaceSync(cssText.replace(/@import[^;]+;/gi, ''));
    scopeRules(sheet.cssRules, scope);
    return absoluteUrls([...sheet.cssRules].map((rule) => rule.cssText).join('\n'), baseUrl);
}

async function load(urls, key, logger) {
    const scope = scopeFor(key);
    const parts = await Promise.all(urls.map(async (url) => {
        try {
            const absolute = new URL(url, document.baseURI).href;
            if (!/^https?:/i.test(absolute)) {
                return '';
            }
            const response = await fetch(absolute, { credentials: 'same-origin' });
            if (!response.ok) {
                logger?.debug('content_css not loaded', url, response.status);
                return '';
            }
            return scopeCss(await response.text(), scope, absolute);
        } catch (error) {
            logger?.debug('content_css not loaded', url, error);
            return '';
        }
    }));
    const css = parts.filter(Boolean).join('\n');
    if (!css) {
        return null;
    }
    const style = document.createElement('style');
    style.setAttribute(ATTRIBUTE, key);
    style.textContent = css;
    document.head.append(style);
    return style;
}

/**
 * Applies the site CSS to an editor root. Each set of URLs is loaded once per page.
 * @returns {Promise<void>}
 */
export function applyContentCss(root, urls, logger) {
    if (!urls?.length || typeof CSSStyleSheet === 'undefined' || typeof fetch === 'undefined') {
        return Promise.resolve();
    }
    const key = keyOf(urls);
    root.setAttribute(ATTRIBUTE, key);
    if (!loaded.has(key)) {
        loaded.set(key, load(urls, key, logger));
    }
    return loaded.get(key).then(() => undefined);
}
