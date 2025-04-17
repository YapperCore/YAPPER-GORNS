// frontend/src/components/Navbar/Navbar.js
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Navbar.css';
import { useAuth } from '../../context/AuthContext';

const Navbar = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  
  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
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
            <li><Link to="/home">Home</Link></li>
            <li><Link to="/trash">Trash</Link></li>
            <li><Link to="/docs">Docs</Link></li>
            <li><button onClick={handleLogout} className="logout-btn">Logout</button></li>
          </>
        ) : (
          <>
            <li><Link to="/login">Login</Link></li>
            <li><Link to="/signup">Sign Up</Link></li>
          </>
        )}
      </ul>
    </nav>
  );
};

export default Navbar;
