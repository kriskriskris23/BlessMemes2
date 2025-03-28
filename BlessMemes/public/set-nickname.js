// set-nickname.js
import { firebaseConfig } from './firebase-config.js';
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const nicknameForm = document.getElementById("nickname-form");
const nicknameInput = document.getElementById("nickname-input");
const errorMessage = document.getElementById("error-message");

if (nicknameForm && nicknameInput && errorMessage) {
    onAuthStateChanged(auth, (user) => {
        if (!user) {
            window.location.href = "login.html"; // Redirect if not logged in
            return;
        }

        nicknameForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const nickname = nicknameInput.value.trim();

            if (!nickname) {
                errorMessage.textContent = "Please enter a nickname.";
                return;
            }
            if (nickname.length > 32) {
                errorMessage.textContent = "Nickname must be 32 characters or fewer.";
                return;
            }

            try {
                // Check if nickname is already taken
                const nicknameRef = doc(db, "nicknames", nickname);
                const nicknameSnap = await getDoc(nicknameRef);
                if (nicknameSnap.exists()) {
                    errorMessage.textContent = "This nickname is already taken. Please choose another.";
                    return;
                }

                // Store nickname in nicknames collection
                await setDoc(nicknameRef, {
                    email: user.email,
                    uid: user.uid,
                    createdAt: Date.now()
                });

                // Store nickname reference in users collection
                const userRef = doc(db, "users", user.uid);
                await setDoc(userRef, {
                    email: user.email,
                    nickname: nickname,
                    createdAt: Date.now()
                });

                window.location.href = "index.html"; // Redirect to main page after setting nickname
            } catch (error) {
                errorMessage.textContent = `Failed to save nickname: ${error.message}`;
            }
        });
    });
}