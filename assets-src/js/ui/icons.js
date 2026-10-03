// SVG icons from Lucide (ISC license), bundled locally: only the icons imported here end up
// in the build. Rendered inline so they inherit currentColor; no icon fonts.
import alignCenter from 'lucide-static/icons/text-align-center.svg?raw';
import alignJustify from 'lucide-static/icons/text-align-justify.svg?raw';
import alignLeft from 'lucide-static/icons/text-align-start.svg?raw';
import alignRight from 'lucide-static/icons/text-align-end.svg?raw';
import baseline from 'lucide-static/icons/baseline.svg?raw';
import bold from 'lucide-static/icons/bold.svg?raw';
import chevronDown from 'lucide-static/icons/chevron-down.svg?raw';
import code from 'lucide-static/icons/code.svg?raw';
import codeXml from 'lucide-static/icons/code-xml.svg?raw';
import paintbrush from 'lucide-static/icons/paintbrush.svg?raw';
import codeBlock from 'lucide-static/icons/square-code.svg?raw';
import eraser from 'lucide-static/icons/eraser.svg?raw';
import fileSymlink from 'lucide-static/icons/file-symlink.svg?raw';
import hash from 'lucide-static/icons/hash.svg?raw';
import heading from 'lucide-static/icons/heading.svg?raw';
import heading1 from 'lucide-static/icons/heading-1.svg?raw';
import heading2 from 'lucide-static/icons/heading-2.svg?raw';
import heading3 from 'lucide-static/icons/heading-3.svg?raw';
import heading4 from 'lucide-static/icons/heading-4.svg?raw';
import heading5 from 'lucide-static/icons/heading-5.svg?raw';
import heading6 from 'lucide-static/icons/heading-6.svg?raw';
import highlighter from 'lucide-static/icons/highlighter.svg?raw';
import image from 'lucide-static/icons/image.svg?raw';
import italic from 'lucide-static/icons/italic.svg?raw';
import link from 'lucide-static/icons/link.svg?raw';
import list from 'lucide-static/icons/list.svg?raw';
import listOrdered from 'lucide-static/icons/list-ordered.svg?raw';
import maximize from 'lucide-static/icons/maximize-2.svg?raw';
import minimize from 'lucide-static/icons/minimize-2.svg?raw';
import minus from 'lucide-static/icons/minus.svg?raw';
import paperclip from 'lucide-static/icons/paperclip.svg?raw';
import pencil from 'lucide-static/icons/pencil.svg?raw';
import pilcrow from 'lucide-static/icons/pilcrow.svg?raw';
import quote from 'lucide-static/icons/text-quote.svg?raw';
import redo from 'lucide-static/icons/redo-2.svg?raw';
import replace from 'lucide-static/icons/replace.svg?raw';
import removeFormatting from 'lucide-static/icons/remove-formatting.svg?raw';
import strikethrough from 'lucide-static/icons/strikethrough.svg?raw';
import subscript from 'lucide-static/icons/subscript.svg?raw';
import superscript from 'lucide-static/icons/superscript.svg?raw';
import cellsMerge from 'lucide-static/icons/table-cells-merge.svg?raw';
import cellsSplit from 'lucide-static/icons/table-cells-split.svg?raw';
import columnAfter from 'lucide-static/icons/between-vertical-end.svg?raw';
import columnBefore from 'lucide-static/icons/between-vertical-start.svg?raw';
import headerColumn from 'lucide-static/icons/panel-left.svg?raw';
import headerRow from 'lucide-static/icons/panel-top.svg?raw';
import rowAfter from 'lucide-static/icons/between-horizontal-end.svg?raw';
import rowBefore from 'lucide-static/icons/between-horizontal-start.svg?raw';
import table from 'lucide-static/icons/table.svg?raw';
import tableDelete from 'lucide-static/icons/grid-2x2-x.svg?raw';
import tableProperties from 'lucide-static/icons/table-properties.svg?raw';
import trash from 'lucide-static/icons/trash-2.svg?raw';
import underline from 'lucide-static/icons/underline.svg?raw';
import unlink from 'lucide-static/icons/unlink.svg?raw';
import undo from 'lucide-static/icons/undo-2.svg?raw';
import squarePlay from 'lucide-static/icons/square-play.svg?raw';
import imageUp from 'lucide-static/icons/image-up.svg?raw';
import imageDown from 'lucide-static/icons/image-down.svg?raw';
import images from 'lucide-static/icons/images.svg?raw';
import type from 'lucide-static/icons/type.svg?raw';

// Lucide has no "delete row/column" icons; these follow its grid and stroke.
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const rowDelete = svg('<rect width="18" height="7" x="3" y="3" rx="1"/><path d="m9 14 6 6"/><path d="m15 14-6 6"/>');
const columnDelete = svg('<rect width="7" height="18" x="3" y="3" rx="1"/><path d="m14 9 6 6"/><path d="m20 9-6 6"/>');

const sources = {
    cellsMerge, cellsSplit, columnAfter, columnBefore, columnDelete, headerColumn, headerRow, rowAfter, rowBefore, rowDelete,
    table, tableDelete, tableProperties,
    alignCenter, alignJustify, alignLeft, alignRight, baseline, bold, chevronDown, code, codeBlock, codeXml, paintbrush,
    eraser, fileSymlink, hash, heading, heading1, heading2, heading3, heading4, heading5, heading6, highlighter, image, italic,
    link, list, listOrdered, maximize, minimize, minus, paperclip, pencil, pilcrow, quote, redo, removeFormatting, replace,
    strikethrough, subscript, superscript, trash, underline, undo, unlink, squarePlay, type, imageUp, imageDown, images,
};

const cache = new Map();
const extra = new Map();

function clean(svg) {
    return svg
        .replace(/<!--[\s\S]*?-->/g, '')
        // Only the root <svg> loses its size and class; <rect width="…"> must keep them.
        .replace(/<svg\b[^>]*>/, (tag) => tag.replace(/\s(class|width|height)="[^"]*"/g, ''))
        .replace('<svg', '<svg class="tiptapeditor__icon" width="18" height="18" aria-hidden="true" focusable="false"')
        .replace(/>\s+</g, '><')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Registers an additional icon (raw SVG markup) for custom toolbar items. */
export function registerIcon(name, svg) {
    extra.set(name, svg);
    cache.delete(name);
}

/** Returns an SVG element for the icon, or null when unknown. */
export function icon(name) {
    const svg = extra.get(name) ?? sources[name];
    if (!svg) {
        return null;
    }
    if (!cache.has(name)) {
        cache.set(name, clean(svg));
    }
    const template = document.createElement('template');
    template.innerHTML = cache.get(name);
    return template.content.firstElementChild;
}
