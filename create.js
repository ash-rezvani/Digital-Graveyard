// ============================================================
// Digital Graveyard — create.js
// Handles the "Create a Grave" form: validation, saving the
// grave to Firestore, and handing off to the explore page.
// ============================================================

import {
  collection,
  addDoc,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db, configOk } from "./firebase-init.js";

const form = document.getElementById("grave-form");
const nameInput = document.getElementById("name");
const datesInput = document.getElementById("dates");
const obituaryInput = document.getElementById("obituary");
const nameCount = document.getElementById("name-count");
const obituaryCount = document.getElementById("obituary-count");
const errorMsg = document.getElementById("error-msg");
const submitBtn = document.getElementById("submit-btn");

// live character counters
nameInput.addEventListener("input", () => {
  nameCount.textContent = `${nameInput.value.length} / 75`;
});
obituaryInput.addEventListener("input", () => {
  obituaryCount.textContent = `${obituaryInput.value.length} / 500`;
});

// restrict the dates field to digits, spaces, and hyphens
// (e.g. "1948 - 2021") — no letters allowed
datesInput.addEventListener("input", () => {
  datesInput.value = datesInput.value.replace(/[^0-9\s-]/g, "");
});

function showError(message) {
  errorMsg.textContent = message;
  errorMsg.classList.add("visible");
}

function clearError() {
  errorMsg.textContent = "";
  errorMsg.classList.remove("visible");
}

// Graves are laid out in a loose grid clustered near the world
// origin, in the order they were created, with a little random
// jitter so the graveyard doesn't look too mechanical.
function computePosition(index) {
  const spacing = 170;
  const perRow = 6;
  const row = Math.floor(index / perRow);
  const col = index % perRow;
  const jitterX = (Math.random() - 0.5) * 40;
  const jitterY = (Math.random() - 0.5) * 24;
  return {
    x: Math.round((col - (perRow - 1) / 2) * spacing + jitterX),
    y: Math.round(row * spacing + jitterY)
  };
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearError();

  const name = nameInput.value.trim();
  const dates = datesInput.value.trim();
  const obituary = obituaryInput.value.trim();

  if (!name) {
    showError("Please enter a name.");
    return;
  }
  if (name.length > 75) {
    showError("Name must be 75 characters or fewer.");
    return;
  }
  if (!dates) {
    showError("Please enter birth & death dates.");
    return;
  }
  if (obituary.length > 500) {
    showError("Obituary must be 500 characters or fewer.");
    return;
  }

  if (!configOk || !db) {
    showError("Firebase isn't configured yet — see firebase-config.js / README.md.");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Saving…";

  try {
    const gravesRef = collection(db, "graves");
    const existing = await getDocs(gravesRef);
    const position = computePosition(existing.size);

    const docRef = await addDoc(gravesRef, {
      name,
      dates,
      obituary,
      x: position.x,
      y: position.y,
      createdAt: serverTimestamp()
    });

    // remember which grave to spawn next to on the explore page
    sessionStorage.setItem("digitalGraveyard_focusGrave", docRef.id);

    window.location.href = "explore.html";
  } catch (err) {
    console.error(err);
    showError("Something went wrong saving your grave. Please try again.");
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit";
  }
});
