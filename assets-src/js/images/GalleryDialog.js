import { NodeSelection } from '@tiptap/pm/state';
import { browseFiles, canBrowse, fileUrl, hasFileType, IMAGE_FILE_TYPES, previewUrl } from '../modx/MediaBrowser.js';
import { Dialog } from '../ui/Dialog.js';
import { createElement } from '../utils/dom.js';
import { galleryTemplates, newGroup } from './gallery.js';

function selectedGallery(editor) {
    const { selection } = editor.state;
    return selection instanceof NodeSelection && selection.node.type.name === 'gallery'
        ? { pos: selection.from, node: selection.node }
        : null;
}

function normalized(attrs) {
    return JSON.stringify({
        template: attrs.template,
        items: (attrs.items || []).map((item) => ({ ...item, alt: item.alt ?? '', caption: String(item.caption || '').trim() })),
        lightbox: Boolean(attrs.lightbox),
        group: attrs.group ?? null,
        wrapper: attrs.wrapper ?? null,
    });
}

function iconButton(dialog, label, text, onClick) {
    const button = dialog.button(text, { onClick, className: 'tiptapeditor-gallery-list__button' });
    button.setAttribute('aria-label', label);
    button.title = label;
    return button;
}

/**
 * Gallery dialog: the pictures (from the Media Browser, several at once, or uploaded from the
 * computer into upload_path), their order, alt text and caption, the template
 * (tiptapeditor.gallery_template / gallery_templates) and "open larger" (tiptapeditor.lightbox).
 *
 * @param {import('@tiptap/core').Editor} editor
 * @param {object} context ({ t, config, message, logger, upload })
 */
export function openGalleryDialog(editor, context) {
    if (!editor.isEditable) {
        return null;
    }
    const { t, config } = context;
    const target = selectedGallery(editor);
    const attrs = target?.node.attrs || {};
    const { templates } = galleryTemplates(config.galleryTemplates);
    const items = (attrs.items || []).map((item) => ({ ...item }));

    const dialog = new Dialog({ title: t(target ? 'gallery_edit' : 'gallery_insert'), t, className: 'tiptapeditor-dialog--gallery' });

    const list = createElement('ol', 'tiptapeditor-gallery-list');
    const empty = createElement('p', 'tiptapeditor-dialog__hint');
    empty.textContent = t('gallery_empty');
    const tools = createElement('div', 'tiptapeditor-dialog__tools');
    dialog.form.append(tools, empty, list);
    const browseButton = canBrowse(config) ? dialog.button(t('gallery_add_browser'), { onClick: () => browse() }) : null;
    const uploadButton = typeof context.upload === 'function' ? dialog.button(t('gallery_add_upload'), { onClick: () => pickFiles() }) : null;
    tools.append(...[browseButton, uploadButton].filter(Boolean));
    // By URL: copied into upload_path when the field may upload, otherwise linked as it is.
    const urlRow = createElement('div', 'tiptapeditor-dialog__tools');
    const urlInput = createElement('input', 'tiptapeditor-dialog__input', { type: 'url', placeholder: 'https://', 'aria-label': t('image_url') });
    const urlButton = dialog.button(t(typeof context.importImage === 'function' ? 'image_import_button' : 'gallery_add_url'), { onClick: () => addUrl() });
    urlRow.append(urlInput, urlButton);
    tools.after(urlRow);
    urlInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            addUrl();
        }
    });
    const status = createElement('div', 'tiptapeditor-dialog__hint', { 'aria-live': 'polite' });
    tools.after(status);

    const names = Object.keys(templates);
    const chosen = names.includes(attrs.template) ? attrs.template
        : (names.includes(config.galleryTemplate) ? config.galleryTemplate : 'grid');
    const template = dialog.field(t('gallery_template'), dialog.select(
        names.map((name) => ({ value: name, label: t(templates[name].label) })),
        chosen,
    ));
    const lightbox = dialog.field(t('image_lightbox'), dialog.input('checkbox'));
    lightbox.checked = target ? Boolean(attrs.lightbox) : Boolean(config.lightbox);

    const hasCaption = () => templates[template.value]?.item.includes('{caption}');

    function render() {
        empty.hidden = items.length > 0;
        list.replaceChildren(...items.map((item, index) => {
            const row = createElement('li', 'tiptapeditor-gallery-list__item');
            const thumb = createElement('img', 'tiptapeditor-gallery-list__thumb', { alt: '' });
            thumb.src = previewUrl(item.src, config.siteBaseUrl);
            const fields = createElement('div', 'tiptapeditor-gallery-list__fields');
            const name = createElement('div', 'tiptapeditor-gallery-list__name');
            name.textContent = item.src.split('/').pop();
            const alt = createElement('input', 'tiptapeditor-dialog__input', { type: 'text', placeholder: t('image_alt'), 'aria-label': t('image_alt') });
            alt.value = item.alt ?? '';
            alt.addEventListener('input', () => { item.alt = alt.value; });
            const caption = createElement('input', 'tiptapeditor-dialog__input', { type: 'text', placeholder: t('image_caption'), 'aria-label': t('image_caption') });
            caption.value = item.caption ?? '';
            caption.hidden = !hasCaption();
            caption.addEventListener('input', () => { item.caption = caption.value; });
            fields.append(name, alt, caption);
            const actions = createElement('div', 'tiptapeditor-gallery-list__actions');
            const move = (delta) => () => {
                const to = index + delta;
                if (to < 0 || to >= items.length) {
                    return;
                }
                [items[index], items[to]] = [items[to], items[index]];
                render();
                list.children[to]?.querySelector(delta < 0 ? '[data-move="up"]' : '[data-move="down"]')?.focus();
            };
            const up = iconButton(dialog, t('gallery_move_up'), '↑', move(-1));
            up.dataset.move = 'up';
            up.disabled = index === 0;
            const down = iconButton(dialog, t('gallery_move_down'), '↓', move(1));
            down.dataset.move = 'down';
            down.disabled = index === items.length - 1;
            const remove = iconButton(dialog, t('gallery_remove_image'), '✕', () => {
                items.splice(index, 1);
                render();
            });
            actions.append(up, down, remove);
            row.append(thumb, fields, actions);
            return row;
        }));
    }
    template.addEventListener('change', render);

    function add(srcs) {
        for (const src of srcs) {
            if (src && !items.some((item) => item.src === src)) {
                items.push({ src, alt: '', caption: '' });
            }
        }
        dialog.error('');
        render();
    }

    async function browse() {
        let files = [];
        try {
            files = await browseFiles({
                source: config.mediaSource,
                context: config.resource?.context,
                fileTypes: IMAGE_FILE_TYPES,
            });
        } catch (error) {
            context.logger?.debug('media browser failed', error);
            dialog.error(t('media_browser_failed'));
        }
        if (dialog.closed) {
            return;
        }
        const images = files.filter((file) => hasFileType(file, IMAGE_FILE_TYPES));
        if (images.length < files.length) {
            dialog.error(t('not_an_image'));
        }
        add(images.map((file) => fileUrl(file, config.mediaUrlMode, config.siteBaseUrl)));
        (list.querySelector('input') || browseButton)?.focus();
    }

    async function addUrl() {
        const value = urlInput.value.trim();
        if (!/^(https?:\/\/|\/)?\S+$/i.test(value) || /^\s*(javascript|data|vbscript):/i.test(value)) {
            dialog.error(t('image_import_err_url'));
            urlInput.focus();
            return;
        }
        if (typeof context.importImage !== 'function') {
            add([value]);
            urlInput.value = '';
            return;
        }
        if (!/^https?:\/\//i.test(value)) {
            dialog.error(t('image_import_err_url'));
            urlInput.focus();
            return;
        }
        urlButton.disabled = true;
        status.textContent = t('image_url_import_progress');
        try {
            const src = await context.importImage(value);
            if (!dialog.closed) {
                add([src]);
                urlInput.value = '';
            }
        } catch (error) {
            context.logger?.debug('image import failed', error);
            if (!dialog.closed) {
                dialog.error(error?.message || t('image_import_err_download'));
            }
        } finally {
            urlButton.disabled = false;
            status.textContent = '';
        }
    }

    function pickFiles() {
        const input = createElement('input', '', { type: 'file', accept: 'image/*', multiple: '', hidden: '' });
        const done = () => input.remove();
        input.addEventListener('cancel', done);
        input.addEventListener('change', async () => {
            const files = [...(input.files || [])];
            done();
            const images = files.filter((file) => /^image\//.test(file.type));
            if (images.length < files.length) {
                dialog.error(t('not_an_image'));
            }
            const srcs = [];
            for (const [index, file] of images.entries()) {
                status.textContent = t('gallery_uploading').replace('{current}', String(index + 1)).replace('{count}', String(images.length));
                try {
                    const src = await context.upload(file, { editor });
                    if (typeof src === 'string' && src && !/^\s*data:/i.test(src)) {
                        srcs.push(src);
                    }
                } catch (error) {
                    context.logger?.debug('upload failed', error);
                    dialog.error(`${t('upload_failed')} ${error?.message || ''}`.trim());
                }
                if (dialog.closed) {
                    return;
                }
            }
            status.textContent = '';
            add(srcs);
        });
        document.body.append(input);
        input.click();
    }

    const apply = () => {
        if (!items.length) {
            dialog.error(t('gallery_empty'));
            return;
        }
        const next = {
            template: template.value,
            items: items.map((item) => ({ ...item, alt: item.alt ?? '', caption: String(item.caption || '').trim() })),
            lightbox: lightbox.checked,
            group: attrs.group || (lightbox.checked ? newGroup() : null),
            // Another template brings its own outer element.
            wrapper: template.value === attrs.template ? (attrs.wrapper ?? null) : null,
        };
        dialog.close();
        if (target) {
            if (normalized(next) === normalized(attrs)) {
                // Nothing changed: the gallery markup in the field stays as it was.
                editor.commands.focus();
                return;
            }
            editor.chain().focus().setNodeSelection(target.pos).updateAttributes('gallery', next).run();
        } else {
            editor.chain().focus().insertContent({ type: 'gallery', attrs: next }).run();
        }
    };

    dialog.form.addEventListener('submit', (event) => {
        event.preventDefault();
        apply();
    });
    if (target) {
        dialog.actions.append(dialog.button(t('gallery_remove'), {
            className: 'tiptapeditor-dialog__button--danger',
            onClick: () => {
                dialog.close();
                editor.chain().focus().setNodeSelection(target.pos).deleteSelection().run();
            },
        }));
    }
    dialog.actions.append(
        dialog.button(t('cancel'), { onClick: () => dialog.close() }),
        dialog.button(t(target ? 'save' : 'gallery_insert_button'), { primary: true, onClick: apply }),
    );
    const submit = createElement('button', '', { type: 'submit', hidden: '', tabindex: '-1' });
    dialog.form.append(submit);
    render();
    dialog.open(browseButton || uploadButton || urlInput);
    return dialog;
}

/** Gallery is possible for this field: a Media Source to browse or uploads. */
export function canMakeGallery(context) {
    return canBrowse(context.config) || typeof context.upload === 'function';
}
