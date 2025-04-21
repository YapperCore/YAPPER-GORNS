import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function FolderDocs() {
  const { folderName } = useParams();
  const { currentUser } = useAuth();
  const [docs, setDocs] = useState([]);
  const [showOverlay, setShowOverlay] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState([]);

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

  const handleMoveToHome = async (docId) => {
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`/api/folders/home/add/${docId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const errData = await res.json();
        console.error('Error moving document to home:', errData.error);
      } else {
        setDocs(prevDocs => prevDocs.filter(doc => doc.id !== docId)); // Remove the doc from the folder page
      }
    } catch (err) {
      console.error('Error moving document to home:', err);
    }
  };

  const handleDelete = async (docId) => {
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`/api/docs/${docId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (res.ok) {
        setDocs(prevDocs => prevDocs.filter(doc => doc.id !== docId)); // Remove the deleted doc from the state
      } else {
        const errData = await res.json();
        console.error('Error deleting document:', errData.error);
      }
    } catch (err) {
      console.error('Error deleting document:', err);
    }
  };

  return (
    <div className="home-container">
      <h2>Documents in Folder: {folderName}</h2>
      <div className="docs-grid">
        {docs.map(doc => (
          <div key={doc.id} className="doc-card">
            <h4 className="doc-title">{doc.name}</h4>
            {doc.audioFilename && (
              <p className="audio-info">
                Audio: {doc.audioFilename}
                {doc.audioTrashed && ' [TRASHED]'}
              </p>
            )}
            <div className="doc-actions">
              <a
                href={`/transcription/${doc.id}`}
                rel="noreferrer"
                className="action-link transcription-link"
              >
                View Doc
              </a>
              <a
                href={`/docs/edit/${doc.id}`}
                rel="noreferrer"
                className="action-link edit-link"
              >
                Edit Doc
              </a>
              <button
                onClick={() => handleDelete(doc.id)}
                className="action-link delete-link"
              >
                Delete Doc
              </button>
              <button
                onClick={() => handleMoveToHome(doc.id)}
                className="action-link move-link orange-button"
              >
                Move to Home
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
