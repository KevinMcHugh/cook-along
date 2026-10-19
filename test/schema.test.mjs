import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validate } from "../src/validate.js";

const schema = JSON.parse(readFileSync(new URL("../schema/recipe.schema.json", import.meta.url), "utf8"));
const satay = JSON.parse(readFileSync(new URL("../examples/satay.json", import.meta.url), "utf8"));

test("the satay example is valid", () => {
  assert.deepEqual(validate(schema, satay), []);
});

test("a minimal recipe is valid", () => {
  assert.deepEqual(validate(schema, { title: "Toast", steps: [{ title: "Toast it", body: ["Bread in."] }] }), []);
});

test("reports missing, extra and mistyped fields with paths", () => {
  const errs = validate(schema, {
    steps: [{ title: "x", body: [], timer: { seconds: 1.5 }, colour: "red" }],
  });
  assert.ok(errs.includes('$: missing "title"'), errs.join("\n"));
  assert.ok(errs.includes("$.steps[0].body: needs at least 1 item(s)"), errs.join("\n"));
  assert.ok(errs.includes("$.steps[0].timer.seconds: expected integer, got number"), errs.join("\n"));
  assert.ok(errs.includes('$.steps[0]: unexpected property "colour"'), errs.join("\n"));
});

test("rejects an unknown note tone", () => {
  const r = { title: "x", steps: [{ title: "x", body: ["x"], note: { text: "x", tone: "loud" } }] };
  assert.equal(validate(schema, r).length, 1);
});

test("throws on a schema keyword it does not implement", () => {
  assert.throws(() => validate({ type: "string", pattern: "^a" }, "a"), /does not handle keyword "pattern"/);
});
