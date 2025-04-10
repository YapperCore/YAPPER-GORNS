// frontend/src/context/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyB1J8UFKuJ8S4OxTuKJFAJsozKqe6QVBI8",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "yapper-1958d.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "yapper-1958d",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "yapper-1958d.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "247545046246",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:247545046246:web:98be3dc3dbde53dce5c727"
};

// Initialize Firebase services
const app = initializeApp(firebaseConfig);

// List of admin user IDs
export const ADMIN_USER_IDS = [
  "fqFmFaVxP9YCbdpCSbxjw9I8UZI2",
  "9I0tKoljp3h97WaPFH1hEsxgPGP2",
  "OK7kfRfp5YOSawBii8RNIP54fgo1",
  "XOW0xzNdu2V39X88TlKrbnkoMOq1"
];

export default app;
