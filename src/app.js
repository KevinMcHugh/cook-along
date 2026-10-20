import { decode } from "./jwt.js";
import { validate } from "./validate.js";
import { tokenFromLocation, loadSchema } from "./link.js";

const $ = (id) => document.getElementById(id);

// Note text supports **bold** and nothing else. Built with DOM nodes, never
// innerHTML, because the recipe comes from the URL.
function appendRich(el, text) {
  text.split(/(\*\*[^*]+\*\*)/).forEach((part) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      const b = document.createElement("b");
      b.textContent = part.slice(2, -2);
      el.appendChild(b);
    } else if (part) {
      el.appendChild(document.createTextNode(part));
    }
  });
}

function h(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text != null) el.textContent = text;
  return el;
}

function showMessage(title, lines) {
  document.body.classList.add("message-mode");
  const main = $("main");
  main.replaceChildren();
  const sec = h("section", "step active");
  sec.appendChild(h("h2", "step-title", title));
  const ul = h("ul", "step-body");
  lines.forEach((l) => ul.appendChild(h("li", null, l)));
  sec.appendChild(ul);
  main.appendChild(sec);
}

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf).slice(0, 8)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function main() {
  const token = tokenFromLocation(window.location);
  // Even a broken link gets an Edit button, so it can be fixed in the editor.
  const edit = $("editBtn");
  edit.href = token ? "edit.html#token=" + token : "edit.html";
  edit.hidden = false;
  if (!token) {
    showMessage("No recipe in this link", [
      "Open this page with a recipe token: …/#token=<jwt>.",
      "Or write one in the editor."
    ]);
    return;
  }

  let payload, schema;
  try {
    payload = decode(token);
  } catch (e) {
    showMessage("Can't open this recipe", [e.message]);
    return;
  }
  try {
    schema = await loadSchema();
  } catch (e) {
    showMessage("Can't open this recipe", ["Couldn't load the recipe schema."]);
    return;
  }
  const recipe = payload.recipe;
  const errors = recipe === undefined ? ['token has no "recipe" claim'] : validate(schema, recipe);
  if (errors.length) {
    showMessage("This recipe doesn't match the schema", errors.slice(0, 10));
    return;
  }

  run(recipe, `cook-along:${await sha256(token.split(".")[1])}`);
}

function run(recipe, storeKey) {
  const STEPS = recipe.steps;
  document.title = recipe.title;
  $("eyebrow").textContent = recipe.eyebrow || "";
  $("eyebrow").hidden = !recipe.eyebrow;
  $("stepHeading").textContent = recipe.title;

  buildIngredients(recipe);

  // Progress is kept per token, so two recipes open in two tabs don't collide.
  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(storeKey) || "null");
      if (parsed && typeof parsed.step === "number" && parsed.timers) return parsed;
    } catch (e) {}
    return { step: 0, timers: {} };
  }
  function saveState() {
    try { localStorage.setItem(storeKey, JSON.stringify(state)); } catch (e) {}
  }
  const state = loadState();
  if (state.step < 0 || state.step >= STEPS.length) state.step = 0;

  const mainEl = $("main");
  const progressEl = $("progress");
  mainEl.replaceChildren();
  progressEl.replaceChildren();

  STEPS.forEach((step, i) => {
    const el = h("section", "step");
    el.id = "step-" + i;
    el.appendChild(h("p", "step-eyebrow", `Step ${i + 1} of ${STEPS.length}`));
    el.appendChild(h("h2", "step-title", step.title));
    const ul = h("ul", "step-body");
    step.body.forEach((line) => ul.appendChild(h("li", null, line)));
    el.appendChild(ul);

    if (step.note) {
      const note = h("div", "note" + (step.note.tone === "good" ? " good" : ""));
      appendRich(note, step.note.text);
      el.appendChild(note);
    }

    if (step.timer) {
      const card = h("div", "timer-card");
      card.id = "timer-" + i;
      const start = h("button", "timer-start");
      start.type = "button";
      start.dataset.act = "start";
      start.dataset.i = i;
      start.appendChild(h("span", "timer-start-label", "Start " + (step.timer.label || "timer").toLowerCase()));
      start.appendChild(h("span", "timer-start-time", fmt(step.timer.seconds)));
      card.appendChild(start);
      card.appendChild(h("p", "timer-status"));
      el.appendChild(card);
    }

    mainEl.appendChild(el);
    const seg = h("div", "seg");
    seg.id = "seg-" + i;
    progressEl.appendChild(seg);
  });

  // Timers live in the tray above the back/next bar, not in the step, so a
  // 30-minute marinade stays in view while you work through the next steps.
  // A step only offers a Start button for its timer.
  const tray = $("tray");
  tray.replaceChildren();
  STEPS.forEach((step, i) => {
    if (!step.timer) return;
    const row = h("div", "tray-item");
    row.id = "tray-" + i;
    row.hidden = true;
    const label = h("button", "tray-label");
    label.type = "button";
    label.dataset.act = "goto";
    label.dataset.i = i;
    label.appendChild(h("span", "tray-step", `Step ${i + 1}`));
    label.appendChild(h("span", "tray-name", step.timer.label || step.title));
    row.appendChild(label);
    const face = h("span", "tray-face", "--:--");
    face.id = "tface-" + i;
    row.appendChild(face);
    const controls = h("div", "tray-controls");
    [["toggle", "Pause"], ["add", "+1:00"], ["reset", "✕", "Stop and clear this timer"]].forEach(([act, text, title]) => {
      const b = h("button", "tray-btn", text);
      b.type = "button";
      b.dataset.act = act;
      b.dataset.i = i;
      if (title) { b.title = title; b.setAttribute("aria-label", title); }
      controls.appendChild(b);
    });
    row.appendChild(controls);
    const bar = h("div", "tray-bar");
    bar.setAttribute("role", "progressbar");
    bar.setAttribute("aria-label", (step.timer.label || step.title) + " time left");
    bar.setAttribute("aria-valuemin", "0");
    const fill = h("div", "tray-fill");
    fill.id = "tfill-" + i;
    bar.appendChild(fill);
    row.appendChild(bar);
    tray.appendChild(row);
  });

  function timerState(i) {
    const t = state.timers[i];
    if (!t || typeof t.total !== "number") {
      state.timers[i] = { remaining: STEPS[i].timer.seconds, total: STEPS[i].timer.seconds, running: false, endAt: null, active: false, finished: false };
    }
    return state.timers[i];
  }

  function remainingOf(t) {
    return Math.max(0, t.running ? (t.endAt - Date.now()) / 1000 : t.remaining);
  }

  function fmt(sec) {
    sec = Math.max(0, Math.ceil(sec));
    const hr = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    const mm = String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
    return hr ? `${hr}:${mm}` : mm;
  }

  let audioCtx = null;
  function beep() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const now = audioCtx.currentTime;
      [0, 0.22, 0.44].forEach((delay) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.3, now + delay + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.18);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(now + delay); osc.stop(now + delay + 0.2);
      });
    } catch (e) {}
  }

  // A finished timer keeps beeping every few seconds (for a minute) until
  // it's dismissed; one beep is easy to miss over a range hood.
  const beepLog = {};
  function renderTimer(i) {
    const step = STEPS[i];
    const t = timerState(i);
    let remaining = remainingOf(t);
    if (t.running && remaining <= 0) {
      t.running = false;
      t.remaining = 0;
      t.finished = true;
      beepLog[i] = { at: 0, count: 0 };
      saveState();
    }
    if (t.finished) {
      const log = beepLog[i] || (beepLog[i] = { at: 0, count: 0 });
      if (log.count < 15 && Date.now() - log.at > 4000) { beep(); log.at = Date.now(); log.count++; }
    }

    const row = $("tray-" + i);
    row.hidden = !t.active;
    row.classList.toggle("ringing", t.finished);
    row.classList.toggle("paused", t.active && !t.running && !t.finished);
    row.classList.toggle("current", i === state.step);
    $("tface-" + i).textContent = t.finished ? "Done" : fmt(remaining);
    const frac = t.total > 0 ? remaining / t.total : 0;
    $("tfill-" + i).style.transform = `scaleX(${Math.min(1, frac)})`;
    const bar = row.querySelector(".tray-bar");
    bar.setAttribute("aria-valuemax", String(Math.round(t.total)));
    bar.setAttribute("aria-valuenow", String(Math.round(remaining)));
    row.querySelector('[data-act="toggle"]').textContent = t.finished ? "Dismiss" : t.running ? "Pause" : "Resume";

    const card = $("timer-" + i);
    card.querySelector(".timer-start").hidden = t.active;
    const status = card.querySelector(".timer-status");
    status.hidden = !t.active;
    status.textContent = t.finished ? "Time's up — see the timer below." : `${fmt(remaining)} left${t.running ? "" : " (paused)"} — running in the timer bar below.`;
  }

  function renderTimers() {
    STEPS.forEach((step, i) => { if (step.timer) renderTimer(i); });
    tray.hidden = !STEPS.some((step, i) => step.timer && state.timers[i] && state.timers[i].active);
  }

  setInterval(renderTimers, 250);

  function onTimerClick(e) {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const i = parseInt(btn.dataset.i, 10);
    const step = STEPS[i];
    const t = timerState(i);
    const act = btn.dataset.act;
    if (act === "goto") {
      state.step = i;
      renderStep();
      return;
    }
    if (act === "start") {
      Object.assign(t, { remaining: step.timer.seconds, total: step.timer.seconds, running: true, active: true, finished: false });
      t.endAt = Date.now() + t.remaining * 1000;
      unlockAudio();
      requestWake();
    } else if (act === "toggle") {
      if (t.finished) {
        Object.assign(t, { remaining: step.timer.seconds, total: step.timer.seconds, running: false, active: false, finished: false });
      } else if (t.running) {
        t.remaining = remainingOf(t);
        t.running = false;
      } else {
        t.endAt = Date.now() + t.remaining * 1000;
        t.running = true;
        requestWake();
      }
    } else if (act === "add") {
      if (t.finished) {
        t.finished = false;
        t.remaining = 60;
        t.total = 60;
        t.endAt = Date.now() + 60 * 1000;
        t.running = true;
      } else if (t.running) {
        t.endAt += 60 * 1000;
      } else {
        t.remaining += 60;
      }
      t.total = Math.max(t.total, remainingOf(t));
    } else if (act === "reset") {
      Object.assign(t, { remaining: step.timer.seconds, total: step.timer.seconds, running: false, active: false, finished: false });
    }
    saveState();
    renderTimers();
  }
  mainEl.addEventListener("click", onTimerClick);
  tray.addEventListener("click", onTimerClick);

  // iOS only lets audio play after a user gesture; a silent beep on the
  // first Start tap unlocks it for the alarm later.
  function unlockAudio() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtx.resume();
    } catch (e) {}
  }

  function renderStep() {
    STEPS.forEach((step, i) => {
      $("step-" + i).classList.toggle("active", i === state.step);
      $("seg-" + i).className = "seg" + (i < state.step ? " done" : i === state.step ? " current" : "");
    });
    renderTimers();
    $("backBtn").disabled = state.step === 0;
    const last = state.step === STEPS.length - 1;
    $("nextLabel").textContent = last ? "Done ✓" : "Next ▸";
    $("nextSub").textContent = last ? recipe.doneLabel || "Enjoy!" : STEPS[state.step + 1].title;
    $("backSub").textContent = state.step > 0 ? STEPS[state.step - 1].title : " ";
    mainEl.scrollTop = 0;
    saveState();
  }

  $("backBtn").addEventListener("click", () => {
    if (state.step > 0) { state.step -= 1; renderStep(); }
  });
  $("nextBtn").addEventListener("click", () => {
    state.step = state.step < STEPS.length - 1 ? state.step + 1 : 0;
    renderStep();
  });

  function requestWake() {
    try {
      if ("wakeLock" in navigator) navigator.wakeLock.request("screen").catch(() => {});
    } catch (e) {}
  }

  renderStep();
}

function buildIngredients(recipe) {
  const groups = recipe.ingredients || [];
  const btn = $("ingBtn");
  btn.hidden = groups.length === 0;
  if (!groups.length) return;
  $("sheetTitle").textContent = recipe.ingredientsTitle || "Ingredients";
  const body = $("sheetBody");
  body.replaceChildren();
  groups.forEach((g) => {
    const group = h("div", "ing-group");
    if (g.name) group.appendChild(h("h3", null, g.name));
    const ul = h("ul");
    g.items.forEach((it) => {
      const li = h("li");
      li.appendChild(h("span", null, it.name));
      li.appendChild(h("span", "q", it.quantity || ""));
      ul.appendChild(li);
    });
    group.appendChild(ul);
    body.appendChild(group);
  });

  const backdrop = $("sheetBackdrop");
  btn.addEventListener("click", () => backdrop.classList.add("open"));
  $("sheetClose").addEventListener("click", () => backdrop.classList.remove("open"));
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.classList.remove("open"); });
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  main();
  // Pasting a new token into the address bar only changes the fragment.
  window.addEventListener("hashchange", () => window.location.reload());
}
