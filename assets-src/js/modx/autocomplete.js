import { connectorRequest, searchResources } from './connector.js';

/**
 * Suggestions for MODX tags and Fenom expressions typed in the editor.
 *
 *   [[        hints for the tag types below
 *   [[*       resource fields and template variables   → [[*pagetitle]]
 *   [[!  [[x  snippets (uncached / cached)              → [[!pdoResources]]
 *   [[$       chunks                                    → [[$header]]
 *   [[++      system settings (keys only, never values) → [[++site_name]]
 *   [[~       resources by title, alias or ID           → [[~12]]
 *   {$        resource fields as Fenom variables, $_modx
 *   {$_modx-> the documented members of pdoTools' $_modx (a fixed list; nothing is run)
 *
 * Elements, settings and resources come from the TipTapEditor connector, one search per query
 * (debounced by the caller), limited by the user's permissions and MODX ACL. Nothing is
 * loaded with the page. Lexicon keys ([[%) are not suggested: they live in files per topic
 * and cannot be listed reliably.
 */

export const RESOURCE_FIELDS = [
    'pagetitle', 'longtitle', 'description', 'introtext', 'content', 'alias', 'id', 'published', 'menutitle',
    'parent', 'template', 'uri', 'createdon', 'editedon', 'publishedon', 'pub_date', 'link_attributes', 'class_key',
];

// pdoTools' $_modx object in Fenom: properties (followed by ".") and methods (followed by "(").
export const FENOM_MODX = [
    { name: 'resource', property: true },
    { name: 'config', property: true },
    { name: 'user', property: true },
    { name: 'context', property: true },
    { name: 'runSnippet' },
    { name: 'getChunk' },
    { name: 'parseChunk' },
    { name: 'makeUrl' },
    { name: 'lexicon' },
    { name: 'getPlaceholder' },
    { name: 'setPlaceholder' },
    { name: 'getPlaceholders' },
    { name: 'getInfo' },
    { name: 'getResource' },
    { name: 'getResources' },
    { name: 'getChildIds' },
    { name: 'getParentIds' },
    { name: 'isAuthenticated' },
    { name: 'hasSessionContext' },
    { name: 'regClientCSS' },
    { name: 'regClientScript' },
    { name: 'regClientStartupScript' },
    { name: 'regClientHTMLBlock' },
    { name: 'sendRedirect' },
];

export const ACTIONS = {
    chunks: 'TipTapEditor\\Processors\\Element\\SearchChunks',
    snippets: 'TipTapEditor\\Processors\\Element\\SearchSnippets',
    templates: 'TipTapEditor\\Processors\\Element\\SearchTemplates',
    tvs: 'TipTapEditor\\Processors\\Element\\SearchTvs',
    settings: 'TipTapEditor\\Processors\\Setting\\Search',
};

const LIMIT = 15;
const NAME = /^[\w.-]*$/;

function matches(name, query) {
    return name.toLowerCase().includes(query.toLowerCase());
}

/** Names starting with the query first, then the ones containing it. */
function byRelevance(list, query, nameOf = (item) => item) {
    const q = query.toLowerCase();
    const starts = (item) => nameOf(item).toLowerCase().startsWith(q);
    return list.filter((item) => matches(nameOf(item), q)).sort((a, b) => Number(starts(b)) - Number(starts(a)));
}

async function searchElements(config, type, query, signal) {
    if (!config.connectorUrl || signal?.aborted) {
        return [];
    }
    const data = await connectorRequest(config, ACTIONS[type], { query, limit: String(LIMIT) });
    return Array.isArray(data.results) ? data.results : [];
}

/** Server search that never throws: a failed request just suggests nothing. */
async function quiet(promise, logger) {
    try {
        return await promise;
    } catch (error) {
        logger?.debug('autocomplete request failed', error);
        return [];
    }
}

/**
 * Items for the text typed after "[[".
 * Item: { label, detail?, insert, keep? } — insert replaces the typed text; keep leaves the
 * list open (a hint that only adds the tag type).
 */
export async function modxItems(query, { config, t, logger, signal }) {
    if (query === '') {
        return [
            { label: '[[*', detail: t('ac_field'), insert: '[[*', keep: true },
            { label: '[[!', detail: t('ac_snippet'), insert: '[[!', keep: true },
            { label: '[[$', detail: t('ac_chunk'), insert: '[[$', keep: true },
            { label: '[[++', detail: t('ac_setting'), insert: '[[++', keep: true },
            { label: '[[~', detail: t('ac_resource'), insert: '[[~', keep: true },
        ];
    }
    const prefix = /^(\*|!|\$|\+\+|~)?/.exec(query)[0];
    const rest = query.slice(prefix.length);
    if (!NAME.test(rest)) {
        return [];
    }
    const open = `[[${prefix}`;
    switch (prefix) {
        case '*': {
            const fields = byRelevance(RESOURCE_FIELDS, rest)
                .map((name) => ({ label: name, detail: t('ac_field'), insert: `[[*${name}]]` }));
            const tvs = rest ? await quiet(searchElements(config, 'tvs', rest, signal), logger) : [];
            return [...fields, ...tvs.map((tv) => ({ label: tv.name, detail: tv.caption || t('ac_tv'), insert: `[[*${tv.name}]]` }))].slice(0, LIMIT * 2);
        }
        case '$':
        case '!':
        case '': {
            if (!rest) {
                return [];
            }
            const type = prefix === '$' ? 'chunks' : 'snippets';
            const rows = await quiet(searchElements(config, type, rest, signal), logger);
            return rows.map((row) => ({ label: row.name, detail: row.description || t(prefix === '$' ? 'ac_chunk' : 'ac_snippet'), insert: `${open}${row.name}]]` }));
        }
        case '++': {
            if (rest.length < 2) {
                return [];
            }
            const rows = await quiet(searchElements(config, 'settings', rest, signal), logger);
            return rows.map((row) => ({ label: row.key, detail: row.namespace || t('ac_setting'), insert: `[[++${row.key}]]` }));
        }
        case '~': {
            if (!rest || !config.connectorUrl) {
                return [];
            }
            const rows = await quiet(searchResources(config, rest, { limit: LIMIT, signal }), logger);
            return rows.map((row) => ({ label: row.pagetitle, detail: `ID ${row.id}`, insert: `[[~${row.id}]]` }));
        }
        default:
            return [];
    }
}

/** Items for the text typed after "{$". */
export async function fenomItems(query, { config, t, logger, signal }) {
    const resource = /^_modx->resource\.(\w*)$/.exec(query);
    if (resource) {
        return byRelevance(RESOURCE_FIELDS, resource[1])
            .map((name) => ({ label: name, detail: t('ac_field'), insert: `{$_modx->resource.${name}}` }));
    }
    const setting = /^_modx->config\.([\w.-]*)$/.exec(query);
    if (setting) {
        if (setting[1].length < 2) {
            return [];
        }
        const rows = await quiet(searchElements(config, 'settings', setting[1], signal), logger);
        return rows.map((row) => ({ label: row.key, detail: t('ac_setting'), insert: `{$_modx->config.${row.key}}` }));
    }
    const member = /^_modx->(\w*)$/.exec(query);
    if (member) {
        return byRelevance(FENOM_MODX, member[1], (item) => item.name).map((item) => ({
            label: item.property ? item.name : `${item.name}()`,
            detail: '$_modx',
            insert: `{$_modx->${item.name}${item.property ? '.' : '('}`,
            keep: true,
        }));
    }
    if (!/^\w*$/.test(query)) {
        return [];
    }
    const items = byRelevance(RESOURCE_FIELDS, query)
        .map((name) => ({ label: `$${name}`, detail: t('ac_field'), insert: `{$${name}}` }));
    if ('_modx'.startsWith(query.toLowerCase()) || !query) {
        items.unshift({ label: '$_modx->', detail: 'pdoTools', insert: '{$_modx->', keep: true });
    }
    return items;
}
