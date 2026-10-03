import { afterEach, describe, expect, it } from 'vitest';
import { EditorManager } from '../../assets-src/js/editor/EditorManager.js';
import { cleanPastedHtml, pasteSource } from '../../assets-src/js/paste/cleanPaste.js';
import { serialize } from '../../assets-src/js/syntax/serialize.js';
import { createLogger } from '../../assets-src/js/utils/logger.js';

const WORD = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta name=Generator content="Microsoft Word 15"><style><!-- p.MsoNormal {margin:0cm;} --></style>
<!--[if gte mso 9]><xml><o:OfficeDocumentSettings><o:AllowPNG/></o:OfficeDocumentSettings></xml><![endif]--></head>
<body lang=RU style='tab-interval:35.4pt'><!--StartFragment-->
<div class=WordSection1>
<h2 style='mso-margin-top-alt:auto'><a name="_Toc1"></a><span lang=EN-US style='font-family:"Arial"'>Heading</span></h2>
<p class=MsoNormal style='margin-bottom:0cm'><b><span style='font-size:12.0pt'>Bold</span></b><span style='font-size:12.0pt'> and <i>italic</i> and <a href="https://modx.com/">a link</a><o:p></o:p></span></p>
<p class=MsoNormal><o:p>&nbsp;</o:p></p>
<p class=MsoListParagraphCxSpFirst style='text-indent:-18.0pt;mso-list:l0 level1 lfo1'><![if !supportLists]><span style='font-family:Symbol;mso-list:Ignore'>·<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp; </span></span><![endif]>One<o:p></o:p></p>
<p class=MsoListParagraphCxSpMiddle style='margin-left:72.0pt;mso-list:l0 level2 lfo1'><![if !supportLists]><span style='mso-list:Ignore'>o<span>&nbsp; </span></span><![endif]>One A<o:p></o:p></p>
<p class=MsoListParagraphCxSpLast style='mso-list:l0 level1 lfo1'><![if !supportLists]><span style='mso-list:Ignore'>·<span>&nbsp; </span></span><![endif]>Two<o:p></o:p></p>
<p class=MsoNormal>Between</p>
<p class=MsoListParagraph style='mso-list:l1 level1 lfo2'><![if !supportLists]><span style='mso-list:Ignore'>1.<span>&nbsp; </span></span><![endif]>First<o:p></o:p></p>
<p class=MsoListParagraph style='mso-list:l1 level1 lfo2'><![if !supportLists]><span style='mso-list:Ignore'>2.<span>&nbsp; </span></span><![endif]>Second<o:p></o:p></p>
<table class=MsoTableGrid border=1 cellspacing=0 style='border-collapse:collapse'><tr><td width=200 valign=top style='width:150pt'><p class=MsoNormal>Cell<o:p></o:p></p></td></tr></table>
<p class=MsoNormal><img width=100 height=50 src="file:///C:/Users/x/AppData/Local/Temp/msohtmlclip1/01/clip_image001.png" v:shapes="Picture_x0020_1"></p>
</div><!--EndFragment--></body></html>`;

const GOOGLE_DOCS = '<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-1a2b3c"><h2 dir="ltr" style="line-height:1.38;margin-top:18pt"><span style="font-size:16pt;font-family:Arial;color:#000000;font-weight:400">Title</span></h2>'
    + '<p dir="ltr" style="line-height:1.38;text-align:center"><span style="font-size:11pt;font-weight:700">Bold</span><span style="font-size:11pt;font-weight:400"> and </span><span style="font-style:italic">italic</span><span style="text-decoration:underline;-webkit-text-decoration-skip:none">under</span></p>'
    + '<ul style="margin-top:0;margin-bottom:0"><li dir="ltr" style="list-style-type:disc" aria-level="1"><p dir="ltr" role="presentation"><span style="font-size:11pt">Item</span></p></li></ul></b><br class="Apple-interchange-newline">';

describe('pasted HTML clean-up', () => {
    it('detects where HTML comes from', () => {
        expect(pasteSource(WORD)).toBe('word');
        expect(pasteSource(GOOGLE_DOCS)).toBe('google-docs');
        expect(pasteSource('<p data-pm-slice="1 1 []">x</p>')).toBe('internal');
        expect(pasteSource('<p class="x">x</p>')).toBe('html');
    });

    it('Word: keeps structure and formatting, turns list paragraphs into lists, drops Office markup', () => {
        const { html, removedImages } = cleanPastedHtml(WORD);
        const compact = html.replace(/\s*\n\s*/g, '');
        expect(compact).toBe('<h2>Heading</h2>'
            + '<p><strong>Bold</strong> and <em>italic</em> and <a href="https://modx.com/">a link</a></p>'
            + '<ul><li>One<ul><li>One A</li></ul></li><li>Two</li></ul>'
            + '<p>Between</p>'
            + '<ol><li>First</li><li>Second</li></ol>'
            + '<table><tbody><tr><td><p>Cell</p></td></tr></tbody></table>');
        expect(removedImages).toBe(1);
        expect(html).not.toMatch(/Mso|mso-|o:p|style=|class=|<span|lang=/);
    });

    it('Google Docs: formatting from inline styles becomes tags, the wrapper goes', () => {
        const { html } = cleanPastedHtml(GOOGLE_DOCS);
        expect(html).toBe('<h2>Title</h2>'
            + '<p style="text-align: center"><strong>Bold</strong> and <em>italic</em><u>under</u></p>'
            + '<ul><li><p>Item</p></li></ul>');
    });

    it('web pages: classes, ids, styles and data attributes go; links and images with a URL stay', () => {
        const { html, removedImages } = cleanPastedHtml('<div class="post" id="p1"><p class="lead" style="color:red" data-x="1" onclick="x()">Text <a href="/page" class="btn" target="_blank" onclick="y()">link</a> <a href="javascript:alert(1)">bad</a></p><img src="https://site.test/a.jpg" alt="A" class="w"><img src="data:image/png;base64,AAAA"></div>');
        expect(html).toBe('<div><p>Text <a href="/page">link</a> <a>bad</a></p><img src="https://site.test/a.jpg" alt="A"></div>');
        expect(removedImages).toBe(1);
    });

    it('HTML copied inside the editor is not changed', () => {
        const html = '<p data-pm-slice="1 1 []" class="lead" data-x="1">x</p>';
        expect(cleanPastedHtml(html).html).toBe(html);
    });
});

describe('paste in the editor', () => {
    let manager;
    let instance;
    let notices;
    const start = (server = {}) => {
        document.body.innerHTML = '<textarea id="ta"></textarea>';
        document.getElementById('ta').value = '<p>x</p>';
        manager = new EditorManager(createLogger(false));
        manager.configure({ toolbar: 'bold', ...server });
        instance = manager.create('ta');
        notices = () => instance.root.querySelector('.tiptapeditor__message')?.textContent || '';
        instance.editor.commands.setTextSelection(2);
        return instance;
    };
    const clipboard = (html, text) => ({
        clipboardData: {
            types: ['text/html', 'text/plain'],
            files: [],
            getData: (type) => ({ 'text/html': html, 'text/plain': text })[type] ?? '',
        },
        preventDefault() {},
    });
    afterEach(() => manager?.destroyAll());

    it('Word content is cleaned before it reaches the document', () => {
        start();
        instance.editor.view.pasteHTML(WORD, clipboard(WORD, 'Heading'));
        const html = serialize(instance.editor);
        // The first pasted block joins the paragraph the cursor is in.
        expect(html).toContain('<p>xHeading</p><p><strong>Bold</strong> and <em>italic</em>');
        expect(html).toContain('<ul><li><p>One</p><ul><li><p>One A</p></li></ul></li><li><p>Two</p></li></ul>');
        expect(html).not.toMatch(/Mso|file:|class=/);
        expect(notices()).toBe('Pasted images that exist only on your computer were left out. Insert them with the Image button.');
    });

    it('paste_as_text: the plain text is inserted, MODX tags become tokens', () => {
        start({ pasteAsText: true });
        const html = '<p><strong>Bold</strong> [[*pagetitle]]</p>';
        instance.editor.view.pasteHTML(html, clipboard(html, 'Bold [[*pagetitle]]'));
        expect(serialize(instance.editor)).toBe('<p>xBold [[*pagetitle]]</p>');
        const types = [];
        instance.editor.state.doc.descendants((node) => {
            types.push(node.type.name);
        });
        expect(types).toContain('modxSyntax');
    });
});
