// Fails when @tiptap/* packages are not pinned to one exact version (package.json and installed).
import { readFileSync, existsSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
const declared = Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })
    .filter(([name]) => name.startsWith('@tiptap/'));

const errors = [];
const versions = new Set(declared.map(([, version]) => version));
if (versions.size !== 1) {
    errors.push(`@tiptap/* declare different versions: ${[...versions].join(', ')}`);
}
for (const [name, version] of declared) {
    if (!/^\d+\.\d+\.\d+$/.test(version)) {
        errors.push(`${name} must be pinned to an exact version, got "${version}"`);
    }
    const installed = new URL(`../node_modules/${name}/package.json`, import.meta.url);
    if (existsSync(installed)) {
        const actual = JSON.parse(readFileSync(installed)).version;
        if (actual !== version) {
            errors.push(`${name}: installed ${actual}, declared ${version}`);
        }
    }
}

if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
}
console.log(`@tiptap/* pinned to ${[...versions][0]} (${declared.length} packages)`);
