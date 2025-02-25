import React from 'react';
import { Link } from 'react-router-dom';
import './Navbar.css';

export default function Navbar() {
  return (
    <div className="navbar">
      <div className="brand">Yapper</div>
      <Link to="/">Home</Link>
      <Link to="/docs">Docs</Link>
      <Link to="/trash">Trash</Link>
    </div>
  );
}
