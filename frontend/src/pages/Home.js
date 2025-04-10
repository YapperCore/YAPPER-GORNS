import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import '../static/Home.css';
import Confirmable from '../util/confirmable';
import { Toast } from 'primereact/toast';
import 'primereact/resources/themes/saga-blue/theme.css';
import 'primereact/resources/primereact.min.css';
import { useAuth } from '../context/AuthContext';

function Home() {
  const [file, setFile] = useState(null);
  const [uploadMessage, setUploadMessage] = useState("");
  const [transcripts, setTranscripts] = useState([]);
  const [docs, setDocs] = useState([]); // make sure docs is an array
  const { currentUser } = useAuth();
  const toast = useRef(null);

  useEffect(() => {
    const socket = io();
    socket.on('partial_transcript_batch', data => {
      const lines = data.chunks.map(
        c => `Chunk ${c.chunk_index}/${c.total_chunks}: ${c.text}`
      );
      setTranscripts(prev => [...prev, ...lines]);
    });
    socket.on('final_transcript', data => {
      setTranscripts(prev => [...prev, "Transcription complete."]);
    });

    async function fetchDocs() {
      if (currentUser) {
        try {
          const token = await currentUser.getIdToken();
          const res = await fetch('/api/docs', {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          const d = await res.json();
          // Ensure that docs is an array. If not, log an error and default to [].
          setDocs(Array.isArray(d) ? d : []);
        } catch (err) {
          console.error("Error fetching docs:", err);
          setDocs([]);
        }
      }
    }
    fetchDocs();

    return () => {
      socket.disconnect();
    };
  }, [currentUser]);

  const handleFileChange = e => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) {
      setUploadMessage("No file selected!");
      return;
    }
    try {
      const formData = new FormData();
      formData.append('audio', file);
      const token = await currentUser.getIdToken();
      const res = await fetch('/upload-audio', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        setUploadMessage(data.message || "Upload succeeded");
        if (data.doc_id) {
          window.open(`/transcription/${data.doc_id}`, '_blank');
        }
        const docsRes = await fetch('/api/docs', { 
          headers: { Authorization: `Bearer ${token}` } 
        });
        if (docsRes.ok) {
          const docData = await docsRes.json();
          setDocs(Array.isArray(docData) ? docData : []);
        }
      } else {
        const errData = await res.json();
        setUploadMessage(errData.error || "Upload failed");
      }
    } catch (err) {
      console.error("Upload error:", err);
      setUploadMessage("Upload failed");
    }
  };

  const handleDelete = async (id) => {
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`/api/docs/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setDocs(prev => prev.filter(d => d.id !== id));
      }
    } catch (err) {
      console.error("Error deleting doc:", err);
    }
  };

  return (
    <div className="home-container">
      <Toast ref={toast} position="top-right" />

      <h2>Home - Upload Audio ={'>'} Create Doc</h2>
      <div className="upload-section">
        <input
          type="file"
          onChange={handleFileChange}
          className="file-input"
        />
        <button
          onClick={handleUpload}
          className="upload-button"
        >
          Submit
        </button>
      </div>
      <p className="message">{uploadMessage}</p>

      <hr className="divider" />
      <div>
        <h3>Docs in Session:</h3>
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
                <Confirmable
                  onDelete={() => handleDelete(doc.id)}
                  toast={toast}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <hr className="divider" />
    </div>
  );
}

export default Home;

