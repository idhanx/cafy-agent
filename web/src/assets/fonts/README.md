# Vendored web fonts

The web app vendors only the latin files it uses so `next build` does not make
network requests to Google Fonts.

- Inter variable normal: `@fontsource-variable/inter@5.2.8`
- Titillium Web 600 and 700 normal (display headings): `@fontsource/titillium-web@5.2.8`

Both packages publish the Google Fonts binaries under the SIL Open Font
License 1.1. Each family directory includes the corresponding license text. Source packages:

- https://www.npmjs.com/package/@fontsource-variable/inter/v/5.2.8
- https://www.npmjs.com/package/@fontsource/titillium-web/v/5.2.8
