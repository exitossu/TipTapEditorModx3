/**
 * Toolbar item registry.
 *
 * An item describes one control:
 *   name      unique key used in the toolbar setting
 *   type      'button' (default) | 'menu' (dropdown of options) | 'color' (palette popover)
 *   label     lexicon key (without "tiptapeditor.") for aria-label and tooltip
 *   icon      icon name (ui/icons.js)
 *   shortcut  shown in the tooltip, "Mod" = Ctrl or Cmd
 *   requires  extension name the item needs; the item is hidden when it is not loaded
 *   command   (chain, editor) => chain   used for running AND for editor.can() checks
 *   active    (editor) => boolean        aria-pressed state
 *   action    (editor, context) => void  for items that are not a plain command (dialogs, fullscreen)
 *   options   for 'menu': (editor, config) => [{ label, icon, command, active }]
 *
 * Third-party extras add items with TipTapEditor.registerToolbarItem(item).
 */

import { openAnchorDialog } from '../links/AnchorDialog.js';
import { openLinkDialog } from '../links/LinkDialog.js';
import { canImport, canUpload, openImageDialog, openImageUrlDialog, uploadImage } from '../images/ImageDialog.js';
import { openEmbedDialog } from '../embed/EmbedDialog.js';
import { canMakeGallery, openGalleryDialog } from '../images/GalleryDialog.js';
import { browseFile, canBrowse, fileUrl } from '../modx/MediaBrowser.js';
import { openTableDialog } from '../tables/TableDialog.js';
import { parseClassPresets } from '../links/links.js';
import { blockClassActive, setBlockClass } from '../utils/blockClass.js';

const items = new Map();

export function registerToolbarItem(item) {
    if (!item || typeof item.name !== 'string' || !item.name) {
        throw new TypeError('Toolbar item needs a name');
    }
    items.set(item.name, { type: 'button', ...item });
}

export function getToolbarItem(name) {
    return items.get(name) || null;
}

/** Case-insensitive lookup used by the toolbar setting parser. */
export function resolveToolbarItemName(token) {
    if (items.has(token)) {
        return token;
    }
    const lower = token.toLowerCase();
    for (const name of items.keys()) {
        if (name.toLowerCase() === lower) {
            return name;
        }
    }
    return null;
}

const mark = (name, label, icon, shortcut, command, requires = name) => ({
    name, label, icon, shortcut, requires,
    command,
    active: (editor) => editor.isActive(name),
});

const headingOption = (level) => ({
    label: `heading${level}`,
    icon: `heading${level}`,
    command: (chain) => chain.setHeading({ level }),
    active: (editor) => editor.isActive('heading', { level }),
});

const alignOption = (value, icon) => ({
    label: `align_${value}`,
    icon,
    command: (chain) => chain.setTextAlign(value),
    active: (editor) => editor.isActive({ textAlign: value }),
});

const ALIGN_OPTIONS = [
    alignOption('left', 'alignLeft'),
    alignOption('center', 'alignCenter'),
    alignOption('right', 'alignRight'),
    alignOption('justify', 'alignJustify'),
];

export const DEFAULT_COLORS = [
    '#000000', '#434343', '#666666', '#999999', '#c00000', '#e67e22', '#f1c40f',
    '#27ae60', '#16a085', '#2980b9', '#234368', '#8e44ad',
];

export const DEFAULT_HIGHLIGHTS = ['#fff3a3', '#ffd6a5', '#caffbf', '#9bf6ff', '#bdb2ff', '#ffc6ff'];

[
    { name: 'undo', label: 'undo', icon: 'undo', shortcut: 'Mod+Z', command: (c) => c.undo() },
    { name: 'redo', label: 'redo', icon: 'redo', shortcut: 'Mod+Shift+Z', command: (c) => c.redo() },
    {
        name: 'paragraph', label: 'paragraph', icon: 'pilcrow', shortcut: 'Mod+Alt+0',
        command: (c) => c.setParagraph(), active: (e) => e.isActive('paragraph'),
    },
    {
        name: 'heading', type: 'menu', label: 'heading', icon: 'heading',
        options: (editor, config) => [
            {
                label: 'paragraph', icon: 'pilcrow',
                command: (c) => c.setParagraph(), active: (e) => e.isActive('paragraph'),
            },
            ...config.headingLevels.map(headingOption),
        ],
    },
    ...[1, 2, 3, 4, 5, 6].map((level) => ({
        name: `h${level}`, label: `heading${level}`, icon: `heading${level}`, shortcut: `Mod+Alt+${level}`,
        level,
        command: (c) => c.toggleHeading({ level }),
        active: (e) => e.isActive('heading', { level }),
    })),
    {
        // Class presets for paragraphs and headings (tiptapeditor.paragraph_classes).
        name: 'paragraphClass', type: 'menu', label: 'paragraph_class', icon: 'paintbrush', requires: 'preservedAttributes',
        available: (config) => parseClassPresets(config.paragraphClasses).length > 0,
        options: (editor, config) => {
            const presets = parseClassPresets(config.paragraphClasses);
            const all = presets.map((preset) => preset.value);
            return [
                {
                    label: 'class_none',
                    command: (c) => setBlockClass(c, null, all),
                    active: (e) => !all.some((value) => blockClassActive(e, value)),
                },
                ...presets.map((preset) => ({
                    text: preset.label,
                    command: (c) => setBlockClass(c, preset.value, all),
                    active: (e) => blockClassActive(e, preset.value),
                })),
            ];
        },
    },
    mark('bold', 'bold', 'bold', 'Mod+B', (c) => c.toggleBold()),
    mark('italic', 'italic', 'italic', 'Mod+I', (c) => c.toggleItalic()),
    mark('underline', 'underline', 'underline', 'Mod+U', (c) => c.toggleUnderline()),
    mark('strike', 'strike', 'strikethrough', 'Mod+Shift+S', (c) => c.toggleStrike()),
    mark('code', 'code', 'code', 'Mod+E', (c) => c.toggleCode()),
    mark('superscript', 'superscript', 'superscript', 'Mod+.', (c) => c.toggleSuperscript(), 'superscript'),
    mark('subscript', 'subscript', 'subscript', 'Mod+,', (c) => c.toggleSubscript(), 'subscript'),
    {
        name: 'color', type: 'color', label: 'color', icon: 'baseline', requires: 'color',
        palette: (config) => config.colors,
        current: (editor) => editor.getAttributes('textStyle').color || null,
        apply: (chain, color) => chain.setColor(color),
        clear: (chain) => chain.unsetColor(),
        active: (editor) => Boolean(editor.getAttributes('textStyle').color),
    },
    {
        name: 'highlight', type: 'color', label: 'highlight', icon: 'highlighter', requires: 'highlight',
        palette: (config) => config.highlightColors,
        current: (editor) => editor.getAttributes('highlight').color || null,
        apply: (chain, color) => chain.setHighlight({ color }),
        clear: (chain) => chain.unsetHighlight(),
        active: (editor) => editor.isActive('highlight'),
    },
    {
        name: 'align', type: 'menu', label: 'align', icon: 'alignLeft', requires: 'textAlign',
        options: () => ALIGN_OPTIONS,
    },
    ...ALIGN_OPTIONS.map((option) => ({
        name: `align${option.label.slice(6, 7).toUpperCase()}${option.label.slice(7)}`,
        requires: 'textAlign',
        ...option,
    })),
    {
        name: 'bulletList', label: 'bullet_list', icon: 'list', shortcut: 'Mod+Shift+8',
        command: (c) => c.toggleBulletList(), active: (e) => e.isActive('bulletList'),
    },
    {
        name: 'orderedList', label: 'ordered_list', icon: 'listOrdered', shortcut: 'Mod+Shift+7',
        command: (c) => c.toggleOrderedList(), active: (e) => e.isActive('orderedList'),
    },
    {
        name: 'blockquote', label: 'blockquote', icon: 'quote', shortcut: 'Mod+Shift+B',
        command: (c) => c.toggleBlockquote(), active: (e) => e.isActive('blockquote'),
    },
    { name: 'horizontalRule', label: 'horizontal_rule', icon: 'minus', command: (c) => c.setHorizontalRule() },
    {
        name: 'codeBlock', label: 'code_block', icon: 'codeBlock', shortcut: 'Mod+Alt+C',
        command: (c) => c.toggleCodeBlock(), active: (e) => e.isActive('codeBlock'),
    },
    {
        name: 'clearFormatting', label: 'clear_formatting', icon: 'removeFormatting',
        command: (c) => c.unsetAllMarks().clearNodes(),
    },
    {
        name: 'link', label: 'link', icon: 'link', shortcut: 'Mod+K', requires: 'link',
        active: (editor) => editor.isActive('link'),
        enabled: (editor) => editor.isEditable,
        action: (editor, context) => openLinkDialog(editor, context),
    },
    {
        // Same dialog, opened on the MODX resource search.
        name: 'modxLink', label: 'link_resource', icon: 'fileSymlink', requires: 'link',
        enabled: (editor, context) => editor.isEditable && Boolean(context.config.connectorUrl),
        action: (editor, context) => openLinkDialog(editor, context, { searchFirst: true }),
    },
    {
        name: 'unlink', label: 'link_remove', icon: 'unlink', requires: 'link',
        command: (c) => c.extendMarkRange('link').unsetLink(),
        enabled: (editor) => editor.isActive('link'),
    },
    {
        name: 'anchor', label: 'anchor', icon: 'hash', requires: 'headingAnchor',
        active: (editor) => Boolean(editor.isActive('heading') && editor.getAttributes('heading').id),
        enabled: (editor) => editor.isActive('heading'),
        action: (editor, context) => openAnchorDialog(editor, context),
    },
    {
        // The image dialog: a URL, the Media Browser, an upload from the computer or a copy
        // of a web image (both into tiptapeditor.upload_path), alt, caption, size, "open larger".
        // On a selected image: edit it.
        name: 'image', label: 'image', icon: 'image', requires: 'image',
        active: (editor) => editor.isActive('image') || editor.isActive('figureImage'),
        enabled: (editor) => editor.isEditable,
        action: (editor, context) => openImageDialog(editor, context),
    },
    {
        // Kept for toolbars that list them; the image dialog has the same choices.
        // Image from the user's computer, uploaded into tiptapeditor.upload_path of the field's
        // Media Source; then the image dialog as for the Media Browser.
        name: 'imageUpload', label: 'image_upload', icon: 'imageUp', requires: 'image',
        available: (config) => Boolean(config.uploadHandler || (config.uploadEnabled && config.mediaSource?.id)),
        enabled: (editor, context) => editor.isEditable && canUpload(context),
        action: (editor, context) => uploadImage(editor, context),
    },
    {
        // Image by URL: the server copies it into tiptapeditor.upload_path (public addresses only).
        name: 'imageUrl', label: 'image_url_import', icon: 'imageDown', requires: 'image',
        available: (config) => Boolean(config.uploadEnabled && config.mediaSource?.id && config.connectorUrl),
        enabled: (editor, context) => editor.isEditable && canImport(context),
        action: (editor, context) => openImageUrlDialog(editor, context),
    },
    {
        // Image gallery: several pictures from the Media Browser or the computer, a template
        // (tiptapeditor.gallery_template) and "open larger"; on a selected gallery: edit it.
        name: 'gallery', label: 'gallery', icon: 'images', requires: 'gallery',
        available: (config) => Boolean(config.mediaSource?.id || config.uploadHandler || config.uploadEnabled),
        active: (editor) => editor.isActive('gallery'),
        enabled: (editor, context) => editor.isEditable && canMakeGallery(context),
        action: (editor, context) => openGalleryDialog(editor, context),
    },
    {
        // Link to a file from the Media Browser: the selected text becomes the link,
        // otherwise the file name is inserted as the link text.
        name: 'file', label: 'file_link', icon: 'paperclip', requires: 'link',
        enabled: (editor, context) => canBrowse(context.config),
        action: (editor, context) => insertFileLink(editor, context),
    },
    {
        // Video or other iframe embed (extensions/Iframe.js): a page URL of YouTube, VK Video,
        // Rutube, an embed URL or an <iframe> code; on a selected embed: edit it.
        name: 'embed', label: 'embed', icon: 'squarePlay', requires: 'iframe',
        active: (editor) => editor.isActive('iframe'),
        enabled: (editor) => editor.isEditable,
        action: (editor, context) => openEmbedDialog(editor, context),
    },
    {
        name: 'fullscreen', label: 'fullscreen', icon: 'maximize', shortcut: 'Esc',
        feature: 'fullscreen',
        action: (editor, context) => context.fullscreen.toggle(),
        active: (editor, context) => context.fullscreen.active,
        enabled: () => true,
        whileReadOnly: true,
    },
    {
        // HTML source mode (ui/SourceView.js): the field value as plain text, MODX/Fenom literally.
        name: 'source', label: 'source', icon: 'codeXml',
        action: (editor, context) => context.source?.toggle(),
        active: (editor, context) => Boolean(context.source?.active),
        enabled: (editor, context) => Boolean(context.source),
        whileReadOnly: true,
    },
].forEach(registerToolbarItem);

/** Contextual table toolbar, shown while the cursor is in a table. */
export const TABLE_BAR = 'addRowBefore addRowAfter deleteRow | addColumnBefore addColumnAfter deleteColumn'
    + ' | toggleHeaderRow toggleHeaderColumn | mergeCells splitCell | tableProperties deleteTable';

const tableCommand = (name, label, icon, command) => ({ name, label, icon, requires: 'table', command });

[
    {
        // Insert a table (dialog: size, header row, classes); in a table: its properties.
        name: 'table', label: 'table', icon: 'table', requires: 'table',
        active: (editor) => editor.isActive('table'),
        enabled: (editor) => editor.isEditable
            && (editor.isActive('table') || editor.can().insertTable({ rows: 1, cols: 1, withHeaderRow: false })),
        action: (editor, context) => openTableDialog(editor, context),
    },
    tableCommand('addRowBefore', 'table_add_row_before', 'rowBefore', (c) => c.addRowBefore()),
    tableCommand('addRowAfter', 'table_add_row_after', 'rowAfter', (c) => c.addRowAfter()),
    tableCommand('deleteRow', 'table_delete_row', 'rowDelete', (c) => c.deleteRow()),
    tableCommand('addColumnBefore', 'table_add_column_before', 'columnBefore', (c) => c.addColumnBefore()),
    tableCommand('addColumnAfter', 'table_add_column_after', 'columnAfter', (c) => c.addColumnAfter()),
    tableCommand('deleteColumn', 'table_delete_column', 'columnDelete', (c) => c.deleteColumn()),
    tableCommand('toggleHeaderRow', 'table_toggle_header_row', 'headerRow', (c) => c.toggleHeaderRow()),
    tableCommand('toggleHeaderColumn', 'table_toggle_header_column', 'headerColumn', (c) => c.toggleHeaderColumn()),
    tableCommand('mergeCells', 'table_merge_cells', 'cellsMerge', (c) => c.mergeCells()),
    tableCommand('splitCell', 'table_split_cell', 'cellsSplit', (c) => c.splitCell()),
    {
        name: 'tableProperties', label: 'table_properties', icon: 'tableProperties', requires: 'table',
        enabled: (editor) => editor.isEditable && editor.isActive('table'),
        action: (editor, context) => openTableDialog(editor, context),
    },
    tableCommand('deleteTable', 'table_delete', 'tableDelete', (c) => c.deleteTable()),
].forEach(registerToolbarItem);

function browseFor(context, options) {
    const { config } = context;
    return browseFile({
        source: config.mediaSource,
        context: config.resource?.context,
        ...options,
    }).catch((error) => {
        context.logger?.debug('media browser failed', error);
        context.message?.show(context.t('media_browser_failed'), 'error');
        return null;
    });
}

async function insertFileLink(editor, context) {
    const { config } = context;
    const file = await browseFor(context, {});
    const href = file && fileUrl(file, config.mediaUrlMode, config.siteBaseUrl);
    if (!href || editor.isDestroyed) {
        editor.isDestroyed || editor.commands.focus();
        return;
    }
    if (editor.state.selection.empty) {
        const text = String(file.name || href.split('/').pop() || href);
        editor.chain().focus().insertContent({ type: 'text', text, marks: [{ type: 'link', attrs: { href } }] }).run();
    } else {
        editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    }
}
