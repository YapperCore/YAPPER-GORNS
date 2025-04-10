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
            console.log("Login successful, result:", result);
            
            // Redirect to home page after successful login
            navigate("/home", { replace: true });
            console.log("Redirecting to home page...");
        } catch (error) {
            console.error("Login failed:", error);
            setError(`Failed to log in: ${error.message}`);
        } finally {
            setLoading(false);
        }
    }

    return (
        <Container className="d-flex justify-content-center align-items-center vh-100">
            <div className="w-100" style={{ maxWidth: "400px" }}>
                <Card className="shadow-lg">
                    <Card.Body>
                        <h2 className="text-center mb-4">Log In</h2>
                        {error && <Alert variant="danger">{error}</Alert>}
                        <Form onSubmit={handleSubmit}>
                            <Form.Group id="email" className="mb-3">
                                <Form.Label>Email</Form.Label>
                                <InputGroup>
                                    <InputGroup.Text>📧</InputGroup.Text>
                                    <Form.Control type="email" ref={emailRef} required placeholder="Enter your email" />
                                </InputGroup>
                            </Form.Group>

                            <Form.Group id="password" className="mb-3">
                                <Form.Label>Password</Form.Label>
                                <InputGroup>
                                    <InputGroup.Text>🔒</InputGroup.Text>
                                    <Form.Control type="password" ref={passwordRef} required placeholder="Enter your password" />
                                </InputGroup>
                            </Form.Group>

                            <Button disabled={loading} className="w-100" variant="primary" type="submit">
                                Log In
                            </Button>
                        </Form>
                    </Card.Body>
                </Card>
                <div className="text-center mt-3">
                    Need an account? <a href="/signup">Sign Up</a>
                </div>
            </div>
        </Container>
    );
}

