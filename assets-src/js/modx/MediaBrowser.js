/**
 * MODX Media Browser integration.
 *
 * The editor never builds file URLs itself and never talks to the filesystem: it opens the
 * browser MODX ships (which checks file_manager and the Media Source policies on every
 * request) and takes the URL MODX returns for the chosen file.
 *
 * Main path: the in-page "modx-browser" window, the one the Image TV uses.
 * Fallback:  the standalone page ?a=browser&tiptapeditor=1 in a popup; its callback
 *            (assets/js/browser.js) posts the file back with an explicit origin.
 */

export const IMAGE_FILE_TYPES = 'jpg,jpeg,png,gif,webp,svg,avif';

const ABSOLUTE = /^([a-z][a-z\d+.-]*:|\/\/)/i;
const TEMPLATE_TAG = /\[\[|\{[$/a-z_]/i;

function hasInPageBrowser() {
    return Boolean(window.MODx?.load && window.Ext?.ComponentMgr?.isRegistered?.('modx-browser'));
}

function managerUrl() {
    return window.MODx?.config?.manager_url || null;
}

/**
 * URL to store in the content for a file picked in the browser.
 *  relative (default): exactly what MODX returns (fullRelativeUrl), like the Image TV;
 *                      resolved against the site <base href> on the frontend.
 *  root:               the site base URL is prepended, e.g. /assets/img/a.jpg.
 * Absolute URLs (S3 and other remote sources) are always kept as they are.
 */
export function fileUrl(file, mode = 'relative', siteBaseUrl = '/') {
    const url = String(file?.fullRelativeUrl || file?.relativeUrl || file?.url || '');
    if (!url || ABSOLUTE.test(url) || url.startsWith('/') || mode !== 'root') {
        return url;
    }
    const base = String(siteBaseUrl || '/');
    return (base.endsWith('/') ? base : `${base}/`) + url;
}

/**
 * URL the editor uses to show an image: relative URLs are resolved against the site base
 * URL, because the manager lives in another directory. The stored src is not changed.
 */
export function previewUrl(src, siteBaseUrl = '/') {
    const value = String(src ?? '');
    if (!value || ABSOLUTE.test(value) || value.startsWith('/') || value.startsWith('#') || TEMPLATE_TAG.test(value)) {
        return value;
    }
    const base = String(siteBaseUrl || '/');
    return (base.endsWith('/') ? base : `${base}/`) + value;
}

/**
 * Folder to open the browser in for an existing file URL, relative to the Media Source.
 * Returns '' when the URL does not belong to the source.
 */
export function folderOf(src, source, siteBaseUrl = '/') {
    let path = String(src ?? '').split(/[?#]/)[0];
    if (!path || ABSOLUTE.test(path) || TEMPLATE_TAG.test(path)) {
        return '';
    }
    const base = String(siteBaseUrl || '/');
    if (path.startsWith('/')) {
        if (!path.startsWith(base)) {
            return '';
        }
        path = path.slice(base.length);
    }
    // fullRelativeUrl = source base URL + path inside the source.
    const sourceBase = String(source?.baseUrl || '').replace(/^\/+/, '');
    if (sourceBase) {
        if (!path.startsWith(sourceBase)) {
            return '';
        }
        path = path.slice(sourceBase.length);
    }
    const slash = path.lastIndexOf('/');
    return slash > 0 ? path.slice(0, slash + 1) : '';
}

function openInPage({ source, context, openTo, fileTypes, multiple = false }) {
    return new Promise((resolve) => {
        let settled = false;
        let browser = null;
        // With several files selected MODX fires "select" once per file, right after another.
        const picked = [];
        const onSelect = (data) => {
            if (!multiple) {
                finish(data);
                return;
            }
            picked.push(data);
            if (picked.length === 1) {
                setTimeout(() => finish(picked), 0);
            }
        };
        const finish = (value) => {
            if (!settled) {
                settled = true;
                // The window only hides after a selection; destroy it so no hidden browser
                // windows pile up in the page. Resolve afterwards: ExtJS moves focus while the
                // window goes away, and a dialog opened for the result must keep the focus.
                setTimeout(() => {
                    browser?.win?.destroy?.();
                    setTimeout(() => resolve(value), 0);
                }, 0);
            }
        };
        browser = window.MODx.load({
            xtype: 'modx-browser',
            id: window.Ext.id(),
            multiple: true,
            closeAction: 'close',
            source: source.id,
            wctx: context || 'web',
            openTo: openTo || '',
            allowedFileTypes: fileTypes || '',
            hideSourceCombo: true,
            // Ctrl/Shift+click selects several files (the browser window is single-select by default).
            multiSelect: Boolean(multiple),
            listeners: {
                select: { fn: (data) => onSelect(data) },
            },
        });
        if (!browser?.win) {
            finish(null);
            return;
        }
        // "select" fires after the window hid, so a hide without a selection is a cancel.
        browser.win.on('hide', () => setTimeout(() => finish(multiple ? picked : null), 100));
        browser.win.on('close', () => setTimeout(() => finish(multiple ? picked : null), 100));
        browser.show();
    });
}

function openPopup({ source, context, openTo, fileTypes }) {
    const base = managerUrl();
    if (!base) {
        return Promise.resolve(null);
    }
    const params = new URLSearchParams({ a: 'browser', tiptapeditor: '1', source: String(source.id), ctx: context || 'web' });
    if (openTo) {
        params.set('dir', openTo);
    }
    if (fileTypes) {
        params.set('allowedFileTypes', fileTypes);
    }
    const popup = window.open(`${base}?${params}`, 'tiptapeditor-browser', 'width=1000,height=700,resizable=yes,scrollbars=yes');
    if (!popup) {
        return Promise.resolve(null);
    }
    return new Promise((resolve) => {
        const done = (value) => {
            window.removeEventListener('message', onMessage);
            clearInterval(timer);
            resolve(value);
        };
        const onMessage = (event) => {
            const message = event.data;
            if (event.origin !== window.location.origin || event.source !== popup
                || message?.source !== 'tiptapeditor' || message.action !== 'selectFile') {
                return;
            }
            done(message.data && typeof message.data === 'object' ? message.data : null);
        };
        const timer = setInterval(() => {
            if (popup.closed) {
                setTimeout(() => done(null), 50);
            }
        }, 500);
        window.addEventListener('message', onMessage);
    });
}

/** True when the picked file has one of the extensions in the comma-separated list. */
export function hasFileType(file, fileTypes) {
    const allowed = String(fileTypes || '').toLowerCase().split(',').map((ext) => ext.trim()).filter(Boolean);
    if (!allowed.length) {
        return true;
    }
    const name = String(file?.ext ? `.${file.ext}` : (file?.fullRelativeUrl || file?.url || '')).split(/[?#]/)[0];
    const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '';
    return allowed.includes(ext);
}

/**
 * Opens the Media Browser for a field.
 * @param {{ source: {id:number}|null, context?: string, openTo?: string, fileTypes?: string }} options
 * @returns {Promise<object|null>} the file MODX returned, or null when cancelled/unavailable
 */
export function browseFile(options) {
    if (!options?.source?.id) {
        return Promise.resolve(null);
    }
    return hasInPageBrowser() ? openInPage(options) : openPopup(options);
}

/**
 * Opens the Media Browser for several files (Ctrl/Shift+click in the browser). In the popup
 * fallback one file can be picked at a time.
 * @returns {Promise<object[]>} the files MODX returned (empty when cancelled)
 */
export async function browseFiles(options) {
    if (!options?.source?.id) {
        return [];
    }
    if (hasInPageBrowser()) {
        return (await openInPage({ ...options, multiple: true })) || [];
    }
    const file = await openPopup(options);
    return file ? [file] : [];
}

/** True when the field has a Media Source the user may browse and a manager to browse it in. */
export function canBrowse(config) {
    return Boolean(config?.mediaSource?.id && (hasInPageBrowser() || managerUrl()));
}
