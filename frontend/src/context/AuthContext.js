// frontend/src/context/AuthContext.js
import React, { useContext, useState, useEffect } from "react";
import { auth, db, ADMIN_USER_IDS } from "./firebase";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  onAuthStateChanged,
  signOut
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";

const AuthContext = React.createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  async function signup(email, password) {
    try {
      setError(null);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Create user document
      await setDoc(doc(db, "users", userCredential.user.uid), {
        email: email,
        isAdmin: false,
        createdAt: new Date().toISOString()
      });
      
      return userCredential;
    } catch (error) {
      setError(error.message);
      throw error;
    }
  }

  async function login(email, password) {
    try {
      setError(null);
      return await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      setError(error.message);
      throw error;
    }
  }

  function logout() {
    setError(null);
    return signOut(auth);
  }

  // Get auth token for API calls
  async function getAuthToken() {
    if (!currentUser) return null;
    
    try {
      return await currentUser.getIdToken(true);
    } catch (error) {
      console.error("Error getting auth token:", error);
      return null;
    }
  }

  // Check if user is admin
  async function checkAdminStatus(user) {
    if (!user) return false;
    
    // Check hardcoded admin list first
    if (ADMIN_USER_IDS.includes(user.uid)) {
      return true;
    }
    
    try {
      // Check Firestore for admin role
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists() && userDoc.data().isAdmin) {
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error checking admin status:", error);
      return false;
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const adminStatus = await checkAdminStatus(user);
        setIsAdmin(adminStatus);
      } else {
        setIsAdmin(false);
      }
      
      setCurrentUser(user);
      setLoading(false);
    });
    
    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    isAdmin,
    error,
    signup,
    login,
    logout,
    getAuthToken
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
