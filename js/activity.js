// ============================================================
// CAMPUS BARTER - Activity engine (js/activity.js)
// ------------------------------------------------------------
// A small personal log, separate from trades: things like
// "your profile was saved" that don't belong in the trades
// collection but still deserve a place in Notifications.
//
// DATA SHAPE (one doc per event):
//   activity/{autoId} = { uid, message, createdAt }
//
// Load with:
//   <script type="module" src="js/activity.js"></script>
// Use:
//   CBActivity.logActivity(uid, message)
//   CBActivity.getMyActivity(uid)
// ============================================================

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, query, where, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { FIREBASE_CONFIG } from "./firebase-config.js";

const app = getApps().length > 0 ? getApp() : initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);

function friendly(error) {
  return "Something went wrong. (" + error.code + ")";
}

async function logActivity(uid, message) {
  try {
    await addDoc(collection(db, "activity"), {
      uid: uid,
      message: message,
      createdAt: serverTimestamp()
    });
    return { ok: true };
  } catch (error) {
    /* Non-fatal by design: a failed log entry should never
       block the action that triggered it (e.g. saving a profile
       still succeeds even if the notification about it fails). */
    console.error("Activity log failed:", error);
    return { ok: false, message: friendly(error) };
  }
}

async function getMyActivity(uid) {
  try {
    const q = query(collection(db, "activity"), where("uid", "==", uid));
    const snap = await getDocs(q);
    let items = [];
    snap.forEach(function (d) { items.push(Object.assign({ id: d.id }, d.data())); });
    return { ok: true, data: items };
  } catch (error) {
    return { ok: false, message: friendly(error) };
  }
}

window.CBActivity = { logActivity: logActivity, getMyActivity: getMyActivity };
window.dispatchEvent(new Event("cbactivity-ready"));