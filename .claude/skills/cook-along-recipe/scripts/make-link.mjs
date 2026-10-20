// Turns a recipe JSON file into a cook-along link.
//   node scripts/make-link.mjs recipe.json [--base URL]
// Validates the recipe against the schema first, so a bad recipe fails here
// rather than on someone's phone.
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { linkFor } from "../src/link.js";
import { validate } from "../src/validate.js";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    base: { type: "string", default: process.env.COOK_ALONG_BASE || "https://kevinmchugh.github.io/cook-along/" },
  },
});
if (positionals.length !== 1) {
  console.error("usage: node scripts/make-link.mjs recipe.json [--base URL]");
  process.exit(2);
}

const recipe = JSON.parse(readFileSync(positionals[0], "utf8"));
const schema = JSON.parse(readFileSync(new URL("../schema/recipe.schema.json", import.meta.url), "utf8"));
const errors = validate(schema, recipe);
if (errors.length) {
  console.error("recipe does not match schema/recipe.schema.json:\n  " + errors.join("\n  "));
  process.exit(1);
}

const link = linkFor(values.base, recipe);
console.log(link);
if (link.length > 8000) console.error(`note: link is ${link.length} chars; some chat apps truncate long links`);
