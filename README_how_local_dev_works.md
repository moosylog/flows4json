# How Local Development Works

This project has a small local development setup so you can test changes to flows,
images, and the HTML app without overwriting the production `catalog.json`.

## Quick Start

Run the local server from the repository root:

```sh
npm run dev
```

By default it starts on:

```text
http://localhost:7103
```

The default port `7103` is intentional: it is a compact leetspeak-style spelling
of `flow`. The `7` reads like `f`, `1` like `l`, `0` like `o`, and the `3` is used
as a visually flipped `w`.

You can choose another port with:

```sh
PORT=7200 npm run dev
```

Open either `http://localhost:7103/` for `index.html` or
`http://localhost:7103/index_single.html` for the single-file page.

## What Happens When The Dev Server Starts

`npm run dev` runs `scripts/dev-server.js`. Before serving the app, the dev server
builds a development-only catalog:

```sh
node scripts/build-catalog.js --local --output .dev/catalog.json
```

That command reads the `.flows` files and matching media files from the repository
root, then writes the generated catalog to `.dev/catalog.json`.

The `.dev` directory is ignored by Git. It is local scratch output for development,
not source data.

## How The App Chooses The Catalog URL

Both `index.html` and `index_single.html` use `getCatalogUrl()` when fetching the
catalog.

When the page runs on one of these local hosts:

```text
localhost
127.0.0.1
::1
```

the app fetches:

```text
/.dev/catalog.json
```

When the same page runs anywhere else, it fetches the published catalog:

```text
https://moosylog.github.io/flows4json/catalog.json
```

This means the HTML files can be used in both places. Local development is detected
by the browser hostname, so there is no manual switch to flip before publishing.

## Why URLs Inside The Local Catalog Are Different

The production `catalog.json` contains absolute media URLs, for example:

```text
https://moosylog.github.io/flows4json/Fn_combos.png
```

That is correct for the published GitHub Pages app, because users should load
assets from the public site.

The local dev catalog uses local asset URLs instead, for example:

```text
/Fn_combos.png
```

This happens because the dev server builds the catalog with the `--local` flag.
With local URLs, the browser loads images from the local dev server instead of
GitHub Pages. If you edit or replace a local image, you see that local change
immediately.

## Why The Real `catalog.json` Is Left Alone

The root-level `catalog.json` is the real published catalog. It should stay stable
unless you intentionally rebuild it for production.

The local server writes to `.dev/catalog.json` instead because local development
needs different behavior:

- local media URLs such as `/Fn_combos.png`
- automatic rebuilds when `.flows` or media files change
- live reload in the browser
- no accidental production catalog diffs while experimenting

This keeps development output separate from source-controlled production output.
You can freely run the dev server, test unfinished flows, and iterate on images
without dirtying the real `catalog.json`.

If you do want to rebuild the production catalog intentionally, run:

```sh
npm run build:catalog
```

That command writes to `catalog.json` in the repository root and uses the published
GitHub Pages media URLs.

## File Watching And Reloading

The dev server watches the repository root and the `scripts` directory.

When a watched `.flows`, image, HTML, JS, or CSS file changes, the browser reloads.
When a `.flows` or image file changes, the dev server first rebuilds
`.dev/catalog.json`, then reloads the browser.

The server deliberately ignores:

- `catalog.json`
- everything inside `.dev/`

Ignoring these files prevents rebuild loops and keeps the production catalog out of
the local feedback cycle.
