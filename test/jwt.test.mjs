import { test } from "node:test";
import assert from "node:assert/strict";
import { encode, decode } from "../src/jwt.js";

test("round-trips a payload, including non-ASCII text", () => {
  assert.deepEqual(decode(encode({ recipe: { title: "Tést ½" } })), { recipe: { title: "Tést ½" } });
});

test("ignores the signature, whatever it is", () => {
  const [h, p] = encode({ recipe: { title: "x" } }).split(".");
  assert.equal(decode(`${h}.${p}.c2lnbmF0dXJl`).recipe.title, "x");
});

test("accepts a token whose trailing dot was stripped", () => {
  const token = encode({ recipe: { title: "x" } });
  assert.ok(token.endsWith("."));
  assert.equal(decode(token.slice(0, -1)).recipe.title, "x");
});

test("reports malformed tokens clearly", () => {
  assert.throws(() => decode("abc"), /header\.payload/);
  assert.throws(() => decode("a.b.c.d"), /header\.payload/);
  assert.throws(() => decode("a.b!.c"), /base64url/);
  assert.throws(() => decode("a.bm90IGpzb24.c"), /not valid JSON/);
});
