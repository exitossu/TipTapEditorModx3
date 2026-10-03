/**
 * Requests to the TipTapEditor connector (assets/components/tiptapeditor/connector.php).
 *
 * The connector runs the standard MODX connector bootstrap: it needs the manager session
 * cookie and the modAuth token of this page, and each processor checks permissions.
 */
export async function connectorRequest(config, action, params = {}) {
    if (!config?.connectorUrl) {
        throw new Error('No connector URL');
    }
    const token = window.MODx?.siteId || '';
    const body = new URLSearchParams({ action, ...params });
    if (token) {
        body.set('HTTP_MODAUTH', token);
    }
    const response = await fetch(config.connectorUrl, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            ...(token ? { modAuth: token } : {}),
        },
        body,
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    if (!data || data.success === false) {
        throw new Error(data?.message || 'Request failed');
    }
    return data;
}

export const RESOURCE_SEARCH = 'TipTapEditor\\Processors\\Resource\\Search';

/** Resources matching a query (title, long title, alias or ID), limited by MODX ACL. */
export async function searchResources(config, query, { limit = 20, signal } = {}) {
    if (signal?.aborted) {
        return [];
    }
    const data = await connectorRequest(config, RESOURCE_SEARCH, {
        query: String(query),
        context: String(config.resource?.context || ''),
        limit: String(limit),
    });
    return Array.isArray(data.results) ? data.results : [];
}
