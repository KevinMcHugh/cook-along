// Copies the files the cook-along-recipe skill needs into its folder, so the
// skill works on its own when uploaded to claude.ai. Same relative layout as
// the repo, so imports between them keep working.
//   node scripts/sync-skill.mjs          copy files into the skill folder
//   node scripts/sync-skill.mjs --zip    …and build dist/cook-along-recipe.zip
// test/skill.test.mjs fails if the copies drift from the originals.
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const SKILL_DIR = ".claude/skills/cook-along-recipe";
export const SKILL_FILES = [
  "scripts/make-link.mjs",
  "src/jwt.js",
  "src/link.js",
  "src/validate.js",
  "schema/recipe.schema.json",
  "examples/satay.json",
];

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const f of SKILL_FILES) {
    const to = join(root, SKILL_DIR, f);
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(join(root, f), to);
  }
  console.log(`synced ${SKILL_FILES.length} files into ${SKILL_DIR}`);
  if (process.argv.includes("--zip")) {
    const out = join(root, "dist", "cook-along-recipe.zip");
    mkdirSync(dirname(out), { recursive: true });
    rmSync(out, { force: true });
    // The zip holds the skill folder itself, which is what claude.ai expects.
    execFileSync("zip", ["-qr", out, "cook-along-recipe"], { cwd: join(root, dirname(SKILL_DIR)) });
    console.log(`wrote ${out}`);
  }
}
