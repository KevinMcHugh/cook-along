import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SKILL_DIR, SKILL_FILES } from "../scripts/sync-skill.mjs";

const root = new URL("../", import.meta.url);

for (const f of SKILL_FILES) {
  test(`skill copy of ${f} is up to date (run npm run sync-skill)`, () => {
    assert.equal(readFileSync(new URL(`${SKILL_DIR}/${f}`, root), "utf8"), readFileSync(new URL(f, root), "utf8"));
  });
}

test("SKILL.md has name and description front matter", () => {
  const md = readFileSync(new URL(`${SKILL_DIR}/SKILL.md`, root), "utf8");
  assert.match(md, /^---\nname: cook-along-recipe\ndescription: .+\n---\n/);
});
