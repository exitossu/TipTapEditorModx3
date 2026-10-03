/**
 * Link helpers shared by the link dialog and the toolbar.
 */

export const DEFAULT_RESOURCE_LINK_FORMAT = '[[~{id}]]';

// Schemes that run code or embed documents are never written into href.
const UNSAFE_SCHEME = /^\s*(javascript|vbscript|data|file):/i;
const NEW_WINDOW_REL = ['noopener', 'noreferrer'];

/** Trimmed href, or null when it is empty or uses an unsafe scheme. Nothing is prepended. */
export function cleanHref(value) {
    const href = String(value ?? '').trim();
    if (!href || UNSAFE_SCHEME.test(href.replace(/[\u0000-\u001f\s]+/g, ''))) {
        return null;
    }
    return href;
}

/**
 * rel for the chosen target: a new window always gets noopener noreferrer (added to what the
 * user typed); same window drops just those two again. Other tokens are kept in order.
 */
export function relForTarget(rel, newWindow) {
    const tokens = String(rel ?? '').split(/\s+/).filter(Boolean);
    const rest = tokens.filter((token) => !NEW_WINDOW_REL.includes(token.toLowerCase()));
    const result = newWindow ? [...new Set([...tokens, ...NEW_WINDOW_REL])] : rest;
    return result.join(' ');
}

/**
 * Class presets from a setting: JSON {"class": "Label"} or a comma separated class list.
 * Returns [{ value, label }]. Invalid input gives an empty list (the field is free text).
 */
export function parseClassPresets(value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return Object.entries(value).map(([cls, label]) => ({ value: String(cls), label: String(label || cls) }));
    }
    const text = String(value ?? '').trim();
    if (!text) {
        return [];
    }
    if (text.startsWith('{')) {
        try {
            return parseClassPresets(JSON.parse(text));
        } catch {
            return [];
        }
    }
    return text.split(',').map((cls) => cls.trim()).filter(Boolean).map((cls) => ({ value: cls, label: cls }));
}

function formatPattern(format) {
    const escaped = format.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^${escaped
        .replace('\\{id\\}', '(\\d+)')
        .replace(/\\\{(context|uri)\\\}/g, '.*?')}$`);
}

/** Href for a resource from tiptapeditor.resource_link_format ({id}, {context}, {uri}). */
export function resourceHref(resource, format = DEFAULT_RESOURCE_LINK_FORMAT) {
    const pattern = String(format || DEFAULT_RESOURCE_LINK_FORMAT);
    const safe = pattern.includes('{id}') ? pattern : DEFAULT_RESOURCE_LINK_FORMAT;
    return safe
        .replace('{id}', String(Number(resource.id) || 0))
        .replace('{context}', String(resource.context_key || ''))
        .replace('{uri}', String(resource.uri || ''));
}

/** Resource ID of an href made with the format (or a plain [[~id]] tag), else null. */
export function resourceIdOf(href, format = DEFAULT_RESOURCE_LINK_FORMAT) {
    const value = String(href ?? '').trim();
    const formats = [format || DEFAULT_RESOURCE_LINK_FORMAT, DEFAULT_RESOURCE_LINK_FORMAT];
    for (const candidate of formats) {
        if (!String(candidate).includes('{id}')) {
            continue;
        }
        const match = value.match(formatPattern(String(candidate)));
        if (match) {
            return Number(match[1]);
        }
    }
    const tag = value.match(/^\[\[~(\d+)(?:\?[^\]]*)?\]\]/);
    return tag ? Number(tag[1]) : null;
}

/** Anchor targets in the document: id attributes of headings (and other nodes that keep one). */
export function documentAnchors(editor) {
    const anchors = [];
    editor.state.doc.descendants((node) => {
        const id = node.attrs?.id;
        if (id && !anchors.some((a) => a.id === id)) {
            anchors.push({ id, label: node.textContent.trim().slice(0, 60) || id });
        }
    });
    return anchors;
}
