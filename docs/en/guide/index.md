# Introduction

TipTapEditor is a visual (rich text) editor for the MODX Revolution 3 manager. It is built on [Tiptap 3](https://tiptap.dev/) and ProseMirror. After installation it appears as **TipTapEditor** in the `which_editor` system setting. It replaces the plain textarea of the resource content field and of every richtext template variable (TV).

## What it does

- Everyday formatting: headings, bold, italic, lists, quotes, alignment, text color, code blocks.
- Links to URLs, MODX resources (written as `[[~12]]`), files and anchors in the text.
- Images from the MODX Media Browser, from your computer or by link; captions, an "open larger" link for your lightbox script, and galleries.
- Tables with a table toolbar, merged cells and class presets.
- Video embeds (YouTube, VK Video, Rutube or any `<iframe>` code). Embeds are never loaded in the manager.
- MODX tags and Fenom kept exactly as written, with autocomplete for fields, snippets, chunks and settings.
- HTML source mode, fullscreen mode, a bubble menu, a floating menu, slash commands and a status bar.
- Paste cleanup for Word and Google Docs.
- Profiles: a different toolbar and feature set for the content field and for each TV.

## Requirements

- MODX Revolution 3.0 or later
- PHP 8.0 or later

Everything the editor needs ships with the package. You do not need a CDN, Tiptap Cloud, an API key or a paid extension. To build the package from source you also need Node.js 20.19+ (or 22.12+) and npm. See [Build and tests](../dev/build).

## Key principles

### Your content is never changed silently

- When you open a resource and save it without editing, the field is saved exactly as it was. The editor writes to the field only after you change something.
- Before the editor takes over a field, it checks that loading the content loses nothing: elements, attributes, comments and text. HTML the editor cannot show (a `<div>`, a `<script>`, custom elements, and so on) is kept unchanged as an **HTML block**. MODX tags and Fenom become protected badges that are saved character for character.
- If the content still cannot be shown without a loss, the field stays a plain textarea. A short notice explains why.

### A broken editor never blocks your work

The original textarea stays in the page. It is hidden only after the editor has started successfully. If the editor's script fails for any reason, the textarea stays visible and you can keep working and saving as usual.

### Security in plain words

- Your users' rights still apply. Searching resources, browsing and uploading files, and suggesting chunks, snippets and settings all go through MODX, which checks the user's permissions, resource group ACL and Media Source policies.
- Nothing from the content runs in the manager. Scripts, iframes and event handler attributes (`onclick`, `onerror`, …) are shown as inert cards or text.
- Dangerous link addresses (`javascript:`, `vbscript:`, `data:`, `file:`) are refused. Images are never stored as base64 data in the content.
- The external config file is plain data: nothing in it is executed. It is read only from inside the MODX core or site folder.
- "Copy to site" for an image link downloads only from public web addresses, so it cannot be used to reach your internal network.
- Setting values are never shown in autocomplete, only setting names.

## Where to go next

- [Install and upgrade](./install): installation, upgrading, uninstalling.
- [Editing](./editing): what content managers see and do in the editor.
- [Toolbar](./toolbar): choosing the buttons.
- [Images, galleries, files](./media): Media Browser, uploads, captions, galleries, embeds.
- [MODX and Fenom tags](./modx-syntax): how template code is protected.
- [Profiles and configuration](./profiles): different editors for different fields.
- [System settings](./settings): the full list of settings.
- [JS API](../dev/api): for developers who extend the editor.
