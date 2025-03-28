// signup.js
import { firebaseConfig } from './firebase-config.js';
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-app.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const signupForm = document.getElementById("signup-form");
const signupEmail = document.getElementById("signup-email");
const signupPassword = document.getElementById("signup-password");
const errorMessage = document.getElementById("error-message");

if (signupForm && signupEmail && signupPassword && errorMessage) {
    signupForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = signupEmail.value.trim();
        const password = signupPassword.value.trim();

        if (!email || !password) {
            errorMessage.textContent = "Please enter both email and password.";
            return;
        }
        if (password.length < 6) {
            errorMessage.textContent = "Password must be at least 6 characters.";
            return;
        }

        try {
            await createUserWithEmailAndPassword(auth, email, password);
            window.location.href = "set-nickname.html"; // Redirect to set nickname
        } catch (error) {
            errorMessage.textContent = `Sign up failed: ${error.message}`;
        }
    });
}