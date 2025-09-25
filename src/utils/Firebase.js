import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// --- TEMPORARY HARD-CODED KEYS ---
// This is for debugging only.
const firebaseConfig = {
  apiKey: "AIzaSyA_1rKM9X4p83er-gj9a2_wnmVvsOEb0S0",
  authDomain: "nagar-ani-sih.firebaseapp.com",
  projectId: "nagar-ani-sih",
  storageBucket: "nagar-ani-sih.firebasestorage.app",
  messagingSenderId: "91601128161",
  appId: "1:91601128161:web:b17478e895435475de05a0",
  measurementId: "G-GVS4P9LRK2"
};
// ---------------------------------

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);
export { db, auth, storage };

