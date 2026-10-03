# MODX and Fenom tags

MODX content often holds template code: MODX tags like `[[*pagetitle]]` or `[[!pdoResources? …]]`, and Fenom expressions like `{$_modx->resource.pagetitle}` or `{if …}{/if}`. A normal visual editor breaks such code: it escapes `&` to `&amp;` (so the snippet no longer sees its parameters), moves Fenom loops out of lists and tables, and drops attributes.

TipTapEditor protects template code. It is kept exactly as written, character for character, also when you edit the text around it.

## What is protected

### MODX tags

Everything between `[[` and the matching `]]`, with any prefix: `*`, `++`, `~`, `$`, `%`, `+`, `-`, `!`, `#`. Output filters, properties and nested tags are part of the same tag, so this is one tag:

```html
[[!pdoResources? &parents=`10` &tpl=`@INLINE <li>[[+pagetitle]]</li>`]]
```

An unclosed `[[` is ordinary text.

### Fenom

A `{` directly followed by `$`, `/`, `*`, a quote or a Fenom keyword (`if`, `elseif`, `else`, `foreach`, `for`, `switch`, `set`, `var`, `include`, `insert`, `extends`, `block`, `macro`, `import`, `filter`, `ignore`, `raw`, `cycle`, `unset` and others) up to the matching `}`. Quoted strings and nested braces inside are taken into account.

- `{* … *}` comments and `{ignore}…{/ignore}` are one construct each.
- `{ ` with a space after the brace is plain text. This is Fenom's own rule, so CSS and JSON in the text stay text.
- Names of your own Fenom tags or functions go into `tiptapeditor.fenom_tags`, comma separated (`myTag, other`).

```html
{if $_modx->resource.parent == 5}
    <p>{$_modx->resource.introtext}</p>
{/if}
```

## How tags look in the editor

| Where the tag is | How it is shown |
|---|---|
| In a line of text (`Hello, [[+name]]!`) | A **badge**. It cannot be split, typed into or formatted on its own. `&`, `<` and quotes in it are never escaped. |
| On a line of its own between blocks (`[[!pdoResources? …]]`, `{if …}`, `{/foreach}`) | A **card** showing the full source. |
| In an attribute (`href="[[~12]]"`, `src="[[+image]]"`, `class="{$cls}"`) | Plain text in the link and image dialogs. It is written back without escaping. |

To change a tag, double click its badge or card, or select it and press **Enter**. The **MODX / Fenom code** dialog shows the source. **Ctrl/Cmd+Enter** saves; an empty field removes the tag.

When you type or paste a complete tag, it becomes a badge. `[[*pagetitle` stays text until you type `]]`. Backticks inside a MODX tag you are typing do not start inline code. Text in code blocks and inline code is never turned into badges.

## HTML blocks

Some HTML has no matching tool in the editor: `<div>`, `<section>`, `<span class="…">`, `<script>`, `<style>`, `<iframe>` outside the allowed rules, custom elements, Fenom loops between table rows or list items, tags inside `<pre>`, elements with event handler attributes, and so on.

Such HTML is not removed or "fixed". It is kept byte for byte as an **HTML block**:

- The editor shows a card with the element name and a text-only preview. Nothing of it is rendered or run in the manager.
- Double click or **Enter** opens its source in the **HTML block** dialog. **Ctrl/Cmd+Enter** saves; an empty field removes the block.
- Everything around the block stays fully editable.

**Why non-editable?** The editor could only show such HTML by changing it: a `<div>` would be unwrapped, a `{foreach}` between `<tr>` rows would be moved, a script would be run. Keeping it as a block is the only way to save it unchanged.

Some cases where a regular element becomes an HTML block:

- a tag inside a tag (`<li[[+attr]]>`) or a double quote inside a tag in an attribute;
- a table with `<caption>`, `<colgroup>`, attributes on `<thead>`/`<tbody>`/`<tfoot>`, or MODX/Fenom code between rows;
- a figure that is not one image with a caption;
- an iframe outside `tiptapeditor.iframe_allowed_hosts` or `iframe_allowed_attributes`.

Paragraphs, headings, quotes, lists, links and inline formatting keep their attributes (`id`, `class`, `data-*`, `aria-*`, `style`, …) and stay editable: `<p class="lead">` is a normal paragraph.

## What can change when you edit

Saving without edits never changes anything. After you edit, these differences are possible, all without changing the meaning:

- line breaks and spaces between blocks;
- the order of attributes on some elements;
- `style` values only where the editor sets them (alignment);
- a bare `&` in text is written as `&amp;` (the same HTML).

If loading the content would lose anything else, the field stays a plain textarea with a notice. The same check runs when you leave [HTML source mode](./editing#html-source-mode).

::: warning Private use characters
The editor uses the Unicode characters U+E000 and U+E001 internally. Content that contains them stays in the plain textarea (or in source mode) and is saved as it is.
:::

## Autocomplete

While you type, the editor suggests MODX tags and Fenom expressions:

| You type | Suggestions |
|---|---|
| `[[` | Tag types |
| `[[*` | Resource fields and TVs, for example `[[*pagetitle]]` |
| `[[!name` or `[[name` | Snippets |
| `[[$name` | Chunks |
| `[[++key` | System setting keys (never their values) |
| `[[~title` | Resources, written as `[[~12]]` |
| `{$` | Resource fields as Fenom variables, and `$_modx` (with Fenom autocomplete on) |
| `{$_modx->` | Members of pdoTools' `$_modx`; after `resource.` the fields, after `config.` setting keys |

Arrow keys move, **Enter** or **Tab** picks, **Escape** closes. Lexicon tags (`[[%`) are not suggested.

Suggestions come from MODX with the user's rights: `view_chunk`, `view_snippet`, `view_tv` and `settings` permissions and element category ACL apply. Only names and short descriptions are sent to the browser.

## Settings

| Setting | Default | Meaning |
|---|---|---|
| `tiptapeditor.protect_modx_syntax` | Yes | Protect MODX tags. |
| `tiptapeditor.protect_fenom_syntax` | Yes | Protect Fenom. |
| `tiptapeditor.fenom_tags` | (empty) | Names of your own Fenom tags or functions. |
| `tiptapeditor.modx_autocomplete` | Yes | Suggestions for MODX tags. |
| `tiptapeditor.fenom_autocomplete` | No | Suggestions for Fenom. |

::: tip Keep protection on
With protection off, tags are ordinary text: `&` inside them can be escaped, and Fenom can be moved around. Leave both protection settings on unless the site uses neither MODX tags nor Fenom in content.
:::

See [System settings](./settings) for the full list.
