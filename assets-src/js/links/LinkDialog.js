import { browseFile, canBrowse, fileUrl } from '../modx/MediaBrowser.js';
import { searchResources } from '../modx/connector.js';
import { Dialog } from '../ui/Dialog.js';
import { debounce } from '../utils/debounce.js';
import { createElement } from '../utils/dom.js';
import {
    cleanHref, documentAnchors, parseClassPresets, relForTarget, resourceHref, resourceIdOf,
} from './links.js';

const SEARCH_DELAY = 300;

/**
 * Link dialog: URL, MODX resource search, file from the Media Browser, anchors of the
 * document, title, target, rel and CSS class. Opened from the toolbar (link, modxLink) and
 * with Mod+K.
 *
 * @param {import('@tiptap/core').Editor} editor
 * @param {object} context toolbar context ({ t, config, message, logger })
 * @param {{ searchFirst?: boolean }} [options] open with the resource search focused
 */
export function openLinkDialog(editor, context, { searchFirst = false } = {}) {
    if (!editor.isEditable) {
        return null;
    }
    const { t, config } = context;
    const format = config.resourceLinkFormat;
    const editing = editor.isActive('link');
    const current = editing ? editor.getAttributes('link') : {};
    const { empty } = editor.state.selection;
    const needsText = !editing && empty;
    let search = null;

    const dialog = new Dialog({ title: t(editing ? 'link_edit' : 'link_insert'), t, className: 'tiptapeditor-dialog--link' });

    // URL with the resource / file / anchor helpers next to it.
    const url = dialog.field(t('link_url'), dialog.input('text', { value: current.href || '', placeholder: 'https://… [[~12]] #anchor' }));
    const resourceInfo = createElement('div', 'tiptapeditor-dialog__hint tiptapeditor-dialog__resource', { 'aria-live': 'polite' });
    url.after(resourceInfo);

    const tools = createElement('div', 'tiptapeditor-dialog__tools');
    url.parentElement.append(tools);
    const resourceButton = dialog.button(t('link_resource'), { onClick: () => search.toggle(true) });
    resourceButton.setAttribute('aria-expanded', 'false');
    tools.append(resourceButton);
    if (canBrowse(config)) {
        tools.append(dialog.button(t('link_file'), { onClick: () => chooseFile() }));
    }
    const anchors = documentAnchors(editor);
    if (anchors.length) {
        const anchorSelect = dialog.select([
            { value: '', label: t('link_anchor') },
            ...anchors.map((a) => ({ value: `#${a.id}`, label: `#${a.id} (${a.label})` })),
        ], '');
        anchorSelect.setAttribute('aria-label', t('link_anchor'));
        anchorSelect.addEventListener('change', () => {
            if (anchorSelect.value) {
                setUrl(anchorSelect.value);
                anchorSelect.value = '';
            }
        });
        tools.append(anchorSelect);
    }

    search = createResourceSearch(dialog, context, {
        trigger: resourceButton,
        onPick: (resource) => {
            setUrl(resourceHref(resource, format), resource);
            if (text && !text.value) {
                text.value = resource.pagetitle;
            }
            url.focus();
        },
    });
    tools.after(search.el);

    const text = needsText ? dialog.field(t('link_text'), dialog.input('text')) : null;
    const title = dialog.field(t('link_title'), dialog.input('text', { value: current.title || '' }));
    const target = dialog.field(t('link_target'), dialog.select([
        { value: '', label: t('link_target_same') },
        { value: '_blank', label: t('link_target_new') },
    ], current.target === '_blank' ? '_blank' : ''));
    const rel = dialog.field(t('link_rel'), dialog.input('text', { value: current.rel || '' }), { hint: t('link_rel_hint') });
    target.addEventListener('change', () => {
        rel.value = relForTarget(rel.value, target.value === '_blank');
    });

    const presets = parseClassPresets(config.linkClasses);
    let cssClass;
    if (presets.length) {
        const options = [{ value: '', label: t('link_class_none') }, ...presets];
        if (current.class && !presets.some((p) => p.value === current.class)) {
            options.push({ value: current.class, label: current.class });
        }
        cssClass = dialog.field(t('link_class'), dialog.select(options, current.class || ''));
    } else {
        cssClass = dialog.field(t('link_class'), dialog.input('text', { value: current.class || '' }));
    }

    function setUrl(value, resource) {
        url.value = value;
        showResource(resource);
    }

    let lookup = 0;
    function showResource(resource) {
        const id = resourceIdOf(url.value, format);
        resourceInfo.textContent = '';
        if (!id) {
            return;
        }
        if (resource) {
            resourceInfo.textContent = t('link_resource_selected')
                .replace('{title}', resource.pagetitle).replace('{id}', String(resource.id)).replace('{context}', resource.context_key);
            return;
        }
        const request = ++lookup;
        searchResources(config, String(id), { limit: 1 }).then((results) => {
            const found = results.find((r) => r.id === id);
            if (request === lookup && found) {
                showResource(found);
            }
        }).catch(() => {});
    }
    url.addEventListener('input', debounce(() => showResource(), SEARCH_DELAY));
    showResource();

    async function chooseFile() {
        const file = await browseFile({ source: config.mediaSource, context: config.resource?.context });
        if (file && !dialog.closed) {
            setUrl(fileUrl(file, config.mediaUrlMode, config.siteBaseUrl));
            if (text && !text.value) {
                text.value = String(file.name || '');
            }
        }
        if (!dialog.closed) {
            url.focus();
        }
    }

    const apply = () => {
        const href = cleanHref(url.value);
        if (!href) {
            dialog.error(t(url.value.trim() ? 'link_unsafe' : 'link_required'));
            url.focus();
            return;
        }
        const attrs = {
            href,
            target: target.value || null,
            rel: relForTarget(rel.value, target.value === '_blank') || null,
            class: cssClass.value.trim() || null,
            title: title.value.trim() || null,
        };
        dialog.close();
        const chain = editor.chain().focus();
        if (editing) {
            chain.extendMarkRange('link').setLink(attrs).run();
        } else if (needsText) {
            const label = text.value.trim() || href;
            chain.insertContent({ type: 'text', text: label, marks: [{ type: 'link', attrs }] }).run();
        } else {
            chain.setLink(attrs).run();
        }
    };

    dialog.form.addEventListener('submit', (event) => {
        event.preventDefault();
        apply();
    });
    if (editing) {
        dialog.actions.append(dialog.button(t('link_remove'), {
            className: 'tiptapeditor-dialog__button--danger',
            onClick: () => {
                dialog.close();
                editor.chain().focus().extendMarkRange('link').unsetLink().run();
            },
        }));
    }
    dialog.actions.append(
        dialog.button(t('cancel'), { onClick: () => dialog.close() }),
        dialog.button(t('save'), { primary: true, onClick: apply }),
    );
    // Enter in a text field submits; the hidden submit keeps that standard behaviour.
    const submit = createElement('button', '', { type: 'submit', hidden: '', tabindex: '-1' });
    dialog.form.append(submit);

    dialog.open(searchFirst ? null : url);
    if (searchFirst) {
        search.toggle(true);
    }
    return dialog;
}

/**
 * Resource search inside the dialog: a search box and a listbox of results. Arrow keys move
 * through results, Enter picks one. Requests are debounced and limited by the server.
 */
function createResourceSearch(dialog, context, { trigger, onPick }) {
    const { t, config } = context;
    const el = createElement('div', 'tiptapeditor-dialog__search');
    el.hidden = true;
    const input = dialog.input('search', {
        placeholder: t('link_resource_placeholder'),
        role: 'combobox',
        'aria-autocomplete': 'list',
        'aria-expanded': 'false',
        'aria-label': t('link_resource'),
    });
    const list = createElement('ul', 'tiptapeditor-dialog__results', { role: 'listbox', 'aria-label': t('link_resource') });
    list.id = `${dialog.window.getAttribute('aria-labelledby')}-results`;
    input.setAttribute('aria-controls', list.id);
    const status = createElement('div', 'tiptapeditor-dialog__hint', { 'aria-live': 'polite' });
    el.append(input, status, list);

    let results = [];
    let active = -1;
    let request = 0;

    const render = () => {
        list.textContent = '';
        results.forEach((resource, index) => {
            const option = createElement('li', 'tiptapeditor-dialog__result', {
                role: 'option',
                id: `${list.id}-${index}`,
                'aria-selected': String(index === active),
            });
            const name = createElement('span', 'tiptapeditor-dialog__result-title');
            name.textContent = resource.pagetitle || `#${resource.id}`;
            const meta = createElement('span', 'tiptapeditor-dialog__result-meta');
            meta.textContent = `${resource.id} · ${resource.context_key}${resource.uri ? ` · ${resource.uri}` : ''}${resource.published ? '' : ` · ${t('link_unpublished')}`}`;
            option.append(name, meta);
            option.addEventListener('mousedown', (event) => event.preventDefault());
            option.addEventListener('click', () => onPick(resource));
            list.append(option);
        });
        input.setAttribute('aria-expanded', String(results.length > 0));
        if (active >= 0) {
            input.setAttribute('aria-activedescendant', `${list.id}-${active}`);
            list.children[active]?.scrollIntoView?.({ block: 'nearest' });
        } else {
            input.removeAttribute('aria-activedescendant');
        }
    };

    const run = debounce(async () => {
        const query = input.value.trim();
        const current = ++request;
        if (!/^\d+$/.test(query) && query.length < 2) {
            results = [];
            active = -1;
            status.textContent = '';
            render();
            return;
        }
        status.textContent = t('link_searching');
        try {
            const found = await searchResources(config, query);
            if (current !== request) {
                return;
            }
            results = found;
            active = found.length ? 0 : -1;
            status.textContent = found.length ? '' : t('link_no_results');
        } catch (error) {
            context.logger?.debug('resource search failed', error);
            if (current === request) {
                results = [];
                active = -1;
                status.textContent = t('link_search_failed');
            }
        }
        render();
    }, SEARCH_DELAY);

    input.addEventListener('input', run);
    input.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (results.length) {
                active = (active + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
                render();
            }
        } else if (event.key === 'Enter') {
            event.preventDefault(); // never submits the dialog from the search box
            if (results[active]) {
                onPick(results[active]);
            }
        }
    });

    return {
        el,
        input,
        toggle(open) {
            el.hidden = !open;
            trigger.setAttribute('aria-expanded', String(open));
            if (open) {
                input.focus();
            }
        },
    };
}
