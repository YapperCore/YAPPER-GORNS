"use client";

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from 'primereact/button';

const Navbar = () => {
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
    <nav className="Navbar">
      <h1 className="logo">Yapper</h1>
      
      <ul className="nav-links">
        {currentUser ? (
          <>
            <li><Link href="/home">Home</Link></li>
            <li><Link href="/documents">Documents</Link></li>
            <li><Link href="/settings">Settings</Link></li>
            <li><Link href="/trash">Trash</Link></li>
            <li><Button onClick={handleLogout} className="logout-btn p-button-danger p-button-sm">Logout</Button></li>
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
};

export default Navbar;
