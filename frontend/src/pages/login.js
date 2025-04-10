import React, { useRef, useState } from "react";
import { Form, Button, Card, Alert, InputGroup, Container } from "react-bootstrap";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Login() {
    const emailRef = useRef();
    const passwordRef = useRef();
    const { login, currentUser } = useAuth();
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    async function handleSubmit(e) {
        e.preventDefault();
        
        console.log("Login form submitted");
        console.log("Email entered:", emailRef.current.value);
        console.log("Password entered:", passwordRef.current.value);
        
        try {
            setError("");
            setLoading(true);
            console.log("Attempting to log in user...");
            
            const result = await login(emailRef.current.value, passwordRef.current.value);
            console.log("Login successful, result:", result);
            
            // Redirect to home page after successful login
            navigate("/home", { replace: true });
            console.log("Redirecting to home page...");
        } catch (error) {
            console.error("Login failed:", error);
            setError("Failed to log in");
        }

        setLoading(false);
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

