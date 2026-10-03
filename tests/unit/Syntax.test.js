import { afterEach, describe, expect, it } from 'vitest';
import { EditorManager } from '../../assets-src/js/editor/EditorManager.js';
import { serialize } from '../../assets-src/js/syntax/serialize.js';
import { createLogger } from '../../assets-src/js/utils/logger.js';

describe('MODX/Fenom protection in the editor', () => {
    let manager;
    let instance;
    const start = (html, extra = {}) => {
        document.body.innerHTML = '<textarea id="ta"></textarea>';
        document.getElementById('ta').value = html;
        manager = new EditorManager(createLogger(false));
        manager.configure({ toolbar: 'bold,link', ...extra });
        instance = manager.create('ta');
        return instance;
    };
    const types = () => {
        const list = [];
        instance.editor.state.doc.forEach((node) => list.push(node.type.name));
        return list;
    };
    const typeAtEnd = (text) => {
        const { editor } = instance;
        editor.chain().setTextSelection(editor.state.doc.content.size - 1).insertContent(text).run();
    };
    afterEach(() => manager?.destroyAll());

    it('shows tokens in attributes as text and writes them back byte for byte', () => {
        const html = '<p><a href="[[~5? &scheme=`abs`]]">a</a> <img src="[[+img]]" alt="{$alt}"></p>';
        start(html);
        let href = null;
        instance.editor.state.doc.descendants((node) => {
            node.marks.forEach((mark) => {
                if (mark.type.name === 'link') {
                    href = mark.attrs.href;
                }
            });
        });
        expect(href).toBe('[[~5? &scheme=`abs`]]');
        typeAtEnd('!');
        expect(serialize(instance.editor)).toBe('<p><a href="[[~5? &scheme=`abs`]]">a</a> <img src="[[+img]]" alt="{$alt}">!</p>');
    });

    it('turns tokens standing on their own line next to text into blocks', () => {
        start('{if $a}\nText [[*pagetitle]] here.\n{/if}');
        expect(types()).toEqual(['modxSyntaxBlock', 'paragraph', 'modxSyntaxBlock']);
        const once = serialize(instance.editor);
        expect(once).toBe('{if $a}\nText [[*pagetitle]] here.\n{/if}');
        start(once);
        expect(serialize(instance.editor)).toBe(once);
    });

    it('keeps several tokens on one line inline', () => {
        start('[[$a]] [[$b]]');
        expect(types()).toEqual(['paragraph']);
        expect(serialize(instance.editor)).toBe('[[$a]] [[$b]]');
    });

    it('converts a typed MODX tag into a token once it is complete', () => {
        start('<p>Hello</p>');
        typeAtEnd(' [[*pagetitle');
        let tokens = 0;
        instance.editor.state.doc.descendants((node) => {
            tokens += node.type.name === 'modxSyntax' ? 1 : 0;
        });
        expect(tokens).toBe(0);
        typeAtEnd(']]');
        instance.editor.state.doc.descendants((node) => {
            tokens += node.type.name === 'modxSyntax' ? 1 : 0;
        });
        expect(tokens).toBe(1);
        expect(serialize(instance.editor)).toBe('<p>Hello [[*pagetitle]]</p>');
    });

    it('keeps a typed token with "&" unescaped', () => {
        start('<p>x</p>');
        typeAtEnd(' [[!snippet? &a=`1`]]');
        expect(serialize(instance.editor)).toBe('<p>x [[!snippet? &a=`1`]]</p>');
    });

    it('does not tokenize text typed in a code block', () => {
        start('<pre><code>x</code></pre>');
        typeAtEnd(' [[*x]] {$y}');
        expect(serialize(instance.editor)).toBe('<pre><code>x [[*x]] {$y}</code></pre>');
        let tokens = 0;
        instance.editor.state.doc.descendants((node) => {
            tokens += node.type.name.startsWith('modxSyntax') ? 1 : 0;
        });
        expect(tokens).toBe(0);
    });

    it('keeps style attributes exactly as written', () => {
        start('<p><img src="a.png" style="border: 0"></p>');
        typeAtEnd('x');
        expect(serialize(instance.editor)).toBe('<p><img src="a.png" style="border: 0">x</p>');
    });

    it('drops private use characters from pasted content', () => {
        start('<p>a</p>');
        const view = instance.editor.view;
        let html = '<p>bx-1c</p>';
        let text = 'de';
        view.someProp('transformPastedHTML', (f) => {
            html = f(html, view);
        });
        view.someProp('transformPastedText', (f) => {
            text = f(text, false, view);
        });
        expect(html).toBe('<p>bx-1c</p>');
        expect(text).toBe('de');
    });

    it('keeps the HTML of a Fenom loop between table rows as a raw block', () => {
        const html = '<table>\n{foreach $rows as $r}\n<tr><td>{$r}</td></tr>\n{/foreach}\n</table>';
        start(html);
        expect(types()).toEqual(['rawHtml']);
        expect(serialize(instance.editor)).toBe(html);
    });

    it('does not make inline code of backticks inside a MODX tag being typed', () => {
        start('<p>x</p>');
        const view = instance.editor.view;
        const typeChars = (text) => {
            for (const char of text) {
                const { from, to } = view.state.selection;
                const handled = view.someProp('handleTextInput', (f) => f(view, from, to, char, () => view.state.tr.insertText(char, from, to)));
                if (!handled) {
                    view.dispatch(view.state.tr.insertText(char, from, to));
                }
            }
        };
        instance.editor.commands.setTextSelection(2);
        typeChars(' [[!s? &a=`1` &b=`2`]]');
        expect(serialize(instance.editor)).toBe('<p>x [[!s? &a=`1` &b=`2`]]</p>');
        typeChars(' `c`');
        expect(serialize(instance.editor)).toBe('<p>x [[!s? &a=`1` &b=`2`]] <code>c</code></p>');
    });
});
