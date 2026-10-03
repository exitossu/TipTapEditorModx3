/**
 * Runs the callback once the manager is ready: Ext.onReady when ExtJS is present,
 * DOMContentLoaded otherwise (or immediately when the DOM is already parsed).
 */
export function onReady(callback) {
    if (window.Ext && typeof window.Ext.onReady === 'function') {
        window.Ext.onReady(callback);
        return;
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback, { once: true });
        return;
    }
    callback();
}
