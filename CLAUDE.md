## Versions and changelog

Every change that people using the app will notice ships as a new version, with its notes on the What's new page (`/changelog`):

1. Bump `version` in `package.json`: patch for a fix, minor for something new, major when something people relied on goes away.
2. Add the version at the top of `RELEASES` in `lib/changelog.ts`, with the day it ships.
3. Write its notes under `changelog.releases` in every dictionary (`lib/i18n/dictionaries/*.ts`), as many in each language as in English: short sentences about what people can now do, not a commit log. French says "tu".

Several changes on the same day can share one version. `pnpm test` fails when `package.json` and the changelog disagree, or a language is missing notes; the type check fails when a version has no notes.
