import React, { useRef, useState } from "react";
import { Form, Button, Card, Alert } from "react-bootstrap";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";


export default function Login() {
    const emailRef = useRef();
    const passwordRef = useRef();
    const { login, currentUser } = useAuth();  // Use login instead of signup
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate(); // Use useNavigate to redirect

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
             navigate ("/home", { replace: true }); // Use navigate to redirect to home page
            console.log("Redirecting to home page...");
        } catch (error) {

            console.error("Login failed:", error);
            setError("Failed to log in");
        }

        setLoading(false);
    }

    return (
        <>
            <Card>
                <Card.Body>
                    <h2 className="text-center mb-4">Log In</h2>
                    {currentUser && currentUser.email}
                    {error && <Alert variant="danger">{error}</Alert>}
                    <Form onSubmit={handleSubmit}>
                        <Form.Group id="email">
                            <Form.Label>Email</Form.Label>
                            <Form.Control type="email" ref={emailRef} required />
                        </Form.Group>
                        <Form.Group id="password">
                            <Form.Label>Password</Form.Label>
                            <Form.Control type="password" ref={passwordRef} required />
                        </Form.Group>
                        <Button disabled={loading} className="w-100 mt-3" type="submit">
                            Log In
                        </Button>
                    </Form>
                </Card.Body>
            </Card>
            <div className="w-100 text-center mt-2">
                Need an account? <a href="/signup">Sign Up</a>
            </div>
        </>
    );
}
