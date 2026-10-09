# Сборка и тесты

## Структура проекта

```text
_build/                           сборщик транспортного пакета (на основе ModExtra3)
  build.php  config.inc.php
  elements/  plugins.php settings.php   плагин и системные настройки пакета
  resolvers/ install.php uninstall.php  действия при установке и удалении
assets/components/tiptapeditor/   то, что уходит в пакет: connector.php, js/browser.js, dist/ (собранный бандл)
assets-src/                       исходники редактора (ES-модули, SCSS), в пакет не входят
  js/editor/   создание редактора, конфигурация, синхронизация с полем
  js/syntax/   защита тегов MODX/Fenom, HTML-блоки, проверка потерь
  js/ui/       панель, меню, диалоги, режим HTML-кода
  js/images/   изображения, галереи;  js/links/ ссылки;  js/tables/ таблицы;  js/embed/ iframe
  js/modx/     файловый менеджер, загрузка, коннектор, хуки менеджера MODX
core/components/tiptapeditor/     PHP: bootstrap.php, src/ (PSR-4, пространство имён TipTapEditor), lexicon/, elements/, docs/
docs/                             этот сайт документации (VitePress)
scripts/                          вспомогательные скрипты
tests/unit/  tests/e2e/  tests/fixtures/
```

PHP-классы загружаются через `core/components/tiptapeditor/bootstrap.php`, который MODX выполняет для каждого зарегистрированного пространства имён. Каталог `vendor/` пакету не нужен.

Процессоры коннектора (`core/components/tiptapeditor/src/Processors/`): поиск ресурсов (`Resource/Search`), элементов и настроек для подсказок (`Element/Search*`, `Setting/Search`), копирование картинки по ссылке (`Image/Import`).

## Подготовка

Нужны Node.js 20.19+ (или 22.12+) и npm, для сборки пакета — PHP 8.0+ и сайт на MODX 3.

```bash
npm install
npm run build                    # → assets/components/tiptapeditor/dist/tiptapeditor.js и tiptapeditor.css
npm run watch                    # пересборка при изменениях
npm run check:tiptap-versions    # все @tiptap/* закреплены на одной точной версии
```

Бандл — один IIFE-скрипт и один CSS-файл: MODX подключает скрипты обычными тегами `<script>`, а наружу выходит только `window.TipTapEditor`. Всё (Tiptap, ProseMirror, иконки Lucide) собирается внутрь, внешних загрузок нет.

::: warning Версии Tiptap
Все пакеты `@tiptap/*` должны быть закреплены на **одной точной** версии — смешение версий ломает ProseMirror. Проверка `npm run check:tiptap-versions` сверяет и `package.json`, и установленные пакеты. Обновляйте их вместе.
:::

## Транспортный пакет

Сначала обязательно `npm run build`. Сборщик откажется собирать пакет, если нет `dist/` или если версия в PHP не совпадает с `package.json`.

```bash
# CLI, на любом сайте MODX 3
MODX_CORE_PATH=/path/to/site/core/ php _build/build.php            # только собрать
MODX_CORE_PATH=/path/to/site/core/ php _build/build.php --install  # собрать и установить
```

Работает и раскладка ModExtra3: положите проект в `{site}/Extras/TipTapEditor/` и откройте `/Extras/TipTapEditor/_build/build.php` (`?install=1` — установить, `?download=1` — скачать zip).

Пакет записывается в `core/packages/tiptapeditor-<версия>.transport.zip`.

Что учитывает сборщик:

- версия пакета берётся из `package.json`: `version` + `modx.release` (например, `0.1.0` + `alpha17`);
- при обновлении плагин перезаписывается, а значения системных настроек — нет;
- резолвер установки выставляет `which_editor` и `use_editor` (только при первой установке); резолвер удаления сбрасывает `which_editor` и удаляет плагин, настройки и пространство имён (см. [Установка](../guide/install)).

## Тесты

### Unit-тесты

```bash
npm test     # vitest + happy-dom
```

Покрывают конфигурацию и профили, защиту синтаксиса, проверку потерь, таблицы, изображения, галереи, ссылки, вставку, встраивание, панель и лексиконы. `tests/unit/Lexicon.test.js` проверяет, что каждая строка интерфейса и каждая настройка есть на английском и русском. `tests/unit/Fixtures.test.js` прогоняет HTML из `tests/fixtures/` (статьи, теги MODX, Fenom, таблицы, iframe, произвольный HTML) через редактор и проверяет, что содержимое сохраняется.

### Браузерные тесты (e2e)

Проверяют редактор в настоящем менеджере MODX 3 через Playwright (Chromium).

```bash
M=/path/to/site MODX_URL=http://127.0.0.1:8080 MODX_USER=admin MODX_PASS=secret npm run test:e2e
```

- `M` — корень сайта, `MODX_URL` — адрес, `MODX_USER` / `MODX_PASS` — администратор.
- Другой Chromium можно указать в `PLAYWRIGHT_CHROMIUM=/path/to/chrome`.
- Если сайт работает на встроенном PHP-сервере, отключите opcache — иначе изменения настроек применяются с опозданием.

::: danger Только на тестовом сайте
E2e-тесты меняют `which_editor` и другие системные настройки, создают тестовые TV и ресурсы и пишут в базу. **Никогда не запускайте их на рабочем сайте.**
:::

## Документация

Сайт документации собирается VitePress из `docs/`. Страницы [Системные настройки](../guide/settings) и [История изменений](../changelog) генерируются из исходников пакета (`_build/elements/settings.php`, лексиконы, `core/components/tiptapeditor/docs/changelog.txt` и `changelog.ru.txt`), правьте источники, а не эти страницы.

```bash
npm run docs:generate   # только сгенерировать страницы
npm run docs:dev        # локальный сервер
npm run docs:build      # сборка сайта
```

GitHub Actions (`.github/workflows/docs.yml`) собирает сайт на каждый push и pull request и публикует его в GitHub Pages из ветки `main`.

## Выпуск версии

1. Поднимите версию в `package.json` (`version` и `modx.release`) и ту же строку в `TipTapEditor::VERSION` (`core/components/tiptapeditor/src/TipTapEditor.php`), например `0.1.0-alpha18`.
2. Опишите изменения в `core/components/tiptapeditor/docs/changelog.txt` (английский) и `changelog.ru.txt` (русский), с одинаковым списком версий.
3. Новые строки интерфейса и настройки — в оба лексикона, `en` и `ru`; новые настройки — в `_build/elements/settings.php`.
4. Прогоните проверки: `npm run check:tiptap-versions`, `npm test` и e2e на тестовом сайте.
5. `npm run build`, затем `php _build/build.php`.
6. Если в версии появились новые кнопки, напомните в описании выпуска, что на существующих сайтах их нужно добавить в `tiptapeditor.toolbar` вручную.
