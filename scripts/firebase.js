// scripts/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

import {
  getDatabase
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-database.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDGWnf6xxDP7OE1o95YIx97Q6TDbxVrgIk",
  authDomain: "ashlyn-autostelle.firebaseapp.com",
  projectId: "ashlyn-autostelle",
  storageBucket: "ashlyn-autostelle.appspot.com",
  messagingSenderId: "963559722963",
  appId: "1:963559722963:web:825ac9a1ac205d7def2926",
  databaseURL: "https://ashlyn-autostelle-default-rtdb.asia-southeast1.firebasedatabase.app"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export auth and database
export const auth = getAuth(app);
export const db = getDatabase(app);

// Monitor auth changes (optional, for redirect or debug)
export function monitorAuth() {
  onAuthStateChanged(auth, (user) => {
    console.log("Auth State Changed:", user);
  });
}
