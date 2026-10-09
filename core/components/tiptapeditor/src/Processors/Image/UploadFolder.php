<?php

namespace TipTapEditor\Processors\Image;

use MODX\Revolution\Processors\Browser\Browser;
use RuntimeException;

/**
 * Where an image uploaded from the editor goes: the folder in the field's Media Source and the
 * file name prefix, with the placeholders of tiptapeditor.upload_path and upload_file_prefix
 * filled in for this resource (see UploadTarget). The editor then uploads through MODX's own
 * Browser/File/Upload, which checks the same permissions again.
 *
 * Needs tiptapeditor.upload_enabled, the file_upload permission and the source's "create" policy.
 * Properties: source, resource, parent, tv, wctx. Result object: path, prefix.
 */
class UploadFolder extends Browser
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
            return $this->success('', $this->uploadTarget());
        } catch (RuntimeException $error) {
            return $this->failure($this->modx->lexicon('tiptapeditor.' . $error->getMessage()));
        }
    }
}
