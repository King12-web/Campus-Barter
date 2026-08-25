// ============================================================
// CAMPUS BARTER - Auth engine (js/auth.js)
// ------------------------------------------------------------
// Wraps Firebase Authentication behind simple functions so our
// pages never talk to Firebase directly. When pages need auth,
// they load this file as a module and call window.CBAuth.*
//
// Load in any page with:
//   <script type="module" src="js/auth.js"></script>
//
// Then (after it loads) use:
//   CBAuth.signUp(email, password)     -> creates account, sends verification email
//   CBAuth.signIn(email, password)     -> signs in
//   CBAuth.resetPassword(email)        -> sends password reset email
//   CBAuth.signOutUser()               -> signs out
//   CBAuth.watchUser(callback)         -> callback(user) runs on every auth change;
//                                         user is null when signed out
//
// Every function returns a promise resolving to:
//   { ok: true, user }  on success
//   { ok: false, message } with a HUMAN-FRIENDLY message on failure
// so pages can show errors without knowing Firebase error codes.
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

import { FIREBASE_CONFIG } from "./firebase-config.js";

// ---- boot ----
const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);

// ---- Firebase error codes -> sentences a student understands ----
const FRIENDLY = {
  "auth/email-already-in-use":
    "An account with this email already exists. Try signing in instead.",
  "auth/invalid-email":
    "That email address doesn't look right. Check it and try again.",
  "auth/weak-password":
    "Password is too weak. Use at least 6 characters.",
  "auth/invalid-credential":
    "Email or password is incorrect. Check both and try again.",
  "auth/user-not-found":
    "No account found with this email. Join the board to create one.",
  "auth/wrong-password":
    "Email or password is incorrect. Check both and try again.",
  "auth/too-many-requests":
    "Too many attempts. Wait a few minutes and try again.",
  "auth/network-request-failed":
    "Network problem. Check your connection and try again."
};

function friendly(error) {
  return FRIENDLY[error.code] ||
    "Something went wrong. Please try again. (" + error.code + ")";
}

// ---- the public functions ----

async function signUp(email, password) {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    /* Verification email goes out immediately. The account exists
       either way; pages decide what unverified users may do. */
    await sendEmailVerification(result.user);
    return { ok: true, user: result.user };
  } catch (error) {
    return { ok: false, message: friendly(error) };
  }
}

async function signIn(email, password) {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return { ok: true, user: result.user };
  } catch (error) {
    return { ok: false, message: friendly(error) };
  }
}

async function resetPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: friendly(error) };
  }
}

async function signOutUser() {
  try {
    await signOut(auth);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: friendly(error) };
  }
}

function watchUser(callback) {
  /* Runs callback immediately with the current state, then again
     on every sign-in/sign-out. user is null when signed out.
     This is how pages answer "who is looking at me right now?" */
  return onAuthStateChanged(auth, callback);
}

// ---- expose to regular scripts (onclick handlers etc.) ----
window.CBAuth = { signUp, signIn, resetPassword, signOutUser, watchUser };

/* Pages can listen for this if they need to know the engine is ready */
window.dispatchEvent(new Event("cbauth-ready"));