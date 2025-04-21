// src/app/login/page.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { InputText } from 'primereact/inputtext';
import { Password } from 'primereact/password';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { Card } from 'primereact/card';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import '@/styles/Login.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { currentUser, login } = useAuth();
  const router = useRouter();
  const toast = useRef<Toast>(null);

  useEffect(() => {
    // If already logged in, redirect to home
    if (currentUser) {
      router.push('/home');
    }
  }, [currentUser, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Please enter both email and password');
      toast.current?.show({
        severity: 'error',
        summary: 'Login Error',
        detail: 'Please enter both email and password',
        life: 3000
      });
      return;
    }
    
    try {
      setError('');
      setLoading(true);
      
      await login(email, password);
      console.log("Login successful");
      
      toast.current?.show({
        severity: 'success',
        summary: 'Login Successful',
        detail: 'You have been logged in successfully',
        life: 3000
      });
      
      // Redirect to home page
      router.push('/home');
    } catch (err: any) {
      console.error("Login failed:", err);
      
      let errorMessage = 'Failed to log in. Please check your credentials.';
      
      // Get specific Firebase error message
      if (err.code) {
        switch (err.code) {
          case 'auth/user-not-found':
          case 'auth/wrong-password':
            errorMessage = 'Invalid email or password';
            break;
          case 'auth/invalid-email':
            errorMessage = 'Invalid email format';
            break;
          case 'auth/too-many-requests':
            errorMessage = 'Too many failed login attempts. Please try again later.';
            break;
          default:
            errorMessage = `Failed to log in: ${err.message}`;
        }
      }
      
      setError(errorMessage);
      
      toast.current?.show({
        severity: 'error',
        summary: 'Login Failed',
        detail: errorMessage,
        life: 3000
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <Toast ref={toast} position="top-right" />
      
      <Card title="Log In" className="login-card">
        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <span className="p-input-icon-left w-full">
              <i className="pi pi-envelope" />
              <InputText
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full"
                required
              />
            </span>
          </div>
          
          <div className="field">
            <label htmlFor="password">Password</label>
            <span className="p-input-icon-left w-full">
              <i className="pi pi-lock" />
              <Password
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                toggleMask
                feedback={false}
                className="w-full"
                inputClassName="w-full"
                required
              />
            </span>
          </div>
          
          <Button
            type="submit"
            label={loading ? "Logging in..." : "Log In"}
            icon="pi pi-sign-in"
            className="w-full"
            loading={loading}
            disabled={loading}
          />
        </form>
        
        <div className="login-footer">
          <p>Need an account? <Link href="/signup">Sign Up</Link></p>
        </div>
      </Card>
    </div>
  );
}
