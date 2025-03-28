// admin-login.js
import { firebaseConfig } from './firebase-config.js';
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-app.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const ADMIN_ID = "adminaccount@gmail.com"; // Your admin email

const adminLoginBtn = document.getElementById("admin-login-btn");
const adminEmail = document.getElementById("admin-email");
const adminPassword = document.getElementById("admin-password");
const errorMessage = document.getElementById("error-message");

if (adminLoginBtn && adminEmail && adminPassword && errorMessage) {
    adminLoginBtn.addEventListener("click", async (event) => {
        event.preventDefault();
        const email = adminEmail.value.trim();
        const password = adminPassword.value.trim();

        console.log("Admin login attempt with email:", email);

        if (!email || !password) {
            errorMessage.textContent = "Please enter both email and password.";
            return;
        }

        try {
            await signInWithEmailAndPassword(auth, email, password);
            if (email === ADMIN_ID) {
                console.log("Admin login successful, redirecting to index.html");
                alert("Admin login successful!");
                window.location.href = "index.html"; // Redirect to Bless Memes page
            } else {
                errorMessage.textContent = "This account is not an admin.";
                await auth.signOut();
                console.log("Non-admin account, signed out");
            }
        } catch (error) {
            console.error("Login error:", error);
            errorMessage.textContent = `🔥 Login failed: ${error.message}`;
        }
    });
} else {
    console.error("Admin login elements not found:", {
        btn: !!adminLoginBtn,
        email: !!adminEmail,
        password: !!adminPassword,
        error: !!errorMessage
    });
}