import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

const IMAGE = /^image\//;

function filesOf(transfer) {
    return transfer?.files ? [...transfer.files] : [];
}

/**
 * Files dropped or pasted into the editor.
 *
 * Without an upload handler nothing is inserted (never a data: URL in the content) and the
 * user is told to use the Media Browser. With a handler (tiptapeditor.upload_enabled: modx/upload.js,
 * or the runtime option uploadHandler: async (file, { editor }) => url), each image is
 * uploaded by it and inserted with the returned URL. The handler decides where files go, so
 * uploads always pass through MODX.
 *
 * A paste that also carries HTML or text (Word, Google Docs put a picture of the selection
 * on the clipboard too) is left to the normal paste handling.
 */
export const FileDropGuard = Extension.create({
    name: 'fileDropGuard',

    addOptions() {
        return {
            uploadHandler: null,
            onBlocked: () => {},
            onUploading: () => {},
            onUploaded: () => {},
            onError: () => {},
        };
    },

    addProseMirrorPlugins() {
        const { editor } = this;
        const options = this.options;

        const handleFiles = (files, position) => {
            if (typeof options.uploadHandler !== 'function') {
                options.onBlocked();
                return true;
            }
            const images = files.filter((file) => IMAGE.test(file.type));
            if (!images.length) {
                options.onBlocked('images_only');
                return true;
            }
            (async () => {
                options.onUploading(images.length);
                let done = 0;
                for (const file of images) {
                    try {
                        const src = await options.uploadHandler(file, { editor });
                        if (src && typeof src === 'string' && !/^data:/i.test(src) && !editor.isDestroyed) {
                            editor.chain().focus().insertContentAt(position ?? editor.state.selection.to, {
                                type: 'image', attrs: { src, alt: '' },
                            }).run();
                            done += 1;
                        }
                    } catch (error) {
                        options.onError(error);
                    }
                }
                if (done) {
                    options.onUploaded(done);
                }
            })();
            return true;
        };

        return [
            new Plugin({
                key: new PluginKey('tiptapeditorFileDropGuard'),
                props: {
                    handleDrop(view, event) {
                        const files = filesOf(event.dataTransfer);
                        if (!files.length) {
                            return false;
                        }
                        event.preventDefault();
                        const position = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
                        return handleFiles(files, position);
                    },
                    handlePaste(view, event) {
                        const files = filesOf(event.clipboardData);
                        if (!files.length) {
                            return false;
                        }
                        const types = [...(event.clipboardData.types || [])];
                        if (types.includes('text/html') || types.includes('text/plain')) {
                            return false;
                        }
                        event.preventDefault();
                        return handleFiles(files);
                    },
                },
            }),
        ];
    },
});
