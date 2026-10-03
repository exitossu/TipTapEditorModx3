# Build and tests

## Project layout

```text
_build/                           transport package builder (based on ModExtra3)
  build.php  config.inc.php
  elements/  plugins.php settings.php
  resolvers/ install.php uninstall.php
assets/components/tiptapeditor/   shipped assets: connector.php, js/browser.js, dist/ (built bundle)
assets-src/                       editor sources (ES modules, SCSS); not shipped
core/components/tiptapeditor/     PHP: bootstrap.php, src/ (PSR-4, namespace TipTapEditor),
                                  lexicon/ (en, ru), elements/, docs/changelog.txt
docs/                             this documentation site (VitePress)
scripts/                          helper scripts (version check, docs generator)
tests/unit/                       unit tests (Vitest + happy-dom)
tests/e2e/                        browser tests against a MODX 3 test site (Playwright)
tests/fixtures/                   acceptance content (MODX tags, Fenom, tables, custom HTML, …)
```

PHP classes are autoloaded through `core/components/tiptapeditor/bootstrap.php`, which MODX runs for every registered namespace. The package needs no `vendor/` directory and has no PHP dependencies.

## Development setup

You need Node.js 20.19+ (or 22.12+) and npm; PHP 8.0+ for the package builder.

```bash
npm install
npm run build                    # -> assets/components/tiptapeditor/dist/tiptapeditor.js + tiptapeditor.css
npm run watch                    # rebuild on every change
npm run check:tiptap-versions    # all @tiptap/* packages pinned to one exact version
```

The bundle is one self-contained script (IIFE) and one stylesheet. Its only global is `window.TipTapEditor`. All dependencies are pinned to exact versions, and all `@tiptap/*` packages must have the same version.

To try a change in a MODX manager, rebuild the bundle and build and install the package on a test site with `--install` (see below).

## Building the transport package

Run `npm run build` first. The builder refuses to package when `dist/` is missing, or when the version constant `TipTapEditor::VERSION` in `core/components/tiptapeditor/src/TipTapEditor.php` differs from the version in `package.json`.

From the command line, against any MODX 3 site:

```bash
MODX_CORE_PATH=/path/to/site/core/ php _build/build.php            # build only
MODX_CORE_PATH=/path/to/site/core/ php _build/build.php --install  # build and install
```

The ModExtra3 layout also works: put the project into `{site}/Extras/TipTapEditor/` and open `/Extras/TipTapEditor/_build/build.php` in the browser. Add `?install=1` to install the package, or `?download=1` to download the zip.

The package is written to `core/packages/tiptapeditor-<version>.transport.zip` of that site.

## Unit tests

```bash
npm test
```

Vitest with happy-dom. The tests cover the tokenizer, syntax protection and loss detection, the acceptance fixtures in `tests/fixtures/` (round trip without changes), tables, links, images, galleries, uploads, embeds, paste cleanup, configuration, the toolbar, and the lexicons (every UI string and setting must exist in `en` and `ru`).

## Browser tests (e2e)

::: danger Only on a test site
The e2e tests log into the manager and change the site: they switch `which_editor` and other system settings, and create test resources and TVs. **Never point them at a production site.**
:::

They need a running MODX 3 site with the package installed, PHP on the command line, and Playwright with Chromium.

```bash
M=/path/to/site MODX_URL=http://127.0.0.1:8080 MODX_USER=admin MODX_PASS=secret npm run test:e2e
```

| Variable | Meaning |
|---|---|
| `M` | Root folder of the test site (helper PHP scripts use it). |
| `MODX_URL` | URL of the site, default `http://127.0.0.1:8080`. |
| `MODX_USER`, `MODX_PASS` | Manager login. |
| `PLAYWRIGHT_CHROMIUM` | Optional: path to the Chromium executable. |

A single test file can be run on its own, for example `node tests/e2e/links.mjs` with the same variables. When you use the PHP built-in server, disable opcache, otherwise setting changes show up late.

## Documentation site

```bash
npm run docs:dev        # generate pages and start a local server
npm run docs:build      # generate pages and build docs/.vitepress/dist
```

`npm run docs:generate` (also run by both commands above) writes the System settings and Changelog pages from `_build/elements/settings.php`, the setting lexicons and `core/components/tiptapeditor/docs/changelog.txt`. Do not edit those pages by hand. The GitHub workflow `.github/workflows/docs.yml` builds the site for every push and pull request and publishes it to GitHub Pages from `main`.

## Releasing

1. Set the version in `package.json` (`version` and `modx.release`, for example `0.1.0` and `alpha17`).
2. Set the same full version in `TipTapEditor::VERSION` (`0.1.0-alpha17`).
3. Describe the changes in `core/components/tiptapeditor/docs/changelog.txt`.
4. Run `npm run check:tiptap-versions`, `npm test` and `npm run build`. Commit the rebuilt `dist/`.
5. Run the e2e tests on a test site.
6. Build the transport package and test the install and the upgrade from the previous version.
