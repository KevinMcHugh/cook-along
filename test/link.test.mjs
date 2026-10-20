import { test } from "node:test";
import assert from "node:assert/strict";
import { linkFor, recipeFromText, tokenFromLocation } from "../src/link.js";
import { encode } from "../src/jwt.js";

const recipe = { title: "Toast", steps: [{ title: "Toast it", body: ["Bread in."] }] };

test("a link round-trips through recipeFromText", () => {
  const link = linkFor("https://example.com/cook/?x=1", recipe);
  assert.match(link, /^https:\/\/example\.com\/cook\/#token=/);
  assert.deepEqual(recipeFromText(link), recipe);
});

test("reads a bare token, recipe JSON, and a payload JSON", () => {
  assert.deepEqual(recipeFromText(encode({ recipe })), recipe);
  assert.deepEqual(recipeFromText(JSON.stringify(recipe)), recipe);
  assert.deepEqual(recipeFromText(JSON.stringify({ recipe })), recipe);
});

test("finds tokens in fragment, bare fragment and query", () => {
  const t = encode({ recipe });
  assert.equal(tokenFromLocation(new URL(`https://x/#token=${t}`)), t);
  assert.equal(tokenFromLocation(new URL(`https://x/#${t}`)), t);
  assert.equal(tokenFromLocation(new URL(`https://x/?token=${t}`)), t);
});

test("explains unreadable input", () => {
  assert.throws(() => recipeFromText(""), /nothing/);
  assert.throws(() => recipeFromText("https://x/"), /no #token/);
  assert.throws(() => recipeFromText("{nope"), /JSON/);
  assert.throws(() => recipeFromText(encode({ other: 1 })), /no "recipe"/);
});
