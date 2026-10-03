/**
 * Reads the configuration blocks written by OnRichTextEditorInit
 * (<script type="application/json" data-tiptapeditor-config>). Several blocks may exist on
 * one page; their element lists are merged, the first block wins for other keys.
 * Invalid JSON is skipped so one broken block cannot stop the others.
 *
 * @param {ParentNode} root
 * @returns {object|null} null when the page has no configuration (editor not requested)
 */
export function readServerConfig(root = document) {
    const blocks = root.querySelectorAll('script[type="application/json"][data-tiptapeditor-config]');
    let merged = null;

    for (const block of blocks) {
        let data;
        try {
            data = JSON.parse(block.textContent || '{}');
        } catch {
            continue;
        }
        if (!merged) {
            merged = { ...data, elements: [] };
        }
        for (const id of data.elements || []) {
            if (!merged.elements.includes(id)) {
                merged.elements.push(id);
            }
        }
    }

    return merged;
}
