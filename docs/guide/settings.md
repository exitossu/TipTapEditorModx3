---
outline: [2, 2]
---

# Системные настройки

Все настройки находятся в разделе «Системные настройки», пространство имён `tiptapeditor`. Их можно переопределить в настройках контекста, группы пользователей или пользователя. При обновлении пакета значения не сбрасываются.

::: tip
Страница собирается автоматически из исходников пакета (`npm run docs:generate`).
:::

## Интерфейс

| Ключ | Описание | По умолчанию |
|---|---|---|
| <code>tiptapeditor.toolbar</code> | **Панель инструментов** Кнопки через пробел, группы через «\|». Пример: undo redo \| heading \| bold italic \| link image. | <code>undo redo \| heading \| bold italic underline strike code \| color highlight \| superscript subscript \| align \| bulletList orderedList \| blockquote horizontalRule \| link modxLink anchor \| image gallery file table embed \| codeBlock \| clearFormatting \| source fullscreen</code> |
| <code>tiptapeditor.profiles</code> | **Профили** JSON-объект именованных профилей, например {"simple": {"toolbar": "bold italic link"&#125;&#125;. Профиль переопределяет toolbar и функции. | (пусто) |
| <code>tiptapeditor.default_profile</code> | **Профиль по умолчанию** Профиль, который используется, если не задан другой. | <code>default</code> |
| <code>tiptapeditor.content_profile</code> | **Профиль поля content** Профиль для поля content ресурса. Пусто — профиль по умолчанию. | (пусто) |
| <code>tiptapeditor.tv_profiles</code> | **Профили TV** Имя TV → профиль: JSON-объект, например {"introtext": "simple"}, или пары имя=профиль по одной в строке или через запятую. | (пусто) |
| <code>tiptapeditor.heading_levels</code> | **Уровни заголовков** Доступные уровни заголовков через запятую. | <code>1,2,3,4,5,6</code> |
| <code>tiptapeditor.bubble_menu</code> | **Всплывающее меню** Показывать меню форматирования над выделенным текстом. | Да |
| <code>tiptapeditor.floating_menu</code> | **Плавающее меню** Показывать меню вставки на пустом абзаце. | Да |
| <code>tiptapeditor.slash_commands</code> | **Slash-команды** Ввод «/» на пустой строке открывает меню блоков. | Да |
| <code>tiptapeditor.statusbar</code> | **Строка состояния** Показывать количество слов и символов и путь текущего элемента. | Нет |
| <code>tiptapeditor.sticky_toolbar</code> | **Закреплённая панель** Панель инструментов остаётся видимой при прокрутке. | Да |
| <code>tiptapeditor.enable_fullscreen</code> | **Полноэкранный режим** Разрешить кнопку полноэкранного режима (выход — Esc). | Да |
| <code>tiptapeditor.min_height</code> | **Минимальная высота** Минимальная высота редактора в пикселях. | <code>200</code> |
| <code>tiptapeditor.max_height</code> | **Максимальная высота** Максимальная высота при автоувеличении, в пикселях. 0 — без ограничения. | <code>700</code> |
| <code>tiptapeditor.default_height</code> | **Высота по умолчанию** Высота редактора в пикселях, если автоувеличение выключено. | <code>300</code> |
| <code>tiptapeditor.autogrow</code> | **Автоувеличение** Редактор растёт вместе с содержимым до максимальной высоты. | Да |
| <code>tiptapeditor.content_css</code> | **CSS содержимого** Список CSS-файлов сайта через запятую для отображения содержимого в редакторе, например /assets/css/content.css,/assets/css/article.css. | (пусто) |

## Содержимое

| Ключ | Описание | По умолчанию |
|---|---|---|
| <code>tiptapeditor.enable_tables</code> | **Таблицы** Таблицы в редакторе: кнопка таблицы и панель таблицы. Если выключено, контент с таблицами остаётся в обычном текстовом поле. | Да |
| <code>tiptapeditor.enable_images</code> | **Изображения** Включить изображения. | Да |
| <code>tiptapeditor.enable_iframe</code> | **Iframe и встраивание** Включить iframe и встраивание видео. | Да |
| <code>tiptapeditor.iframe_allowed_attributes</code> | **Разрешённые атрибуты iframe** Список разрешённых атрибутов iframe через запятую. Обработчики событий (on*) удаляются всегда. | <code>src,width,height,allow,allowfullscreen,loading,title,name,referrerpolicy,frameborder,class,id,style</code> |
| <code>tiptapeditor.iframe_allowed_hosts</code> | **Разрешённые хосты iframe** Список хостов, разрешённых в src у iframe, через запятую. Пусто — любой хост. | (пусто) |
| <code>tiptapeditor.paste_as_text</code> | **Вставка как текст** Вставлять содержимое буфера обмена как простой текст. | Нет |
| <code>tiptapeditor.image_classes</code> | **Пресеты классов изображений** Классы для изображений: JSON-объект {"css-класс": "Название"} или список классов через запятую. | (пусто) |
| <code>tiptapeditor.enable_gallery</code> | **Галереи** Включить кнопку «Галерея»: несколько изображений по шаблону (сетка, слайдер…). | Да |
| <code>tiptapeditor.gallery_template</code> | **Шаблон галереи** Шаблон новых галерей: grid (сетка), slider (разметка Swiper), images (только изображения) или имя своего шаблона (имя файла в папке шаблонов галереи, без .html). | <code>grid</code> |
| <code>tiptapeditor.gallery_templates_path</code> | **Папка шаблонов галереи** Папка с файлами шаблонов галереи, один .html файл на шаблон (grid.html, slider.html …); имя файла — имя шаблона. Внутри core_path или base_path. Установка один раз кладёт сюда стандартные шаблоны; пакет никогда не перезаписывает и не удаляет файлы в этой папке, поэтому ваши правки сохраняются при обновлении. | <code>{core_path}elements/tiptapeditor/gallery/</code> |
| <code>tiptapeditor.lightbox</code> | **Увеличение изображений по клику** Новые изображения и галереи получают ссылку на изображение вокруг картинки (&lt;figure&gt;&lt;a href="…"&gt;&lt;img&gt;&lt;/a&gt;&lt;/figure&gt;) для скрипта-лайтбокса на сайте. В диалоге включается и выключается для каждой картинки и галереи. | Нет |
| <code>tiptapeditor.lightbox_attribute</code> | **Атрибут лайтбокса** Атрибут, который ищет ваш скрипт-лайтбокс, например data-fancybox (Fancybox), data-lightbox, data-gallery. У одиночного изображения он без значения, у галереи — с именем группы (data-fancybox="gallery-3fa9c1"). Пусто — обычная ссылка. | (пусто) |
| <code>tiptapeditor.lightbox_label</code> | **Подпись ссылки увеличения** aria-label ссылки, {alt} — альтернативный текст или подпись. Пусто — «Открыть изображение: {alt}» на языке менеджера. | (пусто) |
| <code>tiptapeditor.link_classes</code> | **Пресеты классов ссылок** CSS-классы для диалога ссылки: JSON-объект {"css-класс": "Название"} или список классов через запятую. Пусто — свободное текстовое поле. | (пусто) |
| <code>tiptapeditor.paragraph_classes</code> | **Пресеты классов абзацев** Классы для абзацев: JSON-объект {"css-класс": "Название"} или список классов через запятую. | (пусто) |
| <code>tiptapeditor.table_classes</code> | **Пресеты классов таблиц** CSS-классы в диалоге таблицы: JSON-объект {"css-класс": "Название"} (в одной записи можно несколько классов) или список через запятую. | (пусто) |
| <code>tiptapeditor.preserve_style_attribute</code> | **Сохранять атрибут style** Сохранять существующие атрибуты style без изменений. Выключите, чтобы удалять inline-стили. | Да |

## Интеграция с MODX

| Ключ | Описание | По умолчанию |
|---|---|---|
| <code>tiptapeditor.protect_modx_syntax</code> | **Защита тегов MODX** Сохранять теги MODX, например [[*pagetitle]] и [[!snippet? ...]], без изменений: они показываются защищёнными плашками, не экранируются и не разбиваются, в том числе при правке текста вокруг. | Да |
| <code>tiptapeditor.protect_fenom_syntax</code> | **Защита Fenom** Сохранять конструкции Fenom, например {$var}, {if}...{/if} и {foreach}, без изменений: они показываются защищёнными плашками или карточками и не экранируются. «{ » с пробелом остаётся текстом (CSS, JSON). | Да |
| <code>tiptapeditor.fenom_tags</code> | **Дополнительные теги Fenom** Имена собственных тегов или функций Fenom через запятую (myTag, other), которые нужно защищать помимо встроенных ключевых слов (if, foreach, set, include, ...). | (пусто) |
| <code>tiptapeditor.modx_autocomplete</code> | **Автодополнение MODX** Подсказывать поля, сниппеты, чанки и настройки при вводе тегов MODX. | Да |
| <code>tiptapeditor.fenom_autocomplete</code> | **Автодополнение Fenom** Подсказывать основные переменные Fenom при вводе. | Нет |
| <code>tiptapeditor.links_across_contexts</code> | **Ссылки между контекстами** Нет (по умолчанию): поиск ресурса MODX в диалоге ссылки ищет только в контексте редактируемого ресурса. Да: во всех контекстах, доступных пользователю (кроме mgr). | Нет |
| <code>tiptapeditor.resource_link_format</code> | **Формат ссылки на ресурс** href для ресурса MODX, выбранного в диалоге ссылки. {id} — ID ресурса (обязательно); также заменяются {context} и {uri}. По умолчанию: [[~{id}]]. | <code>[[~{id}]]</code> |
| <code>tiptapeditor.media_source</code> | **Источник файлов** ID источника файлов для файлового браузера. Пусто — источник контекста по умолчанию или источник TV. | (пусто) |
| <code>tiptapeditor.media_url_mode</code> | **Формат URL файлов** «relative» (по умолчанию) — URL в точности как вернул файловый менеджер MODX, как в TV «Изображение»; «root» — к относительным URL добавляется base URL сайта (например, /assets/img/a.jpg). Абсолютные URL (S3 и другие удалённые источники) всегда сохраняются как есть. | <code>relative</code> |
| <code>tiptapeditor.upload_enabled</code> | **Загрузка перетаскиванием и вставкой** Загружать перетащенные и вставленные в редактор изображения в источник файлов поля, в папку tiptapeditor.upload_path. Загрузка идёт через штатную загрузку MODX (право file_upload, политики источника, разрешённые типы файлов и upload_maxsize). Изображения никогда не сохраняются в base64. | Нет |
| <code>tiptapeditor.upload_path</code> | **Папка загрузки** Папка в источнике файлов поля для загружаемых изображений, например assets/uploads/ или assets/uploads/{y}/{m}/{id}/. Подстановки: {id}, {pid} (ID родителя), {alias}, {palias} (алиас родителя), {context}, {tid} (ID TV, пусто для поля content), {uid} (ID пользователя), {rand} (случайная строка), {t} (timestamp), {y}, {m}, {d}, {h}, {i}, {s}. {id} и {alias} работают после сохранения ресурса. | <code>assets/uploads/</code> |
| <code>tiptapeditor.upload_file_prefix</code> | **Префикс имени загружаемого файла** Имя загружаемого изображения, например {id} даст 15.jpg (расширение сохраняется). Пусто: у файла остаётся своё имя. Если имя в папке уже занято, добавляется -1, -2 …. Те же подстановки, что в папке загрузки. | (пусто) |
| <code>tiptapeditor.upload_rand_length</code> | **Длина {rand}** Количество символов подстановки {rand} (1–32). | <code>6</code> |

## Система

| Ключ | Описание | По умолчанию |
|---|---|---|
| <code>tiptapeditor.external_config</code> | **Внешняя конфигурация** Путь к JSON-файлу с дополнительной конфигурацией, например {core_path}config/tiptapeditor.json. Читаются только данные, код не выполняется. | (пусто) |
| <code>tiptapeditor.debug</code> | **Режим отладки** Выводить диагностические сообщения в консоль браузера и журнал ошибок MODX. | Нет |
