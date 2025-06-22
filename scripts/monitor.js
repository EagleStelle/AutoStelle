import { auth, db } from './firebase.js';
import { ref, onValue } from 'https://www.gstatic.com/firebasejs/11.9.1/firebase-database.js';
import { signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js';

const logoutBtn = document.getElementById('logoutBtn');
const stateEl = document.getElementById('buttonState');

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }

  const buttonRef = ref(db, 'buttonState');
  onValue(buttonRef, (snapshot) => {
    const state = snapshot.val();
    stateEl.innerText = state === 'pressed' ? "🔴 PRESSED" : "⚪ RELEASED";
  }, (error) => {
    console.error("Firebase read failed:", error);
    stateEl.innerText = "❌ Error loading data";
  });
});

logoutBtn.addEventListener('click', () => {
  signOut(auth).then(() => {
    window.location.href = 'index.html';
  }).catch(err => {
    console.error('Logout failed:', err);
  });
});
