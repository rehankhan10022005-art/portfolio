/**
 * Shared Firebase initialization — imported by index.html, admin-login.html,
 * and admin.html. Uses the Firebase Modular Web SDK (v10) straight from a
 * CDN, so there's no npm install / build step — this works as-is on
 * GitHub Pages or any static host.
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// Public, non-secret config — safe to ship in client code. Firebase projects
// are protected by Firestore Security Rules and Auth, not by hiding this
// object. See firestore.rules in this repo.
const firebaseConfig = {
  apiKey: "AIzaSyBUj-NZE6BSpvFjahyi1nZPmNmsZyQ6DkU",
  authDomain: "portfolio-777a5.firebaseapp.com",
  projectId: "portfolio-777a5",
  storageBucket: "portfolio-777a5.firebasestorage.app",
  messagingSenderId: "55044559165",
  appId: "1:55044559165:web:b8469949bb4848dda9b554",
  measurementId: "G-SEC1485N1F",
};

// The only account allowed to write content. Enforced server-side by
// firestore.rules — this constant is only used client-side to show a clear
// message if a different account somehow ends up signed in.
export const ADMIN_EMAIL = "megatech1978@gmail.com";

// Firestore location where all site content lives as one document.
export const CONTENT_DOC_PATH = ["content", "site"];

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
