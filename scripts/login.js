// login.js
import { auth } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  sendEmailVerification,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { showModal, closeModal, initPasswordToggle } from "./ui.js";

// 🔒 Redirect if already logged in and verified
onAuthStateChanged(auth, (user) => {
  if (user && user.emailVerified) {
    window.location.href = "index.html";
  }
});

document.getElementById("closeModal").addEventListener("click", () => closeModal("modal"));
document.addEventListener("DOMContentLoaded", () => {
  initPasswordToggle("password");
});

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  // const captchaResponse = grecaptcha.getResponse();
  // if (!captchaResponse) {
  //   showModal("Please complete the reCAPTCHA.", "orange");
  //   return;
  // }
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    await setPersistence(auth, browserLocalPersistence);
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    if (!user.emailVerified) {
      await sendEmailVerification(user);
      await auth.signOut();
      showModal("Verification email sent. Please check your inbox before logging in again.", "orange");
      return;
    }

    window.location.href = "index.html";

  } catch (error) {
    const messages = {
      "auth/invalid-credential": {
        text: "Invalid email or password.",
        color: "error"
      },
      "auth/invalid-email": {
        text: "Please enter a properly formatted email address.",
        color: "error"
      },
      "auth/network-request-failed": {
        text: "Network error. Please check your internet connection or try disabling ad blockers.",
        color: "error"
      },
      "auth/too-many-requests": {
        text: "Too many failed attempts. Please try again later.",
        color: "error"
      }
    };

    console.warn("Firebase auth error:", error.code);

    const msg = messages[error.code] || {
      text: "Something went wrong. Please try again.",
      color: "red"
    };
    showModal(msg.text, msg.color);
  }
});

document.getElementById('userButton')?.addEventListener('click', () => {
  window.location.href = 'index.html';
});
