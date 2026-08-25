// ============================================================
// CAMPUS BARTER - Database engine (js/db.js)
// ------------------------------------------------------------
// Wraps Firestore behind simple functions, same pattern as
// auth.js. Pages never talk to Firestore directly.
//
// Load in any page with:
//   <script type="module" src="js/db.js"></script>
//
// Then (after it loads) use:
//   CBDb.saveProfile(uid, profileObject)   -> create/update a profile
//   CBDb.getProfile(uid)                   -> fetch one profile
//   CBDb.getProfilesByInstitution(name)    -> all profiles at one campus
//   CBDb.getAllProfiles()                  -> everyone (used for "all campuses")
//
// DATA SHAPE (one document per user, keyed by their Firebase uid):
//   profiles/{uid} = {
//     name, institution, whatsapp, offers[], needs[],
//     rating, trades, joined
//   }
//   Note: email and password are NOT stored here — Firebase Auth
//   already owns those. Firestore only holds the public profile.
//
// Every function returns a promise resolving to:
//   { ok: true, data }   on success  (data shape varies by function)
//   { ok: false, message } with a human-friendly message on failure
// ============================================================

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

import { FIREBASE_CONFIG } from "./firebase-config.js";

/* Reuse the same app instance auth.js already created, instead of
   starting a second one. getApps() lists any app already booted
   on this page; if auth.js loaded first, we attach to it. */
const app = getApps().length > 0 ? getApp() : initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);

function friendly(error) {
  const KNOWN = {
    "permission-denied":
      "You don't have permission to do that.",
    "unavailable":
      "Can't reach the server right now. Check your connection."
  };
  return KNOWN[error.code] ||
    "Something went wrong loading your data. (" + error.code + ")";
}

/* ---- save (create OR update) a profile, keyed by uid ---- */
async function saveProfile(uid, profile) {
  try {
    /* setDoc with merge:true means "update these fields, don't
       wipe out anything not mentioned" — safer than overwriting
       the whole document every time. */
    await setDoc(doc(db, "profiles", uid), profile, { merge: true });
    return { ok: true, data: profile };
  } catch (error) {
    return { ok: false, message: friendly(error) };
  }
}

/* ---- fetch one profile by uid ---- */
async function getProfile(uid) {
  try {
    const snap = await getDoc(doc(db, "profiles", uid));
    if (snap.exists() === false) {
      return { ok: true, data: null };  /* not an error: just no profile yet */
    }
    return { ok: true, data: snap.data() };
  } catch (error) {
    return { ok: false, message: friendly(error) };
  }
}

/* ---- everyone at one institution (powers "your campus") ---- */
async function getProfilesByInstitution(institutionName) {
  try {
    const q = query(
      collection(db, "profiles"),
      where("institution", "==", institutionName)
    );
    const snap = await getDocs(q);
    let people = [];
    snap.forEach(function (docSnap) {
      people.push(docSnap.data());
    });
    return { ok: true, data: people };
  } catch (error) {
    return { ok: false, message: friendly(error) };
  }
}

/* ---- everyone, everywhere (powers "all campuses") ---- */
async function getAllProfiles() {
  try {
    const snap = await getDocs(collection(db, "profiles"));
    let people = [];
    snap.forEach(function (docSnap) {
      people.push(docSnap.data());
    });
    return { ok: true, data: people };
  } catch (error) {
    return { ok: false, message: friendly(error) };
  }
}

window.CBDb = { saveProfile, getProfile, getProfilesByInstitution, getAllProfiles };
window.dispatchEvent(new Event("cbdb-ready"));