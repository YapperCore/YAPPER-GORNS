import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Confirmable from '../util/confirmable';

export default function Docs() {
  const [docs, setDocs] = useState([]);

  useEffect(() => {
    fetch('/api/docs')
      .then(r => r.json())
      .then(data => setDocs(data))
      .catch(err => console.error("Error fetching docs:", err));
  }, []);

  const handleDelete = async (docId) => {
    try {
      const res = await fetch(\`/api/docs/\${docId}\`, { method: 'DELETE' });
      if (res.ok) {
        fetch('/api/docs')
          .then(r => r.json())
          .then(data => setDocs(data))
          .catch(err => console.error("Error fetching docs:", err));
      } else {
        const d = await res.json();
        alert("Error deleting doc: " + (d.message || d.error));
      }
    } catch (err) {
      console.error("Error deleting doc:", err);
    }
  };

  return (
    <div style={{ padding: '1rem' }}>
      <h2>Docs Page</h2>
      <ul>
        {docs.map(doc => (
          <li key={doc.id} style={{ marginBottom: '6px' }}>
            <strong>{doc.name}</strong>
            {doc.audioFilename ? \` (Audio: \${doc.audioFilename}\${doc.audioTrashed ? ' [TRASHED]' : ''})\` : ''}
            &nbsp;|&nbsp;
            <Link to={\`/transcription/\${doc.id}\`} target="_blank" rel="noreferrer">Transcription</Link>
            &nbsp;|&nbsp;
            <Link to={\`/docs/edit/\${doc.id}\`} target="_blank" rel="noreferrer">Edit</Link>
            &nbsp;|&nbsp;
            <Confirmable onDelete={() => handleDelete(doc.id)} />
          </li>
        ))}
      </ul>
    </div>
  );
}
