import Highlight from '@tiptap/extension-highlight';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { Color, TextStyle } from '@tiptap/extension-text-style';
import StarterKit from '@tiptap/starter-kit';
import { FileDropGuard } from '../extensions/FileDropGuard.js';
import { Iframe } from '../extensions/Iframe.js';
import { ModxAutocomplete } from '../extensions/ModxAutocomplete.js';
import { PasteCleaner } from '../extensions/PasteCleaner.js';
import { SLASH_COMMANDS, SlashCommands } from '../extensions/SlashCommands.js';
import { menuItems } from '../ui/Menus.js';
import { HeadingAnchor } from '../extensions/HeadingAnchor.js';
import { ImplicitParagraph } from '../extensions/ImplicitParagraph.js';
import { LinkShortcut } from '../extensions/LinkShortcut.js';
import { ModxImage } from '../extensions/ModxImage.js';
import { Figure, FigureCaption, FigureImage } from '../extensions/Figure.js';
import { Gallery } from '../extensions/Gallery.js';
import { galleryTemplates, lightboxAttribute } from '../images/gallery.js';
import { ModxCode } from '../extensions/ModxCode.js';
import { registeredExtensions } from './registry.js';
import { ModxTextAlign, PreservedAttributes } from '../extensions/PreservedAttributes.js';
import { ModxSyntax, ModxSyntaxBlock, PastePrivateMarks, TokenizeText } from '../extensions/ModxSyntax.js';
import { ModxTableKit } from '../extensions/ModxTable.js';
import { RawHtml } from '../extensions/RawHtml.js';

/**
 * Built-in extension set. StarterKit 3 already contains Link, Underline, ListKeymap,
 * UndoRedo, Dropcursor, Gapcursor and TrailingNode: they are configured here, never added twice.
 */
export function buildExtensions(config, hooks = {}) {
    const named = splitOptions(config.extensionOptions);
    const extensions = [
        StarterKit.configure({
            // Options for StarterKit's own extensions from the external config / profiles
            // ("bold": false, "heading": {…}); the settings below always win.
            ...named.starterKit,
            heading: { ...(isObject(named.starterKit.heading) ? named.starterKit.heading : {}), levels: config.headingLevels },
            // TrailingNode appends an empty <p></p> after a final heading, table or code block on
            // every edit, which would change the saved HTML. Gapcursor covers cursor placement.
            trailingNode: false,
            // Replaced by ModxCode (no `code` shortcut inside a MODX tag being typed).
            code: false,
            link: named.starterKit.link === false ? false : {
                ...(isObject(named.starterKit.link) ? named.starterKit.link : {}),
                openOnClick: false,
                // Tiptap 3 adds target="_blank" rel="noopener noreferrer nofollow" to every link
                // by default; existing links must keep exactly their own attributes.
                HTMLAttributes: { target: null, rel: null },
            },
        }),
        TextStyle,
        Color,
        Highlight.configure({ multicolor: true }),
        ModxTextAlign.configure({ types: ['heading', 'paragraph'] }),
        Subscript,
        Superscript,
        HeadingAnchor,
        // After HeadingAnchor, so a heading's id is written before its other attributes.
        PreservedAttributes.configure({ preserveStyle: config.preserveStyleAttribute !== false }),
        ModxCode,
        ImplicitParagraph,
        PastePrivateMarks,
        // MODX/Fenom tokens and raw HTML blocks (syntax/preprocess.js). Always in the schema, so
        // content keeps them even when the protection settings are off.
        ModxSyntax.configure({ onEdit: () => (hooks.ui?.editCode ? hooks.ui.editCode() : false) }),
        ModxSyntaxBlock.configure({ onEdit: () => (hooks.ui?.editCode ? hooks.ui.editCode() : false) }),
        RawHtml.configure({
            onEdit: () => (hooks.ui?.editCode ? hooks.ui.editCode() : false),
            label: hooks.t ? hooks.t('raw_label') : 'HTML',
        }),
        // Options are cloned by configure(), so the UI is reached through a function.
        LinkShortcut.configure({ open: () => (hooks.ui?.openLink ? hooks.ui.openLink() : false) }),
        FileDropGuard.configure({
            uploadHandler: config.uploadHandler || hooks.uploadHandler || null,
            onBlocked: hooks.onUploadBlocked || (() => {}),
            onUploading: hooks.onUploading || (() => {}),
            onUploaded: hooks.onUploaded || (() => {}),
            onError: hooks.onUploadError || (() => {}),
        }),
        PasteCleaner.configure({
            pasteAsText: Boolean(config.pasteAsText),
            onImagesRemoved: hooks.onPasteImagesRemoved || (() => {}),
        }),
    ];
    // Hooks for suggestion lists: plain functions, so configure() does not copy live objects.
    const suggestionHooks = {
        t: hooks.t,
        config,
        logger: hooks.logger,
        context: () => hooks.ui?.context,
    };
    const slash = menuItems(config.slashCommands, SLASH_COMMANDS);
    if (slash) {
        extensions.push(SlashCommands.configure({ items: slash, hooks: suggestionHooks }));
    }
    if (config.modxAutocomplete || config.fenomAutocomplete) {
        extensions.push(ModxAutocomplete.configure({
            modx: Boolean(config.modxAutocomplete),
            fenom: Boolean(config.fenomAutocomplete),
            hooks: suggestionHooks,
        }));
    }
    if (config.features?.iframe !== false) {
        extensions.push(Iframe.configure({
            allowedAttributes: config.iframeAllowedAttributes,
            allowedHosts: config.iframeAllowedHosts,
            label: hooks.t ? hooks.t('embed_label') : 'Embed',
            onEdit: () => (hooks.ui?.editEmbed ? hooks.ui.editEmbed() : false),
        }));
    }
    extensions.push(...(hooks.menus || []));
    if (config.features?.images !== false) {
        extensions.push(ModxImage.configure({
            siteBaseUrl: config.siteBaseUrl || '/',
            onEdit: () => (hooks.ui?.openImage ? hooks.ui.openImage() : false),
        }));
        extensions.push(
            Figure,
            FigureCaption,
            FigureImage.configure({
                siteBaseUrl: config.siteBaseUrl || '/',
                onEdit: () => (hooks.ui?.openImage ? hooks.ui.openImage() : false),
            }),
        );
        if (config.features?.gallery !== false) {
            const { templates, errors } = galleryTemplates(config.galleryTemplateFiles);
            errors.forEach((error) => hooks.logger?.debug(error));
            extensions.push(Gallery.configure({
                templates,
                lightboxAttribute: lightboxAttribute(config.lightboxAttribute),
                lightboxLabel: config.lightboxLabel || (hooks.t ? hooks.t('lightbox_label') : ''),
                siteBaseUrl: config.siteBaseUrl || '/',
                t: hooks.t || ((key) => key),
                onEdit: () => (hooks.ui?.editGallery ? hooks.ui.editGallery() : false),
            }));
        }
        if (hooks.imageMenu) {
            extensions.push(hooks.imageMenu);
        }
    }
    if (config.protectModxSyntax || config.protectFenomSyntax) {
        extensions.push(TokenizeText.configure({
            modx: Boolean(config.protectModxSyntax),
            fenom: Boolean(config.protectFenomSyntax),
            fenomTags: config.fenomTags || '',
        }));
    }
    if (config.features?.tables !== false) {
        extensions.push(ModxTableKit);
    }
    extensions.push(...registeredExtensions());
    return applyOptions(extensions, named.other);
}

// Extensions content depends on: never switched off or reconfigured by name.
const PROTECTED = new Set([
    'starterKit', 'implicitParagraph', 'preservedAttributes', 'modxSyntax', 'modxSyntaxBlock', 'rawHtml',
    'pastePrivateMarks', 'document', 'paragraph', 'text', 'pasteCleaner', 'fileDropGuard',
]);
// Extensions inside StarterKit 3, configured through StarterKit.configure({ name: … }).
const STARTER_KIT = new Set([
    'blockquote', 'bold', 'bulletList', 'codeBlock', 'dropcursor', 'gapcursor', 'hardBreak', 'heading',
    'horizontalRule', 'italic', 'link', 'listItem', 'listKeymap', 'orderedList', 'strike', 'underline', 'undoRedo',
]);

function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function splitOptions(options = {}) {
    const starterKit = {};
    const other = {};
    for (const [name, value] of Object.entries(options || {})) {
        if (PROTECTED.has(name) || !(value === false || isObject(value))) {
            continue;
        }
        (STARTER_KIT.has(name) ? starterKit : other)[name] = value;
    }
    return { starterKit, other };
}

/** false removes an extension, an object configures it (plain data, merged with its options). */
function applyOptions(extensions, options) {
    return extensions
        .filter((extension) => options[extension.name] !== false)
        .map((extension) => (isObject(options[extension.name]) ? extension.configure(options[extension.name]) : extension));
}
