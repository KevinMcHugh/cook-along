# cook-along

Turn-by-turn cooking instructions for any recipe, on one phone-sized screen per
step, with big back/next buttons, an always-visible timer tray and an
ingredients sheet. The recipe isn't stored anywhere: it travels in the link, as
the payload of a JWT.

```
https://<your-host>/#token=eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJyZWNpcGUiOnsi….
```

It began as a single hard-coded "Satay Cook-Along" page. This repo pulls the
recipe out into data ([`schema/recipe.schema.json`](schema/recipe.schema.json))
so the same page can run any recipe.

## Quick start

```sh
npm run serve                      # static server on http://localhost:8000
npm run make-link -- examples/satay.json --base http://localhost:8000/
# → http://localhost:8000/#token=eyJ…   open it
```

Or skip the command line and use the editor at `/edit.html` (below).

There are no dependencies to install. Node 20+ is only needed for the scripts and tests.

## Writing a recipe

A recipe is a JSON object matching [`schema/recipe.schema.json`](schema/recipe.schema.json).
See [`examples/satay.json`](examples/satay.json) for a full one. The minimum:

```json
{
  "title": "Toast",
  "steps": [
    { "title": "Toast it", "body": ["Bread in."], "timer": { "seconds": 120, "label": "Toasting" } }
  ]
}
```

| Field | Notes |
|---|---|
| `title`, `eyebrow` | Header text. |
| `ingredients[]` | Groups of `{ name, quantity }`. The Ingredients button is hidden without them. `ingredientsTitle` names the sheet. |
| `steps[].body[]` | One bullet per string. Plain text. |
| `steps[].note` | Callout under the body. `tone`: `info` (amber) or `good` (green). `**bold**` is the only markup. |
| `steps[].timer` | `seconds` plus optional `label`. The step shows a Start button; once started, the timer lives in the tray (see below). |
| `doneLabel` | Subtitle under the final Done button. |

The token's payload is `{ "recipe": <recipe> }`. Anything else in the payload is
ignored.

## Editor

`edit.html` is a copy from → edit → copy to page:

1. **Copy from:** paste a cook-along link, a bare token, or recipe JSON, or
   start from the example or a blank recipe.
2. **Edit:** the JSON, checked against the schema as you type, with
   `$.path: problem` errors listed under it.
3. **Copy to:** once it's valid, copy the link (it points at the cook page next
   to the editor), open it, or copy the JSON.

The ✎ button on the cook page opens the current recipe in the editor. The
editor removes the token from its own address bar after loading, and keeps
your work as a draft in `localStorage`, so a refresh doesn't throw away edits.

## Skill: sketch → link

[`.claude/skills/cook-along-recipe/`](.claude/skills/cook-along-recipe/SKILL.md)
is a Claude skill that turns a rough recipe (notes, a pasted recipe, a meal-plan
entry) into schema-valid JSON and then a link, following house rules for step size,
timers and notes. Claude Code picks it up automatically in this repo. For
claude.ai, run `npm run package-skill` and upload `dist/cook-along-recipe.zip`
under Settings → Capabilities → Skills.

The skill folder carries its own copies of `make-link.mjs`, `src/{jwt,link,validate}.js`,
the schema and the example, so it works without the repo. **After changing any
of those, run `npm run sync-skill`.** `test/skill.test.mjs` fails until you do.

## Timers

A started timer moves into the **tray** pinned above the back/next bar and
stays there on every step until you clear it, so a 30-minute marinade stays in
view while you make the sauce. Each row shows the step it belongs to (tap to
jump back), a live countdown, a bar that drains as time runs out, and
Pause/Resume, +1:00 and ✕ (stop and clear). Several timers can run at once.

When a timer hits zero its row flashes and it beeps every few seconds for a
minute, until you tap Dismiss (or +1:00 for a bit more). Running timers keep the
screen awake, and they survive a refresh, since they're stored as end times rather than
counted ticks.

## No signing

The JWT is only an envelope: the page decodes the payload and **never checks
the signature**. `make-link` produces unsigned (`alg: none`) tokens, and a token
signed by any other tool opens just the same. Anyone can make a link for any
recipe, which is the point. If that ever needs to change, verification belongs
in `src/jwt.js` `decode()`.

## Design notes

- **The token goes in the fragment** (`#token=…`), which browsers never send to
  the server, so it stays out of access logs and `Referer` headers. `?token=` and a bare
  `#eyJ…` also work. Fragments allow far more than the ~2 KB query-string folk
  limit: the full satay recipe comes out to about 5.5 KB of link.
  `make-link.mjs` warns past 8 KB, since some chat apps truncate long links.
- **The schema is the validator.** `src/validate.js` walks
  `recipe.schema.json` directly, so there's one source of truth and no
  dependency. It implements only the keywords the schema uses and *throws* on
  any other. If you add `pattern` or `oneOf` to the schema, extend the
  validator (and its test) in the same change; it won't silently ignore them.
  `make-link.mjs` runs the same validation, so a bad recipe fails when you mint the
  link, not on someone's phone.
- **Recipe text is never HTML.** Everything is set with `textContent`. The
  original page used `innerHTML` for its notes, which would be an XSS hole once
  the content comes from a URL. That's why notes use `**bold**`.
- **Progress is saved per token** in `localStorage`, keyed by a hash of the
  token. A refresh mid-cook keeps your step and running timers, and two
  recipes don't share state.

## Hosting

Any static host works. Serve the repo root as-is. For GitHub Pages:
Settings → Pages → Deploy from branch → `main` / root. `make-link` defaults
to `https://kevinmchugh.github.io/cook-along/`. Pass `--base` or set
`COOK_ALONG_BASE` for anywhere else.

## Layout

```
index.html, styles.css    the cook page
edit.html, edit.css       the editor
theme.css                 colour tokens shared by both
src/app.js                cook page: reads the token, renders steps, timer tray, ingredients
src/edit.js               editor
src/link.js               link ⇄ recipe (shared by pages, script and skill)
src/jwt.js                decode / encode an unsigned JWT
src/validate.js           minimal JSON Schema validator for the recipe schema
schema/recipe.schema.json the recipe format
scripts/make-link.mjs     recipe.json → link
scripts/sync-skill.mjs    copy shared files into the skill; --zip packages it
.claude/skills/cook-along-recipe/   the sketch → link skill
test/                     node --test
```
