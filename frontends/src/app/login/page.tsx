"use client";

import React, { useRef, useState, useEffect } from "react";
import { Card, Alert, InputGroup, Container } from "react-bootstrap";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const { login, currentUser } = useAuth();
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const router = useRouter();

  // Redirect to /home if already logged in
  useEffect(() => {
    if (currentUser) {
      router.replace("/home");
    }
  }, [currentUser, router]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!emailRef.current || !passwordRef.current) return;

    try {
      setError("");
      setLoading(true);

      await login(emailRef.current.value, passwordRef.current.value);
      console.log("Login successful");
      router.replace("/home");
    } catch (error: any) {
      console.error("Login failed:", error);
      setError(`Failed to log in: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: "80vh" }}>
      <div className="w-100" style={{ maxWidth: "400px" }}>
        <Card className="shadow">
          <Card.Body>
            <h2 className="text-center mb-4">Log In</h2>
            {error && <Alert variant="danger">{error}</Alert>}
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label htmlFor="email">Email</label>
                <InputGroup>
                  <InputGroup.Text>📧</InputGroup.Text>
                  <input
                    type="email"
                    id="email"
                    ref={emailRef}
                    required
                    placeholder="Enter your email"
                    className="form-control"
                  />
                </InputGroup>
              </div>

              <div className="mb-3">
                <label htmlFor="password">Password</label>
                <InputGroup>
                  <InputGroup.Text>🔒</InputGroup.Text>
                  <input
                    type="password"
                    id="password"
                    ref={passwordRef}
                    required
                    placeholder="Enter your password"
                    className="form-control"
                  />
                </InputGroup>
              </div>

              <button
                disabled={loading}
                className="w-100 btn btn-primary"
                type="submit"
              >
                {loading ? "Logging in..." : "Log In"}
              </button>
            </form>
          </Card.Body>
        </Card>
        <div className="text-center mt-3">
          Need an account? <a href="/signup">Sign Up</a>
        </div>
      </div>
    </Container>
  );
}
