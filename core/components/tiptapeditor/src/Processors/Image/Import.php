<?php

namespace TipTapEditor\Processors\Image;

use MODX\Revolution\Processors\Browser\Browser;
use RuntimeException;
use TipTapEditor\Media\RemoteImage;

/**
 * "Image by URL": downloads a picture from a public web address and stores it in the field's
 * Media Source, in tiptapeditor.upload_path, like an uploaded file.
 *
 * Runs through the manager connector (session + modAuth) with the same checks as MODX's own
 * upload (Browser/File/Upload): the file_upload permission, the source's "create" policy, its
 * allowed file types and upload_maxsize. Also needs tiptapeditor.upload_enabled. The folder and
 * the name prefix come from the system settings with their placeholders filled in for the
 * resource (UploadTarget), never a path from the request. The file keeps its own name unless
 * the prefix is set, and never replaces an existing file ("-1", "-2" … instead). Download rules: see Media\RemoteImage.
 *
 * Properties: source (Media Source id), url, wctx, resource, parent, tv.
 * Result object: name (file name in the upload folder), path (the upload folder).
 */
class Import extends Browser
{
    use UploadTarget;

    public $permission = 'file_upload';
    public $policy = 'create';
    public $languageTopics = ['file', 'tiptapeditor:default'];

    public function process()
    {
        if (!$this->modx->getOption('tiptapeditor.upload_enabled', null, false)) {
            return $this->failure($this->modx->lexicon('permission_denied'));
        }
        try {
            ['path' => $path, 'prefix' => $prefix] = $this->uploadTarget();
        } catch (RuntimeException $error) {
            return $this->failure($this->modx->lexicon('tiptapeditor.' . $error->getMessage()));
        }
        $url = (string)$this->getProperty('url', '');
        $maxBytes = (int)$this->modx->getOption('upload_maxsize', null, 1048576);

        try {
            $image = $this->downloader($maxBytes > 0 ? $maxBytes : 1048576)->fetch($url);
        } catch (RuntimeException $error) {
            return $this->failure($this->modx->lexicon('tiptapeditor.' . $error->getMessage()));
        }

        $folder = trim($path, '/');
        $files = $this->source->getFilesystem();
        $name = RemoteImage::uniqueName(
            RemoteImage::fileName($image['name'], $image['extension'], $prefix),
            static function (string $name) use ($files, $folder): bool {
                try {
                    return $files->fileExists(ltrim($folder . '/' . $name, '/'));
                } catch (\Throwable) {
                    return false;
                }
            },
        );
        if (!$this->source->createObject($path, $name, $image['content'])) {
            $errors = $this->source->getErrors();

            return $this->failure($errors ? (string)array_shift($errors) : $this->modx->lexicon('tiptapeditor.image_import_err_download'));
        }

        return $this->success('', ['name' => $name, 'path' => $path]);
    }

    protected function downloader(int $maxBytes): RemoteImage
    {
        return new RemoteImage($maxBytes);
    }
}
