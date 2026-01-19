// --- Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyChXMCIpoFDo-O58yt9U2NWLXE_Xa_6ieE",
    authDomain: "juegoabalos.firebaseapp.com",
    projectId: "juegoabalos",
    storageBucket: "juegoabalos.firebasestorage.app",
    messagingSenderId: "145810937746",
    appId: "1:145810937746:web:e39f9405a59eaef37ad34b",
    measurementId: "G-6540CMPYBX"
};

// --- Initialization (Compat Version) ---
// Checks if firebase global exists (loaded via CDN scripts in index.html)
if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();
    const provider = new firebase.auth.GoogleAuthProvider();

    // --- Global API for script.js ---
    window.GameManager = {
        user: null,

        // LOGIN
        loginWithGoogle: () => {
            // Return promise for async/await
            return auth.signInWithPopup(provider)
                .then((result) => {
                    const user = result.user;
                    console.log("Login success:", user.displayName);
                    return user;
                })
                .catch((error) => {
                    console.error("Login failed:", error);
                    alert("Error al iniciar sesión: " + error.message);
                    throw error;
                });
        },

        // LOGOUT
        logout: () => {
            return auth.signOut()
                .then(() => {
                    console.log("Logged out");
                    window.location.reload();
                })
                .catch((error) => console.error("Logout error", error));
        },

        // SAVE SCORE
        saveScore: (score) => {
            const user = auth.currentUser;
            if (!user) return;

            // Add to scores collection
            db.collection("scores").add({
                uid: user.uid,
                name: user.displayName,
                photoURL: user.photoURL,
                score: score,
                date: new Date().toISOString(),
                timestamp: Date.now()
            }).catch(e => console.error("Error adding score: ", e));

            // Update last login
            db.collection("users").doc(user.uid).set({
                displayName: user.displayName,
                photoURL: user.photoURL,
                lastLogin: new Date().toISOString()
            }, { merge: true });
        },

        // UPDATE PERSONAL HIGH SCORE
        updatePersonalHighScore: (newScore) => {
            const user = auth.currentUser;
            if (!user) return;

            const userRef = db.collection("users").doc(user.uid);

            userRef.get().then((docSnap) => {
                let currentHigh = 0;
                if (docSnap.exists) {
                    currentHigh = docSnap.data().highScore || 0;
                }

                if (newScore > currentHigh) {
                    userRef.set({ highScore: newScore }, { merge: true });
                    console.log("New personal high score saved to cloud:", newScore);
                }
            }).catch(e => console.error("Error updating high score:", e));
        },

        // GET LEADERBOARD
        getLeaderboard: () => {
            return db.collection("scores")
                .orderBy("score", "desc")
                .limit(10)
                .get()
                .then((querySnapshot) => {
                    const scores = [];
                    querySnapshot.forEach((doc) => {
                        scores.push(doc.data());
                    });
                    return scores;
                })
                .catch((e) => {
                    console.error("Error fetching leaderboard:", e);
                    return [];
                });
        },

        // SAVE ACHIEVEMENTS
        saveAchievements: (achievementsObj) => {
            const user = auth.currentUser;
            if (!user) return;

            db.collection("users").doc(user.uid).set({ achievements: achievementsObj }, { merge: true })
                .catch(e => console.error("Error saving achievements:", e));
        },

        // LOAD USER DATA
        loadUserData: () => {
            const user = auth.currentUser;
            if (!user) return Promise.resolve(null);

            return db.collection("users").doc(user.uid).get()
                .then((docSnap) => {
                    if (docSnap.exists) {
                        return docSnap.data();
                    }
                    return null;
                })
                .catch(e => {
                    console.error("Error loading user data:", e);
                    return null;
                });
        }
    };

    // --- Auth State Listener ---
    auth.onAuthStateChanged((user) => {
        if (user) {
            window.GameManager.user = user;
            window.dispatchEvent(new CustomEvent('firebase-auth-change', { detail: { user: user } }));
            console.log("Firebase Auth Connect: ", user.email);
        } else {
            window.GameManager.user = null;
            window.dispatchEvent(new CustomEvent('firebase-auth-change', { detail: { user: null } }));
        }
    });

} else {
    console.error("Firebase SDK not loaded! Check internet connection.");
}
