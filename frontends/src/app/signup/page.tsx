// src/app/signup/page.tsx
'use client';

import React, { useRef, useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Toast } from "primereact/toast";
import { InputText } from "primereact/inputtext";
import { Password } from "primereact/password";
import { Button } from "primereact/button";
import { Card } from "primereact/card";
import { Divider } from "primereact/divider";
import "@/styles/Signup.css";

export default function Signup() {
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const passwordConfirmRef = useRef<HTMLInputElement>(null);
  const { signup, currentUser } = useAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const router = useRouter();
  const toast = useRef<Toast>(null);

  // If already logged in, redirect to home
  useEffect(() => {
    if (currentUser) {
      router.push('/home');
    }
  }, [currentUser, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    // Clear previous errors
    setError('');
    setSuccess(false);
    
    // Validate passwords match
    if (password !== passwordConfirm) {
      setError("Passwords do not match");
      return;
    }
    
    // Validate password strength
    if (password.length < 6) {
      setError("Password should be at least 6 characters");
      return;
    }
    
    try {
      setLoading(true);
      await signup(email, password);
      setSuccess(true);
      
      toast.current?.show({
        severity: 'success',
        summary: 'Account Created',
        detail: 'Your account has been created successfully!',
        life: 3000
      });
      
      // Redirect to home after short delay
      setTimeout(() => {
        router.push('/home');
      }, 1500);
      
    } catch (error: any) {
      console.error("Signup failed:", error);
      
      // Provide user-friendly error messages
      if (error.code === 'auth/email-already-in-use') {
        setError("This email is already registered. Please use a different email or try logging in.");
      } else if (error.code === 'auth/invalid-email') {
        setError("Invalid email address format.");
      } else if (error.code === 'auth/weak-password') {
        setError("Password is too weak. Please use a stronger password.");
      } else {
        setError("Failed to create an account: " + error.message);
      }
      
      toast.current?.show({
        severity: 'error',
        summary: 'Signup Failed',
        detail: error.message,
        life: 3000
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="signup-container">
      <Toast ref={toast} position="top-right" />
      
      <Card className="signup-card">
        <div className="signup-header">
          <h1>Yapper</h1>
          <h2>Sign Up</h2>
        </div>
        
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">Account created successfully! Redirecting...</div>}
        
        <form onSubmit={handleSubmit} className="signup-form">
          <div className="form-field">
            <label htmlFor="email">Email</label>
            <span className="p-input-icon-left">
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

          <div className="form-field">
            <label htmlFor="password">Password</label>
            <Password
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              toggleMask
              placeholder="Enter your password"
              className="w-full"
              required
            />
          </div>
          
          <div className="form-field">
            <label htmlFor="password-confirm">Confirm Password</label>
            <Password
              id="password-confirm"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              toggleMask
              feedback={false}
              placeholder="Confirm your password"
              className="w-full"
              required
            />
          </div>

          <Button 
            type="submit"
            label={loading ? "Creating Account..." : "Sign Up"}
            icon="pi pi-user-plus"
            className="signup-button"
            disabled={loading}
          />
        </form>
        
        <Divider align="center">
          <span className="divider-text">OR</span>
        </Divider>
        
        <div className="signup-links">
          <Link href="/login">Already have an account? Login</Link>
        </div>
      </Card>
    </div>
  );
}
