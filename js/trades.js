// ============================================================
// CAMPUS BARTER - Trades engine (js/trades.js)
// ------------------------------------------------------------
// Same pattern as auth.js and db.js: pages never talk to
// Firestore directly for trades, only through CBTrades.*
//
// Load with:
//   <script type="module" src="js/trades.js"></script>
//
// DATA SHAPE (one document per trade, auto-generated id):
//   trades/{tradeId} = {
//     proposerUid, proposerName, proposerWhatsapp,
//     receiverUid, receiverName, receiverWhatsapp,
//     offeredSkill,   // proposer's skill going to receiver
//     requestedSkill, // receiver's skill going to proposer
//     terms,          // free text, optional
//     status,         // "pending" | "accepted" | "declined" | "completed"
//     proposerRating, receiverRating,  // 1-5, filled in after completion
//     createdAt, updatedAt
//   }
//
// Every function returns { ok: true, data } or { ok: false, message }.
// ============================================================

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  updateDoc,
  query,
  where,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

import { FIREBASE_CONFIG } from "./firebase-config.js";

const app = getApps().length > 0 ? getApp() : initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);

function friendly(error) {
  const KNOWN = {
    "permission-denied": "You don't have permission to do that.",
    "unavailable": "Can't reach the server right now. Check your connection."
  };
  return KNOWN[error.code] || "Something went wrong. (" + error.code + ")";
}

/* ---- propose a new trade ---- */
async function proposeTrade(proposer, receiver, offeredSkill, requestedSkill, terms) {
  /* Guard against the exact bug that used to bite here: if either
     uid is missing, Firestore rejects the whole write with a
     cryptic "invalid-argument" (it doesn't allow undefined field
     values). Catching it here gives a message that actually says
     what's wrong instead of making someone debug a Firestore
     error code. */
  if (!proposer.uid || !receiver.uid) {
    return { ok: false, message: "Missing account information — try refreshing the page." };
  }

  try {
    const tradeDoc = {
      proposerUid: proposer.uid,
      proposerName: proposer.name,
      proposerWhatsapp: proposer.whatsapp,
      receiverUid: receiver.uid,
      receiverName: receiver.name,
      receiverWhatsapp: receiver.whatsapp,
      offeredSkill: offeredSkill,
      requestedSkill: requestedSkill,
      terms: terms || "",
      status: "pending",
      proposerRating: null,
      receiverRating: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    const ref = await addDoc(collection(db, "trades"), tradeDoc);
    return { ok: true, data: Object.assign({ id: ref.id }, tradeDoc) };
  } catch (error) {
    return { ok: false, message: friendly(error) };
  }
}

/* ---- all trades involving this uid, either side ---- */
async function getMyTrades(uid) {
  try {
    const asProposer = query(collection(db, "trades"), where("proposerUid", "==", uid));
    const asReceiver = query(collection(db, "trades"), where("receiverUid", "==", uid));

    const results = await Promise.all([getDocs(asProposer), getDocs(asReceiver)]);
    const proposerSnap = results[0];
    const receiverSnap = results[1];

    let trades = [];
    proposerSnap.forEach(function (d) { trades.push(Object.assign({ id: d.id }, d.data())); });
    receiverSnap.forEach(function (d) { trades.push(Object.assign({ id: d.id }, d.data())); });

    /* newest first; createdAt may briefly be null right after
       creation (server timestamp hasn't round-tripped yet) */
    trades.sort(function (a, b) {
      let aTime = a.createdAt ? a.createdAt.toMillis() : Date.now();
      let bTime = b.createdAt ? b.createdAt.toMillis() : Date.now();
      return bTime - aTime;
    });

    return { ok: true, data: trades };
  } catch (error) {
    return { ok: false, message: friendly(error) };
  }
}

async function setStatus(tradeId, status) {
  try {
    await updateDoc(doc(db, "trades", tradeId), {
      status: status,
      updatedAt: serverTimestamp()
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, message: friendly(error) };
  }
}

function acceptTrade(tradeId) { return setStatus(tradeId, "accepted"); }
function declineTrade(tradeId) { return setStatus(tradeId, "declined"); }
function completeTrade(tradeId) { return setStatus(tradeId, "completed"); }

/* ---- rate the other person after completion ---- */
async function rateTrade(tradeId, raterRole, stars) {
  try {
    let field = raterRole === "proposer" ? "proposerRating" : "receiverRating";
    let update = {};
    update[field] = stars;
    update.updatedAt = serverTimestamp();
    await updateDoc(doc(db, "trades", tradeId), update);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: friendly(error) };
  }
}

/* ============================================================
   RECALCULATING YOUR OWN RATING
   ------------------------------------------------------------
   Firestore rules only let you write YOUR OWN profile document
   (request.auth.uid == userId) — on purpose, so nobody can
   tamper with someone else's public stats. That means the person
   who RATES a trade can't directly update the OTHER person's
   profile; only that other person's own signed-in session can.

   So instead of "rating instantly updates their profile", each
   person recalculates and saves their OWN rating/trade count
   whenever their own app loads — self-write only, fully rule-
   compliant. Ratings appear on your profile the next time YOU
   (the rated person) open the dashboard or trades page, not the
   instant the other person submits the star rating. Honest
   trade-off for a client-only build with no backend functions.
   ============================================================ */
async function recalcMyRating(uid) {
  try {
    const asProposer = query(collection(db, "trades"), where("proposerUid", "==", uid));
    const asReceiver = query(collection(db, "trades"), where("receiverUid", "==", uid));
    const results = await Promise.all([getDocs(asProposer), getDocs(asReceiver)]);

    let completedCount = 0;
    let ratingsReceived = [];

    /* When I was the PROPOSER, the RECEIVER rated me —
       that's stored in receiverRating. */
    results[0].forEach(function (d) {
      let data = d.data();
      if (data.status === "completed") {
        completedCount++;
        if (data.receiverRating !== null && data.receiverRating !== undefined) {
          ratingsReceived.push(data.receiverRating);
        }
      }
    });

    /* When I was the RECEIVER, the PROPOSER rated me —
       that's stored in proposerRating. */
    results[1].forEach(function (d) {
      let data = d.data();
      if (data.status === "completed") {
        completedCount++;
        if (data.proposerRating !== null && data.proposerRating !== undefined) {
          ratingsReceived.push(data.proposerRating);
        }
      }
    });

    let avgRating = null;
    if (ratingsReceived.length > 0) {
      let sum = ratingsReceived.reduce(function (a, b) { return a + b; }, 0);
      avgRating = Math.round((sum / ratingsReceived.length) * 10) / 10;
    }

    await updateDoc(doc(db, "profiles", uid), {
      rating: avgRating,
      trades: completedCount
    });

    return { ok: true, data: { rating: avgRating, trades: completedCount } };
  } catch (error) {
    /* Non-fatal on purpose: if this quietly fails, the rest of
       the app should keep working — an out-of-date rating is a
       much smaller problem than a broken page. */
    console.error("Failed to recalculate rating:", error);
    return { ok: false, message: friendly(error) };
  }
}

window.CBTrades = {
  proposeTrade: proposeTrade,
  getMyTrades: getMyTrades,
  acceptTrade: acceptTrade,
  declineTrade: declineTrade,
  completeTrade: completeTrade,
  rateTrade: rateTrade,
  recalcMyRating: recalcMyRating
};
window.dispatchEvent(new Event("cbtrades-ready"));