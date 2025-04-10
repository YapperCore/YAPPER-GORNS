// frontend/src/pages/Home.js
import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import '../static/Home.css';
import Confirmable from '../util/confirmable';
import { Toast } from 'primereact/toast';
import 'primereact/resources/themes/saga-blue/theme.css';
import 'primereact/resources/primereact.min.css';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../util/api'; // Corrected import path

function Home() {
  const [file, setFile] = useState(null);
  const [uploadMessage, setUploadMessage] = useState("");
  const [transcripts, setTranscripts] = useState([]);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(false);

  const { currentUser } = useAuth();
  const api = useApi();
  const toast = useRef(null);

  useEffect(() => {
    // Setup Socket.IO connection
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

    // Fetch documents
    fetchDocs();

    return () => {
      socket.disconnect();
    };
  }, []);

  const fetchDocs = async () => {
    try {
      setLoading(true);
      const data = await api.get('/api/docs');
      setDocs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching docs:", err);
      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to load documents'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = e => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) {
      setUploadMessage("No file selected!");
      return;
    }

    try {
      setLoading(true);
      setUploadMessage("Uploading...");

      const data = await api.uploadFile('/upload-audio', file);

      setUploadMessage(data.message || "Upload succeeded");

      // Open transcription in new tab
      if (data.doc_id) {
        window.open(`/transcription/${data.doc_id}`, '_blank');
      }

      // Refresh document list
      fetchDocs();

    } catch (err) {
      console.error("Upload error:", err);
      setUploadMessage(err.message || "Upload failed");
      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: err.message || 'Failed to upload file'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      setLoading(true);
      await api.delete(`/api/docs/${id}`);

      setDocs(prev => prev.filter(d => d.id !== id));

      toast.current?.show({
        severity: 'success',
        summary: 'Success',
        detail: 'Document deleted successfully'
      });
    } catch (err) {
      console.error("Error deleting doc:", err);
      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: err.message || 'Failed to delete document'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="home-container">
      <Toast ref={toast} position="top-right" />

      <h2>Upload Audio &rarr; Create Document</h2>

      <div className="upload-section">
        <input
          type="file"
          onChange={handleFileChange}
          className="file-input"
          accept="audio/*"
          disabled={loading}
        />
        <button
          onClick={handleUpload}
          className="upload-button"
          disabled={loading || !file}
        >
          {loading ? "Processing..." : "Submit"}
        </button>
      </div>

      {uploadMessage && <p className="message">{uploadMessage}</p>}

      <hr className="divider" />

      <div>
        <h3>Your Documents:</h3>

        {loading ? (
          <p>Loading documents...</p>
        ) : docs.length > 0 ? (
          <div className="docs-grid">
            {docs.map(doc => (
              <div key={doc.id} className="doc-card">
                <h4 className="doc-title">{doc.name}</h4>
                {doc.audioFilename && (
                  <p className="audio-info">
                    Audio: {doc.originalFilename || doc.audioFilename}
                    {doc.audioTrashed && ' [TRASHED]'}
                  </p>
                )}

                <div className="doc-actions">
                  
                    href={`/transcription/${doc.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="action-link transcription-link"
                  >
                    View Doc
                  </a>
                  
                    href={`/docs/edit/${doc.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="action-link edit-link"
                  >
                    Edit Doc
                  </a>
                  <span className="action-wrapper">
                    <Confirmable
                      onDelete={() => handleDelete(doc.id)}
                      toast={toast}
                    />
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p>No documents found. Upload an audio file to get started!</p>
        )}
      </div>
    </div>
  );
}

export default Home;
