import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext'; // Import useAuth
import 'bootstrap/dist/css/bootstrap.min.css'; 

export function Navbar() {
  const { currentUser } = useAuth(); // Access currentUser from AuthContext

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
      <div className="container-fluid">
        
        <div className="navbar-brand"></div>

        
        <div className="mx-auto">
          <ul className="navbar-nav">
            <li className="nav-item">
              <Link to="/" className="nav-link">Login</Link>
            </li>
            <li className="nav-item">
              <Link to="/home" className="nav-link">Home</Link>
            </li>
            <li className="nav-item">
              <Link to="/trash" className="nav-link">Trash</Link>
            </li>
          </ul>
        </div>

        
        <div className="navbar-text">
          {currentUser && currentUser.email} 
        </div>
      </div>
    </nav>
  );
}
export default Navbar;