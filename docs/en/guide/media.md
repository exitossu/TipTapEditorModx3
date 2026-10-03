# Images, galleries, files

## Media Source and the Media Browser

The editor uses the standard MODX **Media Browser**, so any Media Source type works: the file system, S3 or a custom source.

**Which Media Source a field uses:**

- A richtext TV uses the Media Source assigned to that TV for the resource's context.
- The resource content field uses `tiptapeditor.media_source` (a Media Source ID). If it is empty, it uses the context's `default_media_source`.

**Who may browse:** the user needs the `file_manager` permission, and the Media Source must allow `list` for them. Otherwise the **Link to a file** button is disabled and the image dialog has no **Choose in Media Browser…** button; you can still type an image URL. The Media Browser itself checks the same permissions on every request.

**How URLs are stored:** the editor stores the URL exactly as MODX returns it for the file, like the standard Image TV does. It never builds the URL itself.

| `tiptapeditor.media_url_mode` | Stored URL |
|---|---|
| `relative` (default) | As MODX returns it, for example `assets/images/photo.jpg`. |
| `root` | Relative URLs get the site base URL in front, for example `/assets/images/photo.jpg`. |

Absolute URLs (S3 and other remote sources) are always kept as they are. In the editor, relative image URLs are shown resolved against the site; the stored `src` does not change.

::: details When the in-page Media Browser is not available
The Media Browser normally opens as a window inside the manager page. If that is not possible, the editor opens the standalone browser page (`?a=browser&tiptapeditor=1`) in a popup. The plugin adds a small script there (`OnRichTextBrowserInit`) that sends the chosen file back to the editor. The browser page without the `tiptapeditor` flag is not touched.
:::

## Image dialog

Click **Image**. The **Insert image** dialog opens; with an image selected it is **Edit image**. It also opens after a double click on an image, or with **Enter** on a selected image.

The picture can come from three sources, all next to the **Image URL** field:

| Button | What it does |
|---|---|
| **Choose in Media Browser…** | Pick a file in the Media Browser. With an image selected, the browser opens in the folder of its current file. Non-image files are refused. Shown when you may browse the Media Source. |
| **Upload from computer…** | Pick an image on your computer. It is uploaded into the upload folder (see [Upload](#upload)). Shown when uploads are enabled. |
| **Copy to site** | Type a web address into **Image URL** and click this button: the server downloads the picture into the upload folder, so your page does not depend on the other site. Shown when uploads are enabled. |

You can also just type or paste a URL into **Image URL**. A preview is shown under the field.

The other fields:

| Field | What it does |
|---|---|
| **Alternative text (alt)** | Describes the image for people who cannot see it. Leave it empty for a decorative image. |
| **Title** | The `title` attribute. |
| **Caption** | Text shown under the image. The image is then written as a `<figure>` with a `<figcaption>`. |
| **Open larger on click** | Puts a link to the image around it, for your site's lightbox script (see [below](#captions-and-open-larger)). |
| **Width**, **Height** | Whole pixels (`640`) or a percentage (`100%`). After the preview loads, a **Use original size W × H** button fills in the picture's real size. The original size is never applied by itself. |
| **Alignment** | **None**, **Align left**, **Align center**, **Align right**. Writes the class `align-left`, `align-center` or `align-right`. These classes are styled inside the editor; add the same rules to your site CSS. |
| **Style** | Class presets from `tiptapeditor.image_classes`, for example `{"article-image": "Article"}`. Shown only when presets are set. |
| **Other CSS classes** | Any other classes (called **CSS class** when there are no presets). Classes the dialog does not know are kept. |

The dialog buttons are **Save**, **Cancel** and, for an existing image, **Remove image**.

Good to know:

- Every other attribute of an existing `<img>` is kept as written: `id`, `data-*`, `loading`, `srcset`, `sizes`, `style` and so on. Saving the dialog without changes leaves the image untouched.
- The editor shows the picture without `srcset` (relative entries would load from the manager folder), but saves `srcset` unchanged.
- Not accepted: `data:` URLs (no base64 images in the content), `javascript:` and other unsafe addresses, and event handler attributes. A paragraph with `<img onerror="…">` is kept as an HTML block and the handler never runs in the manager.

## Image menu

When you select a plain image (one without a caption or "open larger" link), a small menu appears above it:

- **Edit image**: opens the image dialog.
- **Replace file**: opens the Media Browser in the folder of the current file and swaps only the file. Alt text, title, size and other attributes stay. Shown only when you may browse the Media Source.
- **Remove image**.

For an image with a caption or link, double click it or press **Enter** to open the dialog.

## Upload

Uploads are off by default. Turn on `tiptapeditor.upload_enabled` to allow them.

- Images are stored in the folder `tiptapeditor.upload_path` (default `assets/uploads/`) **inside the field's Media Source**.
- Files get a safe name: Cyrillic is transliterated, other characters become dashes, and a short random suffix is added. For example, `Скриншот 1.png` becomes `skrinshot-1-x7k2q9.png`.
- The upload goes through MODX's own file upload. The user needs the `file_upload` permission and the source's `create` policy. The Media Source decides which file types are allowed, and `upload_maxsize` applies.
- Images are never stored as base64 in the content.

With uploads on, you can add images:

- by dragging image files into the text, or pasting them;
- with **Upload from computer…** in the image dialog and in the gallery dialog;
- with **Copy to site** in the image dialog (and in the gallery dialog, see below);
- with the optional toolbar buttons `imageUpload` (**Image from computer**) and `imageUrl` (**Image by URL**), which do the same as the dialog buttons.

With uploads off, dropped or pasted files are refused with a message that points to the **Image** button. Dropping non-image files is refused too: use **Link to a file** for them.

### Copying an image from a web address safely

**Copy to site** makes your server download a file, so it is limited to protect your internal network:

- Only `http` and `https` addresses on the standard ports (80 and 443) are accepted.
- The address must lead to a public web site. Addresses that point to the server itself (`localhost`), to your local network or to other private or reserved ranges are refused. This is checked for every address the host name resolves to, and the download goes to exactly the checked address.
- Redirects are followed at most 3 times, and each new address is checked again.
- The download stops at `upload_maxsize`.
- The file must really be a JPEG, PNG, GIF, WebP or AVIF image, checked by its content. SVG is not accepted.

## Captions and "open larger"

An image with a caption is written as a figure:

```html
<figure>
    <img src="assets/uploads/sea.jpg" alt="Sea at sunset">
    <figcaption>Photo: Anna</figcaption>
</figure>
```

You can edit the caption in the dialog or directly in the text. Existing figures with one image (optionally inside a link) and a caption open as editable figures, with all their attributes kept. Other figures stay HTML blocks.

**Open larger on click** puts a link to the image around it. The editor only writes the markup; your site's lightbox script (Fancybox, Lightbox and so on) makes it open larger. Three settings control the markup:

| Setting | Meaning |
|---|---|
| `tiptapeditor.lightbox` | **Open larger on click** is ticked for new images and galleries. You can still change it per image and per gallery. Default: off. |
| `tiptapeditor.lightbox_attribute` | The attribute your lightbox script looks for, for example `data-fancybox`, `data-lightbox` or `data-gallery`. Empty: a plain link. |
| `tiptapeditor.lightbox_label` | The `aria-label` of the link; `{alt}` is replaced with the alt text or the caption. Empty: "Open image: {alt}" in the manager language. |

With `lightbox_attribute` set to `data-fancybox`, a single image gets the attribute with an empty value:

```html
<figure>
    <a href="assets/uploads/sea.jpg" data-fancybox="" aria-label="Open image: Sea at sunset">
        <img src="assets/uploads/sea.jpg" alt="Sea at sunset">
    </a>
    <figcaption>Photo: Anna</figcaption>
</figure>
```

In a gallery all pictures share one group name, so the lightbox can page through them: `data-fancybox="gallery-3fa9c1"`.

If you replace the file of an image whose link opened the old file, the link now opens the new one.

## Galleries

Click **Gallery** to open the **Insert gallery** dialog:

- **Add from Media Browser…**: select several images at once in the Media Browser (Ctrl+click or Shift+click).
- **Upload from computer…**: pick several files; they are uploaded one after another into the upload folder. Shown when uploads are enabled.
- An address field with a button for images by link. With uploads enabled the button is **Copy to site** and the picture is copied into the upload folder. Otherwise the button is **Add** and the address is used as it is.
- For each image: alternative text and caption, **Move up**, **Move down**, **Remove from gallery**.
- **Template**: how the gallery is written (see below). The caption field is hidden for templates without captions.
- **Open larger on click**: a lightbox link around every picture, with one group name for the whole gallery.

In the editor a gallery is a card with thumbnails. Double click it, or press Enter when it is selected, to open **Edit gallery**; **Remove gallery** deletes it. Saving without changes leaves the gallery markup untouched.

### Templates

| Template | Markup |
|---|---|
| `grid` (**Grid**) | `<div class="gallery">` with a `<figure class="gallery__item">` per image. |
| `slider` (**Slider (Swiper)**) | Swiper markup: `div.swiper.gallery-slider` > `div.swiper-wrapper` > `div.swiper-slide`, plus pagination and prev/next buttons. Load Swiper on your site to make it slide. |
| `images` (**Images only**) | `<div class="gallery gallery--images">` with just the images. |

`tiptapeditor.gallery_template` sets the template for new galleries (default `grid`).

A gallery with the `grid` template, as saved:

```html
<div class="gallery" data-tiptapeditor-gallery="grid">
    <figure class="gallery__item">
        <a href="img/1.jpg" data-fancybox="gallery-3fa9c1" aria-label="Open image: Sea"><img src="img/1.jpg" alt="Sea"></a>
        <figcaption>Sea</figcaption>
    </figure>
</div>
```

The outer element carries `data-tiptapeditor-gallery` with the template name, so the editor can open the gallery again for editing.

### Your own templates

Add templates in `tiptapeditor.gallery_templates` as a JSON object. Each template has:

- `label`: the name shown in the dialog;
- `wrapper`: the outer HTML with `{items}` exactly once;
- `item`: the HTML for one picture with `{image}` exactly once and, optionally, `{caption}` once. `{image}` is the `<img>` (with its link when "open larger" is on); `{caption}` is a `<figcaption>` with the caption, or nothing.

```json
{
    "cards": {
        "label": "Cards",
        "wrapper": "<ul class=\"cards\">{items}</ul>",
        "item": "<li class=\"cards__item\"><figure>{image}{caption}</figure></li>"
    }
}
```

Then set `tiptapeditor.gallery_template` to `cards` if new galleries should use it. Invalid templates are skipped. Scripts, `<style>`, form elements, `on*` attributes and `javascript:` addresses are removed from templates, so a template cannot run code in the manager or on the site.

## Files

**Link to a file** (`file`) opens the Media Browser without a file type filter. The selected text becomes a link to the chosen file. If no text is selected, the file name is inserted as the link text. In the link dialog, **File…** does the same.

## Embeds (video and iframes)

**Video or embed** (`embed`) opens the **Insert video or embed** dialog:

- **Video URL or embed code**: a YouTube, VK Video or Rutube page link, an embed URL, or a complete `<iframe>` code. Page links are converted to the player address, for example `https://youtu.be/ID?t=30` becomes `https://www.youtube.com/embed/ID?start=30`.
- **Width** and **Height** (560 × 315 for a new embed): a number, optionally with `px` or `%`.
- **Title** and **Allow fullscreen**, when these attributes are allowed.

In the editor, iframes are shown as cards with the host and size. They are **never loaded in the manager**. Double click or Enter edits an embed; **Remove embed** deletes it. Iframes you do not edit are saved exactly as they were.

Settings:

| Setting | Meaning |
|---|---|
| `tiptapeditor.enable_iframe` | Embeds on or off (default on). |
| `tiptapeditor.iframe_allowed_hosts` | Comma separated hosts allowed in the iframe `src`, subdomains included (`youtube.com` also allows `www.youtube.com`). Empty: any `http(s)` host. |
| `tiptapeditor.iframe_allowed_attributes` | Attributes kept on an iframe. Default: `src,width,height,allow,allowfullscreen,loading,title,name,referrerpolicy,frameborder,class,id,style`. Event handlers (`on*`) are never kept. |

An iframe in existing content that breaks these rules is not dropped: it is kept as an HTML block. Developers can add more video providers with [`TipTapEditor.registerEmbedProvider()`](../dev/api#registerembedprovider).
