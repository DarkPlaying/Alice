import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Config 2
const firebaseConfig2 = {
    apiKey: import.meta.env.VITE_FIREBASE_SECONDARY_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_SECONDARY_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_SECONDARY_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_SECONDARY_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_SECONDARY_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_SECONDARY_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_SECONDARY_MEASUREMENT_ID
};

const app2 = initializeApp(firebaseConfig2, "secondary");
const db2 = getFirestore(app2);

let analytics = null;
if (typeof window !== 'undefined' && firebaseConfig.measurementId) {
    try {
        analytics = getAnalytics(app);
    } catch (e) {
        console.warn("Analytics failed:", e);
    }
}

// NOTE: Realtime Database (RTDB) has been removed to prevent "Service database is not available" errors.
// All realtime game logic should now use Supabase Realtime (Broadcast/Presence).
export { app, analytics, db, auth, app2, db2 };
