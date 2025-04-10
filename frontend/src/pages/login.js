// frontend/src/pages/login.js
import React, { useRef, useState, useEffect } from "react";
import { Card, Alert, InputGroup, Container } from "react-bootstrap";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Login() {
    const emailRef = useRef();
    const passwordRef = useRef();
    const { login, currentUser } = useAuth();
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    // If user is already logged in, redirect to home
    useEffect(() => {
        if (currentUser) {
            navigate("/home");
        }
    }, [currentUser, navigate]);

    async function handleSubmit(e) {
        e.preventDefault();
        
        try {
            setError("");
            setLoading(true);
            
            const result = await login(emailRef.current.value, passwordRef.current.value);
            console.log("Login successful");
            
            // Redirect to home page after successful login
            navigate("/home", { replace: true });
        } catch (error) {
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

