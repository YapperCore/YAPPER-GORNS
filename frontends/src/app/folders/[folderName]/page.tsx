import React, { useState, useEffect, JSX } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { User } from 'firebase/auth';

interface Doc {
  id: string;
  name: string;
  audioFilename?: string;
  audioTrashed?: boolean;
}

interface Params {
  folderName?: string;
}

export default function FolderDocs(): JSX.Element {
  const { folderName } = useParams();
  const { currentUser } = useAuth() as { currentUser: User | null };
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDocs() {
      if (currentUser && folderName) {
        setLoading(true);
        try {
          const token = await currentUser.getIdToken();
          const res = await fetch(`/api/folders/${folderName}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          const data = await res.json();
          setDocs(Array.isArray(data) ? data : []);
          setError(null);
        } catch (err) {
          console.error("Error fetching folder docs:", err);
          setError("Failed to load documents.");
          setDocs([]);
        } finally {
          setLoading(false);
        }
      }
    }
    fetchDocs();
  }, [currentUser, folderName]);

  const handleMoveToHome = async (docId: string) => {
    try {
      if (!currentUser) return;
      const token = await currentUser.getIdToken();
      const res = await fetch(`/api/folders/home/add/${docId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errData = await res.json();
        console.error('Error moving document to home:', errData.error);
      } else {
        setDocs((prevDocs) => prevDocs.filter((doc) => doc.id !== docId));
      }
    } catch (err) {
      console.error('Error moving document to home:', err);
    }
  };

  const handleDelete = async (docId: string) => {
    const confirmed = window.confirm("Are you sure you want to delete this document?");
    if (!confirmed) return;

    try {
      if (!currentUser) return;
      const token = await currentUser.getIdToken();
      const res = await fetch(`/api/docs/${docId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        setDocs((prevDocs) => prevDocs.filter((doc) => doc.id !== docId));
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

      {loading && <p>Loading documents...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!loading && docs.length === 0 && <p>No documents found in this folder.</p>}

      <div className="docs-grid">
        {docs.map((doc) => (
          <div key={doc.id} className="doc-card">
            <h4 className="doc-title">{doc.name}</h4>
            {doc.audioFilename && (
              <p className="audio-info">
                Audio: {doc.audioFilename}
                {doc.audioTrashed && ' [TRASHED]'}
              </p>
            )}
            <div className="doc-actions">
              <Link to={`/transcription/${doc.id}`} className="action-link transcription-link">
                View Doc
              </Link>
              <Link to={`/docs/edit/${doc.id}`} className="action-link edit-link">
                Edit Doc
              </Link>
              <button onClick={() => handleDelete(doc.id)} className="action-link delete-link">
                Delete Doc
              </button>
              <button onClick={() => handleMoveToHome(doc.id)} className="action-link move-link orange-button">
                Move to Home
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
