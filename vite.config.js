import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)));
const version = `${pkg.version}-${pkg.modx.release}`;

// One self-contained classic script + one stylesheet for the MODX manager.
// IIFE: MODX registers scripts with addJavascript() as plain <script> tags,
// and nothing leaks into the global scope except window.TipTapEditor set by the code.
export default defineConfig({
    publicDir: false,
    define: {
        __TIPTAPEDITOR_VERSION__: JSON.stringify(version),
    },
    build: {
        outDir: resolve(import.meta.dirname, 'assets/components/tiptapeditor/dist'),
        emptyOutDir: true,
        target: ['es2022', 'chrome100', 'edge100', 'firefox100', 'safari15.4'],
        cssCodeSplit: false,
        sourcemap: false,
        // One bundle by design (loaded only on pages with an editor; ~160 KB gzipped).
        chunkSizeWarningLimit: 1024,
        rollupOptions: {
            input: resolve(import.meta.dirname, 'assets-src/js/index.js'),
            output: {
                format: 'iife',
                entryFileNames: 'tiptapeditor.js',
                assetFileNames: (asset) => (asset.names?.[0] ?? asset.name ?? '').endsWith('.css')
                    ? 'tiptapeditor.css'
                    : 'assets/[name][extname]',
            },
        },
    },
});
