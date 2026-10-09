import { ContentKeptAsSource, createEditor } from './createEditor.js';
import { configData, profileName, resolveConfig } from './config.js';
import { TextareaBinding } from './TextareaBinding.js';
import { removeNotice, showNotice } from '../ui/Notice.js';
import { isRendered, resolveTextareas } from '../utils/dom.js';
import { emit } from '../utils/events.js';
import { createTranslator } from '../utils/i18n.js';
import { hasOutdatedGalleries } from '../extensions/Gallery.js';

const MARKER = 'data-tiptap-initialized';
const HIDDEN_CLASS = 'tiptapeditor-source--hidden';
const RICHTEXT_TV_SELECTOR = 'textarea.modx-richtext';

/**
 * Owns all editor instances on the page, one per textarea.
 *
 * Every operation is idempotent: mounting an already mounted textarea returns the existing
 * instance, and unmounting an unknown one does nothing. A failing instance never affects
 * the others and always leaves its textarea visible and editable.
 */
export class EditorManager {
    constructor(logger) {
        this.logger = logger;
        this.config = resolveConfig();
        this.t = createTranslator();
        /** @type {Map<HTMLTextAreaElement, object>} */
        this.instances = new Map();
        this.observer = null;
    }

    configure(serverConfig) {
        // Settings, then the external config on top (its profiles are already in "profiles").
        this.config = resolveConfig(serverConfig, configData(serverConfig?.external));
        this.t = createTranslator(this.config.lexicon);
    }

    getInstance(target) {
        const [textarea] = resolveTextareas(target);
        return textarea ? this.instances.get(textarea) || null : null;
    }

    /**
     * Creates an editor for one textarea now (visible or not).
     * @returns {object|null} the instance, or null when the textarea stays a plain field
     */
    create(target, options = {}) {
        const [textarea] = resolveTextareas(target);
        if (!textarea) {
            return null;
        }
        if (this.instances.has(textarea)) {
            return this.instances.get(textarea);
        }
        if (textarea.hasAttribute(MARKER)) {
            // Kept as source earlier, or initialised by a second copy of the bundle.
            return null;
        }
        this.unobserve(textarea);

        // Per-field metadata from MODX (richtext TVs: id, name, caption) for profiles and sources.
        const field = this.config.tvs?.[textarea.id] || null;
        const fieldConfig = { field, editable: !textarea.readOnly };
        if (field) {
            // A TV browses its own Media Source (null: the user may not browse it).
            fieldConfig.mediaSource = field.mediaSource ?? null;
        }
        const profile = profileName(this.config, { field, options });
        const config = resolveConfig(this.config, configData(this.config.profiles?.[profile]), fieldConfig, options, { profile });
        try {
            const { editor, root, source, dispose } = createEditor(textarea, config, this.t, this.logger);
            const binding = new TextareaBinding(textarea, editor, { delay: config.syncDelay });
            source.binding = binding;
            if (hasOutdatedGalleries(editor)) {
                binding.refresh();
            }
            const instance = { editor, root, textarea, binding, source, config, field, dispose };

            removeNotice(textarea);
            textarea.classList.add(HIDDEN_CLASS);
            textarea.setAttribute(MARKER, '1');
            textarea.setAttribute('aria-hidden', 'true');
            this.instances.set(textarea, instance);

            emit('init', { editor, element: textarea });
            emit('ready', { editor, element: textarea });
            this.logger.debug('initialized', textarea.id || textarea.name);
            return instance;
        } catch (error) {
            textarea.classList.remove(HIDDEN_CLASS);
            if (error instanceof ContentKeptAsSource) {
                textarea.setAttribute(MARKER, 'source');
                showNotice(textarea, this.t(error.reason), 'info');
                this.logger.debug('kept as source', textarea.id || textarea.name, error.reason, error.details);
            } else {
                showNotice(textarea, this.t('editor_failed'), 'error');
                this.logger.debug('failed', textarea.id || textarea.name, error);
                if (!config.debug) {
                    console.error('[TipTapEditor]', error);
                }
            }
            return null;
        }
    }

    destroy(target) {
        for (const textarea of resolveTextareas(target)) {
            this.unobserve(textarea);
            const instance = this.instances.get(textarea);
            if (!instance) {
                continue;
            }
            this.instances.delete(textarea);
            try {
                instance.binding.dispose();
            } finally {
                instance.dispose();
                instance.editor.destroy();
                instance.root.remove();
                textarea.classList.remove(HIDDEN_CLASS);
                textarea.removeAttribute(MARKER);
                textarea.removeAttribute('aria-hidden');
                emit('destroy', { element: textarea });
                this.logger.debug('destroyed', textarea.id || textarea.name);
            }
        }
    }

    destroyAll() {
        this.destroy([...this.instances.keys()]);
        this.observer?.disconnect();
        this.observer = null;
    }

    /** Writes pending changes of the given editors (all when omitted) into their textareas. */
    sync(target) {
        const list = target === undefined ? [...this.instances.keys()] : resolveTextareas(target);
        for (const textarea of list) {
            this.instances.get(textarea)?.binding.flush();
        }
    }

    syncAll() {
        this.sync();
    }

    /** Textareas this page asks for: elements from the MODX event plus richtext TVs. */
    candidates(targets) {
        if (targets !== undefined && targets !== null && targets !== false) {
            return resolveTextareas(targets);
        }
        return [
            ...resolveTextareas(this.config.elements),
            ...document.querySelectorAll(RICHTEXT_TV_SELECTOR),
        ].filter((el, index, all) => all.indexOf(el) === index);
    }

    /**
     * Initialises editors for the requested textareas. Visible ones start now, hidden ones
     * (inactive tabs, collapsed TV categories) when they become visible.
     */
    mount(targets) {
        for (const textarea of Array.isArray(targets) && targets.every((t) => t instanceof Element) ? targets : this.candidates(targets)) {
            if (this.instances.has(textarea) || textarea.hasAttribute(MARKER) || textarea.disabled) {
                continue;
            }
            if (isRendered(textarea) || typeof IntersectionObserver === 'undefined') {
                this.create(textarea);
            } else {
                this.observe(textarea);
            }
        }
    }

    unmount(targets) {
        if (targets === undefined || targets === null) {
            this.destroyAll();
            return;
        }
        this.destroy(this.candidates(targets));
    }

    /**
     * Drops editors whose textarea left the DOM and mounts newly added fields.
     * The resource content field is left to MODx.loadRTE (it honours the "Rich text" option).
     */
    refresh() {
        for (const textarea of [...this.instances.keys()]) {
            if (!textarea.isConnected) {
                this.destroy(textarea);
            }
        }
        const onResourcePage = Boolean(window.MODx?.panel?.Resource);
        if (onResourcePage && !window.Ext?.getCmp?.('modx-panel-resource')?.initialized) {
            // The panel is still moving TVs into its tabs; MODx.afterTVLoad calls us again.
            return;
        }
        const panelOwned = onResourcePage ? ['ta'] : [];
        this.mount(this.candidates().filter((el) => !panelOwned.includes(el.id) || this.instances.has(el)));
    }

    observe(textarea) {
        if (!this.observer) {
            this.observer = new IntersectionObserver((entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting || isRendered(entry.target)) {
                        this.create(entry.target);
                    }
                }
            });
        }
        this.observer.observe(textarea);
    }

    unobserve(textarea) {
        this.observer?.unobserve(textarea);
    }
}
