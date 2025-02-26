import React from 'react';
import './Navbar.css';

const Navbar = () => {
  return (
    <nav className="Navbar">
      <h1 className="logo">Yapper</h1>
      <ul className="nav-links">
        <li><a href="/">Home</a></li>
        <li><a href="/trash">Trash</a></li>
        <li><a href="/docs">Docs</a></li>
      </ul>
    </nav>
  );
};

export default Navbar;
