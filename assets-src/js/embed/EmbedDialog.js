import { Dialog } from '../ui/Dialog.js';
import { createElement } from '../utils/dom.js';
import { allowedAttributes, allowedHosts, filterAttributes, isAllowedSrc, parseEmbedInput } from './embed.js';

const SIZE = /^\d{1,4}(%|px)?$/;

/**
 * Embed dialog: a video page URL (YouTube, VK Video, Rutube or a registered provider), an
 * embed URL or a pasted <iframe> code, plus size, title and fullscreen. On a selected iframe
 * it edits that iframe and keeps its other attributes.
 *
 * @param {import('@tiptap/core').Editor} editor
 * @param {object} context ({ t, config })
 */
export function openEmbedDialog(editor, context) {
    if (!editor.isEditable || !editor.schema.nodes.iframe) {
        return null;
    }
    const { t, config } = context;
    const { selection } = editor.state;
    const editing = selection.node?.type.name === 'iframe' ? selection.node : null;
    const current = editing ? { ...editing.attrs.attributes } : {};
    const allowed = allowedAttributes(config.iframeAllowedAttributes);
    const hosts = allowedHosts(config.iframeAllowedHosts);

    const dialog = new Dialog({ title: t(editing ? 'embed_edit' : 'embed_insert'), t, className: 'tiptapeditor-dialog--embed' });
    const url = dialog.field(t('embed_url'), dialog.input('text', { value: current.src || '' }), { hint: t('embed_url_hint') });
    const sizeRow = createElement('div', 'tiptapeditor-dialog__row');
    dialog.form.append(sizeRow);
    const width = dialog.field(t('image_width'), dialog.input('text', { value: editing ? (current.width || '') : '560', inputmode: 'numeric' }));
    const height = dialog.field(t('image_height'), dialog.input('text', { value: editing ? (current.height || '') : '315', inputmode: 'numeric' }));
    sizeRow.append(width.parentElement, height.parentElement);
    const title = allowed.has('title') ? dialog.field(t('link_title'), dialog.input('text', { value: current.title || '' })) : null;
    let fullscreen = null;
    if (allowed.has('allowfullscreen')) {
        fullscreen = dialog.field(t('embed_fullscreen'), dialog.input('checkbox'));
        fullscreen.checked = editing ? 'allowfullscreen' in current : true;
    }

    const apply = () => {
        const parsed = parseEmbedInput(url.value);
        if (!parsed || !isAllowedSrc(parsed.src, hosts)) {
            dialog.error(t(parsed && hosts.length ? 'embed_host_not_allowed' : 'embed_invalid'));
            url.focus();
            return;
        }
        for (const input of [width, height]) {
            if (input.value.trim() && !SIZE.test(input.value.trim())) {
                dialog.error(t('embed_size_invalid'));
                input.focus();
                return;
            }
        }
        // Editing keeps the iframe's other attributes and their order; new embeds get defaults.
        const base = editing ? { ...current } : {
            src: '', width: '', height: '', title: '',
            allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
            allowfullscreen: '', loading: 'lazy',
        };
        const next = { ...base, ...(editing ? {} : parsed.attributes), src: parsed.src };
        const set = (name, value) => {
            if (value === null || value === '') {
                delete next[name];
            } else {
                next[name] = value;
            }
        };
        set('width', width.value.trim());
        set('height', height.value.trim());
        if (title) {
            set('title', title.value.trim());
        }
        if (fullscreen) {
            // A boolean attribute: present (empty value) or absent.
            if (fullscreen.checked) {
                next.allowfullscreen = '';
            } else {
                delete next.allowfullscreen;
            }
        }
        const attributes = filterAttributes(next, allowed);
        dialog.close();
        if (editing) {
            editor.chain().focus().updateAttributes('iframe', { attributes }).run();
        } else {
            editor.chain().focus().insertContent({ type: 'iframe', attrs: { attributes } }).run();
        }
    };

    dialog.form.addEventListener('submit', (event) => {
        event.preventDefault();
        apply();
    });
    if (editing) {
        dialog.actions.append(dialog.button(t('embed_remove'), {
            className: 'tiptapeditor-dialog__button--danger',
            onClick: () => {
                dialog.close();
                editor.chain().focus().deleteSelection().run();
            },
        }));
    }
    dialog.actions.append(
        dialog.button(t('cancel'), { onClick: () => dialog.close() }),
        dialog.button(t(editing ? 'save' : 'embed_insert_button'), { primary: true, onClick: apply }),
    );
    const submit = createElement('button', '', { type: 'submit', hidden: '', tabindex: '-1' });
    dialog.form.append(submit);
    dialog.open(url);
    return dialog;
}
