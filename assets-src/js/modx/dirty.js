/**
 * Tells the MODX manager that a field changed, so the save button and the
 * "unsaved changes" warning work as with a plain textarea.
 *
 * - resource content ("ta"): MODx.triggerRTEOnChange(), the core hook meant for RTEs;
 * - richtext TVs: their textarea has onchange="MODx.fireResourceFormChange()", which the
 *   change event fired by the binding already triggers.
 */
export function markModxDirty(textarea) {
    const MODx = window.MODx;
    if (!MODx) {
        return;
    }
    try {
        if (textarea.id === 'ta' && typeof MODx.triggerRTEOnChange === 'function' && window.Ext?.getCmp('modx-panel-resource')) {
            MODx.triggerRTEOnChange();
        }
    } catch {
        // Dirty tracking is a convenience; the value itself is already in the textarea.
    }
}
