# Byte-Sized Toolbox — Teacher Userscript Catalog & Customizer

**Deliverable:** `teacher-script-toolbox.html` — a complete, single-file web app (no build step, no network dependencies). Open it in any browser.

Built from your Tampermonkey backup (`uploads/tampermonkey-backup-chrome-2026-09-30T20-23-03-766Z.txt`): **29 userscripts** across Connexus (16), Google Voice (4), Google Chat (3), Utilities (3), Labster (2), Gmail (1).

## Features

| Feature | Where |
|---|---|
| Catalog + search (title / description / domain / `@match` URL / tags, press `/` to focus) | top bar |
| Domain category tabs with counts | under search |
| Sort (backup order, A→Z, Z→A, domain) + "Select all shown" | toolbar |
| Combine selected scripts → merged `==UserScript==` header, deduped `@match`/`@grant`/`@connect`/`@require`, each body in its own IIFE, earliest `@run-at` wins, update URLs stripped | checkbox on card → bottom bar → ⚡ Combine |
| Customizer: 50 curated settings + auto-detected constants (`const X = …`, `CONFIG.foo` objects) with live code preview — text, number, toggle, color picker, dropdown, comma lists, JSON editors | ⚙ Customize on any card |
| Export: **⧉ Copy Code** and **⬇ Install / Download .user.js** (blob download → Tampermonkey install prompt) | modal toolbar + quick actions on each card |

Notes:
- Customized exports automatically drop `@updateURL`/`@downloadURL` so Tampermonkey never auto-updates over your changes.
- Customizations stick per-script while the page is open (card shows an **EDITED** badge; quick copy/download on the card includes them).
- Combining scripts from different domains is allowed but warns you.

## Editing the script database

Open the HTML file — `SCRIPTS_DATA` is the first thing in the `<script>` section:

```js
{
  id, title, description, version, domain, matchUrl, matches, grants,
  connects, runAt, enabled, tags,
  customizations: [{ key, label, type, hint, options?, default }],
  code: `…full userscript source including its ==UserScript== header…`
}
```

- To swap in an updated script: paste its full source into `code` (backticks and `${` inside the source must be escaped as `` \` `` and `\${`). The customizer auto-detects editable constants at runtime.
- `customizations` entries are optional niceties (nicer labels/hints); auto-detection covers everything else.

## Regenerating from a new backup

```
tools/
  meta.json      curated metadata (domains, descriptions, tags, which constants to surface)
  sources/       the 29 decoded .user.js files from the backup
  core.js        parsing / customization / combination engine (pure, testable)
  app_ui.js      catalog UI
  template.html  page skeleton
  build.js       assembles the final single file
  test.js        607 engine tests   (node test.js)
  smoke.js       49 jsdom UI tests  (node smoke.js, needs `npm i jsdom`)
```

To import a new backup: decode it into `tools/sources/` (base64 `source` field per script), add/adjust entries in `meta.json`, then `node build.js`.
