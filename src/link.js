// Moving recipes in and out of links. Shared by the cook page, the editor and
// scripts/make-link.mjs, so all three agree on what a link looks like.
import { decode, encode } from "./jwt.js";

// The token is read from the fragment (#token=… or a bare #eyJ…) so it never
// reaches a server log; ?token=… works too for tools that drop fragments.
export function tokenFromLocation(loc) {
  const hash = loc.hash.replace(/^#/, "");
  if (hash) {
    const p = new URLSearchParams(hash);
    if (p.get("token")) return p.get("token");
    if (/^[\w-]+\.[\w-]+(\.[\w-]*)?$/.test(hash)) return hash;
  }
  return new URLSearchParams(loc.search).get("token");
}

export function linkFor(base, recipe) {
  const url = new URL(base);
  url.search = "";
  url.hash = "token=" + encode({ recipe });
  return url.toString();
}

/**
 * Reads whatever someone pasted: a cook-along link, a bare token, or recipe
 * JSON (either the recipe itself or a `{ "recipe": … }` payload). Returns the
 * recipe object, unvalidated; throws with a readable message otherwise.
 */
export function recipeFromText(text) {
  const s = String(text).trim();
  if (!s) throw new Error("nothing to read");
  if (s.startsWith("{")) {
    let obj;
    try {
      obj = JSON.parse(s);
    } catch (e) {
      throw new Error("JSON: " + e.message);
    }
    return obj && typeof obj === "object" && "recipe" in obj && !("steps" in obj) ? obj.recipe : obj;
  }
  let token = s;
  if (/^https?:\/\//i.test(s)) {
    token = tokenFromLocation(new URL(s));
    if (!token) throw new Error("that link has no #token=… in it");
  }
  const payload = decode(token);
  if (!payload || payload.recipe === undefined) throw new Error('token has no "recipe" claim');
  return payload.recipe;
}

/** Fetches the schema relative to this module (browser only). */
export async function loadSchema() {
  return (await fetch(new URL("../schema/recipe.schema.json", import.meta.url))).json();
}
