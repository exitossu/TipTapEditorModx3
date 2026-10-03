# Install and upgrade

## Install

TipTapEditor is a regular MODX transport package (`tiptapeditor-<version>.transport.zip`).

1. In the manager, open **Extras → Installer**.
2. Upload the package file with **Upload a package**. You can also copy the file into `core/packages/` and use **Search locally for packages**.
3. Click **Install**.

To build the package from source, see [Build and tests](../dev/build).

### What installation does

- It adds the `tiptapeditor` namespace, the `TipTapEditor` plugin and the `tiptapeditor.*` system settings with their default values.
- It sets two core system settings so the editor works right away:
  - `which_editor` = `TipTapEditor`
  - `use_editor` = `1`

  The previous values are written to the install log. Context, user group and user settings are not changed: if you set `which_editor` there on purpose, those values still apply.

After installation, open any resource. Its content field and its richtext TVs now use the editor.

::: tip Content field and the "Rich text" option
The content field uses the editor only when the resource's **Rich text** option is on (on the Settings tab of the resource). This option affects only the content field, not the TVs.
:::

### Richtext TVs

Every TV with the input type **Rich Text** gets its own editor on the resource page:

- Each TV is saved and marked as changed on its own.
- A TV on a hidden tab or in a collapsed category starts its editor when it becomes visible.
- TVs added or removed later (template switch, Form Customization, other extras) are picked up automatically.
- A read-only TV gets a read-only editor. A disabled TV stays a plain textarea.
- Images and files of a TV use the Media Source assigned to that TV.
- A TV can have its own toolbar and features through a profile. See [Profiles and configuration](./profiles).

## Upgrade

Install the new version over the old one in **Extras → Installer**.

- Your `tiptapeditor.*` system settings, your external config file and your content stay as they are. An upgrade never resets them.
- `which_editor` and `use_editor` are not changed on upgrade.

::: warning New toolbar buttons are not added automatically
If you changed `tiptapeditor.toolbar`, the upgrade keeps your value, so buttons added in a new version (for example `gallery`, `embed` or `file`) do not appear by themselves. Add them to the setting yourself. Compare your value with the default toolbar in [Toolbar](./toolbar#default-toolbar).
:::

## Moving from TiptapRTE

Up to version 0.1.0-alpha15 the extra was called **TiptapRTE**. In 0.1.0-alpha16 it was renamed to TipTapEditor: namespace, settings (`tiptapeditor.*`), folders, plugin, category and the editor name in `which_editor`. The two packages are separate, so:

1. Write down your `tiptaprte.*` settings (toolbar, profiles, class presets, and so on).
2. Uninstall the old **TiptapRTE** package in **Extras → Installer**.
3. Install **TipTapEditor**.
4. Enter your settings again under the new prefix `tiptapeditor.*`.

Good to know:

- If TiptapRTE is still installed, the installer writes a warning to the log. The old package is not used any more.
- `which_editor` values that still say `Tiptap RTE` (in system, context, user group or user settings) are switched to `TipTapEditor` automatically on install and upgrade.
- Galleries saved by TiptapRTE (marked with `data-tiptaprte-gallery`) still open as galleries. When you save such a gallery again, it gets the new attribute `data-tiptapeditor-gallery`.
- Your resource content does not need any change.

## Uninstall

Uninstalling in **Extras → Installer**:

- removes the plugin, the `tiptapeditor.*` system settings, the namespace and the files;
- resets `which_editor` to an empty value (the plain textarea) wherever it pointed to `TipTapEditor`: in system, context, user group and user settings. This way the manager never tries to load a missing editor;
- never changes resource content or TV values.

When the package manager only reverts to a previous version of the package, nothing is removed.
