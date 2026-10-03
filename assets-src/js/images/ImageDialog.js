import { NodeSelection } from '@tiptap/pm/state';
import { cleanHref, parseClassPresets } from '../links/links.js';
import { browseFile, canBrowse, fileUrl, folderOf, hasFileType, IMAGE_FILE_TYPES, previewUrl } from '../modx/MediaBrowser.js';
import { Dialog } from '../ui/Dialog.js';
import { createElement } from '../utils/dom.js';
import { DEFAULT_ALIGN_CLASSES, dimension, splitImageClasses, updatedImageClass } from './classes.js';
import { lightboxAttribute, lightboxLabel } from './gallery.js';

const DATA_URL = /^\s*data:/i;

const IMAGE_TYPES = new Set(['image', 'figureImage']);

/** The selected image: an inline image or the picture of a figure. */
function selectedImage(editor) {
    const { selection } = editor.state;
    return selection instanceof NodeSelection && IMAGE_TYPES.has(selection.node.type.name)
        ? { pos: selection.from, node: selection.node }
        : null;
}

/** The figure around a figureImage at pos: { pos, node }. */
function figureAt(editor, pos) {
    const $pos = editor.state.doc.resolve(pos);
    return $pos.parent.type.name === 'figure' ? { pos: $pos.before(), node: $pos.parent } : null;
}

function captionOf(figure) {
    return figure && figure.node.childCount > 1 ? figure.node.child(1).textContent : '';
}

/**
 * Attributes of the link that opens the image larger (tiptapeditor.lightbox): href (the image,
 * unless the link pointed elsewhere already), the lightbox attribute without a value
 * (tiptapeditor.lightbox_attribute, e.g. data-fancybox) and an aria-label. Other attributes of
 * an existing link stay.
 */
export function lightboxLink(old, { src, previousSrc, text }, config, t) {
    const link = {};
    link.href = old?.href && old.href !== previousSrc ? old.href : src;
    const attribute = lightboxAttribute(config.lightboxAttribute);
    if (attribute) {
        link[attribute] = old?.[attribute] ?? '';
    }
    const label = lightboxLabel(config.lightboxLabel || t('lightbox_label'), text);
    if (label) {
        link['aria-label'] = label;
    }
    return { ...(old || {}), ...link };
}

function figureJson(attrs, caption) {
    return {
        type: 'figure',
        content: [
            { type: 'figureImage', attrs },
            ...(caption ? [{ type: 'figcaption', content: [{ type: 'text', text: caption }] }] : []),
        ],
    };
}

/**
 * Image dialog: URL (with the Media Browser), alt, title, width, height (with the image's
 * natural size as a suggestion, never applied by itself), alignment, style preset and other
 * classes. Edits the selected image, or inserts a new one when none is selected.
 *
 * @param {import('@tiptap/core').Editor} editor
 * @param {object} context ({ t, config, message, logger })
 */
export function openImageDialog(editor, context) {
    if (!editor.isEditable) {
        return null;
    }
    const { t, config } = context;
    const target = selectedImage(editor);
    const attrs = target ? target.node.attrs : {};
    const presets = parseClassPresets(config.imageClasses);
    const alignClasses = { ...DEFAULT_ALIGN_CLASSES, ...(config.imageAlignClasses || {}) };
    const parts = splitImageClasses(attrs.class, presets, alignClasses);

    const dialog = new Dialog({ title: t(target ? 'image_edit' : 'image_insert'), t, className: 'tiptapeditor-dialog--image' });

    const url = dialog.field(t('image_url'), dialog.input('text', { value: attrs.src || '' }));
    const preview = createElement('div', 'tiptapeditor-dialog__preview');
    const previewImg = createElement('img', '', { alt: '' });
    const natural = createElement('div', 'tiptapeditor-dialog__hint', { 'aria-live': 'polite' });
    preview.append(previewImg);
    const tools = createElement('div', 'tiptapeditor-dialog__tools');
    url.parentElement.append(tools, preview, natural);
    if (canBrowse(config)) {
        tools.append(dialog.button(t('image_browse'), { onClick: () => browse() }));
    }
    // Upload from the computer and "copy to the site" store the file in tiptapeditor.upload_path.
    if (canUpload(context)) {
        tools.append(dialog.button(t('image_upload_button'), { onClick: () => uploadFromComputer() }));
    }
    let importButton = null;
    if (canImport(context)) {
        importButton = dialog.button(t('image_import_button'), { onClick: () => importFromUrl() });
        importButton.title = t('image_url_import_hint');
        tools.append(importButton);
    }
    const status = createElement('div', 'tiptapeditor-dialog__hint', { 'aria-live': 'polite' });
    tools.after(status);

    const alt = dialog.field(t('image_alt'), dialog.input('text', { value: attrs.alt ?? '' }), { hint: t('image_alt_hint') });
    const title = dialog.field(t('image_title'), dialog.input('text', { value: attrs.title ?? '' }));
    const figure = target?.node.type.name === 'figureImage' ? figureAt(editor, target.pos) : null;
    const captionText = captionOf(figure);
    const caption = dialog.field(t('image_caption'), dialog.input('text', { value: captionText }), { hint: t('image_caption_hint') });
    const lightbox = dialog.field(t('image_lightbox'), dialog.input('checkbox'));
    lightbox.checked = figure ? Boolean(attrs.link) : (!target && Boolean(config.lightbox));

    const sizeRow = createElement('div', 'tiptapeditor-dialog__row');
    dialog.form.append(sizeRow);
    const width = dialog.field(t('image_width'), dialog.input('text', { value: attrs.width ?? '', inputmode: 'numeric' }));
    const height = dialog.field(t('image_height'), dialog.input('text', { value: attrs.height ?? '', inputmode: 'numeric' }));
    sizeRow.append(width.parentElement, height.parentElement);
    const useNatural = dialog.button('', { onClick: () => applyNatural() });
    useNatural.hidden = true;
    sizeRow.append(useNatural);

    const align = dialog.field(t('image_align'), dialog.select([
        { value: '', label: t('image_align_none') },
        { value: 'left', label: t('align_left') },
        { value: 'center', label: t('align_center') },
        { value: 'right', label: t('align_right') },
    ], parts.align));
    let preset = null;
    if (presets.length) {
        preset = dialog.field(t('image_style'), dialog.select([{ value: '', label: t('image_style_none') }, ...presets], parts.preset));
    }
    const other = dialog.field(t(presets.length ? 'image_other_classes' : 'image_class'), dialog.input('text', { value: parts.other }));

    let naturalSize = null;
    function showPreview() {
        const src = url.value.trim();
        naturalSize = null;
        useNatural.hidden = true;
        natural.textContent = '';
        if (!src || DATA_URL.test(src) || !cleanHref(src)) {
            previewImg.removeAttribute('src');
            preview.hidden = true;
            return;
        }
        preview.hidden = false;
        previewImg.src = previewUrl(src, config.siteBaseUrl);
    }
    previewImg.addEventListener('load', () => {
        if (!previewImg.naturalWidth) {
            return;
        }
        naturalSize = { width: previewImg.naturalWidth, height: previewImg.naturalHeight };
        const label = t('image_natural_size').replace('{width}', String(naturalSize.width)).replace('{height}', String(naturalSize.height));
        useNatural.textContent = label;
        useNatural.hidden = false;
    });
    previewImg.addEventListener('error', () => {
        natural.textContent = t('image_preview_failed');
    });
    function applyNatural() {
        if (naturalSize) {
            width.value = String(naturalSize.width);
            height.value = String(naturalSize.height);
        }
    }
    url.addEventListener('change', showPreview);
    showPreview();

    function useFile(src) {
        if (dialog.closed || typeof src !== 'string' || !src || DATA_URL.test(src)) {
            return;
        }
        dialog.error('');
        url.value = src;
        showPreview();
        url.focus();
    }

    function uploadFromComputer() {
        pickImageFile(async (file) => {
            if (!/^image\//.test(file.type)) {
                dialog.error(t('not_an_image'));
                return;
            }
            status.textContent = t('upload_progress');
            try {
                useFile(await context.upload(file, { editor }));
            } catch (error) {
                context.logger?.debug('upload failed', error);
                dialog.error(`${t('upload_failed')} ${error?.message || ''}`.trim());
            } finally {
                status.textContent = '';
            }
        });
    }

    async function importFromUrl() {
        const value = url.value.trim();
        if (!/^https?:\/\/\S+$/i.test(value)) {
            dialog.error(t('image_import_err_url'));
            url.focus();
            return;
        }
        importButton.disabled = true;
        status.textContent = t('image_url_import_progress');
        try {
            useFile(await context.importImage(value));
        } catch (error) {
            context.logger?.debug('image import failed', error);
            dialog.error(error?.message || t('image_import_err_download'));
        } finally {
            importButton.disabled = false;
            status.textContent = '';
        }
    }

    async function browse() {
        const file = await browseFile({
            source: config.mediaSource,
            context: config.resource?.context,
            fileTypes: IMAGE_FILE_TYPES,
            openTo: folderOf(url.value, config.mediaSource, config.siteBaseUrl),
        });
        if (dialog.closed) {
            return;
        }
        if (file && !hasFileType(file, IMAGE_FILE_TYPES)) {
            dialog.error(t('not_an_image'));
        } else if (file) {
            dialog.error('');
            url.value = fileUrl(file, config.mediaUrlMode, config.siteBaseUrl);
            showPreview();
        }
        url.focus();
    }

    const apply = () => {
        const src = url.value.trim();
        if (!src) {
            dialog.error(t('image_url_required'));
            url.focus();
            return;
        }
        if (DATA_URL.test(src) || !cleanHref(src)) {
            dialog.error(t('image_url_unsafe'));
            url.focus();
            return;
        }
        const w = dimension(width.value);
        const h = dimension(height.value);
        if (w === undefined || h === undefined) {
            dialog.error(t('image_size_invalid'));
            (w === undefined ? width : height).focus();
            return;
        }
        const values = {
            src,
            alt: alt.value,
            title: title.value.trim() || null,
            width: w,
            height: h,
            class: updatedImageClass(attrs.class, { align: align.value, preset: preset?.value || '', other: other.value }, presets, alignClasses),
        };
        // Keep an existing empty title="" (or none) as it was when the field stays empty.
        if (target && !values.title && attrs.title === '') {
            values.title = '';
        }
        const captionValue = caption.value.trim();
        const zoom = lightbox.checked;
        dialog.close();
        const unchanged = target && Object.keys(values).every((key) => (values[key] ?? null) === (attrs[key] ?? null))
            && captionValue === captionText.trim() && zoom === Boolean(attrs.link);
        if (unchanged) {
            // Nothing changed: leave the node (and its attribute order in the textarea) alone.
            editor.commands.focus();
            return;
        }
        const link = zoom
            ? lightboxLink(attrs.link, { src: values.src, previousSrc: attrs.src, text: values.alt || captionValue }, config, t)
            : null;
        const asFigure = Boolean(captionValue || zoom || figure?.node.attrs.extra);
        const imageAttrs = { ...values, extra: attrs.extra ?? null };
        if (target && editor.state.doc.nodeAt(target.pos)?.type.name !== target.node.type.name) {
            return;
        }
        if (figure) {
            updateFigure(editor, figure, target.pos, { imageAttrs, link, caption: captionValue, captionText, asFigure });
        } else if (target && asFigure) {
            imageToFigure(editor, target.pos, figureJson({ ...imageAttrs, link }, captionValue));
        } else if (target) {
            editor.chain().focus().setNodeSelection(target.pos).updateAttributes('image', values).run();
        } else if (asFigure) {
            editor.chain().focus().insertContent(figureJson({ ...imageAttrs, link }, captionValue)).run();
        } else {
            editor.chain().focus().insertContent({ type: 'image', attrs: values }).run();
        }
    };

    dialog.form.addEventListener('submit', (event) => {
        event.preventDefault();
        apply();
    });
    if (target) {
        dialog.actions.append(dialog.button(t('image_remove'), {
            className: 'tiptapeditor-dialog__button--danger',
            onClick: () => {
                dialog.close();
                if (figure) {
                    editor.chain().focus().deleteRange({ from: figure.pos, to: figure.pos + figure.node.nodeSize }).run();
                } else {
                    editor.chain().focus().setNodeSelection(target.pos).deleteSelection().run();
                }
            },
        }));
    }
    dialog.actions.append(
        dialog.button(t('cancel'), { onClick: () => dialog.close() }),
        dialog.button(t('save'), { primary: true, onClick: apply }),
    );
    const submit = createElement('button', '', { type: 'submit', hidden: '', tabindex: '-1' });
    dialog.form.append(submit);
    dialog.open(target ? alt : url);
    return dialog;
}

/** Edits a figure: its picture, link and caption; without caption and link it becomes an inline image again. */
function updateFigure(editor, figure, imagePos, { imageAttrs, link, caption, captionText, asFigure }) {
    const { state } = editor;
    const { schema } = state;
    let tr = state.tr;
    if (!asFigure) {
        const paragraph = schema.nodes.paragraph.create(null, schema.nodes.image.create(imageAttrs));
        tr = tr.replaceWith(figure.pos, figure.pos + figure.node.nodeSize, paragraph);
        editor.view.dispatch(tr);
        editor.commands.focus();
        return;
    }
    tr = tr.setNodeMarkup(imagePos, null, { ...imageAttrs, link });
    if (caption !== captionText.trim()) {
        const figureNode = tr.doc.nodeAt(figure.pos);
        const imageNode = figureNode.child(0);
        const captionPos = figure.pos + 1 + imageNode.nodeSize;
        const existing = figureNode.childCount > 1 ? figureNode.child(1) : null;
        const replacement = caption ? schema.nodes.figcaption.create(existing?.attrs, schema.text(caption)) : null;
        if (existing && replacement) {
            tr = tr.replaceWith(captionPos, captionPos + existing.nodeSize, replacement);
        } else if (existing) {
            tr = tr.delete(captionPos, captionPos + existing.nodeSize);
        } else if (replacement) {
            tr = tr.insert(captionPos, replacement);
        }
    }
    editor.view.dispatch(tr);
    editor.commands.focus();
}

/** Replaces an inline image by a figure: the paragraph when it held only the image, else after it. */
function imageToFigure(editor, pos, json) {
    const { state } = editor;
    const node = state.schema.nodeFromJSON(json);
    const $pos = state.doc.resolve(pos);
    const parent = $pos.parent;
    let tr = state.tr;
    if ($pos.depth > 0 && parent.childCount === 1 && parent.type.name === 'paragraph') {
        tr = tr.replaceWith($pos.before(), $pos.after(), node);
    } else if ($pos.depth > 0) {
        const after = $pos.after();
        tr = tr.insert(after, node).delete(pos, pos + 1);
    } else {
        tr = tr.replaceWith(pos, pos + 1, node);
    }
    editor.view.dispatch(tr);
    editor.commands.focus();
}

/**
 * Picks an image in the Media Browser. With an image selected, replaces only its file (the
 * browser opens in its folder); otherwise inserts the image and opens the dialog for alt,
 * size and the rest. Without a browsable Media Source the dialog opens for a URL.
 */
export async function browseImage(editor, context, { edit = true } = {}) {
    const { config } = context;
    if (!canBrowse(config)) {
        return openImageDialog(editor, context);
    }
    const target = selectedImage(editor);
    let file = null;
    try {
        file = await browseFile({
            source: config.mediaSource,
            context: config.resource?.context,
            fileTypes: IMAGE_FILE_TYPES,
            openTo: target ? folderOf(target.node.attrs.src, config.mediaSource, config.siteBaseUrl) : '',
        });
    } catch (error) {
        context.logger?.debug('media browser failed', error);
        context.message?.show(context.t('media_browser_failed'), 'error');
    }
    if (editor.isDestroyed) {
        return null;
    }
    if (file && !hasFileType(file, IMAGE_FILE_TYPES)) {
        // The MODX browser does not always apply the type filter; never put a PDF in an <img>.
        context.message?.show(context.t('not_an_image'), 'error');
        file = null;
    }
    const src = file && fileUrl(file, config.mediaUrlMode, config.siteBaseUrl);
    return placeImage(editor, context, src, { target, edit });
}

/**
 * Puts a stored image into the document, the same way for the Media Browser, an upload from
 * the computer and an image by URL: with an image selected only its file changes; otherwise
 * the image is inserted at the cursor and the dialog opens for alt, size and the rest.
 */
export function placeImage(editor, context, src, { target = selectedImage(editor), edit = true } = {}) {
    if (editor.isDestroyed) {
        return null;
    }
    if (!src) {
        editor.commands.focus();
        return null;
    }
    const current = target ? editor.state.doc.nodeAt(target.pos) : null;
    if (!current || !IMAGE_TYPES.has(current.type.name)) {
        target = null;
    }
    if (target) {
        // Only the file changes; alt, title, size and other attributes stay. A link that
        // opened the old file larger now opens the new one.
        const attrs = { src };
        if (current.type.name === 'figureImage' && current.attrs.link?.href === current.attrs.src) {
            attrs.link = { ...current.attrs.link, href: src };
        }
        editor.chain().focus().setNodeSelection(target.pos).updateAttributes(current.type.name, attrs).run();
        return null;
    }
    const { config, t } = context;
    if (config.lightbox) {
        // "Open larger" is on for new images: a figure with the link around the picture.
        const link = lightboxLink(null, { src, previousSrc: null, text: '' }, config, t);
        editor.view.focus();
        const before = editor.state.selection.from;
        editor.commands.insertContent(figureJson({ src, alt: '', title: '', link }, ''));
        if (!edit) {
            return null;
        }
        let found = null;
        editor.state.doc.nodesBetween(Math.max(0, before - 1), Math.min(editor.state.doc.content.size, editor.state.selection.from + 2), (node, pos) => {
            if (!found && node.type.name === 'figureImage' && node.attrs.src === src) {
                found = pos;
            }
        });
        if (found !== null) {
            editor.commands.setNodeSelection(found);
            return openImageDialog(editor, context);
        }
        return null;
    }
    const position = editor.state.selection.from;
    if (!edit) {
        editor.chain().focus().setImage({ src, alt: '', title: '' }).run();
        return null;
    }
    // Tiptap's focus() is deferred to the next frame and would pull the focus out of the
    // dialog opened below; focus the view right away instead, so the dialog returns there.
    editor.view.focus();
    editor.commands.setImage({ src, alt: '', title: '' });
    // Select the new image and let the user describe it.
    const pos = editor.state.doc.nodeAt(position)?.type.name === 'image' ? position : editor.state.selection.from - 1;
    if (editor.state.doc.nodeAt(pos)?.type.name === 'image') {
        editor.commands.setNodeSelection(pos);
        return openImageDialog(editor, context);
    }
    return null;
}

/** Opens the file picker; calls back with the chosen file(s). */
export function pickImageFile(onPick, { multiple = false } = {}) {
    const input = createElement('input', '', { type: 'file', accept: 'image/*', hidden: '' });
    input.multiple = multiple;
    const done = () => input.remove();
    input.addEventListener('cancel', done);
    input.addEventListener('change', () => {
        const files = [...(input.files || [])];
        done();
        if (files.length) {
            onPick(multiple ? files : files[0]);
        }
    });
    document.body.append(input);
    input.click();
    return input;
}

/** Uploads stay possible for this field: tiptapeditor.upload_enabled (or a runtime uploadHandler). */
export function canUpload(context) {
    return typeof context?.upload === 'function';
}

export function canImport(context) {
    return typeof context?.importImage === 'function';
}

/**
 * "Image from computer": a file picker, then the upload into tiptapeditor.upload_path of the
 * field's Media Source (modx/upload.js), then the same placement as the Media Browser.
 * The selection at the time of the click decides insert or replace.
 */
export function uploadImage(editor, context) {
    if (!editor.isEditable || !canUpload(context)) {
        return null;
    }
    const { t, message } = context;
    const target = selectedImage(editor);
    const input = createElement('input', '', { type: 'file', accept: 'image/*', hidden: '' });
    const done = () => input.remove();
    input.addEventListener('cancel', done);
    input.addEventListener('change', async () => {
        const file = input.files?.[0];
        done();
        if (!file) {
            return;
        }
        if (!/^image\//.test(file.type)) {
            message?.show(t('not_an_image'), 'error');
            return;
        }
        message?.show(t('upload_progress'), 'info', 60000);
        let src = '';
        try {
            src = await context.upload(file, { editor });
            message?.hide();
        } catch (error) {
            context.logger?.debug('upload failed', error);
            message?.show(`${t('upload_failed')} ${error?.message || ''}`.trim(), 'error');
            return;
        }
        if (typeof src !== 'string' || DATA_URL.test(src)) {
            return;
        }
        placeImage(editor, context, src, { target });
    });
    document.body.append(input);
    input.click();
    return input;
}

/**
 * "Image by URL": the server downloads the picture into tiptapeditor.upload_path (only public
 * http(s) addresses, images only, upload_maxsize), then the same placement as the Media Browser.
 * The page never loads the remote address itself.
 */
export function openImageUrlDialog(editor, context) {
    if (!editor.isEditable || !canImport(context)) {
        return null;
    }
    const { t } = context;
    const target = selectedImage(editor);
    const dialog = new Dialog({ title: t('image_url_import'), t, className: 'tiptapeditor-dialog--image-url' });
    const url = dialog.field(t('image_url'), dialog.input('url', { value: '', placeholder: 'https://' }), { hint: t('image_url_import_hint') });
    const status = createElement('div', 'tiptapeditor-dialog__hint', { 'aria-live': 'polite' });
    url.parentElement.append(status);
    const save = dialog.button(t('image_url_import_button'), { primary: true, onClick: () => apply() });
    let busy = false;

    const apply = async () => {
        if (busy) {
            return;
        }
        const value = url.value.trim();
        if (!/^https?:\/\/[^\s]+$/i.test(value)) {
            dialog.error(t('image_import_err_url'));
            url.focus();
            return;
        }
        busy = true;
        save.disabled = true;
        dialog.error('');
        status.textContent = t('image_url_import_progress');
        try {
            const src = await context.importImage(value);
            if (dialog.closed) {
                return;
            }
            dialog.close();
            placeImage(editor, context, src, { target });
        } catch (error) {
            context.logger?.debug('image import failed', error);
            if (!dialog.closed) {
                dialog.error(error?.message || t('image_import_err_download'));
                url.focus();
            }
        } finally {
            busy = false;
            save.disabled = false;
            status.textContent = '';
        }
    };

    dialog.form.addEventListener('submit', (event) => {
        event.preventDefault();
        apply();
    });
    dialog.actions.append(dialog.button(t('cancel'), { onClick: () => dialog.close() }), save);
    const submit = createElement('button', '', { type: 'submit', hidden: '', tabindex: '-1' });
    dialog.form.append(submit);
    dialog.open(url);
    return dialog;
}
