import { DEFAULT_IFRAME_ATTRIBUTES } from '../embed/embed.js';
import { DEFAULT_COLORS, DEFAULT_HIGHLIGHTS } from '../ui/toolbarItems.js';

/**
 * Editor configuration, in this order (later wins):
 *   defaults → MODX system settings → external config (tiptapeditor.external_config)
 *   → profile (tiptapeditor.profiles, chosen per field) → runtime options (TipTapEditor.create).
 * External config and profiles are data: only the keys in CONFIG_KEYS are taken from them.
 */
export const DEFAULT_TOOLBAR = 'undo redo | heading | bold italic underline strike code | color highlight'
    + ' | superscript subscript | align | bulletList orderedList | blockquote horizontalRule'
    + ' | link modxLink anchor | image gallery file table embed | codeBlock | clearFormatting | source fullscreen';

export const defaults = Object.freeze({
    debug: false,
    elements: [],
    lexicon: {},
    toolbar: DEFAULT_TOOLBAR,
    headingLevels: [1, 2, 3, 4, 5, 6],
    colors: DEFAULT_COLORS,
    highlightColors: DEFAULT_HIGHLIGHTS,
    stickyToolbar: true,
    features: { fullscreen: true, images: true, tables: true, iframe: true, gallery: true },
    // Menus: true = default items, false = off, a string = the toolbar items to show.
    bubbleMenu: true,
    floatingMenu: true,
    slashCommands: true,
    statusbar: false,
    // Paste: plain text only (tiptapeditor.paste_as_text); otherwise pasted HTML is cleaned.
    pasteAsText: false,
    // Iframes (tiptapeditor.iframe_allowed_attributes / iframe_allowed_hosts).
    iframeAllowedAttributes: DEFAULT_IFRAME_ATTRIBUTES,
    iframeAllowedHosts: '',
    // Autocomplete of MODX tags and Fenom expressions.
    modxAutocomplete: true,
    fenomAutocomplete: false,
    // Upload of dropped/pasted images into the field's Media Source (tiptapeditor.upload_enabled).
    uploadEnabled: false,
    uploadPath: 'assets/uploads/',
    // Media Browser: the field's Media Source ({ id, name, baseUrl } or null when the user
    // may not browse), how picked file URLs are stored, and the site base URL for previews.
    mediaSource: null,
    mediaUrlMode: 'relative',
    siteBaseUrl: '/',
    // Links: href written for a MODX resource ({id}, {context}, {uri}) and class presets
    // (JSON {"class": "Label"} or a comma separated list).
    resourceLinkFormat: '[[~{id}]]',
    linkClasses: '',
    // Images: style presets (tiptapeditor.image_classes, same format as linkClasses) and the
    // classes written for the alignment choice.
    imageClasses: '',
    imageAlignClasses: { left: 'align-left', center: 'align-center', right: 'align-right' },
    // "Open larger" link around images and gallery pictures (tiptapeditor.lightbox): the
    // attribute the site's lightbox script needs (e.g. data-fancybox; '' = a plain link) and
    // the aria-label ({alt} = alt text or caption; '' = the lexicon text).
    lightbox: false,
    lightboxAttribute: '',
    lightboxLabel: '',
    // Galleries: the template for new galleries and more templates (JSON, images/gallery.js).
    galleryTemplate: 'grid',
    galleryTemplates: '',
    // Tables: class presets (tiptapeditor.table_classes) offered in the table dialog.
    tableClasses: '',
    // Runtime extension point: async (file, { editor }) => url for dropped/pasted images.
    uploadHandler: null,
    minHeight: 200,
    maxHeight: 700,
    defaultHeight: 300,
    autogrow: true,
    // Inline style attributes of paragraphs, headings, lists and marks are kept as written;
    // off: they may be dropped when the content is edited.
    preserveStyleAttribute: true,
    protectModxSyntax: true,
    protectFenomSyntax: true,
    // Names of custom Fenom functions/tags ({myTag …}) besides the built-in keywords.
    fenomTags: '',
    syncDelay: 150,
    // Site CSS shown in the editor (tiptapeditor.content_css), scoped to the editing area.
    contentCss: [],
    // Profiles: { name: { toolbar, features, … } }; which one a field uses.
    profiles: {},
    profile: null,
    defaultProfile: 'default',
    contentProfile: '',
    tvProfiles: {},
    // Built-in or registered extensions by name: false = off, object = options.
    extensionOptions: {},
    // Extra attributes of the editable element (external config "editorProps.attributes").
    editorAttributes: {},
});

/** Keys a profile or the external config may set (the same list as SettingParser.php). */
export const CONFIG_KEYS = Object.freeze([
    'toolbar', 'headingLevels', 'colors', 'highlightColors', 'stickyToolbar', 'features',
    'minHeight', 'maxHeight', 'defaultHeight', 'autogrow', 'linkClasses', 'imageClasses',
    'tableClasses', 'paragraphClasses', 'imageAlignClasses', 'resourceLinkFormat', 'contentCss',
    'preserveStyleAttribute', 'extensions', 'editorProps', 'bubbleMenu', 'floatingMenu', 'slashCommands',
    'statusbar', 'pasteAsText', 'iframeAllowedAttributes', 'iframeAllowedHosts', 'modxAutocomplete', 'fenomAutocomplete',
    'lightbox', 'lightboxAttribute', 'lightboxLabel', 'galleryTemplate', 'galleryTemplates',
]);

const SAFE_EDITOR_ATTRIBUTE = /^(spellcheck|lang|dir|class|autocorrect|autocapitalize|(data|aria)-[a-z0-9-]+)$/;

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** The configuration part of a profile or external config (unknown keys dropped). */
export function configData(data) {
    if (!isPlainObject(data)) {
        return {};
    }
    const result = {};
    for (const key of CONFIG_KEYS) {
        if (data[key] !== undefined) {
            result[key] = data[key];
        }
    }
    if (Array.isArray(result.toolbar)) {
        // ["undo", "redo", "|", "bold"] or [["undo", "redo"], ["bold"]] → "undo redo | bold".
        result.toolbar = result.toolbar
            .map((entry) => (Array.isArray(entry) ? `${entry.join(' ')} |` : String(entry)))
            .join(' ')
            .replace(/\s+/g, ' ')
            .replace(/(\|\s*)+\|/g, '|')
            .replace(/^[\s|]+|[\s|]+$/g, '');
    }
    return result;
}

function editorAttributes(value) {
    const result = {};
    for (const [name, attr] of Object.entries(isPlainObject(value?.attributes) ? value.attributes : {})) {
        const lower = name.toLowerCase();
        if (SAFE_EDITOR_ATTRIBUTE.test(lower) && ['string', 'number', 'boolean'].includes(typeof attr)) {
            result[lower] = String(attr);
        }
    }
    return result;
}

/**
 * Profile name for a field: runtime option, else the TV's entry in tiptapeditor.tv_profiles,
 * else tiptapeditor.content_profile for other fields (resource content, chunks), else
 * tiptapeditor.default_profile.
 */
export function profileName(config, { field = null, options = {} } = {}) {
    if (options.profile) {
        return String(options.profile);
    }
    const byTv = field && (config.tvProfiles?.[field.name] || config.tvProfiles?.[`tv${field.id}`]);
    if (byTv) {
        return byTv;
    }
    if (!field && config.contentProfile) {
        return config.contentProfile;
    }
    return config.defaultProfile || 'default';
}

function normalizeLevels(value) {
    const list = Array.isArray(value) ? value : String(value ?? '').split(',');
    const levels = list.map((level) => parseInt(level, 10)).filter((level) => level >= 1 && level <= 6);
    return levels.length ? [...new Set(levels)].sort() : [...defaults.headingLevels];
}

export function resolveConfig(...sources) {
    const config = { ...defaults };
    for (const source of sources) {
        if (!source) {
            continue;
        }
        for (const [key, value] of Object.entries(source)) {
            if (value === undefined) {
                continue;
            }
            if (key === 'features') {
                config.features = { ...config.features, ...value };
            } else if (key === 'extensions' && isPlainObject(value)) {
                // From settings/JSON: options by name. Runtime options pass extension objects.
                config.extensionOptions = { ...config.extensionOptions, ...value };
            } else if (key === 'extensionOptions') {
                config.extensionOptions = { ...config.extensionOptions, ...value };
            } else if (key === 'editorProps') {
                config.editorAttributes = { ...config.editorAttributes, ...editorAttributes(value) };
            } else {
                config[key] = value;
            }
        }
    }
    config.headingLevels = normalizeLevels(config.headingLevels);
    if (!config.toolbar && config.toolbar !== '') {
        config.toolbar = DEFAULT_TOOLBAR;
    }
    config.contentCss = (Array.isArray(config.contentCss) ? config.contentCss : String(config.contentCss || '').split(','))
        .map((url) => String(url).trim()).filter(Boolean);
    if (!Array.isArray(config.extensions)) {
        config.extensions = [];
    }
    return config;
}
