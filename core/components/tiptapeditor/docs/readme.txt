TipTapEditor for MODX Revolution 3
================================

A rich text editor for the MODX 3 manager based on Tiptap 3 / ProseMirror.

Installation sets the system setting "which_editor" to "TipTapEditor"
and make sure "use_editor" is enabled. The editor replaces the resource
content field and RichText template variables.

The editor keeps MODX tags ([[*field]], [[!snippet? ...]]) and Fenom
constructs ({$var}, {if}...{/if}) exactly as written.

Everything is bundled locally: no CDN, no Tiptap Cloud, no API keys.

Documentation: see README.md in the source repository.
