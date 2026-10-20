---
name: cook-along-recipe
description: Turn a sketched, rough, pasted or dictated recipe into a cook-along link — a step-by-step phone cooking page with timers — by writing it as JSON that matches the cook-along recipe schema and encoding it into a URL. Use whenever the user wants a recipe "cook-along", "as a link", "in cook-along format", "for my phone while cooking", or hands over recipe notes, a recipe from a site, or a meal plan's cooking steps and asks for a link or cook-along. Also use to edit an existing cook-along link (decode it, change it, re-encode it).
---

# Cook-along recipe → link

A cook-along link opens a phone page that walks through a recipe one screen per
step, with Start buttons for timers that then stay pinned on screen. The whole
recipe travels in the link, as the payload of an unsigned JWT:
`https://kevinmchugh.github.io/cook-along/#token=<jwt>`.

Your job: turn whatever the user gave you into a recipe JSON file that passes
`schema/recipe.schema.json`, run the bundled script to get the link, and hand
the link back.

## Workflow

1. **Read the sketch** and note what's missing: quantities, temperatures, times, doneness cues.
2. **Write `recipe.json`** following the authoring rules below. `examples/satay.json` is a
   complete, good example; read it if you haven't.
3. **Make the link**, from this skill's directory:
   ```sh
   node scripts/make-link.mjs /path/to/recipe.json
   ```
   It validates against the schema first and prints `$.path: problem` lines on
   failure. Fix them and re-run until it prints a URL. Pass `--base URL` (or
   set `COOK_ALONG_BASE`) for a different host. It needs Node 20+ and nothing else.
4. **Reply** with:
   - the link, on its own line;
   - a one-line summary: steps, timers, total active time if obvious;
   - **every assumption you made** (e.g. "assumed 400°F, the sketch didn't say") so
     the user can fix it. They can also tap **Edit** on the cook page to change the
     JSON in the browser.
   - Offer the JSON too if they might want to keep it, but don't paste it unasked; it's long.

To **edit an existing link**: decode its payload with `src/link.js`
(`recipeFromText(link)`), or run
`node -e 'import("./src/link.js").then(m=>console.log(JSON.stringify(m.recipeFromText(process.argv[1]),null,2)))' "<link>"`.
Change the JSON, then re-run make-link.

## The format (summary — the schema is authoritative)

```json
{
  "title": "Satay Cook-Along",            // required, ≤120 chars
  "eyebrow": "Tuesday · Thai Week",       // optional small label above the title
  "ingredientsTitle": "For the satay",    // optional heading for the ingredients sheet
  "ingredients": [                        // optional; groups of items
    { "name": "Peanut sauce", "items": [ { "name": "Peanut butter", "quantity": "⅓ cup" } ] }
  ],
  "steps": [                              // required, 1–100
    {
      "title": "Grill — first side",      // required, ≤120
      "body": ["Lay the skewers down.", "Don't move them until the timer's done."],  // required, 1–20 strings
      "note":  { "text": "**Tip:** …", "tone": "info" },   // optional; tone "info" (amber) or "good" (green)
      "timer": { "seconds": 330, "label": "First side" }   // optional; integer 1–86400
    }
  ],
  "doneLabel": "Enjoy dinner"             // optional subtitle on the final Done button
}
```

No other properties are allowed anywhere (`additionalProperties: false`): no `servings`,
`time`, `url`, or `image`. Put that kind of detail in `eyebrow` or a step.
Strings are plain text. The only markup is `**bold**` inside `note.text`.

## Authoring rules

These are what make it pleasant to cook from, not just valid.

**Steps**
- One step = one thing you do at the stove/board before moving on, sized to fit one phone screen without
  scrolling: usually 1–4 body bullets of one or two sentences each.
- Titles are short imperatives: "Make the peanut sauce", "Flip — second side".
- Split a step wherever the cook waits on something with a timer. A step that ends in a
  timer should be the *start* of that wait ("Lay the skewers down… don't move them"),
  and the next step is what happens when it's done.
- Order steps the way a person should actually cook them, not the order the source
  lists components in. Put long passive waits (marinate, rest dough, preheat oven) as
  early as they can go, so their timers run while other prep happens. That's what the
  pinned timer tray is for. Mention in the body what to do meanwhile.
- Include quantities in the body where the cook needs them at that moment ("Whisk ⅓ cup
  peanut butter with…"). Nobody wants to flip to the ingredients sheet mid-whisk.
- Give doneness cues alongside times: "until golden", "165°F at the thickest piece".

**Timers**
- Add a timer only when there's a wait worth tracking: roughly 1 minute or more, where
  the cook might wander off. Not for "stir 30 seconds".
- `seconds` is an integer. When the source gives a range, use the low end and put the
  range in the body ("8–10 minutes; check at 8").
- `label` names the wait, as a noun or gerund: "Marinating", "Preheating", "Second side".
  It shows in the tray next to other timers, so make it distinguishable.

**Notes**
- For warnings, tips, kid or allergy variants, and make-ahead/leftover hand-offs. One per step at most.
- Lead with a bold label: `"**Heads up:** the pan will spit."`. Use `"tone": "good"` for
  positive or serving notes, and the default amber for cautions.

**Ingredients**
- Group by component (Marinade / Sauce / To serve) when there's more than one; a single
  unnamed group is fine for simple recipes.
- `quantity` is a free string: "2 tbsp", "~½ can", "to taste", "for skewers". Prefer
  the user's units. Use real fraction characters (½ ⅓ ¼ ¾).

**Don't invent**
- If the sketch omits something the cook genuinely needs (oven temp, a key quantity),
  either ask first (when it's central and you can't sensibly guess) or make a standard,
  conservative choice and list it under assumptions in your reply. Never quietly
  invent precise-looking numbers.
- Keep the user's voice and specifics: their equipment, their household notes ("toddler
  pull"), their day labels.

## Gotchas

- Links grow with the recipe: about 5.5 KB for the 8-step satay. make-link warns
  past 8 KB, since some chat apps truncate long links. Tighten wording before splitting a
  recipe in two.
- The JSON must be strict: no comments, no trailing commas. The block above has comments
  for explanation only.
- Don't add properties to "help" (e.g. `servings`); validation will reject them.
