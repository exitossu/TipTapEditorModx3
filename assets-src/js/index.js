import '../scss/main.scss';
import { createApi } from './api.js';
import { onReady } from './utils/ready.js';

// The bundle may be registered twice on one page; keep the first API and init once.
if (!window.TipTapEditor) {
    window.TipTapEditor = createApi();
    onReady(() => window.TipTapEditor.init());
}
