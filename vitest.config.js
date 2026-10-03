import { defineConfig } from 'vitest/config';

export default defineConfig({
    define: {
        __TIPTAPEDITOR_VERSION__: JSON.stringify('test'),
    },
    test: {
        environment: 'happy-dom',
        setupFiles: ['tests/unit/setup/quietIframes.js'],
        include: ['tests/unit/**/*.test.js'],
    },
});
