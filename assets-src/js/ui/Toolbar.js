import { createElement } from '../utils/dom.js';
import { icon } from './icons.js';
import { parseToolbar } from './parseToolbar.js';
import { Popover } from './Popover.js';
import { getToolbarItem, resolveToolbarItemName } from './toolbarItems.js';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

function shortcutLabel(shortcut) {
    if (!shortcut) {
        return '';
    }
    return shortcut
        .replace('Mod', isMac ? '⌘' : 'Ctrl')
        .replace('Alt', isMac ? '⌥' : 'Alt')
        .replace('Shift', isMac ? '⇧' : 'Shift');
}

function safe(fn, fallback) {
    try {
        return fn();
    } catch {
        return fallback;
    }
}

function canRun(editor, command) {
    return safe(() => command(editor.can().chain(), editor).run(), false);
}

function run(editor, command) {
    command(editor.chain().focus(), editor).run();
}

function hasExtension(editor, name) {
    return !name || editor.extensionManager.extensions.some((ext) => ext.name === name);
}

/** Whether a toolbar item can be offered in this editor (feature, heading level, extension). */
export function itemAvailable(item, editor, config) {
    if (!item) {
        return false;
    }
    if (item.feature && config.features?.[item.feature] === false) {
        return false;
    }
    if (item.level && !config.headingLevels.includes(item.level)) {
        return false;
    }
    if (item.available && !item.available(config)) {
        return false;
    }
    return hasExtension(editor, item.requires);
}

/** Runs a toolbar item: its action (dialogs) or its command, with the chain given first. */
export function runItem(item, editor, context, chain = editor.chain().focus()) {
    if (item.action) {
        chain.run();
        item.action(editor, context);
    } else {
        item.command(chain, editor).run();
    }
}

/**
 * Toolbar built from the toolbar setting.
 *
 * Accessibility: role="toolbar" with a roving tabindex (one Tab stop, arrow keys move between
 * controls, Home/End jump); every control is a <button type="button"> with aria-label, a
 * tooltip (title) including the shortcut, aria-pressed for toggles and aria-haspopup /
 * aria-expanded for menus. Menus are keyboard operable and return focus on Escape.
 * Pointer clicks do not move focus out of the document, so the selection is kept.
 */
export class Toolbar {
    /**
     * @param {import('@tiptap/core').Editor} editor
     * @param {object} config resolved editor config (toolbar, headingLevels, colors, ...)
     * @param {object} context { t, fullscreen, logger }
     * @param {{ className?: string, label?: string }} [options] for additional toolbars (table)
     */
    constructor(editor, config, context, { className = '', label = 'toolbar' } = {}) {
        this.editor = editor;
        this.config = config;
        this.context = context;
        this.t = context.t;
        this.controls = [];
        this.popovers = [];
        this.frame = 0;

        this.el = createElement('div', `tiptapeditor__toolbar ${className}`.trim(), {
            role: 'toolbar',
            'aria-label': this.t(label),
            'aria-orientation': 'horizontal',
        });

        const { groups, unknown } = parseToolbar(config.toolbar, resolveToolbarItemName);
        if (unknown.length) {
            context.logger?.debug('toolbar items not available', unknown);
        }
        for (const names of groups) {
            const group = createElement('div', 'tiptapeditor__group', { role: 'group' });
            for (const name of names) {
                const item = getToolbarItem(name);
                if (!this.isAvailable(item)) {
                    continue;
                }
                const control = this.createControl(item);
                group.append(control.el);
                if (control.popover) {
                    group.append(control.popover.el);
                }
                this.controls.push(control);
            }
            if (group.childElementCount) {
                this.el.append(group);
            }
        }

        this.el.addEventListener('keydown', (event) => this.onKeydown(event));
        // Keep the editor selection when a toolbar control is clicked.
        this.el.addEventListener('mousedown', (event) => {
            if (event.target.closest('button')) {
                event.preventDefault();
            }
        });

        this.scheduleUpdate = () => {
            if (!this.frame) {
                this.frame = requestAnimationFrame(() => {
                    this.frame = 0;
                    this.update();
                });
            }
        };
        editor.on('transaction', this.scheduleUpdate);
        editor.on('focus', this.scheduleUpdate);
        editor.on('blur', this.scheduleUpdate);

        if (this.controls.length) {
            this.controls[0].el.tabIndex = 0;
        }
        this.update();
    }

    get isEmpty() {
        return this.controls.length === 0;
    }

    isAvailable(item) {
        return itemAvailable(item, this.editor, this.config);
    }

    createButton(item, extraClass = '') {
        const label = this.t(item.label);
        const shortcut = shortcutLabel(item.shortcut);
        const button = createElement('button', `tiptapeditor__button ${extraClass}`.trim(), {
            type: 'button',
            'aria-label': label,
            title: shortcut ? `${label} (${shortcut})` : label,
            'data-tiptapeditor-item': item.name,
            tabindex: '-1',
        });
        const svg = icon(item.icon);
        if (svg) {
            button.append(svg);
        } else {
            button.textContent = label;
        }
        return button;
    }

    createControl(item) {
        if (item.type === 'menu') {
            return this.createMenu(item);
        }
        if (item.type === 'color') {
            return this.createColor(item);
        }

        const button = this.createButton(item);
        const isToggle = typeof item.active === 'function';
        if (isToggle) {
            button.setAttribute('aria-pressed', 'false');
        }
        button.addEventListener('click', () => {
            if (item.action) {
                item.action(this.editor, this.context);
            } else {
                run(this.editor, item.command);
            }
            this.update();
        });

        return {
            el: button,
            update: () => {
                const enabled = item.enabled ? item.enabled(this.editor, this.context) : canRun(this.editor, item.command);
                // Most items need an editable document; fullscreen and source work without one.
                button.disabled = !enabled || (!this.editor.isEditable && !item.whileReadOnly);
                if (isToggle) {
                    button.setAttribute('aria-pressed', String(Boolean(safe(() => item.active(this.editor, this.context), false))));
                }
            },
        };
    }

    createMenu(item) {
        const trigger = this.createButton(item, 'tiptapeditor__button--menu');
        trigger.setAttribute('aria-haspopup', 'menu');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.append(icon('chevronDown') || '');
        const popover = new Popover(trigger, 'tiptapeditor__menu');
        popover.el.setAttribute('role', 'menu');
        popover.el.setAttribute('aria-label', this.t(item.label));
        this.popovers.push(popover);

        const options = item.options(this.editor, this.config);
        const entries = options.map((option) => {
            const el = createElement('button', 'tiptapeditor__menu-item', {
                type: 'button',
                role: 'menuitemradio',
                'aria-checked': 'false',
                tabindex: '-1',
            });
            const svg = icon(option.icon);
            if (svg) {
                el.append(svg);
            }
            // Presets from settings carry their own text; built-in options a lexicon key.
            el.append(document.createTextNode(option.text ?? this.t(option.label)));
            el.addEventListener('click', () => {
                popover.close(false);
                run(this.editor, option.command);
                this.update();
            });
            popover.el.append(el);
            return { el, option };
        });

        const openMenu = (focusLast = false) => {
            this.update();
            popover.open();
            const enabled = entries.filter((entry) => !entry.el.disabled);
            const checked = enabled.find((entry) => entry.el.getAttribute('aria-checked') === 'true');
            (checked || enabled[focusLast ? enabled.length - 1 : 0])?.el.focus();
        };
        trigger.addEventListener('click', () => (popover.isOpen ? popover.close(true) : openMenu()));
        trigger.addEventListener('keydown', (event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                event.stopPropagation();
                openMenu(event.key === 'ArrowUp');
            }
        });
        popover.el.addEventListener('keydown', (event) => this.onMenuKeydown(event, popover));

        return {
            el: trigger,
            popover,
            update: () => {
                let current = null;
                let anyEnabled = false;
                for (const entry of entries) {
                    const enabled = canRun(this.editor, entry.option.command);
                    const active = Boolean(safe(() => entry.option.active(this.editor), false));
                    entry.el.disabled = !enabled && !active;
                    entry.el.setAttribute('aria-checked', String(active));
                    anyEnabled ||= enabled;
                    if (active && !current) {
                        current = entry.option;
                    }
                }
                trigger.disabled = !anyEnabled || !this.editor.isEditable;
                const svg = icon(current?.icon || item.icon);
                const old = trigger.querySelector('.tiptapeditor__icon');
                if (svg && old) {
                    old.replaceWith(svg);
                }
                const label = current ? `${this.t(item.label)}: ${this.t(current.label)}` : this.t(item.label);
                trigger.setAttribute('aria-label', label);
                trigger.title = label;
            },
        };
    }

    createColor(item) {
        const trigger = this.createButton(item, 'tiptapeditor__button--color');
        trigger.setAttribute('aria-haspopup', 'menu');
        trigger.setAttribute('aria-expanded', 'false');
        const bar = createElement('span', 'tiptapeditor__color-bar', { 'aria-hidden': 'true' });
        trigger.append(bar);
        const popover = new Popover(trigger, 'tiptapeditor__palette');
        popover.el.setAttribute('role', 'menu');
        popover.el.setAttribute('aria-label', this.t(item.label));
        this.popovers.push(popover);

        const swatches = (item.palette(this.config) || []).map((color) => {
            const el = createElement('button', 'tiptapeditor__swatch', {
                type: 'button',
                role: 'menuitem',
                tabindex: '-1',
                title: color,
                'aria-label': color,
            });
            el.style.setProperty('--tiptapeditor-swatch', color);
            el.addEventListener('click', () => {
                popover.close(false);
                run(this.editor, (chain) => item.apply(chain, color));
                this.update();
            });
            popover.el.append(el);
            return el;
        });
        const clear = createElement('button', 'tiptapeditor__menu-item tiptapeditor__menu-item--clear', {
            type: 'button',
            role: 'menuitem',
            tabindex: '-1',
        });
        clear.textContent = this.t('remove_color');
        clear.addEventListener('click', () => {
            popover.close(false);
            run(this.editor, item.clear);
            this.update();
        });
        popover.el.append(clear);

        trigger.addEventListener('click', () => {
            if (popover.isOpen) {
                popover.close(true);
                return;
            }
            popover.open();
            swatches[0]?.focus();
        });
        trigger.addEventListener('keydown', (event) => {
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                event.stopPropagation();
                popover.open();
                swatches[0]?.focus();
            }
        });
        popover.el.addEventListener('keydown', (event) => this.onMenuKeydown(event, popover));

        return {
            el: trigger,
            popover,
            update: () => {
                const enabled = canRun(this.editor, (chain) => item.apply(chain, '#000000'));
                trigger.disabled = !enabled || !this.editor.isEditable;
                const current = safe(() => item.current(this.editor), null);
                bar.style.background = current || '';
                trigger.setAttribute('aria-pressed', String(Boolean(current)));
                clear.disabled = !current;
            },
        };
    }

    onMenuKeydown(event, popover) {
        const items = [...popover.el.querySelectorAll('button:not(:disabled)')];
        const index = items.indexOf(event.target);
        let next = null;
        switch (event.key) {
            case 'ArrowDown':
            case 'ArrowRight':
                next = items[(index + 1) % items.length];
                break;
            case 'ArrowUp':
            case 'ArrowLeft':
                next = items[(index - 1 + items.length) % items.length];
                break;
            case 'Home':
                next = items[0];
                break;
            case 'End':
                next = items[items.length - 1];
                break;
            case 'Tab':
                popover.close(false);
                return;
            default:
                return;
        }
        event.preventDefault();
        event.stopPropagation();
        next?.focus();
    }

    onKeydown(event) {
        if (event.target.closest('.tiptapeditor__popover')) {
            return;
        }
        const buttons = this.controls.map((control) => control.el).filter((el) => !el.disabled);
        const index = buttons.indexOf(event.target);
        if (index === -1) {
            return;
        }
        let next = null;
        if (event.key === 'ArrowRight') {
            next = buttons[(index + 1) % buttons.length];
        } else if (event.key === 'ArrowLeft') {
            next = buttons[(index - 1 + buttons.length) % buttons.length];
        } else if (event.key === 'Home') {
            next = buttons[0];
        } else if (event.key === 'End') {
            next = buttons[buttons.length - 1];
        } else if (event.key === 'Escape') {
            this.editor.commands.focus();
            return;
        }
        if (next) {
            event.preventDefault();
            this.setTabStop(next);
            next.focus();
        }
    }

    setTabStop(target) {
        for (const control of this.controls) {
            control.el.tabIndex = control.el === target ? 0 : -1;
        }
    }

    update() {
        if (this.editor.isDestroyed) {
            return;
        }
        for (const control of this.controls) {
            control.update();
        }
        // Keep exactly one reachable Tab stop even when the current one became disabled.
        const stop = this.controls.find((control) => control.el.tabIndex === 0 && !control.el.disabled);
        if (!stop) {
            const first = this.controls.find((control) => !control.el.disabled);
            if (first) {
                this.setTabStop(first.el);
            }
        }
    }

    destroy() {
        cancelAnimationFrame(this.frame);
        this.editor.off('transaction', this.scheduleUpdate);
        this.editor.off('focus', this.scheduleUpdate);
        this.editor.off('blur', this.scheduleUpdate);
        this.popovers.forEach((popover) => popover.destroy());
        this.el.remove();
    }
}
