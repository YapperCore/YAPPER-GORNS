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