/**
 * TipTapEditor: callback for the standalone MODX Media Browser page (?a=browser&tiptapeditor=1).
 *
 * Loaded only there by the OnRichTextBrowserInit handler. The editor normally uses the
 * in-page browser window; this page is the fallback for managers where that window is not
 * available. The chosen file is posted to the editor window with an explicit origin.
 */
(function () {
    'use strict';

    var api = window.TipTapEditor = window.TipTapEditor || {};
    var FIELDS = ['url', 'relativeUrl', 'fullRelativeUrl', 'name', 'ext', 'image_width', 'image_height', 'source'];

    api.browserCallback = function (data) {
        var target = window.opener || (window.parent !== window ? window.parent : null);
        if (!target || !data) {
            return;
        }
        var file = {};
        FIELDS.forEach(function (key) {
            if (data[key] !== undefined && data[key] !== null) {
                file[key] = data[key];
            }
        });
        target.postMessage({ source: 'tiptapeditor', action: 'selectFile', data: file }, window.location.origin);
        if (window.opener) {
            window.close();
        }
    };
})();
