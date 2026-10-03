/**
 * Parses the toolbar setting into groups of item names.
 *
 *   "undo redo | heading | bold italic" -> [["undo", "redo"], ["heading"], ["bold", "italic"]]
 *
 * Accepts an array as well (external config): ["undo", "redo", "|", "bold"] or nested groups.
 * Names are matched case-insensitively against the registry; unknown names are reported
 * and skipped so a typo in the setting never breaks the editor.
 *
 * @param {string|Array} value
 * @param {(name: string) => string|null} resolveName returns the canonical name or null
 * @returns {{ groups: string[][], unknown: string[] }}
 */
export function parseToolbar(value, resolveName) {
    let tokens;
    if (Array.isArray(value)) {
        tokens = value.flatMap((entry, index) => (Array.isArray(entry) ? [...(index ? ['|'] : []), ...entry] : [entry]));
    } else {
        tokens = String(value ?? '').match(/\||[^\s|]+/g) || [];
    }

    const groups = [[]];
    const unknown = [];
    const seen = new Set();
    for (const raw of tokens) {
        const token = String(raw).trim();
        if (!token) {
            continue;
        }
        if (token === '|') {
            if (groups[groups.length - 1].length) {
                groups.push([]);
            }
            continue;
        }
        const name = resolveName(token);
        if (!name) {
            unknown.push(token);
        } else if (!seen.has(name)) {
            seen.add(name);
            groups[groups.length - 1].push(name);
        }
    }

    return { groups: groups.filter((group) => group.length), unknown };
}
