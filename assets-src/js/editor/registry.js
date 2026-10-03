/**
 * Extensions registered by other extras (TipTapEditor.registerExtension). They are added to
 * every editor created afterwards; tiptapeditor.external_config / profiles can switch one off
 * or configure it by its name ("extensions": {"myExtension": false}).
 */
const registered = [];

export function registerExtension(extension) {
    if (!extension || typeof extension.name !== 'string' || typeof extension.configure !== 'function') {
        throw new TypeError('TipTapEditor.registerExtension expects a Tiptap extension (Extension, Node or Mark)');
    }
    const index = registered.findIndex((item) => item.name === extension.name);
    if (index === -1) {
        registered.push(extension);
    } else {
        registered[index] = extension;
    }
}

export function registeredExtensions() {
    return [...registered];
}
