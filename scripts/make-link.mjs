// Turns a recipe JSON file into a cook-along link.
//   node scripts/make-link.mjs recipe.json [--base URL]
// Validates the recipe against the schema first, so a bad recipe fails here
// rather than on someone's phone.
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { encode } from "../src/jwt.js";
import { validate } from "../src/validate.js";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    base: { type: "string", default: process.env.COOK_ALONG_BASE || "http://localhost:8000/" },
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

const url = new URL(values.base);
url.hash = "token=" + encode({ recipe });
console.log(url.toString());
if (url.toString().length > 8000) console.error(`note: link is ${url.toString().length} chars; some chat apps truncate long links`);
