// src/context/AuthContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { initializeApp } from 'firebase/app';

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
};

// Initialize Firebase
const app = typeof window !== 'undefined' ? initializeApp(firebaseConfig) : null;
const auth = typeof window !== 'undefined' ? getAuth(app) : null;

interface AuthContextProps {
  currentUser: User | null;
  loading: boolean;
  isAdmin: boolean;
  signup: (email: string, password: string) => Promise<any>;
  login: (email: string, password: string) => Promise<any>;
  logout: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const router = useRouter();

  // Admin UIDs
  const ADMIN_UIDS = [
    "fqFmFaVxP9YCbdpCSbxjw9I8UZI2",
    "9I0tKoljp3h97WaPFH1hEsxgPGP2",
    "OK7kfRfp5YOSawBii8RNIP54fgo1",
    "XOW0xzNdu2V39X88TlKrbnkoMOq1"
  ];

  function signup(email: string, password: string) {
    if (!auth) throw new Error("Firebase auth not initialized");
    return createUserWithEmailAndPassword(auth, email, password);
  }

  function login(email: string, password: string) {
    if (!auth) throw new Error("Firebase auth not initialized");
    return signInWithEmailAndPassword(auth, email, password);
  }

  async function logout() {
    if (!auth) throw new Error("Firebase auth not initialized");
    await firebaseSignOut(auth);
    router.push('/login');
  }

  async function getIdToken() {
    if (!currentUser) return null;
    try {
      return await currentUser.getIdToken(true);
    } catch (error) {
      console.error("Error getting token:", error);
      return null;
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined' || !auth) return;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsAdmin(user ? ADMIN_UIDS.includes(user.uid) : false);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    loading,
    isAdmin,
    signup,
    login,
    logout,
    getIdToken
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
