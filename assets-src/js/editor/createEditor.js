import { Editor, getSchema } from '@tiptap/core';
import { ContentKeptAsSource } from '../syntax/errors.js';
import { findLosses } from '../syntax/LossDetector.js';
import { preprocess } from '../syntax/preprocess.js';
import { prepareContent, serialize } from '../syntax/serialize.js';
import { browseImage, openImageDialog } from '../images/ImageDialog.js';
import { createImageMenu } from '../images/ImageMenu.js';
import { openLinkDialog } from '../links/LinkDialog.js';
import { openEmbedDialog } from '../embed/EmbedDialog.js';
import { canBrowse } from '../modx/MediaBrowser.js';
import { createImportHandler, createUploadHandler } from '../modx/upload.js';
import { openGalleryDialog } from '../images/GalleryDialog.js';
import { createMenus } from '../ui/Menus.js';
import { StatusBar } from '../ui/StatusBar.js';
import { Fullscreen } from '../ui/Fullscreen.js';
import { Message } from '../ui/Message.js';
import { openCodeDialog } from '../ui/CodeDialog.js';
import { SourceView } from '../ui/SourceView.js';
import { applyContentCss } from '../ui/contentCss.js';
import { Toolbar } from '../ui/Toolbar.js';
import { TABLE_BAR } from '../ui/toolbarItems.js';
import { createElement } from '../utils/dom.js';
import { buildExtensions } from './extensions.js';

export { ContentKeptAsSource };

function applyHeight(content, config) {
    const px = (value) => `${Math.max(0, Number(value) || 0)}px`;
    content.style.minHeight = px(config.minHeight);
    if (config.autogrow) {
        if (Number(config.maxHeight) > 0) {
            content.style.maxHeight = px(config.maxHeight);
        }
    } else {
        content.style.height = px(Math.max(config.defaultHeight, config.minHeight));
    }
}

/**
 * Builds the editor UI next to the textarea. The textarea itself is not changed here;
 * the caller hides it only after this function returned successfully.
 *
 * @param {HTMLTextAreaElement} textarea
 * @param {object} config resolved configuration
 * @param {(key: string) => string} t translator
 * @param {object} [logger]
 * @returns {{ editor: Editor, root: HTMLElement, source: SourceView, dispose: () => void }}
 */
export function createEditor(textarea, config, t, logger) {
    const content = prepareContent(textarea.value);

    const root = createElement('div', 'tiptapeditor', { 'data-tiptapeditor-for': textarea.id || '' });
    root.classList.toggle('tiptapeditor--sticky-toolbar', Boolean(config.stickyToolbar));
    const contentEl = createElement('div', 'tiptapeditor__content');
    root.append(contentEl);
    applyHeight(contentEl, config);
    // Site CSS (tiptapeditor.content_css), scoped to this editing area; loads in the background.
    applyContentCss(root, config.contentCss, logger);
    textarea.after(root);
    const message = new Message(root);
    // Filled in once the UI exists; extensions (Mod+K, image menu) call through it.
    const ui = {};
    const imageMenu = config.features?.images !== false ? createImageMenu(ui, t) : null;
    // Bubble and floating menus stay away while the source view is open.
    const menus = createMenus(config, t, { blocked: () => Boolean(ui.context?.source?.active) });

    const uploadHandler = typeof config.uploadHandler === 'function' ? config.uploadHandler : createUploadHandler(config, t);

    let editor;
    try {
        const extensions = [
            ...buildExtensions(config, {
                ui,
                t,
                logger,
                imageMenu: imageMenu?.extension,
                menus: menus.extensions,
                uploadHandler,
                onUploadBlocked: (reason) => message.show(t(reason === 'images_only' ? 'upload_images_only' : 'upload_not_configured')),
                onUploading: () => message.show(t('upload_progress'), 'info', 60000),
                onUploaded: () => message.hide(),
                onUploadError: (error) => {
                    logger?.debug('upload failed', error);
                    message.show(`${t('upload_failed')} ${error?.message || ''}`.trim(), 'error');
                },
                onPasteImagesRemoved: () => message.show(t(config.uploadEnabled ? 'paste_images_removed_upload' : 'paste_images_removed')),
            }),
            ...(config.extensions || []),
        ];
        // MODX/Fenom tokens and HTML the editor cannot represent are protected before parsing.
        const prepared = preprocess(content, {
            schema: getSchema(extensions),
            modx: Boolean(config.protectModxSyntax),
            fenom: Boolean(config.protectFenomSyntax),
            fenomTags: config.fenomTags,
            ignoreStyle: config.preserveStyleAttribute === false,
        });
        editor = new Editor({
            element: contentEl,
            extensions,
            content: prepared,
            editable: config.editable !== false,
            editorProps: {
                attributes: {
                    // From the external config (editorProps.attributes, filtered to safe names).
                    ...config.editorAttributes,
                    class: `tiptapeditor__editable ${config.editorAttributes?.class || ''}`.trim(),
                    role: 'textbox',
                    'aria-multiline': 'true',
                    'aria-label': t('editor_label'),
                },
            },
        });

        const losses = findLosses(content, serialize(editor), { ignoreStyle: config.preserveStyleAttribute === false });
        if (losses.length) {
            throw new ContentKeptAsSource('content_kept_as_source', losses);
        }
    } catch (error) {
        editor?.destroy();
        root.remove();
        throw error;
    }

    let toolbar;
    let tableBar;
    let fullscreen;
    let source;
    let statusBar;
    let showTableBar = () => {};
    try {
        fullscreen = new Fullscreen(root, {
            onChange: () => {
                toolbar?.update();
                if (source?.active) {
                    source.el.focus();
                } else {
                    editor.commands.focus();
                }
            },
        });
        source = new SourceView({
            root,
            contentEl,
            editor,
            textarea,
            config,
            t,
            onChange: (active) => {
                showTableBar();
                toolbar?.update();
                if (!active) {
                    editor.view.focus();
                }
            },
        });
        const context = { t, fullscreen, source, logger, config, message, upload: uploadHandler, importImage: createImportHandler(config) };
        ui.context = context;
        ui.openLink = () => Boolean(openLinkDialog(editor, context));
        ui.openImage = () => Boolean(openImageDialog(editor, context));
        ui.replaceImage = () => browseImage(editor, context);
        ui.editGallery = () => Boolean(openGalleryDialog(editor, context));
        ui.removeImage = () => editor.chain().focus().deleteSelection().run();
        ui.canBrowse = () => canBrowse(config);
        ui.editCode = () => Boolean(openCodeDialog(editor, context));
        ui.editEmbed = () => Boolean(openEmbedDialog(editor, context));
        toolbar = new Toolbar(editor, config, context);
        // Toolbars share one (sticky) container: the main toolbar and, while the cursor is in
        // a table, the table toolbar under it.
        const bars = createElement('div', 'tiptapeditor__bars');
        if (!toolbar.isEmpty) {
            bars.append(toolbar.el);
        }
        if (config.features?.tables !== false && editor.schema.nodes.table) {
            tableBar = new Toolbar(editor, { ...config, toolbar: TABLE_BAR }, context, {
                className: 'tiptapeditor__toolbar--table',
                label: 'table_toolbar',
            });
            tableBar.el.hidden = true;
            bars.append(tableBar.el);
            showTableBar = () => {
                const show = editor.isEditable && editor.isActive('table');
                if (tableBar.el.hidden === show) {
                    tableBar.el.hidden = !show;
                }
            };
            editor.on('transaction', showTableBar);
            showTableBar();
        }
        if (bars.childElementCount) {
            root.prepend(bars);
        }
        menus.mount(editor, context);
        if (config.statusbar) {
            statusBar = new StatusBar(root, editor, t);
            // Under the text, above status messages.
            contentEl.after(statusBar.el);
        }
    } catch (error) {
        statusBar?.destroy();
        menus.destroy();
        tableBar?.destroy();
        toolbar?.destroy();
        source?.destroy();
        fullscreen?.destroy();
        editor.destroy();
        root.remove();
        throw error;
    }

    const dispose = () => {
        editor.off('transaction', showTableBar);
        statusBar?.destroy();
        menus.destroy();
        tableBar?.destroy();
        toolbar.destroy();
        source.destroy();
        fullscreen.destroy();
        message.destroy();
        imageMenu?.element.remove();
    };

    return { editor, root, source, dispose };
}
