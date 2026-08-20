// ============================================================
// Digital Graveyard — Firebase init (shared by create.js / explore.js)
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";

export let db = null;
export let configOk = false;

try {
  if (isFirebaseConfigured) {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app, "digital-graveyard");
    configOk = true;
  }
} catch (err) {
  console.error("Firebase failed to initialize:", err);
  configOk = false;
}
