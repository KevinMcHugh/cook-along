import { validate } from "./validate.js";
import { tokenFromLocation, linkFor, recipeFromText, loadSchema } from "./link.js";

const $ = (id) => document.getElementById(id);
const DRAFT_KEY = "cook-along:editor-draft";
const BLANK = {
  title: "New recipe",
  ingredients: [{ name: "Main", items: [{ name: "Something", quantity: "1 cup" }] }],
  steps: [{ title: "First step", body: ["Do the first thing."], timer: { seconds: 300, label: "Simmering" } }],
};

// Links point at the cook page that sits next to this editor.
const cookBase = new URL("./", window.location.href).toString();
let schema = null;
let current = null; // last valid recipe, or null

function setJson(obj) {
  $("json").value = JSON.stringify(obj, null, 2);
  check();
}

function loadFrom(text, origin) {
  const msg = $("loadMsg");
  try {
    setJson(recipeFromText(text));
    msg.className = "msg";
    msg.textContent = `Loaded from ${origin}.`;
  } catch (e) {
    msg.className = "msg bad";
    msg.textContent = e.message;
  }
}

function check() {
  const text = $("json").value;
  try { localStorage.setItem(DRAFT_KEY, text); } catch (e) {}
  let errors = [];
  let recipe = null;
  try {
    recipe = JSON.parse(text);
  } catch (e) {
    errors = ["JSON: " + e.message];
  }
  if (recipe !== null && !errors.length) errors = schema ? validate(schema, recipe) : ["schema not loaded yet"];

  const status = $("status");
  const list = $("errors");
  list.replaceChildren();
  if (errors.length) {
    current = null;
    status.className = "status bad";
    status.textContent = `${errors.length} problem${errors.length === 1 ? "" : "s"}`;
    errors.slice(0, 25).forEach((err) => {
      const li = document.createElement("li");
      li.textContent = err;
      list.appendChild(li);
    });
  } else {
    current = recipe;
    const timers = recipe.steps.filter((s) => s.timer).length;
    status.className = "status ok";
    status.textContent = `✓ valid · ${recipe.steps.length} step${recipe.steps.length === 1 ? "" : "s"} · ${timers} timer${timers === 1 ? "" : "s"}`;
  }
  renderLink();
}

function renderLink() {
  const link = current ? linkFor(cookBase, current) : "";
  $("link").value = link;
  $("copyLinkBtn").disabled = !current;
  const open = $("openBtn");
  if (current) { open.href = link; open.removeAttribute("aria-disabled"); }
  else { open.removeAttribute("href"); open.setAttribute("aria-disabled", "true"); }
  $("linkInfo").textContent = current ? `${link.length.toLocaleString()} chars${link.length > 8000 ? " — long; some chat apps truncate" : ""}` : "";
}

async function copy(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    // Older browsers / non-secure contexts: fall back to a selection copy.
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  const was = btn.textContent;
  btn.textContent = "Copied ✓";
  setTimeout(() => { btn.textContent = was; }, 1400);
}

$("loadBtn").addEventListener("click", () => loadFrom($("source").value, "pasted text"));
$("source").addEventListener("paste", () => setTimeout(() => loadFrom($("source").value, "pasted text"), 0));
$("exampleBtn").addEventListener("click", async () => {
  try {
    setJson(await (await fetch("examples/satay.json")).json());
    $("loadMsg").className = "msg";
    $("loadMsg").textContent = "Loaded the satay example.";
  } catch (e) {
    $("loadMsg").className = "msg bad";
    $("loadMsg").textContent = "Couldn't load the example.";
  }
});
$("blankBtn").addEventListener("click", () => {
  setJson(BLANK);
  $("loadMsg").className = "msg";
  $("loadMsg").textContent = "Started a blank recipe.";
});
$("json").addEventListener("input", check);
$("json").addEventListener("keydown", (e) => {
  // Tab indents instead of leaving the field.
  if (e.key === "Tab" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
    e.preventDefault();
    document.execCommand("insertText", false, "  ");
  }
});
$("formatBtn").addEventListener("click", () => {
  try { setJson(JSON.parse($("json").value)); } catch (e) { check(); }
});
$("copyLinkBtn").addEventListener("click", (e) => copy($("link").value, e.currentTarget));
$("copyJsonBtn").addEventListener("click", (e) => copy($("json").value, e.currentTarget));

(async () => {
  try { schema = await loadSchema(); } catch (e) {}
  const token = tokenFromLocation(window.location);
  let draft = null;
  try { draft = localStorage.getItem(DRAFT_KEY); } catch (e) {}
  if (token) {
    loadFrom(token, "the link you opened");
    // Keep the token out of the address bar so a refresh keeps your edits
    // (the draft) instead of reloading the original.
    history.replaceState(null, "", window.location.pathname);
  } else if (draft) {
    $("json").value = draft;
    check();
    $("loadMsg").textContent = "Restored your last draft.";
  } else {
    setJson(BLANK);
  }
})();
