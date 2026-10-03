import { EditorManager } from './editor/EditorManager.js';
import { registerExtension } from './editor/registry.js';
import { registerEmbedProvider } from './embed/embed.js';
import { registerToolbarItem } from './ui/toolbarItems.js';
import { observeFields } from './modx/fieldObserver.js';
import { installModxHooks } from './modx/lifecycle.js';
import { readServerConfig } from './modx/serverConfig.js';
import { createLogger } from './utils/logger.js';

/* global __TIPTAPEDITOR_VERSION__ */

/**
 * Public API exposed as window.TipTapEditor.
 */
export function createApi() {
    const logger = createLogger(false);
    const manager = new EditorManager(logger);
    let config = null;
    let hooksInstalled = false;
    let fieldObserver = null;

    const api = {
        version: __TIPTAPEDITOR_VERSION__,

        /** Configuration in effect after init(), or null before. */
        get config() {
            return config;
        },

        /** Map of textarea -> instance ({ editor, root, textarea, config }). */
        get instances() {
            return manager.instances;
        },

        /**
         * Initialise with the configuration passed by MODX. Without an argument the
         * configuration blocks rendered by OnRichTextEditorInit are read from the page.
         * Installs the manager hooks and mounts the requested fields. Safe to call again.
         *
         * @param {object} [serverConfig]
         * @returns {boolean} false when the page asked for no editor
         */
        init(serverConfig) {
            const resolved = serverConfig || readServerConfig();
            if (!resolved) {
                return false;
            }
            config = resolved;
            logger.enabled = Boolean(resolved.debug);
            manager.configure(resolved);
            logger.debug('version', __TIPTAPEDITOR_VERSION__, 'config', resolved);
            if (!hooksInstalled) {
                installModxHooks(api);
                hooksInstalled = true;
            }
            if (!fieldObserver) {
                fieldObserver = observeFields(() => manager.refresh());
            }
            // The resource panel mounts its content field itself through MODx.loadRTE, and only
            // when the resource's "Rich text" option is on; refresh() mounts everything else
            // (richtext TVs, fields of other pages).
            manager.refresh();
            return true;
        },

        /** Mount editors for the given textareas (IDs, elements, selectors) or all requested ones. */
        mount: (targets) => manager.mount(targets),
        unmount: (targets) => manager.unmount(targets),
        refresh: () => manager.refresh(),

        /**
         * Create an editor for one textarea right away.
         * @param {string|HTMLTextAreaElement} element
         * @param {object} [options] runtime configuration overrides
         */
        create: (element, options) => manager.create(element, options),
        destroy: (element) => manager.destroy(element),
        destroyAll: () => {
            manager.destroyAll();
            fieldObserver?.disconnect();
            fieldObserver = null;
        },
        getInstance: (element) => manager.getInstance(element),

        /** Write pending editor changes into the textareas (all when no element given). */
        sync: (element) => manager.sync(element),
        /** Synchronously write every editor into its textarea, e.g. before an AJAX save. */
        syncAll: () => manager.syncAll(),

        /**
         * Add a Tiptap extension (Extension, Node or Mark) to every editor created afterwards.
         * Call it before the editors start (e.g. from a script loaded with OnManagerPageBeforeRender)
         * or call TipTapEditor.unmount() / mount() to rebuild them.
         */
        registerExtension: (extension) => registerExtension(extension),
        /** Add a toolbar control usable by name in tiptapeditor.toolbar (see ui/toolbarItems.js). */
        registerToolbarItem: (item) => registerToolbarItem(item),
        /**
         * Add a video/embed provider for the embed dialog:
         * { name, match(url) => embed src | { src, width, height } | null }.
         */
        registerEmbedProvider: (provider) => registerEmbedProvider(provider),
    };

    return api;
}
