import { connectorRequest } from './connector.js';
import { fileUrl } from './MediaBrowser.js';

/**
 * Upload of dropped and pasted images (tiptapeditor.upload_enabled) through MODX itself: the
 * core processor Browser/File/Upload of the field's Media Source, into tiptapeditor.upload_path
 * inside that source. MODX checks the file_upload permission, the source's "create" policy,
 * the allowed file types and upload_maxsize; the editor never writes files itself.
 * The URL is the one MODX lists for the uploaded file (Browser/Directory/GetFiles), stored the
 * same way as a file chosen in the Media Browser (tiptapeditor.media_url_mode).
 */

const IMAGE_EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'image/avif': 'avif', 'image/svg+xml': 'svg' };

const CYRILLIC = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
    н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
    ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya', і: 'i', ї: 'yi', є: 'e', ґ: 'g',
};

/** A safe, unique file name: latin letters, digits and dashes, plus a short random suffix. */
export function uploadName(file, random = Math.random().toString(36).slice(2, 8)) {
    const original = String(file?.name || '');
    const dot = original.lastIndexOf('.');
    const ext = (dot > 0 ? original.slice(dot + 1) : IMAGE_EXTENSIONS[file?.type] || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
    const base = (dot > 0 ? original.slice(0, dot) : original)
        .toLowerCase().replace(/[а-яёіїєґ]/g, (char) => CYRILLIC[char] ?? '')
        .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'image';
    return `${base}-${random}.${ext}`;
}

/** Upload directory inside the source: no "..", no leading slash, one trailing slash. */
export function uploadDirectory(path) {
    const parts = String(path ?? '').split(/[\\/]+/).filter((part) => part && part !== '.' && part !== '..');
    return parts.length ? `${parts.join('/')}/` : '/';
}

function managerConnector() {
    return window.MODx?.config?.connector_url || null;
}

async function call(url, body) {
    const token = window.MODx?.siteId || '';
    if (token) {
        body.set('HTTP_MODAUTH', token);
    }
    const response = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', ...(token ? { modAuth: token } : {}) },
        body,
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    if (!data || data.success === false) {
        const message = data?.message || (Array.isArray(data?.errors) ? data.errors.map((e) => e.msg || e.message).filter(Boolean).join(' ') : '');
        throw new Error(message || 'Upload failed');
    }
    return data;
}

/**
 * The upload handler for a field, or null when uploads are off or the field has no Media
 * Source the user may use.
 * @returns {((file: File) => Promise<string>)|null}
 */
export function createUploadHandler(config) {
    if (!config?.uploadEnabled || !config.mediaSource?.id || !managerConnector()) {
        return null;
    }
    const source = String(config.mediaSource.id);
    const dir = uploadDirectory(config.uploadPath);
    const context = String(config.resource?.context || 'web');

    return async (file) => {
        const connector = managerConnector();
        const name = uploadName(file);
        const upload = new FormData();
        upload.set('action', 'Browser/File/Upload');
        upload.set('source', source);
        upload.set('path', dir);
        upload.set('wctx', context);
        upload.set('file', new File([file], name, { type: file.type }));
        await call(connector, upload);
        return listedUrl(config, connector, { source, dir, context, name });
    };
}

/**
 * The URL MODX lists for a file just stored in the source. MODX skips files of a type the
 * source does not allow without an error: the file only counts as uploaded when it is listed.
 */
async function listedUrl(config, connector, { source, dir, context, name }) {
    const list = new URLSearchParams({ action: 'Browser/Directory/GetFiles', source, dir: dir === '/' ? '' : dir, wctx: context });
    const data = await call(connector, list);
    const entry = (Array.isArray(data.results) ? data.results : []).find((item) => item?.name === name);
    if (!entry) {
        throw new Error('The uploaded file is not in the Media Source (file type not allowed?)');
    }
    return fileUrl(entry, config.mediaUrlMode, config.siteBaseUrl);
}

export const IMAGE_IMPORT = 'TipTapEditor\\Processors\\Image\\Import';

/**
 * "Image by URL": the server (Processors/Image/Import) downloads a picture from a public web
 * address into upload_path of the field's Media Source, with the same permission checks as an
 * upload. Null when uploads are off for this field.
 * @returns {((url: string) => Promise<string>)|null}
 */
export function createImportHandler(config) {
    if (!config?.uploadEnabled || !config.mediaSource?.id || !config.connectorUrl || !managerConnector()) {
        return null;
    }
    const source = String(config.mediaSource.id);
    const context = String(config.resource?.context || 'web');

    return async (url) => {
        const data = await connectorRequest(config, IMAGE_IMPORT, { source, url: String(url).trim(), wctx: context });
        const name = String(data.object?.name || '');
        if (!name) {
            throw new Error('Request failed');
        }
        return listedUrl(config, managerConnector(), { source, dir: String(data.object?.path || '/'), context, name });
    };
}
