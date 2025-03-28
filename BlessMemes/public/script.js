// script.js
import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, doc, getDocs, deleteField } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const memeInput = document.getElementById("meme-url");
const updateMemeBtn = document.getElementById("update-meme");
const memesContainer = document.getElementById("memes-container");
const adminBtn = document.getElementById("admin-btn");
const logoutBtn = document.getElementById("logout-btn");
const sortOptions = document.getElementById("sort-options");
const prevPageBtn = document.getElementById("prev-page");
const nextPageBtn = document.getElementById("next-page");
const pageInfo = document.getElementById("page-info");
const prevPageTop = document.getElementById("prev-page-top");
const nextPageTop = document.getElementById("next-page-top");
const pageInfoTop = document.getElementById("page-info-top");
const modeToggleBtn = document.getElementById("mode-toggle");
const bannerImage = document.getElementById("banner-image");
const adminBannerForm = document.getElementById("admin-banner-form");
const bannerInput = document.getElementById("banner-input");
const updateBannerBtn = document.getElementById("update-banner-btn");

const memesCollection = collection(db, "memes");
const usersCollection = collection(db, "users");
const bannerDoc = doc(db, "settings", "banner");
const ADMIN_ID = "adminaccount@gmail.com";

let currentUserEmail = null;
let currentUsername = null;
let currentPage = 1;
const memesPerPage = 10;
const POST_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour in milliseconds
const COMMENT_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes in milliseconds

// Load saved mode from localStorage
const savedMode = localStorage.getItem("theme") || "light";
if (savedMode === "dark") {
    document.body.classList.add("dark-mode");
    if (modeToggleBtn) modeToggleBtn.textContent = "Light Mode";
} else {
    if (modeToggleBtn) modeToggleBtn.textContent = "Dark Mode";
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserEmail = user.email;
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().nickname) {
            currentUsername = userSnap.data().nickname;
        } else {
            window.location.href = "set-nickname.html";
            return;
        }
        console.log("User logged in:", currentUserEmail, "UID:", user.uid, "Nickname:", currentUsername);
        if (currentUserEmail === ADMIN_ID && adminBtn) {
            adminBtn.style.display = "none";
            if (adminBannerForm) adminBannerForm.style.display = "block";
        } else if (adminBtn) {
            adminBtn.style.display = "block";
            if (adminBannerForm) adminBannerForm.style.display = "none";
        }
        renderMemes("latest-uploaded", currentPage); // Re-render after login
    } else {
        currentUserEmail = null;
        currentUsername = null;
        console.log("No user logged in, redirecting to login.html");
        window.location.href = "login.html";
    }
});

// Load banner image from Firestore
onSnapshot(bannerDoc, (docSnap) => {
    if (docSnap.exists() && docSnap.data().imageUrl) {
        if (bannerImage) {
            bannerImage.src = docSnap.data().imageUrl;
            bannerImage.style.display = "block";
        }
    } else {
        if (bannerImage) bannerImage.style.display = "none";
    }
});

// Helper function to get nickname from email
async function getNicknameFromEmail(email) {
    const userQuery = await getDocs(usersCollection);
    for (const docSnap of userQuery.docs) {
        if (docSnap.data().email === email) {
            return docSnap.data().nickname;
        }
    }
    return email;
}

// Helper function to get comment count for a meme
async function getCommentCount(memeId) {
    const commentsCollection = collection(db, "memes", memeId, "comments");
    const commentSnapshot = await getDocs(commentsCollection);
    return commentSnapshot.size;
}

// Function to check if user can post
async function canUserPost(userId) {
    if (currentUserEmail === ADMIN_ID) return true;
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists() || !userSnap.data().lastPostTime) return true;

    const lastPostTime = userSnap.data().lastPostTime;
    const currentTime = Date.now();
    const timeSinceLastPost = currentTime - lastPostTime;
    return timeSinceLastPost >= POST_COOLDOWN_MS;
}

// Function to update last post time
async function updateLastPostTime(userId) {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
        lastPostTime: Date.now()
    });
}

// Function to check if user can comment on a specific meme
async function canUserComment(memeId, userId) {
    if (currentUserEmail === ADMIN_ID) return true;
    const commentTimeRef = doc(db, "memes", memeId, "commentTimes", userId);
    const commentTimeSnap = await getDoc(commentTimeRef);
    if (!commentTimeSnap.exists() || !commentTimeSnap.data().lastCommentTime) return true;

    const lastCommentTime = commentTimeSnap.data().lastCommentTime;
    const currentTime = Date.now();
    const timeSinceLastComment = currentTime - lastCommentTime;
    return timeSinceLastComment >= COMMENT_COOLDOWN_MS;
}

// Function to update last comment time
async function updateLastCommentTime(memeId, userId) {
    const commentTimeRef = doc(db, "memes", memeId, "commentTimes", userId);
    await setDoc(commentTimeRef, {
        lastCommentTime: Date.now()
    });
}

// Function to add or update meme description
async function addDescription(memeId, descriptionText, descriptionInput, descriptionControls) {
    if (!descriptionText.trim()) return;
    try {
        const memeRef = doc(db, "memes", memeId);
        await updateDoc(memeRef, {
            description: descriptionText,
            updatedBy: currentUserEmail,
            updatedAt: Date.now()
        });
        console.log("Description added to meme:", memeId);
        descriptionInput.value = "";
        descriptionControls.style.display = "none";
    } catch (error) {
        console.error("Error adding description:", error);
        alert("Failed to add description: " + error.message);
    }
}

// Function to delete meme description
async function deleteDescription(memeId) {
    try {
        const memeRef = doc(db, "memes", memeId);
        await updateDoc(memeRef, {
            description: deleteField(),
            updatedBy: currentUserEmail,
            updatedAt: Date.now()
        });
        console.log("Description deleted from meme:", memeId);
    } catch (error) {
        console.error("Error deleting description:", error);
        alert("Failed to delete description: " + error.message);
    }
}

function renderMemes(sortBy = "latest-uploaded", page = 1) {
    if (!memesContainer) return;
    memesContainer.innerHTML = "";
    onSnapshot(memesCollection, async (snapshot) => {
        if (!memesContainer) return;
        memesContainer.innerHTML = "";
        let memes = [];
        for (const docSnap of snapshot.docs) {
            const memeData = docSnap.data();
            const memeId = docSnap.id;
            const commentCount = await getCommentCount(memeId);
            memes.push({ id: memeId, ...memeData, commentCount });
        }

        switch (sortBy) {
            case "most-votes":
                memes.sort((a, b) => (b.votes || 0) - (a.votes || 0));
                break;
            case "least-votes":
                memes.sort((a, b) => (a.votes || 0) - (b.votes || 0));
                break;
            case "latest-uploaded":
                memes.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                break;
            case "oldest-uploaded":
                memes.sort((a, b) => (a.timestamp || 0) - (b.votes || 0));
                break;
            case "most-comments":
                memes.sort((a, b) => b.commentCount - a.commentCount);
                break;
            default:
                memes.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        }

        const totalMemes = memes.length;
        const totalPages = Math.ceil(totalMemes / memesPerPage);
        currentPage = Math.max(1, Math.min(page, totalPages));
        const startIndex = (currentPage - 1) * memesPerPage;
        const endIndex = Math.min(startIndex + memesPerPage, totalMemes);
        const paginatedMemes = memes.slice(startIndex, endIndex);

        const paginationContainers = document.querySelectorAll('.pagination-container');
        paginationContainers.forEach(container => {
            container.style.display = totalPages > 1 ? 'flex' : 'none';
        });

        if (pageInfo) pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
        if (pageInfoTop) pageInfoTop.textContent = `Page ${currentPage} of ${totalPages}`;
        if (prevPageBtn) prevPageBtn.disabled = currentPage === 1;
        if (nextPageBtn) nextPageBtn.disabled = currentPage === totalPages;
        if (prevPageTop) prevPageTop.disabled = currentPage === 1;
        if (nextPageTop) nextPageTop.disabled = currentPage === totalPages;

        for (const meme of paginatedMemes) {
            const memeWrapper = document.createElement("div");
            memeWrapper.className = "meme-wrapper";

            const uploaderContainer = document.createElement("div");
            uploaderContainer.className = "uploader-container";

            const uploaderSpan = document.createElement("span");
            uploaderSpan.className = "uploader";
            const uploaderNickname = await getNicknameFromEmail(meme.uploadedBy);
            const uploadDate = meme.timestamp ? new Date(meme.timestamp).toLocaleString() : "Unknown date";
            uploaderSpan.textContent = `Uploaded by: ${uploaderNickname} on ${uploadDate}`;

            uploaderContainer.appendChild(uploaderSpan);

            if (meme.uploadedBy === currentUserEmail || currentUserEmail === ADMIN_ID) {
                const descriptionInput = document.createElement("input");
                descriptionInput.type = "text";
                descriptionInput.placeholder = "Add a short description (max 100 chars)";
                descriptionInput.maxLength = 100;
                descriptionInput.className = "description-input";
                descriptionInput.value = meme.description || "";

                const descriptionBtn = document.createElement("button");
                descriptionBtn.textContent = "Save Description";
                descriptionBtn.className = "description-btn";
                descriptionBtn.onclick = () => addDescription(meme.id, descriptionInput.value, descriptionInput, descriptionControls);

                const descriptionControls = document.createElement("div");
                descriptionControls.className = "description-controls";
                descriptionControls.appendChild(descriptionInput);
                descriptionControls.appendChild(descriptionBtn);

                if (meme.description) {
                    descriptionControls.style.display = "none";
                }

                uploaderContainer.appendChild(descriptionControls);
            }

            memeWrapper.appendChild(uploaderContainer);

            const memeContainer = document.createElement("div");
            memeContainer.className = "meme-container";

            const memeDiv = document.createElement("div");
            memeDiv.className = "meme-item";

            const img = document.createElement("img");
            img.src = meme.url;
            img.alt = "User-uploaded meme";

            const voteCount = document.createElement("span");
            voteCount.textContent = `Ratings: ${meme.votes || 0}`;

            const buttonsDiv = document.createElement("div");
            buttonsDiv.className = "meme-buttons";

            const blessBtn = document.createElement("button");
            blessBtn.className = "bless-btn";
            blessBtn.textContent = "Bless";
            blessBtn.dataset.memeId = meme.id;

            const curseBtn = document.createElement("button");
            curseBtn.className = "curse-btn";
            curseBtn.textContent = "Curse";
            curseBtn.dataset.memeId = meme.id;

            const deleteBtn = document.createElement("button");
            deleteBtn.textContent = "Delete";
            deleteBtn.className = "delete-btn";
            deleteBtn.style.display = (meme.uploadedBy === currentUserEmail || currentUserEmail === ADMIN_ID) ? "inline-block" : "none";
            deleteBtn.onclick = () => deleteMeme(meme.id);

            if (auth.currentUser) {
                const voteRef = doc(db, "memes", meme.id, "votes", auth.currentUser.uid);
                getDoc(voteRef).then((voteSnap) => {
                    const userVote = voteSnap.exists() ? voteSnap.data().vote : null;
                    blessBtn.textContent = userVote === 1 ? "Unbless" : "Bless";
                    curseBtn.textContent = userVote === -1 ? "Uncurse" : "Curse";
                    blessBtn.disabled = userVote === -1;
                    curseBtn.disabled = userVote === 1;
                }).catch((error) => {
                    console.error("Error fetching vote state:", error);
                });
            }

            blessBtn.onclick = () => handleVote(meme.id, 1, blessBtn, curseBtn);
            curseBtn.onclick = () => handleVote(meme.id, -1, curseBtn, blessBtn);

            buttonsDiv.appendChild(blessBtn);
            buttonsDiv.appendChild(curseBtn);
            buttonsDiv.appendChild(deleteBtn);

            memeDiv.appendChild(img);
            memeDiv.appendChild(voteCount);
            memeDiv.appendChild(buttonsDiv);

            const commentSection = document.createElement("div");
            commentSection.className = "comment-section";

            const descriptionDiv = document.createElement("div");
            descriptionDiv.className = "meme-description";
            descriptionDiv.textContent = meme.description || "No description provided.";

            if (meme.description && (meme.uploadedBy === currentUserEmail || currentUserEmail === ADMIN_ID)) {
                const deleteDescriptionBtn = document.createElement("button");
                deleteDescriptionBtn.textContent = "Delete";
                deleteDescriptionBtn.className = "delete-description-btn";
                deleteDescriptionBtn.onclick = () => {
                    deleteDescription(meme.id);
                    const controls = memeWrapper.querySelector('.description-controls');
                    if (controls) controls.style.display = "flex";
                };
                descriptionDiv.appendChild(deleteDescriptionBtn);
            }

            const commentsDiv = document.createElement("div");
            commentsDiv.className = "comments-list";

            const commentInput = document.createElement("input");
            commentInput.type = "text";
            commentInput.placeholder = "Add a comment...";
            commentInput.className = "comment-input";
            commentInput.addEventListener("keypress", (e) => {
                if (e.key === "Enter") {
                    addComment(meme.id, commentInput.value, commentInput);
                }
            });

            const commentBtn = document.createElement("button");
            commentBtn.textContent = "Post";
            commentBtn.className = "comment-btn";
            commentBtn.onclick = () => addComment(meme.id, commentInput.value, commentInput);

            commentSection.appendChild(descriptionDiv);
            commentSection.appendChild(commentsDiv);
            commentSection.appendChild(commentInput);
            commentSection.appendChild(commentBtn);

            memeContainer.appendChild(memeDiv);
            memeContainer.appendChild(commentSection);

            memeWrapper.appendChild(memeContainer);
            memesContainer.appendChild(memeWrapper);

            renderComments(meme.id, commentsDiv);

            const memeHeight = memeDiv.offsetHeight;
            commentSection.style.height = `${memeHeight}px`;
        }
    }, (error) => {
        console.error("Error in memes snapshot:", error);
    });
}

async function handleVote(memeId, voteChange, clickedBtn, otherBtn) {
    if (!auth.currentUser || !auth.currentUser.uid) {
        alert("You must be logged in to vote.");
        return;
    }

    const userId = auth.currentUser.uid;
    console.log("Voting - Meme ID:", memeId, "User ID:", userId, "Vote Change:", voteChange);

    try {
        const memeRef = doc(db, "memes", memeId);
        const voteRef = doc(db, "memes", memeId, "votes", userId);
        const [voteSnap, memeSnap] = await Promise.all([getDoc(voteRef), getDoc(memeRef)]);

        if (!memeSnap.exists()) {
            console.error("Meme does not exist:", memeId);
            return;
        }

        let currentVotes = memeSnap.data().votes || 0;
        console.log("Current votes:", currentVotes);

        if (voteSnap.exists()) {
            const existingVote = voteSnap.data().vote;
            console.log("Existing vote:", existingVote);
            if (existingVote === voteChange) {
                // Delete vote document
                try {
                    await deleteDoc(voteRef);
                    console.log("Vote document deleted successfully");
                } catch (deleteError) {
                    console.error("Failed to delete vote document:", deleteError);
                    throw deleteError; // Re-throw to catch below
                }
                // Update meme votes
                await updateDoc(memeRef, { votes: currentVotes - voteChange });
                clickedBtn.textContent = voteChange > 0 ? "Bless" : "Curse";
                clickedBtn.disabled = false;
                otherBtn.disabled = false;
                console.log(`Cancelled ${voteChange > 0 ? "bless" : "curse"} on meme ${memeId}`);
            }
        } else {
            // Set new vote document
            try {
                await setDoc(voteRef, { vote: voteChange });
                console.log("Vote document set successfully");
            } catch (setError) {
                console.error("Failed to set vote document:", setError);
                throw setError; // Re-throw to catch below
            }
            // Update meme votes
            await updateDoc(memeRef, { votes: currentVotes + voteChange });
            clickedBtn.textContent = voteChange > 0 ? "Unbless" : "Uncurse";
            clickedBtn.disabled = false;
            otherBtn.disabled = true;
            console.log(`Voted ${voteChange > 0 ? "bless" : "curse"} on meme ${memeId}`);
        }
    } catch (error) {
        console.error("Error handling vote:", error);
        if (error.code === "permission-denied") {
            console.log("Permission denied details:", error.message);
            alert("You don’t have permission to fully process this vote. Check Firestore rules. Vote may still be recorded.");
        } else {
            alert("Failed to process vote: " + error.message);
        }
    }
}

async function addComment(memeId, commentText, commentInput) {
    if (!commentText.trim()) return;
    try {
        const userId = auth.currentUser.uid;
        const canComment = await canUserComment(memeId, userId);
        if (!canComment) {
            const commentTimeRef = doc(db, "memes", memeId, "commentTimes", userId);
            const commentTimeSnap = await getDoc(commentTimeRef);
            const lastCommentTime = commentTimeSnap.data().lastCommentTime;
            const timeSinceLastComment = Date.now() - lastCommentTime;
            const timeRemaining = Math.ceil((COMMENT_COOLDOWN_MS - timeSinceLastComment) / (60 * 1000));
            alert(`You can only comment on this meme once every 30 minutes. Please wait ${timeRemaining} minutes.`);
            return;
        }

        const commentsCollection = collection(db, "memes", memeId, "comments");
        await addDoc(commentsCollection, {
            text: commentText,
            nickname: currentUsername,
            timestamp: Date.now()
        });
        await updateLastCommentTime(memeId, userId);
        console.log("Comment added to meme:", memeId);
        commentInput.value = "";
    } catch (error) {
        console.error("Error adding comment:", error);
        if (error.code === "permission-denied") {
            alert("You don’t have permission to comment. Please try again or contact support.");
        } else {
            alert("Failed to add comment: " + error.message);
        }
    }
}

async function deleteComment(memeId, commentId) {
    try {
        const commentRef = doc(db, "memes", memeId, "comments", commentId);
        await deleteDoc(commentRef);
        console.log(`Deleted comment ${commentId} from meme ${memeId}`);
    } catch (error) {
        console.error("Error deleting comment:", error);
        alert("Failed to delete comment: " + error.message);
    }
}

function renderComments(memeId, commentsDiv) {
    const commentsCollection = collection(db, "memes", memeId, "comments");
    onSnapshot(commentsCollection, (snapshot) => {
        commentsDiv.innerHTML = "";
        const comments = [];
        snapshot.forEach((docSnap) => {
            comments.push({ id: docSnap.id, ...docSnap.data() });
        });
        comments.sort((a, b) => a.timestamp - b.timestamp);
        comments.forEach((comment) => {
            const commentWrapper = document.createElement("div");
            commentWrapper.className = "comment-wrapper";

            const commentP = document.createElement("p");
            const date = new Date(comment.timestamp).toLocaleString();
            commentP.textContent = `${comment.nickname}: ${comment.text} (${date})`;

            const deleteCommentBtn = document.createElement("button");
            deleteCommentBtn.textContent = "Delete";
            deleteCommentBtn.className = "delete-comment-btn";
            deleteCommentBtn.style.display = (currentUserEmail === ADMIN_ID) ? "inline-block" : "none";
            deleteCommentBtn.onclick = () => deleteComment(memeId, comment.id);

            commentWrapper.appendChild(commentP);
            commentWrapper.appendChild(deleteCommentBtn);
            commentsDiv.appendChild(commentWrapper);
        });
        commentsDiv.scrollTop = commentsDiv.scrollHeight;
    }, (error) => {
        console.error("Error in comments snapshot:", error);
    });
}

async function deleteMeme(memeId) {
    try {
        const memeRef = doc(db, "memes", memeId);
        await deleteDoc(memeRef);
        console.log(`Deleted meme ${memeId}`);
    } catch (error) {
        console.error("Error deleting meme:", error);
        alert("Failed to delete meme: " + error.message);
    }
}

if (updateMemeBtn && memeInput) {
    updateMemeBtn.addEventListener("click", async () => {
        const newMemeURL = memeInput.value.trim();
        if (!newMemeURL) {
            alert("Please enter a valid image URL!");
            return;
        }
        const allowedExtensions = /\.(jpg|jpeg|png)(\?.*)?$/i;
        if (!allowedExtensions.test(newMemeURL)) {
            alert("Only static images (.jpg, .jpeg, .png) are allowed. No GIFs, videos, or other formats.");
            return;
        }

        try {
            const userId = auth.currentUser.uid;
            const canPost = await canUserPost(userId);
            if (!canPost) {
                const userRef = doc(db, "users", userId);
                const userSnap = await getDoc(userRef);
                const lastPostTime = userSnap.data().lastPostTime;
                const timeSinceLastPost = Date.now() - lastPostTime;
                const timeRemaining = Math.ceil((POST_COOLDOWN_MS - timeSinceLastPost) / (60 * 1000));
                alert(`You can only post one meme per hour. Please wait ${timeRemaining} minutes.`);
                return;
            }

            await addDoc(memesCollection, {
                url: newMemeURL,
                uploadedBy: currentUserEmail,
                nickname: currentUsername,
                timestamp: Date.now(),
                votes: 0
            });
            await updateLastPostTime(userId);
            memeInput.value = "";
            console.log("Meme added successfully");
        } catch (error) {
            console.error("Error adding meme:", error);
            alert("Failed to add meme: " + error.message);
        }
    });
}

if (adminBtn) {
    adminBtn.addEventListener("click", () => {
        window.location.href = "admin-login.html";
    });
}

if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
        try {
            await auth.signOut();
            console.log("Logged out, redirecting to login.html");
            window.location.href = "login.html";
        } catch (error) {
            console.error("Logout error:", error);
        }
    });
}

if (modeToggleBtn) {
    modeToggleBtn.addEventListener("click", () => {
        document.body.classList.toggle("dark-mode");
        const isDarkMode = document.body.classList.contains("dark-mode");
        modeToggleBtn.textContent = isDarkMode ? "Light Mode" : "Dark Mode";
        localStorage.setItem("theme", isDarkMode ? "dark" : "light");
    });
}

if (updateBannerBtn && bannerInput) {
    updateBannerBtn.addEventListener("click", async () => {
        const newBannerImageUrl = bannerInput.value.trim();
        if (newBannerImageUrl) {
            const allowedExtensions = /\.(jpg|jpeg|png|webp)(\?.*)?$/i;
            if (!allowedExtensions.test(newBannerImageUrl)) {
                alert("Only static images (.jpg, .jpeg, .png, .webp) are allowed for the banner.");
                return;
            }
            try {
                await setDoc(bannerDoc, { imageUrl: newBannerImageUrl });
                bannerInput.value = "";
                console.log("Banner image updated successfully");
            } catch (error) {
                console.error("Error updating banner image:", error);
                alert("Failed to update banner image: " + error.message);
            }
        } else {
            alert("Please enter a banner image URL!");
        }
    });
}

if (sortOptions) {
    sortOptions.addEventListener("change", (e) => {
        currentPage = 1;
        renderMemes(e.target.value, currentPage);
    });
}

if (prevPageBtn && nextPageBtn && prevPageTop && nextPageTop) {
    const updatePage = (newPage) => {
        currentPage = newPage;
        renderMemes(sortOptions.value || "latest-uploaded", currentPage);
    };

    prevPageBtn.addEventListener("click", () => {
        if (currentPage > 1) updatePage(currentPage - 1);
    });
    nextPageBtn.addEventListener("click", () => updatePage(currentPage + 1));
    prevPageTop.addEventListener("click", () => {
        if (currentPage > 1) updatePage(currentPage - 1);
    });
    nextPageTop.addEventListener("click", () => updatePage(currentPage + 1));
}