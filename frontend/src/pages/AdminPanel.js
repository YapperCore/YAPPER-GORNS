// frontend/src/pages/AdminPanel.js
import React, { useState, useEffect } from 'react';
import { useApi } from '../util/api';

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [allFiles, setAllFiles] = useState([]);
  const { authGet } = useApi();
  
  useEffect(() => {
    // Fetch all users and files for admin
    const fetchAdminData = async () => {
      try {
        // Get all users (API to be implemented)
        const usersData = await authGet('/api/admin/users');
        setUsers(usersData);
        
        // Get all files
        const filesData = await authGet('/api/firebase/files');
        setAllFiles(filesData.files || []);
      } catch (error) {
        console.error("Error fetching admin data:", error);
      }
    };
    
    fetchAdminData();
  }, []);
  
  return (
    <div className="admin-panel">
      <h2>Admin Panel</h2>
      
      <div className="admin-section">
        <h3>All Users</h3>
        {users.length > 0 ? (
          <table className="admin-table">
            <thead>
              <tr>
                <th>User ID</th>
                <th>Email</th>
                <th>Name</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>{user.email}</td>
                  <td>{user.displayName}</td>
                  <td>{user.isAdmin ? "Admin" : "User"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No users found or still loading...</p>
        )}
      </div>
      
      <div className="admin-section">
        <h3>All Files</h3>
        {allFiles.length > 0 ? (
          <table className="admin-table">
            <thead>
              <tr>
                <th>File Name</th>
                <th>Owner</th>
                <th>Upload Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {allFiles.map(file => (
                <tr key={file.filename}>
                  <td>{file.originalFilename}</td>
                  <td>{file.ownerId}</td>
                  <td>{new Date(file.uploadTime).toLocaleString()}</td>
                  <td>
                    <button>View</button>
                    <button>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No files found or still loading...</p>
        )}
      </div>
    </div>
  );
}
