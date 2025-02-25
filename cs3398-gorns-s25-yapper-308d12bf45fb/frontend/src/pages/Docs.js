import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Confirmable from '../util/confirmable';

/**
 * Lists doc store with ability to "Delete" => doc is removed + audio => trash
 */
export default function Docs() {
  const [docs, setDocs] = useState([]);

  useEffect(() => {
    fetchDocs();
  }, []);

  const fetchDocs = async () => {
    try {
      const res = await fetch('/api/docs');
      if(res.ok) {
        const data = await res.json();
        setDocs(data);
      }
    } catch(err) {
      console.error("Error fetching docs:", err);
    }
  };

  const handleDelete = async (docId) => {
    try {
      const res = await fetch(`/api/docs/${docId}`, { method:'DELETE' });
      if(res.ok) {
        fetchDocs();
      } else {
        const d = await res.json();
        alert("Delete doc error: " + d.message);
      }
    } catch(err) {
      console.error("Delete doc error:", err);
    }
  };

  return (
    <div style={{ padding:'1rem' }}>
      <h2>Docs Page</h2>
      <ul>
        {docs.map(doc => (
          <li key={doc.id} style={{ marginBottom:'6px' }}>
            <b>{doc.name}</b> 
            { doc.audioFilename ? \` (Audio: \${doc.audioFilename}\${doc.audioTrashed?' [TRASHED]':''})\` : '' }
            &nbsp;|&nbsp;
            <Link to={`/transcription/${doc.id}`} target="_blank" rel="noreferrer">Transcription</Link>
            &nbsp;|&nbsp;
            <Link to={`/docs/edit/${doc.id}`} target="_blank" rel="noreferrer">Edit</Link>
            &nbsp;|&nbsp;
            <Confirmable onDelete={() => handleDelete(doc.id)} />
          </li>
        ))}
      </ul>
    </div>
  );
}
