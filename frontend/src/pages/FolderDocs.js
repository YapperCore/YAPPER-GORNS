import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function FolderDocs() {
  const { folderName } = useParams();
  const { currentUser } = useAuth();
  const [docs, setDocs] = useState([]);

  useEffect(() => {
    async function fetchDocs() {
      if (currentUser) {
        try {
          const token = await currentUser.getIdToken();
          const res = await fetch(`/api/folders/${folderName}`, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          const data = await res.json();
          setDocs(Array.isArray(data) ? data : []);
        } catch (err) {
          console.error("Error fetching folder docs:", err);
          setDocs([]);
        }
      }
    }
    fetchDocs();
  }, [currentUser, folderName]);

  return (
    <div className="home-container">
      <h2>Documents in Folder: {folderName}</h2>
      <div className="docs-grid">
        {docs.map(doc => (
          <div key={doc.id} className="doc-card">
            <h4 className="doc-title">{doc.name}</h4>
            {doc.audioFilename}
          </div>
        ))}
      </div>
    </div>
  );
}
