// src/components/Navbar.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Button } from 'primereact/button';
import '@/styles/Navbar.css';

export default function Navbar() {
  const { currentUser, logout } = useAuth();
  const router = useRouter();
  
  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };
  
  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link href={currentUser ? "/home" : "/"}>
          <h1 className="logo">Yapper</h1>
        </Link>
      </div>
      
      <ul className="nav-links">
        {currentUser ? (
          <>
            <li><Link href="/home">Home</Link></li>
            <li><Link href="/trash">Trash</Link></li>
            <li><Link href="/docs">Docs</Link></li>
            <li><Link href="/settings">Settings</Link></li>
            <li>
              <Button 
                label="Logout" 
                icon="pi pi-sign-out" 
                className="p-button-text logout-btn" 
                onClick={handleLogout}
              />
            </li>
          </>
        ) : (
          <>
            <li><Link href="/login">Login</Link></li>
            <li><Link href="/signup">Sign Up</Link></li>
          </>
        )}
      </ul>
    </nav>
  );
}
