<<<<<<< Updated upstream
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase-admin/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyB1J8UFKuJ8S4OxTuKJFAJsozKqe6QVBI8",
  authDomain: "yapper-1958d.firebaseapp.com",
  projectId: "yapper-1958d",
  storageBucket: "yapper-1958d.firebasestorage.app",
  messagingSenderId: "247545046246",
  appId: "1:247545046246:web:98be3dc3dbde53dce5c727",
  measurementId: "G-TREYQ105SE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { auth, app };
=======

import firebase from "firebase/app"
import "firebase/auth"

const app=firebase.initializeApp({
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY, 
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_FIREBASE_APP_ID,
    databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL
})

export const auth=app.auth()
export default app
>>>>>>> Stashed changes
