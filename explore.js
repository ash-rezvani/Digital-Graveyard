// ============================================================
// Digital Graveyard — explore.js
// Renders the ASCII graveyard world, moves the player avatar,
// keeps the camera centered on the player, and shows a tooltip
// when the player walks up to a grave.
// ============================================================

import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db, configOk } from "./firebase-init.js";

const viewport = document.getElementById("viewport");
const world = document.getElementById("world");
const loadingBanner = document.getElementById("loading-banner");
const configBanner = document.getElementById("config-banner");
const dpad = document.getElementById("dpad");

const PROXIMITY_RADIUS = 95;
const SPEED = 220; // world units per second
const WORLD_MIN = -3000;
const WORLD_MAX = 3000;

// ---------- static ASCII scenery ----------
// Fixed set-dressing for the graveyard: trees, benches, flowers,
// and a fountain near the entrance, arranged around where the
// user-created graves will sit.

const TREE = ` ^ \n/|\\\n/|\\\n | `;
const SPOOKY_TREE_1 = ` \\ | /\n  \\|/\n---+---\n  /|\\ \n / | \\`; // bare, radiating dead branches
const SPOOKY_TREE_2 = ` (o)(o)\n   \\_/\n  /-|-\\\n /  |  \\`; // gnarled trunk with a watching face
const SPOOKY_TREE_3 = `   _\n  / \\_\n_/    \\\n \\    /\n  |  |\n  |  |`; // hollowed, leaning dead tree
const BENCH = `_______\n[_|_|_]\n  | |  `;
const FLOWER = ` ,@,\n  |\n  "`;
const FOUNTAIN = ` .--.\n( ~~ )\n \`--'\n  ||  `;
const SIGN = `~ DIGITAL GRAVEYARD ~`;

const decorations = [
  { type: "sign", x: 0, y: -480, art: SIGN },
  { type: "fountain", x: 0, y: -380, art: FOUNTAIN },
  { type: "bench", x: -150, y: -300, art: BENCH },
  { type: "bench", x: 150, y: -300, art: BENCH },
  { type: "tree", x: -600, y: -180, art: TREE },
  { type: "tree", x: 600, y: -180, art: SPOOKY_TREE_1 },
  { type: "tree", x: -700, y: 200, art: SPOOKY_TREE_2 },
  { type: "tree", x: 700, y: 200, art: TREE },
  { type: "tree", x: -650, y: 600, art: SPOOKY_TREE_3 },
  { type: "tree", x: 650, y: 600, art: SPOOKY_TREE_1 },
  { type: "tree", x: -400, y: 950, art: TREE },
  { type: "tree", x: 400, y: 950, art: SPOOKY_TREE_2 },
  { type: "flower", x: -320, y: 40, art: FLOWER },
  { type: "flower", x: 320, y: 40, art: FLOWER },
  { type: "flower", x: -280, y: 380, art: FLOWER },
  { type: "flower", x: 280, y: 380, art: FLOWER },
  { type: "flower", x: 0, y: 720, art: FLOWER },
  { type: "bench", x: -500, y: 400, art: BENCH },
  { type: "bench", x: 500, y: 400, art: BENCH },
];

function renderDecorations() {
  const frag = document.createDocumentFragment();
  for (const d of decorations) {
    const el = document.createElement("pre");
    el.className = "decor";
    el.style.left = `${d.x}px`;
    el.style.top = `${d.y}px`;
    el.textContent = d.art;
    frag.appendChild(el);
  }
  world.appendChild(frag);
}

// ---------- player ----------

const TOMBSTONE_VARIANTS = [
  ` _____ \n/     \\\n|  R  |\n| I P |\n|_____|`,
  `  ___  \n /   \\ \n|     |\n| RIP |\n|_____|`,
  `   +   \n _____ \n/ REST \\\n|      |\n|______|`,
  ` __/\\__\n/  XX  \\\n|      |\n|______|`,
  ` _______ \n/  HERE  \\\n|  LIES   |\n|_________|`,
  `  .---.  \n /     \\ \n| PEACE |\n|________|`,
];
const STICK_FIGURE = ` O \n/|\\\n/ \\`;

const player = {
  x: 0,
  y: -250,
  el: null,
  facing: "right"
};

function createPlayer() {
  const el = document.createElement("pre");
  el.className = "player";
  el.textContent = STICK_FIGURE;
  world.appendChild(el);
  player.el = el;
  updatePlayerVisual();
}

function updatePlayerVisual() {
  player.el.style.left = `${player.x}px`;
  player.el.style.top = `${player.y}px`;
  player.el.classList.toggle("flip", player.facing === "left");
}

// ---------- camera ----------

function updateCamera() {
  const cx = viewport.clientWidth / 2;
  const cy = viewport.clientHeight / 2;
  world.style.transform = `translate(${cx - player.x}px, ${cy - player.y}px)`;
}

window.addEventListener("resize", updateCamera);

// ---------- input ----------

const keys = { up: false, down: false, left: false, right: false };

const KEY_MAP = {
  ArrowUp: "up", w: "up", W: "up",
  ArrowDown: "down", s: "down", S: "down",
  ArrowLeft: "left", a: "left", A: "left",
  ArrowRight: "right", d: "right", D: "right",
};

window.addEventListener("keydown", (e) => {
  const dir = KEY_MAP[e.key];
  if (dir) { keys[dir] = true; e.preventDefault(); }
});

window.addEventListener("keyup", (e) => {
  const dir = KEY_MAP[e.key];
  if (dir) { keys[dir] = false; e.preventDefault(); }
});

// touch d-pad
dpad.querySelectorAll("button").forEach((btn) => {
  const dir = btn.dataset.dir;
  const press = (e) => { e.preventDefault(); keys[dir] = true; };
  const release = (e) => { e.preventDefault(); keys[dir] = false; };
  btn.addEventListener("touchstart", press, { passive: false });
  btn.addEventListener("touchend", release, { passive: false });
  btn.addEventListener("touchcancel", release, { passive: false });
  btn.addEventListener("mousedown", press);
  window.addEventListener("mouseup", release);
});

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// ---------- graves ----------

const graveEls = new Map(); // id -> element

function renderGrave(id, data) {
  let el = graveEls.get(id);
  if (!el) {
    el = document.createElement("div");
    el.className = "grave";
    el.style.left = `${data.x}px`;
    el.style.top = `${data.y}px`;

    const art = document.createElement("pre");
    art.style.margin = "0";
    const variant = TOMBSTONE_VARIANTS[Math.floor(Math.random() * TOMBSTONE_VARIANTS.length)];
    art.textContent = variant;
    el.appendChild(art);

    const tooltip = document.createElement("div");
    tooltip.className = "tooltip";

    const nameEl = document.createElement("div");
    nameEl.className = "t-name";
    const datesEl = document.createElement("div");
    datesEl.className = "t-dates";
    const obitEl = document.createElement("div");
    obitEl.className = "t-obit";

    tooltip.appendChild(nameEl);
    tooltip.appendChild(datesEl);
    tooltip.appendChild(obitEl);
    el.appendChild(tooltip);

    world.appendChild(el);
    graveEls.set(id, {
      root: el,
      nameEl,
      datesEl,
      obitEl,
      x: data.x,
      y: data.y,
    });
    el = graveEls.get(id);
  }

  // fill/update text content safely (textContent, never innerHTML)
  el.nameEl.textContent = data.name || "Unknown";
  el.datesEl.textContent = formatDates(data.dates);
  el.obitEl.textContent = data.obituary || "";
}

function formatDates(raw) {
  if (!raw) return "";
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.length === 8) {
    return `${digits.slice(0, 4)} \u2013 ${digits.slice(4)}`;
  }
  return raw;
}

function removeGrave(id) {
  const entry = graveEls.get(id);
  if (entry) {
    entry.root.remove();
    graveEls.delete(id);
  }
}

let focusGraveId = sessionStorage.getItem("digitalGraveyard_focusGrave");
sessionStorage.removeItem("digitalGraveyard_focusGrave");
let hasSpawned = false;

function maybeSpawnNearFocusGrave() {
  if (hasSpawned || !focusGraveId) return;
  const entry = graveEls.get(focusGraveId);
  if (!entry) return;
  player.x = entry.x + 55;
  player.y = entry.y + 30;
  hasSpawned = true;
  updatePlayerVisual();
  updateCamera();
}

// ---------- proximity check ----------

function updateProximity() {
  for (const entry of graveEls.values()) {
    const dx = player.x - entry.x;
    const dy = player.y - entry.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    entry.root.classList.toggle("near", dist <= PROXIMITY_RADIUS);
  }
}

// ---------- main loop ----------

let lastTime = null;

function tick(now) {
  if (lastTime === null) lastTime = now;
  const dt = Math.min((now - lastTime) / 1000, 0.1); // seconds, clamped
  lastTime = now;

  let dx = 0, dy = 0;
  if (keys.up) dy -= 1;
  if (keys.down) dy += 1;
  if (keys.left) dx -= 1;
  if (keys.right) dx += 1;

  if (dx !== 0 || dy !== 0) {
    const len = Math.sqrt(dx * dx + dy * dy);
    dx /= len; dy /= len;
    player.x = clamp(player.x + dx * SPEED * dt, WORLD_MIN, WORLD_MAX);
    player.y = clamp(player.y + dy * SPEED * dt, WORLD_MIN, WORLD_MAX);
    if (dx > 0) player.facing = "right";
    if (dx < 0) player.facing = "left";
    updatePlayerVisual();
    updateCamera();
  }

  updateProximity();
  requestAnimationFrame(tick);
}

// ---------- boot ----------

function init() {
  if (!configOk || !db) {
    loadingBanner.style.display = "none";
    configBanner.classList.add("visible");
    // still render scenery + a stationary player so the page isn't blank
    renderDecorations();
    createPlayer();
    updateCamera();
    requestAnimationFrame(tick);
    return;
  }

  renderDecorations();
  createPlayer();
  updateCamera();

  const gravesRef = collection(db, "graves");
  onSnapshot(gravesRef, (snapshot) => {
    loadingBanner.style.display = "none";
    snapshot.docChanges().forEach((change) => {
      if (change.type === "removed") {
        removeGrave(change.doc.id);
      } else {
        renderGrave(change.doc.id, change.doc.data());
      }
    });
    maybeSpawnNearFocusGrave();
    updateProximity();
  }, (err) => {
    console.error("Failed to load graves:", err);
    loadingBanner.textContent = "Couldn't load the graveyard. Check your connection and Firestore rules.";
  });

  requestAnimationFrame(tick);
}

init();
