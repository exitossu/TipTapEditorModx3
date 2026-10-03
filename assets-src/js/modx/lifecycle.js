/**
 * Hooks into the MODX manager lifecycle.
 *
 * - MODx.loadRTE / MODx.unloadRTE: called by the resource panel after setup and when the
 *   "Rich text" checkbox is toggled; they mount/unmount editors.
 * - MODx.afterTVLoad: called after TVs (and Form Customization rules) are in place; mounts
 *   richtext TVs that appeared.
 * - MODx.FormPanel#submit: every editor is synced before the panel's beforeSubmit handlers
 *   read field values (the resource panel copies #ta into hiddenContent there).
 * - capture-phase "submit" on document: the same for plain HTML forms.
 *
 * @returns {() => void} uninstall function
 */
export function installModxHooks(api) {
    const MODx = window.MODx;
    const restore = [];

    const onSubmit = () => api.syncAll();
    document.addEventListener('submit', onSubmit, true);
    restore.push(() => document.removeEventListener('submit', onSubmit, true));

    if (!MODx) {
        return () => restore.forEach((fn) => fn());
    }

    const replace = (owner, key, factory) => {
        const original = owner[key];
        owner[key] = factory(original);
        restore.push(() => {
            owner[key] = original;
        });
    };

    replace(MODx, 'loadRTE', () => (elements) => api.mount(elements || undefined));
    replace(MODx, 'unloadRTE', () => (elements) => api.unmount(elements || undefined));
    replace(MODx, 'afterTVLoad', (original) => function afterTVLoad(...args) {
        const result = typeof original === 'function' ? original.apply(this, args) : undefined;
        api.refresh();
        return result;
    });

    const formPanel = MODx.FormPanel?.prototype;
    if (formPanel && typeof formPanel.submit === 'function') {
        replace(formPanel, 'submit', (original) => function submit(...args) {
            api.syncAll();
            return original.apply(this, args);
        });
    }

    return () => restore.forEach((fn) => fn());
}
