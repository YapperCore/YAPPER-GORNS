"use client";

import React, { useRef, useState, useEffect } from "react";
import { Form, Button, Card, Alert, Container, InputGroup } from "react-bootstrap";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function Signup() {
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const passwordConfirmRef = useRef<HTMLInputElement>(null);
  const { signup, currentUser } = useAuth();
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const router = useRouter();

  useEffect(() => {
    if (currentUser) {
      router.replace("/home");
    }
  }, [currentUser, router]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError("");
    setSuccess(false);

    if (passwordRef.current?.value !== passwordConfirmRef.current?.value) {
      return setError("Passwords do not match");
    }

    if (passwordRef.current?.value.length! < 6) {
      return setError("Password should be at least 6 characters");
    }

    try {
      setLoading(true);
      await signup(emailRef.current!.value, passwordRef.current!.value);
      setSuccess(true);
      setTimeout(() => {
        router.replace("/home");
      }, 1500);
    } catch (error: any) {
      console.error("Signup failed:", error);
      if (error.code === "auth/email-already-in-use") {
        setError("This email is already registered. Please use a different email or try logging in.");
      } else if (error.code === "auth/invalid-email") {
        setError("Invalid email address format.");
      } else if (error.code === "auth/weak-password") {
        setError("Password is too weak. Please use a stronger password.");
      } else {
        setError("Failed to create an account: " + error.message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: "80vh" }}>
      <div className="w-100" style={{ maxWidth: "400px" }}>
        <Card className="shadow">
          <Card.Body>
            <h2 className="text-center mb-4">Sign Up</h2>
            {error && <Alert variant="danger">{error}</Alert>}
            {success && <Alert variant="success">Account created successfully! Redirecting...</Alert>}
            <Form onSubmit={handleSubmit}>
              <Form.Group id="email" className="mb-3">
                <Form.Label>Email</Form.Label>
                <InputGroup>
                  <InputGroup.Text>📧</InputGroup.Text>
                  <Form.Control type="email" ref={emailRef} required />
                </InputGroup>
              </Form.Group>
              <Form.Group id="password" className="mb-3">
                <Form.Label>Password</Form.Label>
                <InputGroup>
                  <InputGroup.Text>🔒</InputGroup.Text>
                  <Form.Control type="password" ref={passwordRef} required />
                </InputGroup>
              </Form.Group>
              <Form.Group id="password-confirm" className="mb-3">
                <Form.Label>Password Confirmation</Form.Label>
                <InputGroup>
                  <InputGroup.Text>🔒</InputGroup.Text>
                  <Form.Control type="password" ref={passwordConfirmRef} required />
                </InputGroup>
              </Form.Group>
              <Button disabled={loading} className="w-100" type="submit">
                {loading ? "Creating Account..." : "Sign Up"}
              </Button>
            </Form>
          </Card.Body>
        </Card>
        <div className="text-center mt-3">
          Already have an account? <a href="/login">Log In</a>
        </div>
      </div>
    </Container>
  );
}
