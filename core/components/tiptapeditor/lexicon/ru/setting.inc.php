<?php

/**
 * TipTapEditor system settings lexicon (ru).
 */

$_lang['area_tiptapeditor.main'] = 'Интерфейс';
$_lang['area_tiptapeditor.content'] = 'Содержимое';
$_lang['area_tiptapeditor.modx'] = 'Интеграция с MODX';
$_lang['area_tiptapeditor.system'] = 'Система';
$_lang['area_tiptapeditor.tuning'] = 'Расширенные';

$_lang['setting_tiptapeditor.toolbar'] = 'Панель инструментов';
$_lang['setting_tiptapeditor.toolbar_desc'] = 'Кнопки через пробел, группы через «|», например undo redo | heading | bold italic | link image. Пусто — панель пакета, в которой с обновлениями появляются новые кнопки. Кнопки, которых нет в списке, не показываются.';
$_lang['setting_tiptapeditor.profiles'] = 'Профили';
$_lang['setting_tiptapeditor.profiles_desc'] = 'JSON-объект именованных профилей, например {"simple": {"toolbar": "bold italic link"}}. Профиль «default» применяется ко всем полям, «content» — к полю content ресурса. Профиль задаёт панель, меню, уровни заголовков, функции и другое (см. документацию, «Профили»).';
$_lang['setting_tiptapeditor.tv_profiles'] = 'Профили TV';
$_lang['setting_tiptapeditor.tv_profiles_desc'] = 'Имя TV → профиль: JSON-объект, например {"introtext": "simple"}, или пары имя=профиль по одной в строке или через запятую.';
$_lang['setting_tiptapeditor.content_css'] = 'CSS содержимого';
$_lang['setting_tiptapeditor.content_css_desc'] = 'Список CSS-файлов сайта через запятую для отображения содержимого в редакторе, например /assets/css/content.css,/assets/css/article.css.';
$_lang['setting_tiptapeditor.min_height'] = 'Минимальная высота';
$_lang['setting_tiptapeditor.min_height_desc'] = 'Минимальная высота области редактирования в пикселях. Редактор растёт вместе с содержимым до максимальной высоты.';
$_lang['setting_tiptapeditor.max_height'] = 'Максимальная высота';
$_lang['setting_tiptapeditor.max_height_desc'] = 'Максимальная высота области редактирования в пикселях, дальше появляется прокрутка. 0 — без ограничения. Значение, равное минимальной высоте, даёт фиксированную высоту.';

$_lang['setting_tiptapeditor.iframe_allowed_hosts'] = 'Разрешённые хосты iframe';
$_lang['setting_tiptapeditor.iframe_allowed_hosts_desc'] = 'Список хостов, разрешённых в src у iframe (встраивание, видео в галереях), через запятую. Пусто — любой хост.';
$_lang['setting_tiptapeditor.image_classes'] = 'Пресеты классов изображений';
$_lang['setting_tiptapeditor.image_classes_desc'] = 'Классы для изображений: JSON-объект {"css-класс": "Название"} или список классов через запятую.';
$_lang['setting_tiptapeditor.link_classes'] = 'Пресеты классов ссылок';
$_lang['setting_tiptapeditor.link_classes_desc'] = 'CSS-классы для диалога ссылки: JSON-объект {"css-класс": "Название"} или список классов через запятую. Пусто — свободное текстовое поле.';
$_lang['setting_tiptapeditor.paragraph_classes'] = 'Пресеты классов абзацев';
$_lang['setting_tiptapeditor.paragraph_classes_desc'] = 'Классы для абзацев и заголовков (кнопка панели paragraphClass): JSON-объект {"css-класс": "Название"} или список классов через запятую.';
$_lang['setting_tiptapeditor.table_classes'] = 'Пресеты классов таблиц';
$_lang['setting_tiptapeditor.table_classes_desc'] = 'CSS-классы в диалоге таблицы: JSON-объект {"css-класс": "Название"} (в одной записи можно несколько классов) или список через запятую.';
$_lang['setting_tiptapeditor.gallery_template'] = 'Шаблон галереи';
$_lang['setting_tiptapeditor.gallery_template_desc'] = 'Шаблон новых галерей: grid (сетка), slider (разметка Swiper), images (только изображения) или имя своего шаблона (имя файла в папке шаблонов галереи, без .html).';
$_lang['setting_tiptapeditor.lightbox'] = 'Увеличение изображений по клику';
$_lang['setting_tiptapeditor.lightbox_desc'] = 'Новые изображения и галереи получают ссылку на изображение вокруг картинки (<figure><a href="…"><img></a></figure>) для скрипта-лайтбокса на сайте. В диалоге включается и выключается для каждой картинки и галереи.';
$_lang['setting_tiptapeditor.lightbox_attribute'] = 'Атрибут лайтбокса';
$_lang['setting_tiptapeditor.lightbox_attribute_desc'] = 'Атрибут, который ищет ваш скрипт-лайтбокс, например data-fancybox (Fancybox), data-lightbox. У одиночного изображения он без значения, у галереи — с именем группы (data-fancybox="gallery-3fa9c1"). Пусто — обычная ссылка.';

$_lang['setting_tiptapeditor.fenom'] = 'Fenom';
$_lang['setting_tiptapeditor.fenom_desc'] = 'auto (по умолчанию): конструкции Fenom, например {$var} и {if}…{/if}, сохраняются без изменений; подсказки переменных включены, если pdoTools обрабатывает Fenom. 1 — защита и подсказки всегда. 0 — Fenom считается обычным текстом.';
$_lang['setting_tiptapeditor.upload_enabled'] = 'Загрузка перетаскиванием и вставкой';
$_lang['setting_tiptapeditor.upload_enabled_desc'] = 'Загружать перетащенные и вставленные в редактор изображения в источник файлов поля, в папку tiptapeditor.upload_path. Загрузка идёт через штатную загрузку MODX (право file_upload, политики источника, разрешённые типы файлов и upload_maxsize). Изображения никогда не сохраняются в base64.';
$_lang['setting_tiptapeditor.upload_path'] = 'Папка загрузки';
$_lang['setting_tiptapeditor.upload_path_desc'] = 'Папка в источнике файлов поля для загружаемых изображений, например assets/uploads/ или assets/uploads/{y}/{m}/{id}/. Подстановки вроде {id}, {alias}, {y}, {m}, {rand} или {rand:8} перечислены в документации («Изображения, галереи, файлы»).';

$_lang['setting_tiptapeditor.external_config'] = 'Внешняя конфигурация';
$_lang['setting_tiptapeditor.external_config_desc'] = 'Путь к JSON-файлу с дополнительной конфигурацией и профилями, например {core_path}config/tiptapeditor.json. Читаются только данные, код не выполняется.';
$_lang['setting_tiptapeditor.debug'] = 'Режим отладки';
$_lang['setting_tiptapeditor.debug_desc'] = 'Выводить диагностические сообщения в консоль браузера и журнал ошибок MODX.';

$_lang['setting_tiptapeditor.gallery_templates_path'] = 'Папка шаблонов галереи';
$_lang['setting_tiptapeditor.gallery_templates_path_desc'] = 'Папка с файлами шаблонов галереи, один .html файл на шаблон; имя файла — имя шаблона. Внутри core_path или base_path. Пакет один раз кладёт сюда свои шаблоны и никогда не перезаписывает и не удаляет файлы в этой папке.';
$_lang['setting_tiptapeditor.fenom_tags'] = 'Дополнительные теги Fenom';
$_lang['setting_tiptapeditor.fenom_tags_desc'] = 'Имена собственных тегов или функций Fenom через запятую (myTag, other), которые нужно защищать помимо встроенных ключевых слов (if, foreach, set, include, ...).';
$_lang['setting_tiptapeditor.links_across_contexts'] = 'Ссылки между контекстами';
$_lang['setting_tiptapeditor.links_across_contexts_desc'] = 'Нет (по умолчанию): поиск ресурса MODX в диалоге ссылки ищет только в контексте редактируемого ресурса. Да: во всех контекстах, доступных пользователю (кроме mgr).';
$_lang['setting_tiptapeditor.resource_link_format'] = 'Формат ссылки на ресурс';
$_lang['setting_tiptapeditor.resource_link_format_desc'] = 'href для ресурса MODX, выбранного в диалоге ссылки. {id} — ID ресурса (обязательно); также заменяются {context} и {uri}. По умолчанию: [[~{id}]].';
$_lang['setting_tiptapeditor.media_source'] = 'Источник файлов';
$_lang['setting_tiptapeditor.media_source_desc'] = 'ID источника файлов для поля content ресурса. Пусто — default_media_source контекста. TV всегда используют свой источник.';
$_lang['setting_tiptapeditor.media_url_mode'] = 'Формат URL файлов';
$_lang['setting_tiptapeditor.media_url_mode_desc'] = 'relative (по умолчанию) — URL в точности как вернул файловый менеджер MODX, как в TV «Изображение». root — к относительным URL добавляется base URL сайта (/assets/img/a.jpg). Абсолютные URL (S3 и другие удалённые источники) всегда сохраняются как есть.';
$_lang['setting_tiptapeditor.upload_file_prefix'] = 'Имя загружаемого файла';
$_lang['setting_tiptapeditor.upload_file_prefix_desc'] = 'Имя загружаемого изображения, например {id} даст 15.jpg (расширение сохраняется). Пусто: у файла остаётся своё имя. Если имя в папке уже занято, добавляется -1, -2 …. Те же подстановки, что в папке загрузки.';
