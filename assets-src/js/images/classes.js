/**
 * The image class attribute is edited as three parts: an alignment class, one preset from
 * tiptapeditor.image_classes, and any other classes. Joining them gives the attribute back;
 * tokens are never reordered when nothing changed.
 */

export const DEFAULT_ALIGN_CLASSES = Object.freeze({ left: 'align-left', center: 'align-center', right: 'align-right' });

const tokens = (value) => String(value ?? '').split(/\s+/).filter(Boolean);

/**
 * @param {string|null} classAttr
 * @param {{value: string}[]} presets
 * @param {Record<string, string>} alignClasses
 * @returns {{ align: string, preset: string, other: string }}
 */
export function splitImageClasses(classAttr, presets = [], alignClasses = DEFAULT_ALIGN_CLASSES) {
    let rest = tokens(classAttr);
    let align = '';
    for (const [side, cls] of Object.entries(alignClasses)) {
        if (cls && rest.includes(cls)) {
            align = side;
            rest = rest.filter((token) => token !== cls);
            break;
        }
    }
    // The longest preset whose tokens are all present (a preset may hold several classes).
    let preset = '';
    let best = 0;
    for (const { value } of presets) {
        const parts = tokens(value);
        if (parts.length > best && parts.every((part) => rest.includes(part))) {
            preset = value;
            best = parts.length;
        }
    }
    if (preset) {
        const parts = tokens(preset);
        rest = rest.filter((token) => !parts.includes(token));
    }
    return { align, preset, other: rest.join(' ') };
}

/** Class attribute from the parts, or null when empty. Duplicates are dropped. */
export function joinImageClasses({ align = '', preset = '', other = '' }, alignClasses = DEFAULT_ALIGN_CLASSES) {
    const list = [...tokens(other), ...tokens(preset), ...tokens(alignClasses[align] || '')];
    const unique = [...new Set(list)];
    return unique.length ? unique.join(' ') : null;
}

/**
 * Keeps the original class attribute when the parts did not change, so opening the dialog
 * and saving without edits does not reorder classes.
 */
export function updatedImageClass(original, parts, presets, alignClasses = DEFAULT_ALIGN_CLASSES) {
    const before = splitImageClasses(original, presets, alignClasses);
    const same = before.align === parts.align && before.preset === parts.preset
        && tokens(before.other).join(' ') === tokens(parts.other).join(' ');
    return same ? (original || null) : joinImageClasses(parts, alignClasses);
}

/** Width/height field value: digits, optionally with %; '' clears it. Returns undefined when invalid. */
export function dimension(value) {
    const text = String(value ?? '').trim();
    if (text === '') {
        return null;
    }
    return /^\d+%?$/.test(text) ? text : undefined;
}
