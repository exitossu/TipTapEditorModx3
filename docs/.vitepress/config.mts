import { defineConfig } from 'vitepress';

// GitHub Pages serves the site from https://<owner>.github.io/<repo>/; the workflow passes the
// repository name in DOCS_BASE so a fork or renamed repository needs no change here.
const base = process.env.DOCS_BASE || '/';
const repo = 'https://github.com/exitossu/TipTapEditorModx3';

const sidebar = (prefix: string, t: Record<string, string>) => [
    {
        text: t.guide,
        items: [
            { text: t.intro, link: `${prefix}/guide/` },
            { text: t.install, link: `${prefix}/guide/install` },
            { text: t.editing, link: `${prefix}/guide/editing` },
            { text: t.toolbar, link: `${prefix}/guide/toolbar` },
            { text: t.media, link: `${prefix}/guide/media` },
            { text: t.syntax, link: `${prefix}/guide/modx-syntax` },
            { text: t.profiles, link: `${prefix}/guide/profiles` },
            { text: t.settings, link: `${prefix}/guide/settings` },
        ],
    },
    {
        text: t.dev,
        items: [
            { text: t.api, link: `${prefix}/dev/api` },
            { text: t.build, link: `${prefix}/dev/build` },
        ],
    },
    { text: t.changelog, link: `${prefix}/changelog` },
];

export default defineConfig({
    base,
    title: 'TipTapEditor',
    cleanUrls: true,
    lastUpdated: true,
    head: [['link', { rel: 'icon', href: `${base}favicon.svg` }]],
    themeConfig: {
        logo: '/favicon.svg',
        socialLinks: [{ icon: 'github', link: repo }],
        search: {
            provider: 'local',
            options: {
                locales: {
                    root: {
                        translations: {
                            button: { buttonText: 'Поиск', buttonAriaLabel: 'Поиск' },
                            modal: {
                                displayDetails: 'Подробнее',
                                resetButtonTitle: 'Сбросить',
                                backButtonTitle: 'Закрыть',
                                noResultsText: 'Ничего не найдено',
                                footer: { selectText: 'выбрать', navigateText: 'перейти', closeText: 'закрыть' },
                            },
                        },
                    },
                },
            },
        },
    },
    locales: {
        root: {
            label: 'Русский',
            lang: 'ru-RU',
            description: 'Визуальный редактор Tiptap 3 для MODX Revolution 3',
            themeConfig: {
                nav: [
                    { text: 'Руководство', link: '/guide/' },
                    { text: 'Разработчикам', link: '/dev/api' },
                    { text: 'Изменения', link: '/changelog' },
                ],
                sidebar: sidebar('', {
                    guide: 'Руководство', intro: 'Что это', install: 'Установка и обновление',
                    editing: 'Работа в редакторе', toolbar: 'Панель инструментов', media: 'Изображения, галереи, файлы',
                    syntax: 'Теги MODX и Fenom', profiles: 'Профили и конфигурация', settings: 'Системные настройки',
                    dev: 'Разработчикам', api: 'JS API', build: 'Сборка и тесты',
                    changelog: 'История изменений',
                }),
                editLink: { pattern: `${repo}/edit/main/docs/:path`, text: 'Исправить эту страницу на GitHub' },
                outline: { label: 'На этой странице', level: [2, 3] },
                docFooter: { prev: 'Назад', next: 'Дальше' },
                lastUpdated: { text: 'Обновлено' },
                darkModeSwitchLabel: 'Тема',
                sidebarMenuLabel: 'Меню',
                returnToTopLabel: 'Наверх',
                langMenuLabel: 'Язык',
            },
        },
        en: {
            label: 'English',
            lang: 'en-US',
            link: '/en/',
            description: 'Tiptap 3 rich text editor for MODX Revolution 3',
            themeConfig: {
                nav: [
                    { text: 'Guide', link: '/en/guide/' },
                    { text: 'Developers', link: '/en/dev/api' },
                    { text: 'Changelog', link: '/en/changelog' },
                ],
                sidebar: sidebar('/en', {
                    guide: 'Guide', intro: 'Introduction', install: 'Install and upgrade',
                    editing: 'Editing', toolbar: 'Toolbar', media: 'Images, galleries, files',
                    syntax: 'MODX and Fenom tags', profiles: 'Profiles and configuration', settings: 'System settings',
                    dev: 'Developers', api: 'JS API', build: 'Build and tests',
                    changelog: 'Changelog',
                }),
                editLink: { pattern: `${repo}/edit/main/docs/:path`, text: 'Edit this page on GitHub' },
                outline: { level: [2, 3] },
            },
        },
    },
});
