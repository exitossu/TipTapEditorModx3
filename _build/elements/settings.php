<?php

/**
 * System settings. Keys are prefixed with "tiptapeditor." by build.php.
 * On upgrade existing values are never overwritten (see config.inc.php "update");
 * _build/resolvers/settings.php moves values of removed settings and the area of moved ones.
 *
 * The list itself lives in core/components/tiptapeditor/src/Config/Settings.php, which the
 * editor also reads at runtime.
 */

if (!class_exists(\TipTapEditor\Config\Settings::class, false)) {
    require_once dirname(__DIR__, 2) . '/core/components/tiptapeditor/src/Config/Settings.php';
}

return \TipTapEditor\Config\Settings::all();
